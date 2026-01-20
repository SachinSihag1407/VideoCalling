"""
Email Service for CARE Platform
Handles all email notifications for appointments, reminders, and alerts.
"""
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Optional
from app.core.config import get_settings

settings = get_settings()


class EmailService:
    """Service for sending email notifications."""
    
    def __init__(self):
        settings = get_settings()
        # Email configuration from settings
        self.smtp_host = settings.smtp_host
        self.smtp_port = settings.smtp_port
        self.smtp_user = settings.smtp_user
        self.smtp_password = settings.smtp_password
        self.from_email = settings.from_email
        self.from_name = "CARE Platform"
        
        # Validate SMTP configuration
        if not self.smtp_user or not self.smtp_password:
            raise ValueError(
                "SMTP credentials not configured. "
                "Please set SMTP_USER and SMTP_PASSWORD in .env file"
            )
    
    def _get_base_template(self, content: str, title: str) -> str:
        """Generate base HTML email template."""
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>{title}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fb;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f7fb; padding: 20px;">
                <tr>
                    <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                            <!-- Header -->
                            <tr>
                                <td style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); padding: 30px; text-align: center;">
                                    <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🏥 CARE Platform</h1>
                                    <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 14px;">Secure Medical Consultations</p>
                                </td>
                            </tr>
                            <!-- Content -->
                            <tr>
                                <td style="padding: 40px 30px;">
                                    {content}
                                </td>
                            </tr>
                            <!-- Footer -->
                            <tr>
                                <td style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                                    <p style="color: #64748b; font-size: 12px; margin: 0;">
                                        This is an automated message from CARE Platform.<br>
                                        Please do not reply to this email.
                                    </p>
                                    <p style="color: #94a3b8; font-size: 11px; margin: 10px 0 0 0;">
                                        © 2026 CARE Platform. All rights reserved. | HIPAA Compliant
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """
    
    async def send_email(self, to_email: str, subject: str, html_content: str, plain_content: Optional[str] = None) -> bool:
        """Send an email via SMTP."""
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{self.from_name} <{self.from_email}>"
            msg["To"] = to_email
            
            # Plain text fallback
            if plain_content:
                msg.attach(MIMEText(plain_content, "plain"))
            
            # HTML content
            msg.attach(MIMEText(html_content, "html"))
            
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.sendmail(self.from_email, to_email, msg.as_string())
            
            print(f" Email sent to {to_email}: {subject}")
            return True
        except Exception as e:
            print(f"❌ Failed to send email to {to_email}: {e}")
            return False
    
    # ==================== Appointment Emails ====================
    
    async def send_appointment_booking_patient(
        self, 
        patient_email: str, 
        patient_name: str,
        doctor_name: str, 
        scheduled_time: datetime,
        meeting_number: str,
        reason: str
    ) -> bool:
        """Send appointment booking confirmation to patient."""
        formatted_time = scheduled_time.strftime("%B %d, %Y at %I:%M %p")
        
        content = f"""
        <h2 style="color: #1e293b; margin: 0 0 20px 0;">Appointment Booked Successfully! ✅</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            Hello <strong>{patient_name}</strong>,
        </p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            Your appointment has been successfully booked. Here are the details:
        </p>
        
        <div style="background-color: #f0f9ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <table style="width: 100%;">
                <tr>
                    <td style="padding: 8px 0; color: #64748b; width: 140px;">👨‍⚕️ Doctor:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{doctor_name}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b;">📅 Date & Time:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{formatted_time}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b;">🔢 Meeting ID:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{meeting_number}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b;">📋 Reason:</td>
                    <td style="padding: 8px 0; color: #1e293b;">{reason}</td>
                </tr>
            </table>
        </div>
        
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            ⏳ <strong>Note:</strong> Your appointment is pending confirmation from the doctor. 
            You will receive another email once the doctor confirms.
        </p>
        
        <div style="text-align: center; margin-top: 30px;">
            <a href="#" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
                View Appointment
            </a>
        </div>
        """
        
        html = self._get_base_template(content, "Appointment Booked - CARE Platform")
        return await self.send_email(patient_email, "🏥 Appointment Booked - CARE Platform", html)
    
    async def send_appointment_booking_doctor(
        self,
        doctor_email: str,
        doctor_name: str,
        patient_name: str,
        patient_phone: Optional[str],
        scheduled_time: datetime,
        meeting_number: str,
        reason: str
    ) -> bool:
        """Send new appointment notification to doctor."""
        formatted_time = scheduled_time.strftime("%B %d, %Y at %I:%M %p")
        phone_display = patient_phone or "Not provided"
        
        content = f"""
        <h2 style="color: #1e293b; margin: 0 0 20px 0;">New Appointment Request 📋</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            Hello <strong>Dr. {doctor_name}</strong>,
        </p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            A new appointment has been scheduled with you. Please review and confirm.
        </p>
        
        <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <table style="width: 100%;">
                <tr>
                    <td style="padding: 8px 0; color: #64748b; width: 140px;">👤 Patient:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{patient_name}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b;">📱 Phone:</td>
                    <td style="padding: 8px 0; color: #1e293b;">{phone_display}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b;">📅 Date & Time:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{formatted_time}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b;">🔢 Meeting ID:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{meeting_number}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b;">📋 Reason:</td>
                    <td style="padding: 8px 0; color: #1e293b;">{reason}</td>
                </tr>
            </table>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
            <a href="#" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin-right: 10px;">
                ✓ Confirm Appointment
            </a>
        </div>
        """
        
        html = self._get_base_template(content, "New Appointment - CARE Platform")
        return await self.send_email(doctor_email, "📋 New Appointment Request - CARE Platform", html)
    
    async def send_appointment_confirmed_patient(
        self,
        patient_email: str,
        patient_name: str,
        doctor_name: str,
        scheduled_time: datetime,
        meeting_number: str
    ) -> bool:
        """Send appointment confirmation to patient when doctor confirms."""
        formatted_time = scheduled_time.strftime("%B %d, %Y at %I:%M %p")
        
        content = f"""
        <h2 style="color: #1e293b; margin: 0 0 20px 0;">Appointment Confirmed! 🎉</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            Hello <strong>{patient_name}</strong>,
        </p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            Great news! Your appointment has been confirmed by the doctor.
        </p>
        
        <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <table style="width: 100%;">
                <tr>
                    <td style="padding: 8px 0; color: #64748b; width: 140px;">👨‍⚕️ Doctor:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{doctor_name}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b;">📅 Date & Time:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{formatted_time}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b;">🔢 Meeting ID:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{meeting_number}</td>
                </tr>
            </table>
        </div>
        
        <div style="background-color: #fef3c7; padding: 15px 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #92400e; font-size: 14px; margin: 0;">
                💡 <strong>Tip:</strong> Please join the video call 5 minutes before your scheduled time.
                Make sure you have a stable internet connection and your camera/microphone are working.
            </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
            <a href="#" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
                Join Video Call
            </a>
        </div>
        """
        
        html = self._get_base_template(content, "Appointment Confirmed - CARE Platform")
        return await self.send_email(patient_email, " Appointment Confirmed - CARE Platform", html)
    
    async def send_appointment_cancelled(
        self,
        email: str,
        name: str,
        other_party_name: str,
        scheduled_time: datetime,
        meeting_number: str,
        cancelled_by: str
    ) -> bool:
        """Send appointment cancellation notification."""
        formatted_time = scheduled_time.strftime("%B %d, %Y at %I:%M %p")
        
        content = f"""
        <h2 style="color: #dc2626; margin: 0 0 20px 0;">Appointment Cancelled ❌</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            Hello <strong>{name}</strong>,
        </p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            We regret to inform you that your appointment has been cancelled by {cancelled_by}.
        </p>
        
        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <table style="width: 100%;">
                <tr>
                    <td style="padding: 8px 0; color: #64748b; width: 140px;">With:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{other_party_name}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b;">Scheduled for:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{formatted_time}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b;">Meeting ID:</td>
                    <td style="padding: 8px 0; color: #1e293b;">{meeting_number}</td>
                </tr>
            </table>
        </div>
        
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            If you would like to reschedule, please book a new appointment through the platform.
        </p>
        """
        
        html = self._get_base_template(content, "Appointment Cancelled - CARE Platform")
        return await self.send_email(email, "❌ Appointment Cancelled - CARE Platform", html)
    
    # ==================== Reminder Emails ====================
    
    async def send_upcoming_reminder(
        self,
        email: str,
        name: str,
        other_party_name: str,
        scheduled_time: datetime,
        meeting_number: str,
        is_doctor: bool,
        time_until: str  # e.g., "1 hour", "15 minutes"
    ) -> bool:
        """Send upcoming appointment reminder."""
        formatted_time = scheduled_time.strftime("%B %d, %Y at %I:%M %p")
        role_label = "Patient" if is_doctor else "Doctor"
        
        content = f"""
        <h2 style="color: #f59e0b; margin: 0 0 20px 0;">⏰ Appointment Reminder</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            Hello <strong>{name}</strong>,
        </p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            This is a friendly reminder that your appointment is coming up in <strong>{time_until}</strong>.
        </p>
        
        <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <table style="width: 100%;">
                <tr>
                    <td style="padding: 8px 0; color: #64748b; width: 140px;">{role_label}:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{other_party_name}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b;">📅 Date & Time:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{formatted_time}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b;">🔢 Meeting ID:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{meeting_number}</td>
                </tr>
            </table>
        </div>
        
        <div style="background-color: #f0f9ff; padding: 15px 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #1e40af; font-size: 14px; margin: 0;">
                📌 <strong>Checklist:</strong><br>
                • Check your internet connection<br>
                • Test your camera and microphone<br>
                • Find a quiet, well-lit space<br>
                • Have relevant documents ready
            </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
            <a href="#" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
                Join Video Call
            </a>
        </div>
        """
        
        html = self._get_base_template(content, "Appointment Reminder - CARE Platform")
        return await self.send_email(email, f"⏰ Reminder: Appointment in {time_until} - CARE Platform", html)
    
    async def send_doctor_waiting_alert(
        self,
        doctor_email: str,
        doctor_name: str,
        patient_name: str,
        scheduled_time: datetime,
        meeting_number: str,
        waiting_minutes: int
    ) -> bool:
        """Send urgent alert to doctor when patient is waiting."""
        formatted_time = scheduled_time.strftime("%I:%M %p")
        
        content = f"""
        <h2 style="color: #dc2626; margin: 0 0 20px 0;">🚨 Patient Waiting - Urgent!</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            Hello <strong>Dr. {doctor_name}</strong>,
        </p>
        <p style="color: #dc2626; font-size: 18px; font-weight: 600; line-height: 1.6;">
            Your patient <strong>{patient_name}</strong> has joined the video call and is waiting for you!
        </p>
        
        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <table style="width: 100%;">
                <tr>
                    <td style="padding: 8px 0; color: #64748b; width: 140px;">👤 Patient:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{patient_name}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b;">📅 Scheduled:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{formatted_time}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b;">🔢 Meeting ID:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{meeting_number}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b;">⏱️ Waiting:</td>
                    <td style="padding: 8px 0; color: #dc2626; font-weight: 600;">{waiting_minutes} minutes</td>
                </tr>
            </table>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
            <a href="#" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 700; font-size: 16px;">
                🎥 JOIN NOW
            </a>
        </div>
        
        <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 20px;">
            Please join immediately to avoid patient dissatisfaction.
        </p>
        """
        
        html = self._get_base_template(content, "URGENT: Patient Waiting - CARE Platform")
        return await self.send_email(doctor_email, "🚨 URGENT: Patient Waiting for Consultation - CARE Platform", html)
    
    async def send_patient_notified_waiting(
        self,
        patient_email: str,
        patient_name: str,
        doctor_name: str,
        meeting_number: str
    ) -> bool:
        """Notify patient that doctor has been alerted about the wait."""
        content = f"""
        <h2 style="color: #3b82f6; margin: 0 0 20px 0;">Doctor Notified 📢</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            Hello <strong>{patient_name}</strong>,
        </p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            We noticed you're waiting for your consultation. <strong>Dr. {doctor_name}</strong> has been 
            notified and should join shortly.
        </p>
        
        <div style="background-color: #f0f9ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <p style="color: #1e40af; font-size: 14px; margin: 0;">
                🔢 Meeting ID: <strong>{meeting_number}</strong><br><br>
                Thank you for your patience. The doctor will be with you shortly.
            </p>
        </div>
        
        <p style="color: #64748b; font-size: 14px;">
            If you continue to wait for an extended period, please contact our support.
        </p>
        """
        
        html = self._get_base_template(content, "Doctor Notified - CARE Platform")
        return await self.send_email(patient_email, "📢 Doctor Has Been Notified - CARE Platform", html)


# Singleton instance
_email_service = None

def get_email_service() -> EmailService:
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service
