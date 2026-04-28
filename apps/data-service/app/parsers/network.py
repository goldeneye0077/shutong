from __future__ import annotations

from app.parsers.base import ParserAdapter, ParserContext


class GenericLineParser(ParserAdapter):
    name = "generic-network-line-parser"
    family = "generic"

    def parse(self, content: str, context: ParserContext) -> dict:
        return _parse_common_lines(content, context=context, parser_name=self.name, parser_family=self.family)


class HuaweiFirewallParser(ParserAdapter):
    name = "huawei-firewall-policy-parser"
    family = "firewall"

    def supports(self, context: ParserContext) -> bool:
        return context.vendor.lower() == "huawei" and context.asset_type.upper() in {"OMFW", "FW", "FIREWALL"}

    def parse(self, content: str, context: ParserContext) -> dict:
        return _parse_common_lines(content, context=context, parser_name=self.name, parser_family=self.family)


class H3CFirewallParser(ParserAdapter):
    name = "h3c-firewall-policy-parser"
    family = "firewall"

    def supports(self, context: ParserContext) -> bool:
        return context.vendor.lower() == "h3c" and context.asset_type.upper() in {"OMFW", "FW", "FIREWALL"}

    def parse(self, content: str, context: ParserContext) -> dict:
        return _parse_common_lines(content, context=context, parser_name=self.name, parser_family=self.family)


class CoreSwitchParser(ParserAdapter):
    name = "csw-core-switch-parser"
    family = "core-switch"

    def supports(self, context: ParserContext) -> bool:
        return context.asset_type.upper() == "CSW"

    def parse(self, content: str, context: ParserContext) -> dict:
        return _parse_common_lines(content, context=context, parser_name=self.name, parser_family=self.family)


class BusinessSwitchParser(ParserAdapter):
    name = "bsw-business-switch-parser"
    family = "business-switch"

    def supports(self, context: ParserContext) -> bool:
        return context.asset_type.upper() == "BSW"

    def parse(self, content: str, context: ParserContext) -> dict:
        return _parse_common_lines(content, context=context, parser_name=self.name, parser_family=self.family)


class OperationSwitchParser(ParserAdapter):
    name = "omsw-operation-switch-parser"
    family = "operation-switch"

    def supports(self, context: ParserContext) -> bool:
        return context.asset_type.upper() == "OMSW"

    def parse(self, content: str, context: ParserContext) -> dict:
        return _parse_common_lines(content, context=context, parser_name=self.name, parser_family=self.family)


class CmnetPeParser(ParserAdapter):
    name = "cmnet-pe-line-parser"
    family = "switch-router"

    def supports(self, context: ParserContext) -> bool:
        return context.asset_type.upper() in {"CMNET", "PE", "SWITCH", "ROUTER"}

    def parse(self, content: str, context: ParserContext) -> dict:
        return _parse_common_lines(content, context=context, parser_name=self.name, parser_family=self.family)


PARSER_REGISTRY: list[ParserAdapter] = [
    HuaweiFirewallParser(),
    H3CFirewallParser(),
    CoreSwitchParser(),
    BusinessSwitchParser(),
    OperationSwitchParser(),
    CmnetPeParser(),
    GenericLineParser(),
]


def parse_config_text(content: str, *, asset_type: str, vendor: str) -> dict:
    context = ParserContext(asset_type=asset_type, vendor=vendor)
    adapter = next(parser for parser in PARSER_REGISTRY if parser.supports(context))
    return adapter.parse(content, context)


def _parse_common_lines(content: str, *, context: ParserContext, parser_name: str, parser_family: str) -> dict:
    numbered_lines = [
        (line_no, line.strip())
        for line_no, line in enumerate(content.splitlines(), start=1)
        if line.strip()
    ]
    lines = [line for _, line in numbered_lines]
    lower_lines = [line.lower() for line in lines]

    hostname = None
    interface_names: list[str] = []
    acl_lines: list[str] = []
    warnings: list[dict] = []
    keywords: set[str] = set()

    for (line_no, line), lower_line in zip(numbered_lines, lower_lines, strict=False):
        parts = lower_line.split()
        keywords.update(parts)

        if lower_line.startswith("hostname "):
            hostname = line.split(maxsplit=1)[1]
        elif lower_line.startswith("sysname "):
            hostname = line.split(maxsplit=1)[1]

        if lower_line.startswith("interface "):
            interface_names.append(line.split(maxsplit=1)[1])

        if lower_line.startswith(("permit ", "deny ", "access-list ", "ip access-list ", "rule ", "security-policy ")):
            acl_lines.append(line)

        if " password " in f" {lower_line} " or lower_line.startswith("password "):
            warnings.append(
                {
                    "line_no": line_no,
                    "code": "PASSWORD_MARKER",
                    "message": "检测到密码相关配置，请核查凭据是否加密、账号权限是否符合最小授权要求。",
                    "line": line,
                }
            )
        if "permit ip any any" in lower_line or ("permit" in lower_line and "any any" in lower_line):
            warnings.append(
                {
                    "line_no": line_no,
                    "code": "ANY_ANY_POLICY",
                    "message": "检测到 any-any 放通策略，请核查源、目的和服务范围是否过宽。",
                    "line": line,
                }
            )
        if parser_family in {"core-switch", "business-switch", "operation-switch", "switch-router"}:
            if lower_line == "telnet server enable":
                warnings.append(
                    {
                        "line_no": line_no,
                        "code": "TELNET_ENABLED",
                        "message": "检测到 Telnet 服务启用，请优先使用 SSH 等安全管理通道。",
                        "line": line,
                    }
                )
            if lower_line.startswith("snmp-agent community") and " public" in f" {lower_line} ":
                warnings.append(
                    {
                        "line_no": line_no,
                        "code": "DEFAULT_SNMP_COMMUNITY",
                        "message": "检测到默认 SNMP community，请核查是否需要更换为专用复杂口令。",
                        "line": line,
                    }
                )

    has_any_any_rule = any(
        "permit ip any any" in lower_line or "any any" in lower_line and "permit" in lower_line
        for lower_line in lower_lines
    )

    return {
        "parser_name": parser_name,
        "hostname": hostname,
        "line_count": len(lines),
        "warning_count": len(warnings),
        "summary": {
            "asset_type": context.asset_type,
            "vendor": context.vendor,
            "parser_adapter": parser_name,
            "parser_family": parser_family,
            "interface_names": interface_names[:20],
            "acl_lines": acl_lines[:20],
            "line_preview": lines[:20],
            "warnings": warnings,
        },
        "indicators": {
            "parser_adapter": parser_name,
            "parser_family": parser_family,
            "has_any_any_rule": has_any_any_rule,
            "has_plaintext_password": bool(warnings),
            "warning_codes": sorted({warning["code"] for warning in warnings}),
            "warnings": warnings,
            "keywords": sorted(keywords),
            "interface_names": interface_names,
            "acl_lines": acl_lines,
        },
    }
