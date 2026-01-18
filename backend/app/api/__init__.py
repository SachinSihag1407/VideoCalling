from fastapi import APIRouter
from app.api.auth import router as auth_router
from app.api.appointments import router as appointments_router
from app.api.consent import router as consent_router
from app.api.interviews import router as interviews_router
from app.api.audit import router as audit_router
from app.api.signaling import router as signaling_router
from app.api.storage import router as storage_router

api_router = APIRouter(prefix="/api")

api_router.include_router(auth_router)
api_router.include_router(appointments_router)
api_router.include_router(consent_router)
api_router.include_router(interviews_router)
api_router.include_router(audit_router)
api_router.include_router(signaling_router)
api_router.include_router(storage_router)

__all__ = ["api_router"]
