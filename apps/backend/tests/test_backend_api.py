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


def test_permission_matrix_and_permission_enforcement(client: TestClient):
    headers = auth_headers(client)

    matrix_response = client.get("/api/v1/auth/permission-matrix", headers=headers)
    assert matrix_response.status_code == 200, matrix_response.text
    assert "assets:*" in {item["key"] for item in matrix_response.json()["permissions"]}
    assert "platform" in {item["key"] for item in matrix_response.json()["menus"]}

    from app.db.session import SessionLocal
    from app.models.entities import Role

    with SessionLocal() as db:
        role = Role(
            name="asset-manager",
            description="资产管理测试角色",
            permissions=["assets:*"],
            menu_items=["assets"],
        )
        db.add(role)
        db.commit()
        role_id = role.id

    user_response = client.post(
        "/api/v1/auth/users",
        headers=headers,
        json={
            "username": "asset-manager",
            "password": "asset123456",
            "full_name": "资产管理员",
            "role_id": role_id,
            "is_active": True,
        },
    )
    assert user_response.status_code == 200, user_response.text
    assert user_response.json()["menu_items"] == ["assets"]

    login_response = client.post("/api/v1/auth/login", json={"username": "asset-manager", "password": "asset123456"})
    assert login_response.status_code == 200, login_response.text
    asset_headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}

    create_asset_response = client.post(
        "/api/v1/assets",
        headers=asset_headers,
        json={
            "name": "RBAC-CSW-01",
            "asset_type": "CSW",
            "vendor": "Huawei",
            "status": "active",
            "owner": "rbac-team",
            "scenario": "permission-check",
        },
    )
    assert create_asset_response.status_code == 200, create_asset_response.text

    role_update_response = client.patch(
        f"/api/v1/auth/roles/{role_id}",
        headers=headers,
        json={"permissions": ["assets:read"], "menu_items": ["assets"]},
    )
    assert role_update_response.status_code == 200, role_update_response.text
    assert role_update_response.json()["permissions"] == ["assets:read"]

    denied_response = client.post(
        "/api/v1/assets",
        headers=asset_headers,
        json={
            "name": "RBAC-CSW-02",
            "asset_type": "CSW",
            "vendor": "Huawei",
            "status": "active",
            "owner": "rbac-team",
            "scenario": "permission-check",
        },
    )
    assert denied_response.status_code == 403

    inactive_response = client.patch(
        f"/api/v1/auth/users/{user_response.json()['id']}",
        headers=headers,
        json={"is_active": False},
    )
    assert inactive_response.status_code == 200, inactive_response.text
    blocked_login = client.post("/api/v1/auth/login", json={"username": "asset-manager", "password": "asset123456"})
    assert blocked_login.status_code == 401


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

    search_response = client.get(
        f"/api/v1/configs/normalized/search?asset_id={asset_id}&keyword=permit&section=keywords",
        headers=headers,
    )
    assert search_response.status_code == 200, search_response.text
    search_result = search_response.json()
    assert search_result["total"] == 1
    assert search_result["items"][0]["asset_name"] == "CSW-SZ-01"
    assert search_result["items"][0]["filename"] == "config.txt"
    assert "keywords" in search_result["items"][0]["matched_sections"]

    ai_response = client.get(f"/api/v1/configs/{config_id}/ai-summaries", headers=headers)
    assert ai_response.status_code == 200, ai_response.text
    assert ai_response.json()[0]["review_status"] == "pending_review"


