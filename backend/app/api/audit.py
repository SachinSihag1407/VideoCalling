from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core import get_session, get_current_user
from app.models import User, UserRole, AuditLog, AuditLogRead, AuditAction

router = APIRouter(prefix="/audit", tags=["Audit Logs"])


@router.get("/", response_model=List[AuditLogRead])
async def list_audit_logs(
    action: Optional[AuditAction] = Query(None),
    resource_type: Optional[str] = Query(None),
    resource_id: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List audit logs (doctors see their patients' logs, patients see their own)."""
    query = select(AuditLog)
    
    # Role-based filtering
    if current_user.role == UserRole.PATIENT:
        # Patients can only see their own logs
        query = query.where(AuditLog.user_id == current_user.id)
    else:
        # Doctors can see their own logs
        # In a real system, you'd also show logs related to their patients
        query = query.where(AuditLog.user_id == current_user.id)
    
    # Apply filters
    if action:
        query = query.where(AuditLog.action == action)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    if resource_id:
        query = query.where(AuditLog.resource_id == resource_id)
    if start_date:
        query = query.where(AuditLog.created_at >= start_date)
    if end_date:
        query = query.where(AuditLog.created_at <= end_date)
    
    query = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)
    
    result = await session.execute(query)
    logs = result.scalars().all()
    
    return [
        AuditLogRead(
            id=log.id,
            user_id=log.user_id,
            action=log.action,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            details=log.details,
            ip_address=log.ip_address,
            created_at=log.created_at
        )
        for log in logs
    ]


@router.get("/my-activity", response_model=List[AuditLogRead])
async def get_my_activity(
    limit: int = Query(50, le=200),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get current user's activity log."""
    result = await session.execute(
        select(AuditLog)
        .where(AuditLog.user_id == current_user.id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    logs = result.scalars().all()
    
    return [
        AuditLogRead(
            id=log.id,
            user_id=log.user_id,
            action=log.action,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            details=log.details,
            ip_address=log.ip_address,
            created_at=log.created_at
        )
        for log in logs
    ]
