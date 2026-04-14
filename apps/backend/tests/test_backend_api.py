from __future__ import annotations

import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


@pytest.fixture()
def client(tmp_path, monkeypatch):
    database_url = f"sqlite+pysqlite:///{(tmp_path / 'backend.db').as_posix()}"
    uploads_dir = tmp_path / "uploads"
    uploads_dir.mkdir()

    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("STORAGE_UPLOADS_PATH", str(uploads_dir))
    monkeypatch.setenv("BACKEND_BOOTSTRAP_ADMIN_USERNAME", "admin")
    monkeypatch.setenv("BACKEND_BOOTSTRAP_ADMIN_PASSWORD", "admin123")

    from app.core.config import get_settings
    from app.db.session import configure_database
    from app.main import create_app

    get_settings.cache_clear()
    configure_database(database_url)

    with TestClient(create_app()) as test_client:
        yield test_client


def auth_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_auth_login_and_me(client: TestClient):
    headers = auth_headers(client)
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["username"] == "admin"


def test_config_processing_result_endpoints(client: TestClient):
    headers = auth_headers(client)
    asset_response = client.post(
        "/api/v1/assets",
        headers=headers,
        json={
            "name": "CSW-SZ-01",
            "asset_type": "CSW",
            "vendor": "Huawei",
            "status": "active",
            "owner": "ops-team",
            "scenario": "monthly-check",
        },
    )
    assert asset_response.status_code == 200, asset_response.text
    asset_id = asset_response.json()["id"]

    upload_response = client.post(
        "/api/v1/configs/upload",
        headers=headers,
        data={"asset_id": asset_id, "source": "manual"},
        files={"upload": ("config.txt", b"hostname csw-sz-01\ninterface ge0/0/1\npermit ip any any", "text/plain")},
    )
    assert upload_response.status_code == 200, upload_response.text
    config_id = upload_response.json()["id"]

    from app.db.session import SessionLocal
    from app.models.entities import AiAnalysisJob, ConfigFile, NormalizedConfig, ParseRun

    with SessionLocal() as db:
        config_file = db.get(ConfigFile, config_id)
        config_file.processing_status = "parsed"
        db.add(config_file)
        db.add(
            ParseRun(
                config_file_id=config_id,
                asset_id=asset_id,
                status="completed",
                parser_name="huawei-csw-line-parser",
                line_count=3,
                warning_count=0,
                summary={"hostname": "csw-sz-01"},
                completed_at=datetime.now(UTC),
            )
        )
        db.add(
            NormalizedConfig(
                config_file_id=config_id,
                asset_id=asset_id,
                config_version=1,
                hostname="csw-sz-01",
                interface_count=1,
                summary={"line_preview": ["hostname csw-sz-01"]},
                indicators={"has_any_any_rule": True, "keywords": ["permit", "ip", "any"]},
            )
        )
        db.add(
            AiAnalysisJob(
                target_type="config_file",
                target_id=config_id,
                analysis_type="config_parse_summary",
                status="completed",
                review_status="pending_review",
                summary="AI draft config summary.",
                details={"interface_count": 1},
                completed_at=datetime.now(UTC),
            )
        )
        db.commit()

    parse_runs_response = client.get(f"/api/v1/configs/{config_id}/parse-runs", headers=headers)
    assert parse_runs_response.status_code == 200, parse_runs_response.text
    assert parse_runs_response.json()[0]["status"] == "completed"

    normalized_response = client.get(f"/api/v1/configs/{config_id}/normalized", headers=headers)
    assert normalized_response.status_code == 200, normalized_response.text
    assert normalized_response.json()[0]["hostname"] == "csw-sz-01"

    ai_response = client.get(f"/api/v1/configs/{config_id}/ai-summaries", headers=headers)
    assert ai_response.status_code == 200, ai_response.text
    assert ai_response.json()[0]["review_status"] == "pending_review"


