from __future__ import annotations


def parse_config_text(content: str, *, asset_type: str, vendor: str) -> dict:
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    lower_lines = [line.lower() for line in lines]

    hostname = None
    interface_names: list[str] = []
    acl_lines: list[str] = []
    warning_markers: list[str] = []
    keywords: set[str] = set()

    for line, lower_line in zip(lines, lower_lines, strict=False):
        parts = lower_line.split()
        keywords.update(parts)

        if lower_line.startswith("hostname "):
            hostname = line.split(maxsplit=1)[1]
        elif lower_line.startswith("sysname "):
            hostname = line.split(maxsplit=1)[1]

        if lower_line.startswith("interface "):
            interface_names.append(line.split(maxsplit=1)[1])

        if lower_line.startswith(("permit ", "deny ", "access-list ", "ip access-list ")):
            acl_lines.append(line)

        if " password " in f" {lower_line} " or lower_line.startswith("password "):
            warning_markers.append("plaintext_password_marker")

    has_any_any_rule = any(
        "permit ip any any" in lower_line or "any any" in lower_line and "permit" in lower_line
        for lower_line in lower_lines
    )

    return {
        "parser_name": f"{vendor.lower()}-{asset_type.lower()}-line-parser".replace(" ", "-"),
        "hostname": hostname,
        "line_count": len(lines),
        "warning_count": len(warning_markers),
        "summary": {
            "asset_type": asset_type,
            "vendor": vendor,
            "interface_names": interface_names[:20],
            "acl_lines": acl_lines[:20],
            "line_preview": lines[:20],
        },
        "indicators": {
            "has_any_any_rule": has_any_any_rule,
            "has_plaintext_password": bool(warning_markers),
            "keywords": sorted(keywords),
            "interface_names": interface_names,
            "acl_lines": acl_lines,
        },
    }
