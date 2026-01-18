from datetime import datetime, timedelta
from typing import List
from sqlmodel import select, Session
from app.models import Appointment, Notification, NotificationType, User, AppointmentStatus

class NotificationService:
    def __init__(self, session: Session):
        self.session = session

    async def send_email(self, to_email: str, subject: str, content: str):
        """
        Mock email sending service.
        In a real app, this would use SMTP or an API like SendGrid/SES.
        """
        print(f"[{datetime.utcnow()}] MOCK EMAIL SERVICE")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print(f"Content: {content}")
        print("-" * 50)
        return True

    async def notify_appointment_confirmation(self, appointment: Appointment, patient: User, doctor: User):
        """Send confirmation email to patient and doctor."""
        
        # Notify Patient
        message_patient = f"Your appointment with Dr. {doctor.full_name} is confirmed for {appointment.scheduled_time}."
        await self.send_email(patient.email, "Appointment Confirmed", message_patient)
        
        notif_patient = Notification(
            user_id=patient.id,
            appointment_id=appointment.id,
            type=NotificationType.APPOINTMENT_CONFIRMATION,
            message=message_patient
        )
        self.session.add(notif_patient)

        # Notify Doctor
        message_doctor = f"New appointment with {patient.full_name} on {appointment.scheduled_time}."
        await self.send_email(doctor.email, "New Appointment Scheduled", message_doctor)
        
        notif_doctor = Notification(
            user_id=doctor.id,
            appointment_id=appointment.id,
            type=NotificationType.APPOINTMENT_CONFIRMATION,
            message=message_doctor
        )
        self.session.add(notif_doctor)
        
        await self.session.commit()

    async def check_upcoming_appointments(self):
        """
        Check for appointments in the next 24 hours that haven't been reminded.
        This would typically be run by a scheduler/cron job.
        For this hackathon, we can expose an endpoint to trigger it.
        """
        now = datetime.utcnow()
        tomorrow = now + timedelta(days=1)
        
        # Find pending appointments in the next 24h
        statement = select(Appointment).where(
            Appointment.status == AppointmentStatus.CONFIRMED,
            Appointment.scheduled_time >= now,
            Appointment.scheduled_time <= tomorrow
        )
        results = await self.session.execute(statement)
        appointments = results.scalars().all()
        
        count = 0
        for appointment in appointments:
            # Check if we already sent a reminder
            stmt_notif = select(Notification).where(
                Notification.appointment_id == appointment.id,
                Notification.type == NotificationType.APPOINTMENT_REMINDER
            )
            existing = await self.session.execute(stmt_notif)
            if existing.scalar_one_or_none():
                continue

            # Send Reminder
            # Need to fetch users (lazy loading might need explicit join or separate fetch depending on async config)
            # Fetching manually to be safe with async
            patient = await self.session.get(User, appointment.patient_id)
            
            if patient:
                msg = f"Reminder: You have an appointment tomorrow at {appointment.scheduled_time}."
                await self.send_email(patient.email, "Appointment Reminder", msg)
                
                notif = Notification(
                    user_id=patient.id,
                    appointment_id=appointment.id,
                    type=NotificationType.APPOINTMENT_REMINDER,
                    message=msg
                )
                self.session.add(notif)
                count += 1
        
        await self.session.commit()
        return count
