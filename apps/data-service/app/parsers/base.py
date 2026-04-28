from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ParserContext:
    asset_type: str
    vendor: str


class ParserAdapter:
    name = "generic-network-line-parser"
    family = "generic"

    def supports(self, context: ParserContext) -> bool:
        return True

    def parse(self, content: str, context: ParserContext) -> dict:
        raise NotImplementedError
