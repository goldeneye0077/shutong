from __future__ import annotations

import json
import sys
from pathlib import Path
from zipfile import ZipFile

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


def test_parser_adapter_matrix():
    from app.parsers.network import parse_config_text

    fixture_dir = DATA_SERVICE_ROOT / "tests" / "fixtures"
    cases = [
        ("CSW", "Huawei", "csw-sample.cfg", "csw-core-switch-parser", "core-switch", {"TELNET_ENABLED", "DEFAULT_SNMP_COMMUNITY"}),
        ("BSW", "Huawei", "bsw-sample.cfg", "bsw-business-switch-parser", "business-switch", {"DEFAULT_SNMP_COMMUNITY"}),
        ("OMSW", "Huawei", "omsw-sample.cfg", "omsw-operation-switch-parser", "operation-switch", {"PASSWORD_MARKER"}),
        ("OMFW", "Huawei", "omfw-sample.cfg", "huawei-firewall-policy-parser", "firewall", {"ANY_ANY_POLICY", "PASSWORD_MARKER"}),
    ]

    for asset_type, vendor, filename, parser_name, parser_family, warning_codes in cases:
        parsed = parse_config_text((fixture_dir / filename).read_text(encoding="utf-8"), asset_type=asset_type, vendor=vendor)
        assert parsed["parser_name"] == parser_name
        assert parsed["summary"]["parser_family"] == parser_family
        assert parsed["hostname"]
        assert parsed["indicators"]["interface_names"]
        assert set(parsed["indicators"]["warning_codes"]) == warning_codes
        assert parsed["summary"]["warnings"]
        for warning in parsed["summary"]["warnings"]:
            assert {"line_no", "code", "message", "line"} <= set(warning)

    fallback = parse_config_text("hostname UNKNOWN-01\ninterface eth0", asset_type="UNKNOWN", vendor="Acme")
    assert fallback["parser_name"] == "generic-network-line-parser"
    assert fallback["summary"]["parser_family"] == "generic"


