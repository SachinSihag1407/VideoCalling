from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import AuditLog, AuditLogCreate, AuditAction


class AuditService:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def log(
        self,
        user_id: str,
        action: AuditAction,
        resource_type: str,
        resource_id: Optional[str] = None,
        details: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> AuditLog:
        """Create an immutable audit log entry."""
        audit_log = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            ip_address=ip_address,
            created_at=datetime.utcnow()
        )
        self.session.add(audit_log)
        await self.session.commit()
        await self.session.refresh(audit_log)
        return audit_log
    
    async def log_login(self, user_id: str, ip_address: Optional[str] = None) -> AuditLog:
        return await self.log(
            user_id=user_id,
            action=AuditAction.LOGIN,
            resource_type="auth",
            ip_address=ip_address
        )
    
    async def log_appointment_view(
        self, user_id: str, appointment_id: str, ip_address: Optional[str] = None
    ) -> AuditLog:
        return await self.log(
            user_id=user_id,
            action=AuditAction.VIEW_APPOINTMENT,
            resource_type="appointment",
            resource_id=appointment_id,
            ip_address=ip_address
        )
    
    async def log_interview_join(
        self, user_id: str, appointment_id: str, ip_address: Optional[str] = None
    ) -> AuditLog:
        return await self.log(
            user_id=user_id,
            action=AuditAction.JOIN_INTERVIEW,
            resource_type="interview",
            resource_id=appointment_id,
            ip_address=ip_address
        )
    
    async def log_consent(
        self, user_id: str, appointment_id: str, granted: bool, ip_address: Optional[str] = None
    ) -> AuditLog:
        return await self.log(
            user_id=user_id,
            action=AuditAction.GRANT_CONSENT if granted else AuditAction.DENY_CONSENT,
            resource_type="consent",
            resource_id=appointment_id,
            ip_address=ip_address
        )
    
    async def log_recording_start(
        self, user_id: str, interview_id: str, ip_address: Optional[str] = None
    ) -> AuditLog:
        return await self.log(
            user_id=user_id,
            action=AuditAction.START_RECORDING,
            resource_type="interview",
            resource_id=interview_id,
            ip_address=ip_address
        )
    
    async def log_recording_stop(
        self, user_id: str, interview_id: str, ip_address: Optional[str] = None
    ) -> AuditLog:
        return await self.log(
            user_id=user_id,
            action=AuditAction.STOP_RECORDING,
            resource_type="interview",
            resource_id=interview_id,
            ip_address=ip_address
        )


def get_audit_service(session: AsyncSession) -> AuditService:
    return AuditService(session)