def test_asset_filters_soft_delete_and_bulk_upload(client: TestClient):
    headers = auth_headers(client)
    active_asset = client.post(
        "/api/v1/assets",
        headers=headers,
        json={
            "name": "FORMAL-CSW-01",
            "asset_type": "CSW",
            "vendor": "Huawei",
            "status": "active",
            "owner": "ops-team",
            "scenario": "formalization",
        },
    )
    assert active_asset.status_code == 200, active_asset.text
    retired_asset = client.post(
        "/api/v1/assets",
        headers=headers,
        json={
            "name": "FORMAL-OMFW-01",
            "asset_type": "OMFW",
            "vendor": "Huawei",
            "status": "retired",
            "owner": "security-team",
            "scenario": "formalization",
        },
    )
    assert retired_asset.status_code == 200, retired_asset.text

    filtered = client.get("/api/v1/assets?asset_type=CSW&status=active", headers=headers)
    assert filtered.status_code == 200, filtered.text
    assert filtered.json()["total"] == 1
    assert filtered.json()["items"][0]["name"] == "FORMAL-CSW-01"

    bulk_response = client.post(
        "/api/v1/configs/bulk-upload",
        headers=headers,
        data={"asset_id": active_asset.json()["id"], "source": "manual"},
        files=[
            ("uploads", ("formal-v1.cfg", b"sysname formal-csw-01\ninterface ge0/0/1", "text/plain")),
            ("uploads", ("formal-v2.cfg", b"sysname formal-csw-01\ninterface ge0/0/1\npermit ip any any", "text/plain")),
        ],
    )
    assert bulk_response.status_code == 200, bulk_response.text
    uploaded = bulk_response.json()
    assert [item["version"] for item in uploaded] == [1, 2]
    assert all(item["processing_status"] == "queued" for item in uploaded)

    delete_response = client.delete(f"/api/v1/assets/{retired_asset.json()['id']}", headers=headers)
    assert delete_response.status_code == 200, delete_response.text
    assert delete_response.json()["status"] == "deleted"
    listed = client.get("/api/v1/assets?include_deleted=false", headers=headers)
    assert all(item["status"] != "deleted" for item in listed.json()["items"])
    listed_with_deleted = client.get("/api/v1/assets?include_deleted=true&status=deleted", headers=headers)
    assert listed_with_deleted.status_code == 200
    assert listed_with_deleted.json()["total"] == 1


