from datetime import datetime, timedelta
from typing import List, Optional
from sqlmodel import select, Session
from app.models import Appointment, Notification, NotificationType, User, AppointmentStatus
from app.services.email_service import get_email_service, EmailService


class NotificationService:
    def __init__(self, session: Session):
        self.session = session
        self.email_service: EmailService = get_email_service()

    async def notify_appointment_booking(self, appointment: Appointment, patient: User, doctor: User):
        """Send booking notification to both patient and doctor when appointment is created."""
        
        # Email to Patient
        await self.email_service.send_appointment_booking_patient(
            patient_email=patient.email,
            patient_name=patient.full_name,
            doctor_name=doctor.full_name,
            scheduled_time=appointment.scheduled_time,
            meeting_number=appointment.meeting_number,
            reason=appointment.reason
        )
        
        # Store notification for patient
        notif_patient = Notification(
            user_id=patient.id,
            appointment_id=appointment.id,
            type=NotificationType.APPOINTMENT_BOOKING,
            message=f"Your appointment with Dr. {doctor.full_name} has been booked for {appointment.scheduled_time.strftime('%B %d, %Y at %I:%M %p')}. Waiting for doctor confirmation."
        )
        self.session.add(notif_patient)
        
        # Email to Doctor
        await self.email_service.send_appointment_booking_doctor(
            doctor_email=doctor.email,
            doctor_name=doctor.full_name,
            patient_name=patient.full_name,
            patient_phone=getattr(patient, 'phone', None),
            scheduled_time=appointment.scheduled_time,
            meeting_number=appointment.meeting_number,
            reason=appointment.reason
        )
        
        # Store notification for doctor
        notif_doctor = Notification(
            user_id=doctor.id,
            appointment_id=appointment.id,
            type=NotificationType.APPOINTMENT_BOOKING,
            message=f"New appointment request from {patient.full_name} on {appointment.scheduled_time.strftime('%B %d, %Y at %I:%M %p')}. Please confirm."
        )
        self.session.add(notif_doctor)
        
        await self.session.commit()

    async def notify_appointment_confirmation(self, appointment: Appointment, patient: User, doctor: User):
        """Send confirmation email to patient when doctor confirms."""
        
        # Email to Patient
        await self.email_service.send_appointment_confirmed_patient(
            patient_email=patient.email,
            patient_name=patient.full_name,
            doctor_name=doctor.full_name,
            scheduled_time=appointment.scheduled_time,
            meeting_number=appointment.meeting_number
        )
        
        # Store notification
        notif_patient = Notification(
            user_id=patient.id,
            appointment_id=appointment.id,
            type=NotificationType.APPOINTMENT_CONFIRMATION,
            message=f"Great news! Your appointment with Dr. {doctor.full_name} on {appointment.scheduled_time.strftime('%B %d, %Y at %I:%M %p')} has been confirmed."
        )
        self.session.add(notif_patient)
        
        await self.session.commit()

    async def notify_appointment_cancelled(
        self, 
        appointment: Appointment, 
        patient: User, 
        doctor: User, 
        cancelled_by_role: str
    ):
        """Send cancellation notification to both parties."""
        
        cancelled_by = "the doctor" if cancelled_by_role == "doctor" else "the patient"
        
        # Email to Patient
        await self.email_service.send_appointment_cancelled(
            email=patient.email,
            name=patient.full_name,
            other_party_name=f"Dr. {doctor.full_name}",
            scheduled_time=appointment.scheduled_time,
            meeting_number=appointment.meeting_number,
            cancelled_by=cancelled_by
        )
        
        # Store notification for patient
        notif_patient = Notification(
            user_id=patient.id,
            appointment_id=appointment.id,
            type=NotificationType.APPOINTMENT_CANCELLED,
            message=f"Your appointment on {appointment.scheduled_time.strftime('%B %d, %Y at %I:%M %p')} has been cancelled by {cancelled_by}."
        )
        self.session.add(notif_patient)
        
        # Email to Doctor
        await self.email_service.send_appointment_cancelled(
            email=doctor.email,
            name=f"Dr. {doctor.full_name}",
            other_party_name=patient.full_name,
            scheduled_time=appointment.scheduled_time,
            meeting_number=appointment.meeting_number,
            cancelled_by=cancelled_by
        )
        
        # Store notification for doctor
        notif_doctor = Notification(
            user_id=doctor.id,
            appointment_id=appointment.id,
            type=NotificationType.APPOINTMENT_CANCELLED,
            message=f"Appointment with {patient.full_name} on {appointment.scheduled_time.strftime('%B %d, %Y at %I:%M %p')} has been cancelled by {cancelled_by}."
        )
        self.session.add(notif_doctor)
        
        await self.session.commit()

    async def send_upcoming_reminders(self, time_before: timedelta, reminder_type: NotificationType) -> int:
        """
        Send reminders for upcoming appointments.
        time_before: How far ahead to look (e.g., 1 hour, 15 minutes)
        """
        now = datetime.utcnow()
        target_time_start = now + time_before - timedelta(minutes=5)  # 5 min window
        target_time_end = now + time_before + timedelta(minutes=5)
        
        # Time label for email
        if time_before <= timedelta(minutes=20):
            time_until = "15 minutes"
        elif time_before <= timedelta(hours=1, minutes=10):
            time_until = "1 hour"
        else:
            time_until = "24 hours"
        
        # Find confirmed appointments in the target window
        statement = select(Appointment).where(
            Appointment.status == AppointmentStatus.CONFIRMED,
            Appointment.scheduled_time >= target_time_start,
            Appointment.scheduled_time <= target_time_end
        )
        results = await self.session.execute(statement)
        appointments = results.scalars().all()
        
        count = 0
        for appointment in appointments:
            # Check if we already sent this type of reminder
            stmt_notif = select(Notification).where(
                Notification.appointment_id == appointment.id,
                Notification.type == reminder_type
            )
            existing = await self.session.execute(stmt_notif)
            if existing.scalar_one_or_none():
                continue
            
            # Fetch users
            patient = await self.session.get(User, appointment.patient_id)
            doctor = await self.session.get(User, appointment.doctor_id)
            
            if patient and doctor:
                # Send reminder to patient
                await self.email_service.send_upcoming_reminder(
                    email=patient.email,
                    name=patient.full_name,
                    other_party_name=f"Dr. {doctor.full_name}",
                    scheduled_time=appointment.scheduled_time,
                    meeting_number=appointment.meeting_number,
                    is_doctor=False,
                    time_until=time_until
                )
                
                notif_patient = Notification(
                    user_id=patient.id,
                    appointment_id=appointment.id,
                    type=reminder_type,
                    message=f"Reminder: Your appointment with Dr. {doctor.full_name} is in {time_until}."
                )
                self.session.add(notif_patient)
                
                # Send reminder to doctor
                await self.email_service.send_upcoming_reminder(
                    email=doctor.email,
                    name=f"Dr. {doctor.full_name}",
                    other_party_name=patient.full_name,
                    scheduled_time=appointment.scheduled_time,
                    meeting_number=appointment.meeting_number,
                    is_doctor=True,
                    time_until=time_until
                )
                
                notif_doctor = Notification(
                    user_id=doctor.id,
                    appointment_id=appointment.id,
                    type=reminder_type,
                    message=f"Reminder: Your appointment with {patient.full_name} is in {time_until}."
                )
                self.session.add(notif_doctor)
                
                count += 1
        
        await self.session.commit()
        return count

    async def notify_doctor_patient_waiting(
        self, 
        appointment: Appointment, 
        waiting_minutes: int = 5
    ) -> bool:
        """Alert doctor when patient is waiting in the call."""
        
        # Check if we already sent a waiting notification recently (within 10 minutes)
        stmt = select(Notification).where(
            Notification.appointment_id == appointment.id,
            Notification.type == NotificationType.DOCTOR_WAITING_REMINDER,
            Notification.sent_at >= datetime.utcnow() - timedelta(minutes=10)
        )
        existing = await self.session.execute(stmt)
        if existing.scalar_one_or_none():
            return False  # Already notified recently
        
        # Fetch users
        patient = await self.session.get(User, appointment.patient_id)
        doctor = await self.session.get(User, appointment.doctor_id)
        
        if not patient or not doctor:
            return False
        
        # Send urgent alert to doctor
        await self.email_service.send_doctor_waiting_alert(
            doctor_email=doctor.email,
            doctor_name=doctor.full_name,
            patient_name=patient.full_name,
            scheduled_time=appointment.scheduled_time,
            meeting_number=appointment.meeting_number,
            waiting_minutes=waiting_minutes
        )
        
        # Store notification
        notif_doctor = Notification(
            user_id=doctor.id,
            appointment_id=appointment.id,
            type=NotificationType.DOCTOR_WAITING_REMINDER,
            message=f"URGENT: {patient.full_name} is waiting in the consultation room for {waiting_minutes} minutes!"
        )
        self.session.add(notif_doctor)
        
        # Also notify patient that doctor has been alerted
        await self.email_service.send_patient_notified_waiting(
            patient_email=patient.email,
            patient_name=patient.full_name,
            doctor_name=doctor.full_name,
            meeting_number=appointment.meeting_number
        )
        
        notif_patient = Notification(
            user_id=patient.id,
            appointment_id=appointment.id,
            type=NotificationType.PATIENT_WAITING,
            message=f"Dr. {doctor.full_name} has been notified that you are waiting. They should join shortly."
        )
        self.session.add(notif_patient)
        
        await self.session.commit()
        return True

    async def check_upcoming_appointments(self):
        """
        Legacy method - Check for appointments in the next 24 hours.
        For backward compatibility.
        """
        return await self.send_upcoming_reminders(
            timedelta(hours=24), 
            NotificationType.APPOINTMENT_REMINDER
        )

    async def get_user_notifications(self, user_id: str, limit: int = 20) -> List[Notification]:
        """Get notifications for a user."""
        stmt = select(Notification).where(
            Notification.user_id == user_id
        ).order_by(Notification.sent_at.desc()).limit(limit)
        
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def mark_notification_read(self, notification_id: str, user_id: str) -> bool:
        """Mark a notification as read."""
        notification = await self.session.get(Notification, notification_id)
        if notification and notification.user_id == user_id:
            notification.read = True
            await self.session.commit()
            return True
        return False


def get_notification_service(session: Session) -> NotificationService:
    return NotificationService(session)
