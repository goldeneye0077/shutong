from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = ROOT / "apps" / "backend"
CONTRACTS_DIR = ROOT / "packages" / "api-contracts"

sys.path.insert(0, str(BACKEND_ROOT))

from app.main import create_app  # noqa: E402


def schema_to_type(schema: dict) -> str:
    if "$ref" in schema:
        return schema["$ref"].rsplit("/", 1)[-1]
    if "anyOf" in schema:
        return " | ".join(schema_to_type(item) for item in schema["anyOf"])
    schema_type = schema.get("type")
    if schema_type == "array":
        return f"{schema_to_type(schema.get('items', {}))}[]"
    if schema_type in {"integer", "number"}:
        return "number"
    if schema_type == "boolean":
        return "boolean"
    if schema_type == "object":
        return "Record<string, unknown>"
    if schema_type == "null":
        return "null"
    return "string"


def generate_types(openapi: dict) -> str:
    schemas = openapi.get("components", {}).get("schemas", {})
    blocks = [
        "// Generated from backend OpenAPI. Do not edit by hand.",
        "",
    ]
    for name, schema in sorted(schemas.items()):
        if schema.get("type") != "object":
            continue
        required = set(schema.get("required", []))
        lines = [f"export interface {name} {{"]
        for prop_name, prop_schema in schema.get("properties", {}).items():
            optional = "" if prop_name in required else "?"
            lines.append(f"  {prop_name}{optional}: {schema_to_type(prop_schema)};")
        lines.append("}")
        blocks.append("\n".join(lines))
        blocks.append("")
    return "\n".join(blocks)


def main() -> None:
    CONTRACTS_DIR.mkdir(parents=True, exist_ok=True)
    openapi = create_app().openapi()
    (CONTRACTS_DIR / "openapi.json").write_text(
        json.dumps(openapi, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (CONTRACTS_DIR / "generated.ts").write_text(generate_types(openapi), encoding="utf-8")
    print(f"Synced OpenAPI contracts to {CONTRACTS_DIR}")


if __name__ == "__main__":
    main()
