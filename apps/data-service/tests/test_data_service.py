from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

DATA_SERVICE_ROOT = Path(__file__).resolve().parents[1]
if str(DATA_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(DATA_SERVICE_ROOT))


@pytest.fixture()
def client(tmp_path, monkeypatch):
    database_url = f"sqlite+pysqlite:///{(tmp_path / 'data-service.db').as_posix()}"
    exports_dir = tmp_path / "exports"
    exports_dir.mkdir()

    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("DATA_SERVICE_ENABLE_BACKGROUND_WORKER", "false")
    monkeypatch.setenv("STORAGE_EXPORTS_PATH", str(exports_dir))

    from app.core.config import get_settings
    from app.db.session import configure_database
    from app.main import app

    get_settings.cache_clear()
    configure_database(database_url)

    with TestClient(app) as test_client:
        yield test_client


def test_health_and_full_job_pipeline(client: TestClient, tmp_path):
    health_response = client.get("/internal/health")
    assert health_response.status_code == 200

    from app.db.domain_models import AiAnalysisJob, Asset, ConfigFile, Finding, InspectionRun, NormalizedConfig, ParseRun, ReportArtifact, ReportJob, RuleSet
    from app.db.session import SessionLocal
    from app.jobs.models import JobQueue

    config_path = tmp_path / "sample-config.txt"
    config_path.write_text(
        "\n".join(
            [
                "hostname omfw-sz-01",
                "interface ge0/0/1",
                "permit ip any any",
            ]
        ),
        encoding="utf-8",
    )

    with SessionLocal() as db:
        asset = Asset(
            name="OMFW-SZ-01",
            asset_type="OMFW",
            vendor="H3C",
            status="active",
            owner="security-team",
            scenario="audit",
        )
        db.add(asset)
        db.flush()

        config_file = ConfigFile(
            asset_id=asset.id,
            filename="sample-config.txt",
            storage_path=str(config_path),
            version=1,
            checksum="checksum",
            source="manual",
            uploaded_by_id="system-admin",
            processing_status="queued",
        )
        db.add(config_file)

        rule_set = RuleSet(
            name="default-firewall-check",
            category="firewall",
            version="v1",
            risk_level="high",
            status="active",
            scope="OMFW",
            definition={"must_not_have_any_any": True},
        )
        db.add(rule_set)
        db.flush()

        inspection = InspectionRun(
            name="inspection-001",
            trigger_type="manual",
            rule_set_id=rule_set.id,
            requested_by_id="system-admin",
            status="queued",
            asset_scope=[asset.id],
        )
        report_job = ReportJob(
            report_type="inspection_summary",
            status="queued",
            requested_by_id="system-admin",
        )
        db.add(inspection)
        db.add(report_job)
        db.flush()

        db.add(JobQueue(job_type="parse_config", payload={"config_file_id": config_file.id, "asset_id": asset.id}))
        db.commit()

        config_id = config_file.id
        inspection_id = inspection.id
        report_id = report_job.id

    parse_response = client.post("/internal/queue/run-next")
    assert parse_response.status_code == 200, parse_response.text
    assert parse_response.json()["status"] == "completed"
    assert parse_response.json()["job_type"] == "parse_config"

    config_ai_response = client.post("/internal/queue/run-next")
    assert config_ai_response.status_code == 200, config_ai_response.text
    assert config_ai_response.json()["job_type"] == "generate_ai_summary"

    with SessionLocal() as db:
        config_file = db.get(ConfigFile, config_id)
        assert config_file.processing_status == "parsed"
        assert db.query(ParseRun).filter(ParseRun.config_file_id == config_id).count() == 1
        normalized = db.query(NormalizedConfig).filter(NormalizedConfig.config_file_id == config_id).one()
        assert normalized.indicators["has_any_any_rule"] is True
        config_ai_job = (
            db.query(AiAnalysisJob)
            .filter(AiAnalysisJob.target_type == "config_file", AiAnalysisJob.target_id == config_id)
            .one()
        )
        assert config_ai_job.status == "completed"
        assert "AI 草稿" in (config_ai_job.summary or "")

        db.add(JobQueue(job_type="run_inspection", payload={"inspection_run_id": inspection_id}))
        db.commit()

    inspection_response = client.post("/internal/queue/run-next")
    assert inspection_response.status_code == 200, inspection_response.text
    assert inspection_response.json()["job_type"] == "run_inspection"
    assert inspection_response.json()["finding_count"] == 1

    inspection_ai_response = client.post("/internal/queue/run-next")
    assert inspection_ai_response.status_code == 200, inspection_ai_response.text
    assert inspection_ai_response.json()["job_type"] == "generate_ai_summary"

    with SessionLocal() as db:
        inspection = db.get(InspectionRun, inspection_id)
        assert inspection.status == "completed"
        assert db.query(Finding).filter(Finding.inspection_run_id == inspection_id).count() == 1
        inspection_ai_job = (
            db.query(AiAnalysisJob)
            .filter(AiAnalysisJob.target_type == "inspection_run", AiAnalysisJob.target_id == inspection_id)
            .one()
        )
        assert inspection_ai_job.review_status == "pending_review"

        db.add(JobQueue(job_type="generate_report", payload={"report_job_id": report_id}))
        db.commit()

    report_response = client.post("/internal/queue/run-next")
    assert report_response.status_code == 200, report_response.text
    assert report_response.json()["job_type"] == "generate_report"

    report_ai_response = client.post("/internal/queue/run-next")
    assert report_ai_response.status_code == 200, report_ai_response.text
    assert report_ai_response.json()["job_type"] == "generate_ai_summary"

    with SessionLocal() as db:
        report_job = db.get(ReportJob, report_id)
        assert report_job.status == "completed"
        artifact = db.query(ReportArtifact).filter(ReportArtifact.report_job_id == report_id).one()
        assert Path(artifact.file_path).exists()
        assert artifact.artifact_metadata["metrics"]["finding_total"] == 1
        report_ai_job = (
            db.query(AiAnalysisJob)
            .filter(AiAnalysisJob.target_type == "report_job", AiAnalysisJob.target_id == report_id)
            .one()
        )
        assert report_ai_job.status == "completed"

    stats_response = client.get("/internal/queue/stats")
    assert stats_response.status_code == 200
    assert stats_response.json()["completed"] == 6
