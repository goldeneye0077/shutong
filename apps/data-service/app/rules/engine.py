from __future__ import annotations


def evaluate_rule(*, rule_set, normalized_config, asset) -> dict:
    definition = rule_set.definition or {}
    indicators = normalized_config.indicators or {}
    summary = normalized_config.summary or {}
    preview_lines = [line.lower() for line in summary.get("line_preview", [])]
    keywords = {keyword.lower() for keyword in indicators.get("keywords", [])}
    failed_checks: list[dict] = []

    if definition.get("must_not_have_any_any") and indicators.get("has_any_any_rule"):
        failed_checks.append(
            {
                "name": "must_not_have_any_any",
                "reason": "检测到配置中存在 any-any 放通规则。",
            }
        )

    minimum_interface_count = definition.get("minimum_interface_count")
    if minimum_interface_count is not None and normalized_config.interface_count < minimum_interface_count:
        failed_checks.append(
            {
                "name": "minimum_interface_count",
                "reason": f"接口数量 {normalized_config.interface_count} 小于要求值 {minimum_interface_count}。",
            }
        )

    required_keywords = [keyword.lower() for keyword in definition.get("required_keywords", [])]
    missing_keywords = [keyword for keyword in required_keywords if keyword not in keywords]
    if missing_keywords:
        failed_checks.append(
            {
                "name": "required_keywords",
                "reason": "缺少必选关键字。",
                "missing_keywords": missing_keywords,
            }
        )

    forbidden_keywords = [keyword.lower() for keyword in definition.get("forbidden_keywords", [])]
    present_keywords = [
        keyword
        for keyword in forbidden_keywords
        if keyword in keywords or any(keyword in line for line in preview_lines)
    ]
    if present_keywords:
        failed_checks.append(
            {
                "name": "forbidden_keywords",
                "reason": "检测到禁用关键字。",
                "present_keywords": present_keywords,
            }
        )

    matched = bool(failed_checks)
    result_status = "completed" if definition else "skipped"
    result_summary = (
        f"{asset.name}：共有 {len(failed_checks)} 项规则检查未通过。"
        if matched
        else f"{asset.name}：未检测到规则违规。"
    )

    finding = None
    if matched:
        finding = {
            "title": definition.get("finding_title") or f"{rule_set.name} 在 {asset.name} 上存在违规项",
            "severity": definition.get("severity") or rule_set.risk_level,
            "recommendation": definition.get("recommendation")
            or "请核查高亮的配置项，并按当前安全合规基线完成修正。",
            "evidence": {
                "asset_name": asset.name,
                "failed_checks": failed_checks,
                "normalized_indicators": indicators,
            },
        }

    return {
        "status": result_status,
        "matched": matched,
        "severity": definition.get("severity") or rule_set.risk_level,
        "summary": result_summary,
        "details": {
            "asset_name": asset.name,
            "rule_name": rule_set.name,
            "failed_checks": failed_checks,
            "indicators": indicators,
        },
        "finding": finding,
    }