def test_inspection_and_report_result_endpoints(client: TestClient):
    headers = auth_headers(client)

    asset_response = client.post(
        "/api/v1/assets",
        headers=headers,
        json={
            "name": "OMFW-SZ-01",
            "asset_type": "OMFW",
            "vendor": "H3C",
            "status": "active",
            "owner": "security-team",
            "scenario": "audit",
        },
    )
    asset_id = asset_response.json()["id"]

    rule_response = client.post(
        "/api/v1/rules",
        headers=headers,
        json={
            "name": "default-firewall-check",
            "category": "firewall",
            "version": "v1",
            "risk_level": "high",
            "status": "active",
            "scope": "OMFW",
            "definition": {"must_not_have_any_any": True},
        },
    )
    assert rule_response.status_code == 200, rule_response.text
    rule_id = rule_response.json()["id"]

    inspection_response = client.post(
        "/api/v1/inspections",
        headers=headers,
        json={
            "name": "audit-run-001",
            "trigger_type": "manual",
            "rule_set_id": rule_id,
            "asset_scope": [asset_id],
        },
    )
    assert inspection_response.status_code == 200, inspection_response.text
    inspection_id = inspection_response.json()["id"]

    from app.db.session import SessionLocal
    from app.models.entities import AiAnalysisJob, Finding, ReportArtifact, RuleRunResult

    with SessionLocal() as db:
        finding = Finding(
            inspection_run_id=inspection_id,
            asset_id=asset_id,
            rule_set_id=rule_id,
            title="Any-Any Rule",
            severity="high",
            status="open",
            evidence={"rule": "permit ip any any"},
            recommendation="Restrict source and destination ranges.",
        )
        db.add(finding)
        db.flush()
        finding_id = finding.id

        db.add(
            RuleRunResult(
                inspection_run_id=inspection_id,
                asset_id=asset_id,
                rule_set_id=rule_id,
                status="completed",
                matched=True,
                severity="high",
                summary="Any-any rule matched.",
                details={"failed_checks": [{"name": "must_not_have_any_any"}]},
            )
        )
        db.add(
            AiAnalysisJob(
                target_type="inspection_run",
                target_id=inspection_id,
                analysis_type="inspection_findings_summary",
                status="completed",
                review_status="pending_review",
                summary="AI draft inspection summary.",
                details={"finding_total": 1},
                completed_at=datetime.now(UTC),
            )
        )
        db.commit()

    ticket_response = client.post(
        "/api/v1/tickets",
        headers=headers,
        json={"finding_id": finding_id, "assignee": "alice", "due_at": (datetime.now(UTC) + timedelta(days=2)).isoformat()},
    )
    assert ticket_response.status_code == 200, ticket_response.text
    ticket_id = ticket_response.json()["id"]

    exception_response = client.post(
        "/api/v1/exceptions",
        headers=headers,
        json={
            "ticket_id": ticket_id,
            "reason": "Waiting for the maintenance window before remediation.",
            "expires_at": (datetime.now(UTC) + timedelta(days=30)).isoformat(),
        },
    )
    assert exception_response.status_code == 200, exception_response.text
    exception_id = exception_response.json()["id"]

    approve_response = client.post(
        f"/api/v1/exceptions/{exception_id}/approve",
        headers=headers,
        json={"comment": "Approved until the next maintenance cycle."},
    )
    assert approve_response.status_code == 200, approve_response.text
    assert approve_response.json()["status"] == "approved"

    report_response = client.post(
        "/api/v1/reports",
        headers=headers,
        json={"report_type": "inspection_summary"},
    )
    assert report_response.status_code == 200, report_response.text
    report_id = report_response.json()["id"]

    from app.models.entities import ReportJob

    artifact_file = BACKEND_ROOT / "tests" / "report-artifact-test.txt"
    artifact_file.write_text("inspection summary", encoding="utf-8")

    with SessionLocal() as db:
        report = db.get(ReportJob, report_id)
        report.status = "completed"
        report.file_path = "/tmp/inspection-summary.md"
        report.completed_at = datetime.now(UTC)
        db.add(report)
        db.add(
            ReportArtifact(
                report_job_id=report_id,
                artifact_type="markdown",
                file_path=str(artifact_file.resolve()),
                artifact_metadata={"finding_total": 1},
            )
        )
        db.add(
            AiAnalysisJob(
                target_type="report_job",
                target_id=report_id,
                analysis_type="report_digest",
                status="completed",
                review_status="pending_review",
                summary="AI draft report summary.",
                details={"artifact_type": "markdown"},
                completed_at=datetime.now(UTC),
            )
        )
        db.commit()

    rule_results_response = client.get(f"/api/v1/inspections/{inspection_id}/rule-results", headers=headers)
    assert rule_results_response.status_code == 200, rule_results_response.text
    assert rule_results_response.json()[0]["matched"] is True

    inspection_ai_response = client.get(f"/api/v1/inspections/{inspection_id}/ai-summaries", headers=headers)
    assert inspection_ai_response.status_code == 200, inspection_ai_response.text
    assert inspection_ai_response.json()[0]["analysis_type"] == "inspection_findings_summary"

    report_artifacts_response = client.get(f"/api/v1/reports/{report_id}/artifacts", headers=headers)
    assert report_artifacts_response.status_code == 200, report_artifacts_response.text
    assert report_artifacts_response.json()[0]["artifact_type"] == "markdown"

    artifact_id = report_artifacts_response.json()[0]["id"]
    download_response = client.get(
        f"/api/v1/reports/{report_id}/artifacts/{artifact_id}/download",
        headers=headers,
    )
    assert download_response.status_code == 200, download_response.text
    assert download_response.content == b"inspection summary"
    assert "report-artifact-test.txt" in download_response.headers["content-disposition"]
    artifact_file.unlink(missing_ok=True)

    report_ai_response = client.get(f"/api/v1/reports/{report_id}/ai-summaries", headers=headers)
    assert report_ai_response.status_code == 200, report_ai_response.text
    assert report_ai_response.json()[0]["review_status"] == "pending_review"

    audit_response = client.get("/api/v1/audit", headers=headers)
    assert audit_response.status_code == 200, audit_response.text
    assert audit_response.json()["total"] >= 4
