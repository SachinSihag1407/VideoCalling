from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import select

from app.core import get_session, get_current_user
from app.models import (
    User, UserRole, UserRead,
    Appointment, AppointmentCreate, AppointmentRead, AppointmentUpdate, AppointmentStatus,
    AuditAction
)
from app.services import get_audit_service

router = APIRouter(prefix="/appointments", tags=["Appointments"])


@router.post("/", response_model=AppointmentRead, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    request: Request,
    appointment_data: AppointmentCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new appointment (patients only)."""
    if current_user.role != UserRole.PATIENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can create appointments"
        )
    
    # Verify doctor exists
    result = await session.execute(
        select(User).where(User.id == appointment_data.doctor_id, User.role == UserRole.DOCTOR)
    )
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found"
        )
    
    # Create appointment
    appointment = Appointment(
        doctor_id=appointment_data.doctor_id,
        patient_id=current_user.id,
        scheduled_time=appointment_data.scheduled_time,
        reason=appointment_data.reason,
        notes=appointment_data.notes
    )
    
    session.add(appointment)
    await session.commit()
    await session.refresh(appointment)
    
    # Log the creation
    audit_service = get_audit_service(session)
    client_ip = request.client.host if request.client else None
    await audit_service.log(
        user_id=current_user.id,
        action=AuditAction.CREATE_APPOINTMENT,
        resource_type="appointment",
        resource_id=appointment.id,
        ip_address=client_ip
    )
    
    # Load relationships for response
    result = await session.execute(
        select(Appointment)
        .options(selectinload(Appointment.doctor), selectinload(Appointment.patient))
        .where(Appointment.id == appointment.id)
    )
    appointment = result.scalar_one()
    
    return _appointment_to_read(appointment)


@router.get("/", response_model=List[AppointmentRead])
async def list_appointments(
    request: Request,
    status_filter: Optional[AppointmentStatus] = Query(None, alias="status"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List appointments for current user."""
    query = select(Appointment).options(
        selectinload(Appointment.doctor),
        selectinload(Appointment.patient)
    )
    
    # Filter by user role
    if current_user.role == UserRole.DOCTOR:
        query = query.where(Appointment.doctor_id == current_user.id)
    else:
        query = query.where(Appointment.patient_id == current_user.id)
    
    # Apply status filter if provided
    if status_filter:
        query = query.where(Appointment.status == status_filter)
    
    query = query.order_by(Appointment.scheduled_time.desc())
    
    result = await session.execute(query)
    appointments = result.scalars().all()
    
    return [_appointment_to_read(apt) for apt in appointments]


@router.get("/{appointment_id}", response_model=AppointmentRead)
async def get_appointment(
    appointment_id: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific appointment."""
    result = await session.execute(
        select(Appointment)
        .options(selectinload(Appointment.doctor), selectinload(Appointment.patient))
        .where(Appointment.id == appointment_id)
    )
    appointment = result.scalar_one_or_none()
    
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found"
        )
    
    # Verify access
    if current_user.id not in [appointment.doctor_id, appointment.patient_id]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Log the view
    audit_service = get_audit_service(session)
    client_ip = request.client.host if request.client else None
    await audit_service.log_appointment_view(current_user.id, appointment_id, client_ip)
    
    return _appointment_to_read(appointment)


@router.patch("/{appointment_id}", response_model=AppointmentRead)
async def update_appointment(
    appointment_id: str,
    update_data: AppointmentUpdate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update an appointment (doctors can confirm/cancel, patients can cancel)."""
    result = await session.execute(
        select(Appointment)
        .options(selectinload(Appointment.doctor), selectinload(Appointment.patient))
        .where(Appointment.id == appointment_id)
    )
    appointment = result.scalar_one_or_none()
    
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found"
        )
    
    # Verify access
    if current_user.id not in [appointment.doctor_id, appointment.patient_id]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Apply status rules
    if update_data.status:
        if update_data.status == AppointmentStatus.CONFIRMED:
            if current_user.role != UserRole.DOCTOR:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only doctors can confirm appointments"
                )
        elif update_data.status == AppointmentStatus.COMPLETED:
            if current_user.role != UserRole.DOCTOR:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only doctors can mark appointments as completed"
                )
        
        appointment.status = update_data.status
    
    if update_data.scheduled_time:
        appointment.scheduled_time = update_data.scheduled_time
    
    if update_data.notes is not None:
        appointment.notes = update_data.notes
    
    appointment.updated_at = datetime.utcnow()
    
    await session.commit()
    await session.refresh(appointment)
    
    # Log the update
    audit_service = get_audit_service(session)
    client_ip = request.client.host if request.client else None
    await audit_service.log(
        user_id=current_user.id,
        action=AuditAction.UPDATE_APPOINTMENT,
        resource_type="appointment",
        resource_id=appointment_id,
        details=f"Updated status to {appointment.status.value}" if update_data.status else "Updated appointment",
        ip_address=client_ip
    )
    
    return _appointment_to_read(appointment)


@router.get("/{appointment_id}/room", response_model=dict)
async def get_appointment_room(
    appointment_id: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get the room ID for an appointment's video call."""
    result = await session.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = result.scalar_one_or_none()
    
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found"
        )
    
    if current_user.id not in [appointment.doctor_id, appointment.patient_id]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    if appointment.status not in [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Appointment is not active"
        )
    
    return {
        "room_id": appointment.room_id,
        "appointment_id": appointment.id,
        "meeting_number": appointment.meeting_number,
        "scheduled_time": appointment.scheduled_time.isoformat()
    }


def _appointment_to_read(appointment: Appointment) -> AppointmentRead:
    """Convert Appointment model to AppointmentRead."""
    doctor_read = None
    patient_read = None
    
    if appointment.doctor:
        doctor_read = UserRead(
            id=appointment.doctor.id,
            email=appointment.doctor.email,
            full_name=appointment.doctor.full_name,
            role=appointment.doctor.role,
            is_active=appointment.doctor.is_active,
            created_at=appointment.doctor.created_at
        )
    
    if appointment.patient:
        patient_read = UserRead(
            id=appointment.patient.id,
            email=appointment.patient.email,
            full_name=appointment.patient.full_name,
            role=appointment.patient.role,
            is_active=appointment.patient.is_active,
            created_at=appointment.patient.created_at
        )
    
    return AppointmentRead(
        id=appointment.id,
        meeting_number=appointment.meeting_number,
        doctor_id=appointment.doctor_id,
        patient_id=appointment.patient_id,
        scheduled_time=appointment.scheduled_time,
        reason=appointment.reason,
        notes=appointment.notes,
        status=appointment.status,
        room_id=appointment.room_id,
        created_at=appointment.created_at,
        doctor=doctor_read,
        patient=patient_read
    )
