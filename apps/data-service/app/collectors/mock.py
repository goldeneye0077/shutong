from __future__ import annotations

from app.collectors.base import CollectedLedgerRecord, CollectorRowError, CollectorRunResult


class MockLedgerCollector:
    name = "mock-ledger-collector"

    def collect(self, payload: dict) -> CollectorRunResult:
        catalog_type = str(payload.get("catalog_type") or "account")
        source = str(payload.get("source") or "mock_collector")
        raw_items = payload.get("items") or [
            {
                "name": f"AUTO-{catalog_type.upper()}",
                "status": "active",
                "version": "v1",
                "owner": "system",
                "content": {"collector": self.name, "catalog_type": catalog_type},
            }
        ]

        records: list[CollectedLedgerRecord] = []
        errors: list[CollectorRowError] = []
        for index, raw_item in enumerate(raw_items, start=1):
            if not isinstance(raw_item, dict):
                errors.append(
                    CollectorRowError(
                        row_no=index,
                        field="item",
                        code="INVALID_ITEM",
                        message="采集记录必须是对象",
                        item={"value": raw_item},
                    )
                )
                continue

            name = raw_item.get("name")
            if name is None or not str(name).strip():
                errors.append(
                    CollectorRowError(
                        row_no=index,
                        field="name",
                        code="REQUIRED",
                        message="采集记录名称不能为空",
                        item=raw_item,
                    )
                )
                continue

            item_catalog_type = str(raw_item.get("catalog_type") or catalog_type)
            item_content = raw_item.get("content") if isinstance(raw_item.get("content"), dict) else dict(raw_item)
            records.append(
                CollectedLedgerRecord(
                    catalog_type=item_catalog_type,
                    name=str(name),
                    status=str(raw_item.get("status") or "active"),
                    source=str(raw_item.get("source") or source),
                    version=str(raw_item.get("version") or "v1"),
                    owner=raw_item.get("owner"),
                    content=item_content,
                )
            )

        return CollectorRunResult(
            collector_name=self.name,
            records=records,
            errors=errors,
            message=f"采集完成：成功 {len(records)} 条，失败 {len(errors)} 条",
        )


COLLECTOR_REGISTRY = {
    "mock": MockLedgerCollector(),
    "mock-ledger": MockLedgerCollector(),
}


def collect_base_data(payload: dict) -> CollectorRunResult:
    collector_type = str(payload.get("collector_type") or "mock")
    collector = COLLECTOR_REGISTRY.get(collector_type)
    if not collector:
        supported = ", ".join(sorted(COLLECTOR_REGISTRY))
        raise ValueError(f"Unsupported collector_type: {collector_type}. Supported: {supported}")
    return collector.collect(payload)
