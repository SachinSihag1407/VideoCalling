from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core import get_session, get_current_user
from app.models import (
    User, UserRole,
    Appointment, AppointmentStatus,
    Consent, ConsentCreate, ConsentRead, ConsentUpdate, ConsentStatus
)
from app.services import get_audit_service

router = APIRouter(prefix="/consent", tags=["Consent"])


@router.post("/", response_model=ConsentRead, status_code=status.HTTP_201_CREATED)
async def create_consent_request(
    consent_data: ConsentCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a consent request for an appointment (patients only)."""
    # Only patients can create/grant consent
    if current_user.role != UserRole.PATIENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can create consent records"
        )
    
    # Verify appointment exists
    result = await session.execute(
        select(Appointment).where(Appointment.id == consent_data.appointment_id)
    )
    appointment = result.scalar_one_or_none()
    
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found"
        )
    
    # Verify patient owns this appointment
    if current_user.id != appointment.patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only create consent for your own appointments"
        )
    
    # Check if consent already exists
    result = await session.execute(
        select(Consent).where(Consent.appointment_id == consent_data.appointment_id)
    )
    existing_consent = result.scalar_one_or_none()
    
    if existing_consent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Consent request already exists for this appointment"
        )
    
    # Create consent request
    consent = Consent(
        appointment_id=consent_data.appointment_id,
        patient_id=appointment.patient_id,
        status=ConsentStatus.PENDING
    )
    
    session.add(consent)
    await session.commit()
    await session.refresh(consent)
    
    return ConsentRead(
        id=consent.id,
        appointment_id=consent.appointment_id,
        patient_id=consent.patient_id,
        status=consent.status,
        consent_text=consent.consent_text,
        granted_at=consent.granted_at,
        created_at=consent.created_at
    )


@router.get("/{appointment_id}", response_model=ConsentRead)
async def get_consent(
    appointment_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get consent status for an appointment."""
    # Verify appointment access
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
    
    # Get consent
    result = await session.execute(
        select(Consent).where(Consent.appointment_id == appointment_id)
    )
    consent = result.scalar_one_or_none()
    
    if not consent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consent not found for this appointment"
        )
    
    return ConsentRead(
        id=consent.id,
        appointment_id=consent.appointment_id,
        patient_id=consent.patient_id,
        status=consent.status,
        consent_text=consent.consent_text,
        granted_at=consent.granted_at,
        created_at=consent.created_at
    )


@router.patch("/{appointment_id}", response_model=ConsentRead)
async def update_consent(
    appointment_id: str,
    update_data: ConsentUpdate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update consent status (patients only - grant or deny)."""
    if current_user.role != UserRole.PATIENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can grant or deny consent"
        )
    
    # Get consent
    result = await session.execute(
        select(Consent).where(Consent.appointment_id == appointment_id)
    )
    consent = result.scalar_one_or_none()
    
    if not consent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consent not found"
        )
    
    # Verify patient owns this consent
    if consent.patient_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own consent"
        )
    
    # Update consent
    consent.status = update_data.status
    if update_data.status == ConsentStatus.GRANTED:
        consent.granted_at = datetime.utcnow()
    consent.ip_address = update_data.ip_address or (request.client.host if request.client else None)
    
    await session.commit()
    await session.refresh(consent)
    
    # Log the consent action
    audit_service = get_audit_service(session)
    client_ip = request.client.host if request.client else None
    await audit_service.log_consent(
        user_id=current_user.id,
        appointment_id=appointment_id,
        granted=(update_data.status == ConsentStatus.GRANTED),
        ip_address=client_ip
    )
    
    return ConsentRead(
        id=consent.id,
        appointment_id=consent.appointment_id,
        patient_id=consent.patient_id,
        status=consent.status,
        consent_text=consent.consent_text,
        granted_at=consent.granted_at,
        created_at=consent.created_at
    )


@router.get("/{appointment_id}/check", response_model=dict)
async def check_consent_status(
    appointment_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Quick check if consent is granted for recording."""
    result = await session.execute(
        select(Consent).where(Consent.appointment_id == appointment_id)
    )
    consent = result.scalar_one_or_none()
    
    can_record = consent is not None and consent.status == ConsentStatus.GRANTED
    
    return {
        "appointment_id": appointment_id,
        "consent_exists": consent is not None,
        "consent_status": consent.status.value if consent else None,
        "can_record": can_record
    }
