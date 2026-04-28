"""
API v1 Router
Main router that includes all endpoint routers
"""

from fastapi import APIRouter
from app.api.v1.endpoints import auth, decisions
from app.api.v1.endpoints import workbench, llm_settings, settings, projects, jobs, roadmap
from app.api.v1.endpoints import admin, users, support, copilot, copilot_cleanup, context, invites
from app.api.v1.endpoints import knowledge, memory, work_context, skill_customizations
from app.api.v1.endpoints import team_knowledge, api_keys, mcp, oidc, llm_proxy
from app.api.v1.endpoints import graph

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(invites.router, prefix="/invites", tags=["Invites"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(roadmap.router, prefix="/roadmap", tags=["Roadmap"])
api_router.include_router(decisions.router, prefix="/decisions", tags=["Decisions"])
api_router.include_router(workbench.router, prefix="/workbench", tags=["Workbench"])
api_router.include_router(llm_settings.router, prefix="/llm-settings", tags=["LLM Settings"])
api_router.include_router(settings.router, prefix="/settings", tags=["Settings"])
api_router.include_router(projects.router, prefix="/projects", tags=["Projects"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["Background Jobs"])
api_router.include_router(support.router, prefix="/support", tags=["Support"])
api_router.include_router(copilot.router, prefix="/copilot", tags=["Copilot"])
api_router.include_router(copilot_cleanup.router, prefix="/copilot/cleanup", tags=["Copilot"])
api_router.include_router(context.router, prefix="/context", tags=["Context"])
api_router.include_router(knowledge.router, prefix="/knowledge", tags=["Knowledge"])
api_router.include_router(memory.router, prefix="/memory", tags=["Memory"])
api_router.include_router(work_context.router, prefix="/work-context", tags=["Work Context"])
api_router.include_router(skill_customizations.router, prefix="/skill-customizations", tags=["Skill Customizations"])
api_router.include_router(team_knowledge.router, prefix="/team-knowledge", tags=["Team Knowledge Graph"])
api_router.include_router(api_keys.router, prefix="/auth/api-keys", tags=["API Keys"])
api_router.include_router(mcp.router, prefix="/mcp", tags=["MCP"])
api_router.include_router(oidc.router, prefix="/oidc", tags=["OIDC"])
api_router.include_router(llm_proxy.router, prefix="/llm-proxy", tags=["LLM Proxy"])
api_router.include_router(graph.router, prefix="/graph", tags=["Knowledge Graph"])
