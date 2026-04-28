from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from sqlalchemy import create_engine, inspect

ROOT = Path(__file__).resolve().parents[2]
ALEMBIC_INI = ROOT / "apps" / "backend" / "alembic.ini"
REQUIRED_TABLES = {
    "ai_analysis_jobs",
    "assets",
    "audit_events",
    "config_files",
    "exceptions",
    "findings",
    "inspection_runs",
    "job_queue",
    "ledger_items",
    "log_clues",
    "normalized_configs",
    "notifications",
    "parse_runs",
    "report_artifacts",
    "report_jobs",
    "report_templates",
    "roles",
    "rule_run_results",
    "rule_sets",
    "rule_set_versions",
    "scheduled_tasks",
    "system_parameters",
    "ticket_attachments",
    "ticket_reminders",
    "tickets",
    "users",
    "alembic_version",
}


def run(command: list[str], *, env: dict[str, str]) -> None:
    result = subprocess.run(command, cwd=ROOT, env=env, text=True, capture_output=True, check=False)
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr, file=sys.stderr)
        raise SystemExit(result.returncode)


def main() -> int:
    if not ALEMBIC_INI.exists():
        print(f"Missing Alembic config: {ALEMBIC_INI}")
        return 1

    with tempfile.TemporaryDirectory(prefix="shutong-migration-") as tmp:
        db_path = Path(tmp) / "migration-check.db"
        database_url = f"sqlite+pysqlite:///{db_path.as_posix()}"
        env = {**os.environ, "DATABASE_URL": database_url, "PYTHONPATH": str(ROOT / "apps" / "backend")}
        alembic = shutil.which("alembic")
        command = [alembic, "-c", str(ALEMBIC_INI), "upgrade", "head"] if alembic else [
            sys.executable,
            "-m",
            "alembic",
            "-c",
            str(ALEMBIC_INI),
            "upgrade",
            "head",
        ]
        run(command, env=env)

        engine = create_engine(database_url)
        try:
            tables = set(inspect(engine).get_table_names())
            missing = sorted(REQUIRED_TABLES - tables)
            if missing:
                print("Migration check failed. Missing tables:")
                for table in missing:
                    print(f"- {table}")
                return 1
        finally:
            engine.dispose()

    print("Alembic migration check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
