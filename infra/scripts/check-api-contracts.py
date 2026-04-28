from __future__ import annotations

import json
import sys
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = ROOT / "apps" / "backend"
CONTRACTS_DIR = ROOT / "packages" / "api-contracts"

sys.path.insert(0, str(BACKEND_ROOT))

from app.main import create_app  # noqa: E402

sync_script_path = ROOT / "infra" / "scripts" / "sync-api-contracts.py"
sync_spec = importlib.util.spec_from_file_location("sync_api_contracts", sync_script_path)
if sync_spec is None or sync_spec.loader is None:
    raise RuntimeError("Cannot load sync-api-contracts.py")
sync_module = importlib.util.module_from_spec(sync_spec)
sync_spec.loader.exec_module(sync_module)


def main() -> int:
    openapi_path = CONTRACTS_DIR / "openapi.json"
    generated_path = CONTRACTS_DIR / "generated.ts"
    expected_openapi = json.dumps(create_app().openapi(), ensure_ascii=False, indent=2)
    expected_generated = sync_module.generate_types(json.loads(expected_openapi))

    mismatches = []
    if not openapi_path.exists() or openapi_path.read_text(encoding="utf-8") != expected_openapi:
        mismatches.append(str(openapi_path.relative_to(ROOT)))
    if not generated_path.exists() or generated_path.read_text(encoding="utf-8") != expected_generated:
        mismatches.append(str(generated_path.relative_to(ROOT)))

    if mismatches:
        print("API contract files are out of date. Run `pnpm contracts:sync`.")
        for mismatch in mismatches:
            print(f"- {mismatch}")
        return 1

    print("API contract files are up to date.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
