from __future__ import annotations


def build_normalized_config(*, config_file_id: str, asset_id: str, config_version: int, parsed: dict) -> dict:
    interface_names = parsed["indicators"].get("interface_names", [])
    return {
        "config_file_id": config_file_id,
        "asset_id": asset_id,
        "config_version": config_version,
        "hostname": parsed.get("hostname"),
        "interface_count": len(interface_names),
        "summary": parsed.get("summary", {}),
        "indicators": parsed.get("indicators", {}),
    }