def test_health_and_full_job_pipeline(client: TestClient, tmp_path):
    health_response = client.get("/internal/health")
    assert health_response.status_code == 200

    from app.db.domain_models import (
        AiAnalysisJob,
        Asset,
        ConfigFile,
        Finding,
        InspectionRun,
        LedgerItem,
        NormalizedConfig,
        Notification,
        ParseRun,
        ReportArtifact,
        ReportJob,
        ReportTemplate,
        RuleSet,
        ScheduledTask,
        SystemParameter,
    )
    from app.db.session import SessionLocal
    from app.jobs.models import JobQueue

    config_path = tmp_path / "sample-config.txt"
    config_path.write_text(
        "\n".join(
            [
                "hostname omfw-sz-01",
                "local-user admin password irreversible-cipher mock-hash",
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
        template = ReportTemplate(
            name="inspection-template",
            template_type="inspection_summary",
            version="v1",
            status="active",
            body="模板报告 {{report_id}}：当前发现 {{finding_total}} 项问题。",
            variables={"finding_total": "问题数量"},
            created_by_id="system-admin",
        )
        db.add(inspection)
        db.add(report_job)
        db.add(template)
        db.add(
            SystemParameter(
                key="report.settings",
                category="report",
                value={
                    "finding_list_limit": 100,
                    "include_closed_findings": True,
                    "package_include_evidence_manifest": True,
                },
                description="报告生成默认参数",
                updated_by_id="system-admin",
            )
        )
        db.add(
            SystemParameter(
                key="risk.levels",
                category="risk",
                value={"labels": {"critical": "严重", "high": "高危", "medium": "中危", "low": "低危"}},
                description="风险等级中文标签",
                updated_by_id="system-admin",
            )
        )
        db.flush()

        db.add(JobQueue(job_type="parse_config", payload={"config_file_id": config_file.id, "asset_id": asset.id}))
        db.commit()

        config_id = config_file.id
        inspection_id = inspection.id
        report_id = report_job.id
        template_id = template.id

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
        parse_run = db.query(ParseRun).filter(ParseRun.config_file_id == config_id).one()
        assert parse_run.parser_name == "h3c-firewall-policy-parser"
        assert parse_run.warning_count == 2
        assert parse_run.summary["warnings"][0]["line_no"] == 2
        assert parse_run.summary["warnings"][0]["code"] == "PASSWORD_MARKER"
        assert "password" in parse_run.summary["warnings"][0]["line"]
        normalized = db.query(NormalizedConfig).filter(NormalizedConfig.config_file_id == config_id).one()
        assert normalized.indicators["has_any_any_rule"] is True
        assert normalized.indicators["has_plaintext_password"] is True
        assert normalized.indicators["parser_family"] == "firewall"
        assert normalized.indicators["warning_codes"] == ["ANY_ANY_POLICY", "PASSWORD_MARKER"]
        config_ai_job = (
            db.query(AiAnalysisJob)
            .filter(AiAnalysisJob.target_type == "config_file", AiAnalysisJob.target_id == config_id)
            .one()
        )
        assert config_ai_job.status == "completed"
        assert "智能草稿" in (config_ai_job.summary or "")

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
        assert db.query(Notification).filter(Notification.resource_id == inspection_id).count() == 1
        inspection_ai_job = (
            db.query(AiAnalysisJob)
            .filter(AiAnalysisJob.target_type == "inspection_run", AiAnalysisJob.target_id == inspection_id)
            .one()
        )
        assert inspection_ai_job.review_status == "pending_review"

        db.add(
            JobQueue(
                job_type="generate_report",
                payload={
                    "report_job_id": report_id,
                    "template_id": template_id,
                    "parameters": {"finding_list_limit": 10},
                },
            )
        )
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
        artifacts = db.query(ReportArtifact).filter(ReportArtifact.report_job_id == report_id).all()
        artifact_types = {artifact.artifact_type for artifact in artifacts}
        assert {"markdown", "csv", "json"} <= artifact_types
        summary_artifact = next(artifact for artifact in artifacts if artifact.artifact_type == "markdown")
        csv_artifact = next(artifact for artifact in artifacts if artifact.artifact_type == "csv")
        statistics_artifact = next(artifact for artifact in artifacts if artifact.artifact_type == "json")
        assert Path(summary_artifact.file_path).exists()
        assert "模板报告" in Path(summary_artifact.file_path).read_text(encoding="utf-8")
        assert "问题ID" in Path(csv_artifact.file_path).read_text(encoding="utf-8-sig")
        statistics = json.loads(Path(statistics_artifact.file_path).read_text(encoding="utf-8"))
        assert statistics["metrics"]["finding_total"] == 1
        assert statistics["parameters"]["finding_list_limit"] == 10
        assert summary_artifact.artifact_metadata["metrics"]["finding_total"] == 1
        assert summary_artifact.artifact_metadata["template_id"] == template_id
        report_ai_job = (
            db.query(AiAnalysisJob)
            .filter(AiAnalysisJob.target_type == "report_job", AiAnalysisJob.target_id == report_id)
            .one()
        )
        assert report_ai_job.status == "completed"
        assert db.query(Notification).filter(Notification.resource_type == "report_job", Notification.resource_id == report_id).count() == 1
        assert (
            db.query(Notification)
            .filter(Notification.resource_type == "ai_analysis_job", Notification.resource_id == report_ai_job.id)
            .count()
            == 1
        )

        package_job = ReportJob(
            report_type="inspection_package",
            status="queued",
            requested_by_id="system-admin",
        )
        db.add(package_job)
        db.flush()
        db.add(
            JobQueue(
                job_type="generate_report",
                payload={
                    "report_job_id": package_job.id,
                    "parameters": {"package_include_evidence_manifest": True},
                },
            )
        )
        db.commit()
        package_report_id = package_job.id

    package_response = client.post("/internal/queue/run-next")
    assert package_response.status_code == 200, package_response.text
    assert package_response.json()["job_type"] == "generate_report"

    package_ai_response = client.post("/internal/queue/run-next")
    assert package_ai_response.status_code == 200, package_ai_response.text
    assert package_ai_response.json()["job_type"] == "generate_ai_summary"

    with SessionLocal() as db:
        package_artifacts = db.query(ReportArtifact).filter(ReportArtifact.report_job_id == package_report_id).all()
        assert {"markdown", "csv", "json", "zip"} <= {artifact.artifact_type for artifact in package_artifacts}
        package_artifact = next(artifact for artifact in package_artifacts if artifact.artifact_type == "zip")
        assert package_artifact.artifact_type == "zip"
        assert Path(package_artifact.file_path).exists()
        with ZipFile(package_artifact.file_path) as archive:
            assert {"summary.md", "finding-list.csv", "statistics.json", "evidence-manifest.json", "manifest.json"} <= set(archive.namelist())

        base_sync = ScheduledTask(
            name="base-data-sync",
            task_type="base_data_sync",
            enabled=True,
            interval_minutes=60,
            payload={
                "collector_type": "mock",
                "catalog_type": "account",
                "source": "scheduled_sync",
                "items": [{"name": "AUTO-ACCOUNT", "content": {"username": "AUTO-ACCOUNT", "role": "operator"}}],
            },
            next_run_at=None,
            created_by_id="system-admin",
        )
        periodic = ScheduledTask(
            name="periodic-inspection",
            task_type="periodic_inspection",
            enabled=True,
            interval_minutes=60,
            payload={
                "rule_set_id": rule_set.id,
                "asset_scope": [asset.id],
                "name_prefix": "periodic-check",
                "requested_by_id": "system-admin",
            },
            next_run_at=None,
            created_by_id="system-admin",
        )
        db.add(base_sync)
        db.add(periodic)
        db.flush()
        base_sync.next_run_at = report_job.created_at
        periodic.next_run_at = report_job.created_at
        db.commit()

    schedules_response = client.post("/internal/schedules/run-due")
    assert schedules_response.status_code == 200, schedules_response.text
    assert schedules_response.json()["count"] == 2

    base_sync_response = client.post("/internal/queue/run-next")
    assert base_sync_response.status_code == 200, base_sync_response.text
    assert base_sync_response.json()["job_type"] == "run_scheduled_task"

    periodic_response = client.post("/internal/queue/run-next")
    assert periodic_response.status_code == 200, periodic_response.text
    assert periodic_response.json()["job_type"] == "run_scheduled_task"
    assert periodic_response.json()["assignments"][0]["owner"] == "security-team"
    generated_inspection_id = periodic_response.json()["inspection_run_id"]

    with SessionLocal() as db:
        queued_inspection = db.get(InspectionRun, generated_inspection_id)
        assert "security-team" in (queued_inspection.last_message or "")

    generated_inspection_response = client.post("/internal/queue/run-next")
    assert generated_inspection_response.status_code == 200, generated_inspection_response.text
    assert generated_inspection_response.json()["job_type"] == "run_inspection"

    generated_ai_response = client.post("/internal/queue/run-next")
    assert generated_ai_response.status_code == 200, generated_ai_response.text
    assert generated_ai_response.json()["job_type"] == "generate_ai_summary"

    with SessionLocal() as db:
        assert db.query(LedgerItem).filter(LedgerItem.name == "AUTO-ACCOUNT").count() == 1
        synced_task = db.query(ScheduledTask).filter(ScheduledTask.name == "base-data-sync").one()
        collection_result = synced_task.payload["last_collection_result"]
        assert collection_result["collector"] == "mock-ledger-collector"
        assert collection_result["imported_count"] == 1
        assert collection_result["rejected_count"] == 0
        generated_inspection = db.get(InspectionRun, generated_inspection_id)
        assert generated_inspection.status == "completed"
        assert generated_inspection.trigger_type == "scheduled"

    stats_response = client.get("/internal/queue/stats")
    assert stats_response.status_code == 200
    assert stats_response.json()["completed"] == 12
