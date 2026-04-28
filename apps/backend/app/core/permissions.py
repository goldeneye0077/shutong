from __future__ import annotations

from dataclasses import dataclass

from app.models.entities import User


@dataclass(frozen=True)
class PermissionDefinition:
    key: str
    label: str
    group: str


MENU_DEFINITIONS: list[PermissionDefinition] = [
    PermissionDefinition("dashboard", "值守总览", "菜单"),
    PermissionDefinition("assets", "对象配置", "菜单"),
    PermissionDefinition("rules", "规则巡检", "菜单"),
    PermissionDefinition("workflow", "闭环处置", "菜单"),
    PermissionDefinition("reports", "报告中心", "菜单"),
    PermissionDefinition("audit", "审计日志", "菜单"),
    PermissionDefinition("platform", "平台管理", "菜单"),
]


PERMISSION_DEFINITIONS: list[PermissionDefinition] = [
    PermissionDefinition("*", "全部权限", "全局"),
    PermissionDefinition("dashboard:read", "查看值守总览", "总览"),
    PermissionDefinition("assets:read", "查看对象", "对象配置"),
    PermissionDefinition("assets:*", "管理对象", "对象配置"),
    PermissionDefinition("configs:read", "查看配置", "对象配置"),
    PermissionDefinition("configs:*", "管理配置上传与差异", "对象配置"),
    PermissionDefinition("rules:read", "查看规则", "规则巡检"),
    PermissionDefinition("rules:*", "管理规则与版本", "规则巡检"),
    PermissionDefinition("inspections:read", "查看巡检", "规则巡检"),
    PermissionDefinition("inspections:*", "发起和管理巡检", "规则巡检"),
    PermissionDefinition("findings:read", "查看问题", "闭环处置"),
    PermissionDefinition("tickets:*", "管理工单", "闭环处置"),
    PermissionDefinition("tickets:review", "复核工单", "闭环处置"),
    PermissionDefinition("exceptions:*", "管理例外", "闭环处置"),
    PermissionDefinition("exceptions:review", "审批例外", "闭环处置"),
    PermissionDefinition("reports:read", "查看报告", "报告中心"),
    PermissionDefinition("reports:*", "生成和下载报告", "报告中心"),
    PermissionDefinition("audit:read", "查看审计", "审计日志"),
    PermissionDefinition("ledgers:*", "管理台账导入", "平台管理"),
    PermissionDefinition("schedules:*", "管理周期任务", "平台管理"),
    PermissionDefinition("notifications:*", "管理消息提醒", "平台管理"),
    PermissionDefinition("logs:*", "管理日志线索", "平台管理"),
    PermissionDefinition("templates:*", "管理报告模板", "平台管理"),
    PermissionDefinition("parameters:*", "管理系统参数", "平台管理"),
    PermissionDefinition("ai:review", "复核智能草稿", "平台管理"),
    PermissionDefinition("jobs:*", "管理任务队列", "平台管理"),
    PermissionDefinition("users:*", "管理用户", "平台管理"),
    PermissionDefinition("roles:*", "管理角色权限", "平台管理"),
]


def permission_matrix() -> dict[str, list[dict[str, str]]]:
    return {
        "menus": [definition.__dict__ for definition in MENU_DEFINITIONS],
        "permissions": [definition.__dict__ for definition in PERMISSION_DEFINITIONS],
    }


def has_permission(user: User, required_permission: str) -> bool:
    role = user.role
    permissions = set(role.permissions if role else [])
    if "*" in permissions:
        return True
    if required_permission in permissions:
        return True
    resource, _, _ = required_permission.partition(":")
    return f"{resource}:*" in permissions


def has_any_permission(user: User, required_permissions: tuple[str, ...]) -> bool:
    return any(has_permission(user, permission) for permission in required_permissions)
