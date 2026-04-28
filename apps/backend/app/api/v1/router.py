from fastapi import APIRouter

from app.api.v1 import assets_configs, auth, platform, rules_inspections, system, workflow

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(system.router)
api_router.include_router(platform.router)
api_router.include_router(assets_configs.router)
api_router.include_router(rules_inspections.router)
api_router.include_router(workflow.router)
