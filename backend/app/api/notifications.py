from datetime import timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import select
from pydantic import BaseModel

from app.core import get_session, get_current_user
from app.models import User, Notification, NotificationType, Appointment, AppointmentStatus
from app.services.notification import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class NotificationRead(BaseModel):
    id: str
    type: str
    message: str
    sent_at: str
    read: bool
    appointment_id: Optional[str] = None

    class Config:
        from_attributes = True


class PatientWaitingRequest(BaseModel):
    appointment_id: str
    waiting_minutes: int = 5


@router.get("/", response_model=List[NotificationRead])
async def get_my_notifications(
    limit: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get notifications for the current user."""
    service = NotificationService(session)
    notifications = await service.get_user_notifications(current_user.id, limit)
    
    result = []
    for notif in notifications:
        if unread_only and notif.read:
            continue
        result.append(NotificationRead(
            id=notif.id,
            type=notif.type.value,
            message=notif.message,
            sent_at=notif.sent_at.isoformat(),
            read=notif.read,
            appointment_id=notif.appointment_id
        ))
    
    return result


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Mark a notification as read."""
    service = NotificationService(session)
    success = await service.mark_notification_read(notification_id, current_user.id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found or access denied"
        )
    
    return {"message": "Notification marked as read"}


@router.patch("/mark-all-read")
async def mark_all_notifications_read(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Mark all notifications as read for the current user."""
    stmt = select(Notification).where(
        Notification.user_id == current_user.id,
        Notification.read == False
    )
    result = await session.execute(stmt)
    notifications = result.scalars().all()
    
    for notif in notifications:
        notif.read = True
    
    await session.commit()
    
    return {"message": f"Marked {len(notifications)} notifications as read"}


@router.get("/unread-count")
async def get_unread_count(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get count of unread notifications."""
    stmt = select(Notification).where(
        Notification.user_id == current_user.id,
        Notification.read == False
    )
    result = await session.execute(stmt)
    notifications = result.scalars().all()
    
    return {"unread_count": len(notifications)}


@router.post("/check-reminders")
async def check_reminders(
    session: AsyncSession = Depends(get_session)
):
    """
    Manually trigger a check for upcoming appointment reminders (24 hours).
    In production, this would be a CRON job.
    """
    service = NotificationService(session)
    count = await service.check_upcoming_appointments()
    return {"message": f"Sent {count} 24-hour reminders"}


@router.post("/send-1hr-reminders")
async def send_1hr_reminders(
    session: AsyncSession = Depends(get_session)
):
    """
    Send reminders for appointments happening in 1 hour.
    In production, this would be a CRON job running every few minutes.
    """
    service = NotificationService(session)
    count = await service.send_upcoming_reminders(
        timedelta(hours=1),
        NotificationType.UPCOMING_REMINDER_1HR
    )
    return {"message": f"Sent {count} 1-hour reminders"}


@router.post("/send-15min-reminders")
async def send_15min_reminders(
    session: AsyncSession = Depends(get_session)
):
    """
    Send reminders for appointments happening in 15 minutes.
    In production, this would be a CRON job running every few minutes.
    """
    service = NotificationService(session)
    count = await service.send_upcoming_reminders(
        timedelta(minutes=15),
        NotificationType.UPCOMING_REMINDER_15MIN
    )
    return {"message": f"Sent {count} 15-minute reminders"}


@router.post("/patient-waiting")
async def notify_patient_waiting(
    request: PatientWaitingRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Notify doctor that a patient is waiting in the video call.
    This should be called by the frontend when a patient joins and doctor hasn't.
    """
    # Verify the appointment exists and user is the patient
    result = await session.execute(
        select(Appointment)
        .options(selectinload(Appointment.doctor), selectinload(Appointment.patient))
        .where(Appointment.id == request.appointment_id)
    )
    appointment = result.scalar_one_or_none()
    
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found"
        )
    
    # Only the patient can trigger this notification
    if current_user.id != appointment.patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the patient can trigger this notification"
        )
    
    # Must be a confirmed appointment
    if appointment.status != AppointmentStatus.CONFIRMED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Appointment is not confirmed"
        )
    
    service = NotificationService(session)
    sent = await service.notify_doctor_patient_waiting(
        appointment,
        request.waiting_minutes
    )
    
    if sent:
        return {"message": "Doctor has been notified that you are waiting"}
    else:
        return {"message": "Doctor was already notified recently. Please wait a few more minutes."}