def test_rule_version_history(client: TestClient):
    headers = auth_headers(client)
    rule_response = client.post(
        "/api/v1/rules",
        headers=headers,
        json={
            "name": "版本化规则",
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

    update_response = client.patch(
        f"/api/v1/rules/{rule_id}",
        headers=headers,
        json={"version": "v2", "risk_level": "critical", "definition": {"must_not_have_any_any": True, "deny_telnet": True}},
    )
    assert update_response.status_code == 200, update_response.text

    versions_response = client.get(f"/api/v1/rules/{rule_id}/versions", headers=headers)
    assert versions_response.status_code == 200, versions_response.text
    versions = versions_response.json()
    assert [item["version"] for item in versions] == ["v2", "v1"]
    assert versions[0]["snapshot"]["risk_level"] == "critical"
    assert versions[1]["snapshot"]["risk_level"] == "high"

    diff_response = client.get(
        f"/api/v1/rules/{rule_id}/versions/diff?base_version_id={versions[1]['id']}&compare_version_id={versions[0]['id']}",
        headers=headers,
    )
    assert diff_response.status_code == 200, diff_response.text
    diff = diff_response.json()
    assert diff["changed_count"] >= 2
    changed_fields = {item["field"] for item in diff["changes"]}
    assert {"version", "risk_level", "definition"} <= changed_fields

    rollback_response = client.post(
        f"/api/v1/rules/{rule_id}/versions/{versions[1]['id']}/rollback",
        headers=headers,
        json={"version": "v3-rollback"},
    )
    assert rollback_response.status_code == 200, rollback_response.text
    rollback_rule = rollback_response.json()
    assert rollback_rule["version"] == "v3-rollback"
    assert rollback_rule["risk_level"] == "high"
    assert rollback_rule["definition"] == {"must_not_have_any_any": True}

    rollback_versions_response = client.get(f"/api/v1/rules/{rule_id}/versions", headers=headers)
    assert rollback_versions_response.status_code == 200, rollback_versions_response.text
    rollback_versions = rollback_versions_response.json()
    assert rollback_versions[0]["version"] == "v3-rollback"
    assert rollback_versions[0]["snapshot"]["risk_level"] == "high"


def test_ticket_review_flow(client: TestClient):
    headers = auth_headers(client)
    asset_response = client.post(
        "/api/v1/assets",
        headers=headers,
        json={
            "name": "REVIEW-CSW-01",
            "asset_type": "CSW",
            "vendor": "Huawei",
            "status": "active",
            "owner": "ops-team",
            "scenario": "ticket-review",
        },
    )
    rule_response = client.post(
        "/api/v1/rules",
        headers=headers,
        json={
            "name": "复核规则",
            "category": "firewall",
            "version": "v1",
            "risk_level": "high",
            "status": "active",
            "scope": "CSW",
            "definition": {"must_not_have_any_any": True},
        },
    )
    inspection_response = client.post(
        "/api/v1/inspections",
        headers=headers,
        json={
            "name": "review-run",
            "trigger_type": "manual",
            "rule_set_id": rule_response.json()["id"],
            "asset_scope": [asset_response.json()["id"]],
        },
    )

    from app.db.session import SessionLocal
    from app.models.entities import Finding

    with SessionLocal() as db:
        finding = Finding(
            inspection_run_id=inspection_response.json()["id"],
            asset_id=asset_response.json()["id"],
            rule_set_id=rule_response.json()["id"],
            title="复核问题",
            severity="high",
            status="open",
            evidence={"line": "permit ip any any"},
            recommendation="收敛访问范围。",
        )
        db.add(finding)
        db.commit()
        finding_id = finding.id

    ticket_response = client.post(
        "/api/v1/tickets",
        headers=headers,
        json={"finding_id": finding_id, "assignee": "operator-a"},
    )
    assert ticket_response.status_code == 200, ticket_response.text
    ticket_id = ticket_response.json()["id"]

    attachment_response = client.post(
        f"/api/v1/tickets/{ticket_id}/attachments",
        headers=headers,
        files={"upload": ("evidence.txt", b"before: permit ip any any\nafter: deny unsafe any-any", "text/plain")},
    )
    assert attachment_response.status_code == 200, attachment_response.text
    attachment = attachment_response.json()
    assert attachment["filename"] == "evidence.txt"
    assert attachment["size_bytes"] > 0

    attachments_response = client.get(f"/api/v1/tickets/{ticket_id}/attachments", headers=headers)
    assert attachments_response.status_code == 200, attachments_response.text
    assert attachments_response.json()[0]["id"] == attachment["id"]

    download_response = client.get(
        f"/api/v1/tickets/{ticket_id}/attachments/{attachment['id']}/download",
        headers=headers,
    )
    assert download_response.status_code == 200, download_response.text
    assert b"deny unsafe any-any" in download_response.content

    reminder_response = client.post(
        f"/api/v1/tickets/{ticket_id}/reminders",
        headers=headers,
        json={"message": "请在今日内补充整改截图。", "reminded_to": "operator-a"},
    )
    assert reminder_response.status_code == 200, reminder_response.text
    assert reminder_response.json()["reminded_to"] == "operator-a"

    reminders_response = client.get(f"/api/v1/tickets/{ticket_id}/reminders", headers=headers)
    assert reminders_response.status_code == 200, reminders_response.text
    assert reminders_response.json()[0]["message"] == "请在今日内补充整改截图。"

    log_response = client.post(
        "/api/v1/log-clues/import",
        headers=headers,
        json=[
            {
                "source": "syslog",
                "severity": "high",
                "keyword": "any-any",
                "message": "问题命中前后均有敏感放通日志。",
                "resource_type": "finding",
                "resource_id": finding_id,
                "details": {"line": "permit ip any any"},
            },
            {
                "source": "soc",
                "severity": "medium",
                "keyword": "remediation",
                "message": "工单催办后补充了整改证据。",
                "resource_type": "ticket",
                "resource_id": ticket_id,
                "details": {"operator": "operator-a"},
            },
            {
                "source": "asset-log",
                "severity": "low",
                "keyword": "csw",
                "message": "对象侧采集到策略变更事件。",
                "resource_type": "asset",
                "resource_id": asset_response.json()["id"],
                "details": {"asset_type": "CSW"},
            },
        ],
    )
    assert log_response.status_code == 200, log_response.text
    assert len(log_response.json()) == 3

    filtered_logs_response = client.get(
        f"/api/v1/log-clues?resource_type=finding&resource_id={finding_id}",
        headers=headers,
    )
    assert filtered_logs_response.status_code == 200, filtered_logs_response.text
    assert filtered_logs_response.json()[0]["resource_type"] == "finding"

    finding_logs_response = client.get(f"/api/v1/findings/{finding_id}/log-clues", headers=headers)
    assert finding_logs_response.status_code == 200, finding_logs_response.text
    assert {item["resource_type"] for item in finding_logs_response.json()} >= {"finding", "ticket", "asset"}

    ticket_logs_response = client.get(f"/api/v1/tickets/{ticket_id}/log-clues", headers=headers)
    assert ticket_logs_response.status_code == 200, ticket_logs_response.text
    assert {item["resource_type"] for item in ticket_logs_response.json()} >= {"finding", "ticket", "asset"}

    topic_response = client.get(
        (
            "/api/v1/findings/topic-view"
            f"?rule_set_id={rule_response.json()['id']}&asset_type=CSW&owner=ops-team&severity=high"
        ),
        headers=headers,
    )
    assert topic_response.status_code == 200, topic_response.text
    topic = topic_response.json()
    assert topic["total"] == 1
    assert topic["items"][0]["finding_id"] == finding_id
    assert topic["items"][0]["asset_type"] == "CSW"
    assert topic["items"][0]["owner"] == "ops-team"
    assert topic["items"][0]["ticket_id"] == ticket_id
    assert topic["items"][0]["log_clue_count"] == 3

    submit_response = client.post(
        f"/api/v1/tickets/{ticket_id}/submit-review",
        headers=headers,
        json={"resolution_note": "已删除 any-any 放通策略。"},
    )
    assert submit_response.status_code == 200, submit_response.text
    assert submit_response.json()["status"] == "pending_review"
    assert submit_response.json()["review_status"] == "pending_review"

    reject_response = client.post(
        f"/api/v1/tickets/{ticket_id}/review/reject",
        headers=headers,
        json={"comment": "缺少变更截图，请补充证据。"},
    )
    assert reject_response.status_code == 200, reject_response.text
    assert reject_response.json()["status"] == "in_progress"
    assert reject_response.json()["review_status"] == "rejected"

    client.post(
        f"/api/v1/tickets/{ticket_id}/submit-review",
        headers=headers,
        json={"resolution_note": "已补充变更截图。"},
    )
    approve_response = client.post(
        f"/api/v1/tickets/{ticket_id}/review/approve",
        headers=headers,
        json={"comment": "复核通过。"},
    )
    assert approve_response.status_code == 200, approve_response.text
    assert approve_response.json()["status"] == "closed"
    assert approve_response.json()["review_status"] == "approved"

    metrics_response = client.get("/api/v1/system/dashboard-metrics", headers=headers)
    assert metrics_response.status_code == 200, metrics_response.text
    metrics = metrics_response.json()
    assert metrics["coverage"]["asset_total"] >= 1
    assert metrics["rectification"]["rectification_rate"] == 100
    assert metrics["pilot_effect"]["inspection_total"] >= 1

    audit_response = client.get("/api/v1/audit?page_size=100", headers=headers)
    assert audit_response.status_code == 200, audit_response.text
    actions = {item["action"] for item in audit_response.json()["items"]}
    assert {
        "ticket.attachment_upload",
        "ticket.attachment_download",
        "ticket.reminder_create",
        "log_clue.search",
        "finding.log_clue_trace",
        "ticket.log_clue_trace",
        "finding.topic_search",
    } <= actions


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


def test_platform_gap_features(client: TestClient):
    headers = auth_headers(client)

    roles_response = client.get("/api/v1/auth/roles", headers=headers)
    assert roles_response.status_code == 200, roles_response.text
    admin_role = next(role for role in roles_response.json() if role["name"] == "admin")
    assert "platform" in admin_role["menu_items"]

    user_response = client.post(
        "/api/v1/auth/users",
        headers=headers,
        json={
            "username": "ops-user",
            "password": "ops123456",
            "full_name": "运维用户",
            "role_id": admin_role["id"],
            "is_active": True,
        },
    )
    assert user_response.status_code == 200, user_response.text
    assert user_response.json()["role_name"] == "admin"

    ledger_response = client.post(
        "/api/v1/ledgers/import",
        headers=headers,
        json={
            "catalog_type": "account",
            "source": "mock-import",
            "items": [
                {
                    "name": "NOC-ADMIN",
                    "status": "active",
                    "version": "v1",
                    "owner": "ops",
                    "content": {"username": "NOC-ADMIN", "role": "admin", "login_type": "local"},
                }
            ],
        },
    )
    assert ledger_response.status_code == 200, ledger_response.text
    assert ledger_response.json()["accepted_count"] == 1
    assert ledger_response.json()["rejected_count"] == 0
    assert ledger_response.json()["imported_items"][0]["catalog_type"] == "account"
    listed_ledgers = client.get("/api/v1/ledgers?catalog_type=account", headers=headers)
    assert listed_ledgers.status_code == 200
    assert listed_ledgers.json()["total"] == 1

    invalid_ledger_response = client.post(
        "/api/v1/ledgers/import",
        headers=headers,
        json={
            "catalog_type": "strategy",
            "source": "mock-import",
            "items": [{"name": "BROKEN-STRATEGY", "content": {"policy_id": "P-001"}}],
        },
    )
    assert invalid_ledger_response.status_code == 200, invalid_ledger_response.text
    invalid_result = invalid_ledger_response.json()
    assert invalid_result["accepted_count"] == 0
    assert invalid_result["rejected_count"] == 1
    assert {error["field"] for error in invalid_result["errors"]} >= {"content.source", "content.destination", "content.action"}

    asset_response = client.post(
        "/api/v1/assets",
        headers=headers,
        json={
            "name": "DIFF-CSW-01",
            "asset_type": "CSW",
            "vendor": "Huawei",
            "status": "active",
            "owner": "ops-team",
            "scenario": "diff-check",
        },
    )
    asset_id = asset_response.json()["id"]
    first_upload = client.post(
        "/api/v1/configs/upload",
        headers=headers,
        data={"asset_id": asset_id, "source": "manual"},
        files={"upload": ("v1.cfg", b"hostname diff-csw-01\ninterface ge0/0/1", "text/plain")},
    )
    second_upload = client.post(
        "/api/v1/configs/upload",
        headers=headers,
        data={"asset_id": asset_id, "source": "manual"},
        files={"upload": ("v2.cfg", b"hostname diff-csw-01\ninterface ge0/0/1\npermit ip any any", "text/plain")},
    )
    diff_response = client.get(
        f"/api/v1/configs/diff?base_config_id={first_upload.json()['id']}&compare_config_id={second_upload.json()['id']}",
        headers=headers,
    )
    assert diff_response.status_code == 200, diff_response.text
    assert "permit ip any any" in diff_response.json()["added"]

    schedule_response = client.post(
        "/api/v1/scheduled-tasks",
        headers=headers,
        json={
            "name": "同步账号台账",
            "task_type": "base_data_sync",
            "enabled": True,
            "interval_minutes": 60,
            "payload": {
                "collector_type": "mock",
                "catalog_type": "account",
                "items": [{"name": "AUTO-NOC", "content": {"username": "AUTO-NOC", "role": "operator"}}],
            },
            "next_run_at": datetime.now(UTC).isoformat(),
        },
    )
    assert schedule_response.status_code == 200, schedule_response.text
    trigger_response = client.post(f"/api/v1/scheduled-tasks/{schedule_response.json()['id']}/trigger", headers=headers)
    assert trigger_response.status_code == 200, trigger_response.text
    assert trigger_response.json()["job_type"] == "run_scheduled_task"
    update_schedule_response = client.patch(
        f"/api/v1/scheduled-tasks/{schedule_response.json()['id']}",
        headers=headers,
        json={"enabled": False},
    )
    assert update_schedule_response.status_code == 200, update_schedule_response.text
    assert update_schedule_response.json()["enabled"] is False
    schedule_logs_response = client.get(
        f"/api/v1/scheduled-tasks/{schedule_response.json()['id']}/execution-logs",
        headers=headers,
    )
    assert schedule_logs_response.status_code == 200, schedule_logs_response.text
    assert {"scheduled_task.create", "scheduled_task.trigger", "scheduled_task.update"} <= {
        item["action"] for item in schedule_logs_response.json()
    }

    assignment_rule_response = client.post(
        "/api/v1/rules",
        headers=headers,
        json={
            "name": "周期责任分派规则",
            "category": "firewall",
            "version": "v1",
            "risk_level": "high",
            "status": "active",
            "scope": "CSW",
            "definition": {"must_not_have_any_any": True},
        },
    )
    assert assignment_rule_response.status_code == 200, assignment_rule_response.text
    invalid_periodic_response = client.post(
        "/api/v1/scheduled-tasks",
        headers=headers,
        json={"name": "无效周期巡检", "task_type": "periodic_inspection", "enabled": True, "interval_minutes": 60, "payload": {}},
    )
    assert invalid_periodic_response.status_code == 400
    periodic_schedule_response = client.post(
        "/api/v1/scheduled-tasks",
        headers=headers,
        json={
            "name": "周期巡检责任分派",
            "task_type": "periodic_inspection",
            "enabled": True,
            "interval_minutes": 60,
            "payload": {"rule_set_id": assignment_rule_response.json()["id"], "asset_scope": [asset_id]},
            "next_run_at": datetime.now(UTC).isoformat(),
        },
    )
    assert periodic_schedule_response.status_code == 200, periodic_schedule_response.text
    inspection_assignment_response = client.post(
        "/api/v1/inspections",
        headers=headers,
        json={
            "name": "责任分派巡检",
            "trigger_type": "manual",
            "rule_set_id": assignment_rule_response.json()["id"],
            "asset_scope": [asset_id],
        },
    )
    assert inspection_assignment_response.status_code == 200, inspection_assignment_response.text
    assignment_summary = inspection_assignment_response.json()["assignment_summary"]
    assert assignment_summary[0]["asset_name"] == "DIFF-CSW-01"
    assert assignment_summary[0]["owner"] == "ops-team"

    notification_response = client.post(
        "/api/v1/notifications",
        headers=headers,
        json={"title": "测试提醒", "message": "配置变化需要复核", "level": "warning"},
    )
    assert notification_response.status_code == 200, notification_response.text
    unread_count_response = client.get("/api/v1/notifications/unread-count", headers=headers)
    assert unread_count_response.status_code == 200, unread_count_response.text
    assert unread_count_response.json()["unread_count"] >= 1
    read_response = client.post(f"/api/v1/notifications/{notification_response.json()['id']}/read", headers=headers)
    assert read_response.status_code == 200
    assert read_response.json()["status"] == "read"
    second_notification_response = client.post(
        "/api/v1/notifications",
        headers=headers,
        json={"title": "批量已读提醒", "message": "验证全部已读", "level": "info"},
    )
    assert second_notification_response.status_code == 200, second_notification_response.text
    read_all_response = client.post("/api/v1/notifications/read-all", headers=headers)
    assert read_all_response.status_code == 200, read_all_response.text
    assert read_all_response.json()["marked_count"] >= 1
    assert read_all_response.json()["unread_count"] == 0

    log_response = client.post(
        "/api/v1/log-clues/import",
        headers=headers,
        json=[
            {
                "source": "syslog",
                "severity": "high",
                "keyword": "permit any",
                "message": "敏感放通策略被命中",
                "resource_type": "asset",
                "resource_id": asset_id,
                "details": {"line": "permit ip any any"},
            }
        ],
    )
    assert log_response.status_code == 200, log_response.text
    assert log_response.json()[0]["resource_id"] == asset_id

    template_response = client.post(
        "/api/v1/report-templates",
        headers=headers,
        json={
            "name": "巡检摘要模板",
            "template_type": "inspection_summary",
            "version": "v1",
            "status": "active",
            "body": "报告 {{report_id}} 共发现 {{finding_total}} 项问题。",
            "variables": {"report_id": "报告任务ID"},
        },
    )
    assert template_response.status_code == 200, template_response.text
    template_id = template_response.json()["id"]
    template_update_response = client.patch(
        f"/api/v1/report-templates/{template_id}",
        headers=headers,
        json={"version": "v2", "body": "正式模板 {{report_id}}，问题总数 {{finding_total}}。"},
    )
    assert template_update_response.status_code == 200, template_update_response.text
    assert template_update_response.json()["version"] == "v2"
    report_with_template_response = client.post(
        "/api/v1/reports",
        headers=headers,
        json={
            "report_type": "inspection_summary",
            "template_id": template_id,
            "parameters": {"finding_list_limit": 5},
        },
    )
    assert report_with_template_response.status_code == 200, report_with_template_response.text
    template_delete_response = client.delete(f"/api/v1/report-templates/{template_id}", headers=headers)
    assert template_delete_response.status_code == 200, template_delete_response.text
    assert template_delete_response.json()["status"] == "deleted"
    invalid_report_response = client.post(
        "/api/v1/reports",
        headers=headers,
        json={"report_type": "inspection_summary", "template_id": template_id},
    )
    assert invalid_report_response.status_code == 400
    parameter_response = client.post(
        "/api/v1/system-parameters",
        headers=headers,
        json={
            "key": "risk.levels",
            "value": {"levels": ["critical", "high", "medium", "low"]},
            "category": "risk",
            "description": "风险等级",
        },
    )
    assert parameter_response.status_code == 200, parameter_response.text
    assert parameter_response.json()["category"] == "risk"

    from app.db.session import SessionLocal
    from app.models.entities import AiAnalysisJob, JobQueue

    with SessionLocal() as db:
        ai_job = AiAnalysisJob(
            target_type="config_file",
            target_id=second_upload.json()["id"],
            analysis_type="config_parse_summary",
            status="completed",
            review_status="pending_review",
            summary="待复核摘要",
            details={},
            completed_at=datetime.now(UTC),
        )
        failed_job = JobQueue(
            job_type="parse_config",
            payload={"config_file_id": second_upload.json()["id"], "asset_id": asset_id},
            status="failed",
            attempts=1,
            last_error="mock failure",
        )
        db.add(ai_job)
        db.add(failed_job)
        db.commit()
        ai_job_id = ai_job.id
        failed_job_id = failed_job.id

    review_response = client.post(
        f"/api/v1/ai-analysis/{ai_job_id}/review",
        headers=headers,
        json={"review_status": "approved", "comment": "可以用于报告草稿"},
    )
    assert review_response.status_code == 200, review_response.text
    assert review_response.json()["review_status"] == "approved"

    retry_response = client.post(f"/api/v1/jobs/{failed_job_id}/retry", headers=headers)
    assert retry_response.status_code == 200, retry_response.text
    assert retry_response.json()["status"] == "pending"
    assert retry_response.json()["last_error"] is None
