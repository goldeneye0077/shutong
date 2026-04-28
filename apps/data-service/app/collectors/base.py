from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass(frozen=True)
class CollectedLedgerRecord:
    catalog_type: str
    name: str
    status: str = "active"
    source: str = "mock_collector"
    version: str = "v1"
    owner: str | None = None
    content: dict = field(default_factory=dict)


@dataclass(frozen=True)
class CollectorRowError:
    row_no: int
    field: str
    code: str
    message: str
    item: dict = field(default_factory=dict)


@dataclass(frozen=True)
class CollectorRunResult:
    collector_name: str
    records: list[CollectedLedgerRecord]
    errors: list[CollectorRowError]
    message: str


class CollectorAdapter(Protocol):
    name: str

    def collect(self, payload: dict) -> CollectorRunResult:
        """Collect external data and normalize it into ledger records."""
