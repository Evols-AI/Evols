"""
API v1 Router
Main router that includes all endpoint routers
"""

from fastapi import APIRouter
from app.api.v1.endpoints import auth, feedback, themes, personas, decisions
from app.api.v1.endpoints import workbench, llm_settings, settings, knowledge_base, projects, jobs, roadmap, products
from app.api.v1.endpoints import admin, users, support, advisers, copilot, copilot_cleanup, context, invites

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(invites.router, prefix="/invites", tags=["Invites"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(products.router, prefix="/products", tags=["Products"])
api_router.include_router(feedback.router, prefix="/feedback", tags=["Feedback"])
api_router.include_router(themes.router, prefix="/themes", tags=["Themes"])
api_router.include_router(roadmap.router, prefix="/roadmap", tags=["Roadmap"])
api_router.include_router(personas.router, prefix="/personas", tags=["Personas"])
api_router.include_router(decisions.router, prefix="/decisions", tags=["Decisions"])
api_router.include_router(workbench.router, prefix="/workbench", tags=["Workbench"])
api_router.include_router(llm_settings.router, prefix="/llm-settings", tags=["LLM Settings"])
api_router.include_router(settings.router, prefix="/settings", tags=["Settings"])
api_router.include_router(knowledge_base.router, prefix="/knowledge-base", tags=["Product RAG"])
api_router.include_router(projects.router, prefix="/projects", tags=["Projects"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["Background Jobs"])
api_router.include_router(support.router, prefix="/support", tags=["Support"])
api_router.include_router(advisers.router, prefix="/advisers", tags=["Advisers"])
api_router.include_router(copilot.router, prefix="/copilot", tags=["Copilot"])
api_router.include_router(copilot_cleanup.router, prefix="/copilot/cleanup", tags=["Copilot"])
api_router.include_router(context.router, prefix="/context", tags=["Context"])
