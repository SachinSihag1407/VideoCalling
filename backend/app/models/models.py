from datetime import datetime
from enum import Enum
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from uuid import uuid4
import random
import string


def generate_meeting_number() -> str:
    """Generate unique meeting number like CARE-2026-XXXX"""
    year = datetime.utcnow().year
    random_part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"CARE-{year}-{random_part}"


class UserRole(str, Enum):
    DOCTOR = "doctor"
    PATIENT = "patient"


class AppointmentStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class ConsentStatus(str, Enum):
    PENDING = "pending"
    GRANTED = "granted"
    DENIED = "denied"


# Base Models
class UserBase(SQLModel):
    email: str = Field(unique=True, index=True)
    full_name: str
    role: UserRole


class User(UserBase, table=True):
    __tablename__ = "users"
    
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    password_hash: str
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    doctor_appointments: List["Appointment"] = Relationship(
        back_populates="doctor",
        sa_relationship_kwargs={"foreign_keys": "[Appointment.doctor_id]"}
    )
    patient_appointments: List["Appointment"] = Relationship(
        back_populates="patient",
        sa_relationship_kwargs={"foreign_keys": "[Appointment.patient_id]"}
    )
    audit_logs: List["AuditLog"] = Relationship(back_populates="user")


class UserCreate(UserBase):
    password: str


class UserRead(UserBase):
    id: str
    is_active: bool
    created_at: datetime


class UserLogin(SQLModel):
    email: str
    password: str


# Appointment Models
class AppointmentBase(SQLModel):
    scheduled_time: datetime
    reason: str
    notes: Optional[str] = None


class Appointment(AppointmentBase, table=True):
    __tablename__ = "appointments"
    
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    meeting_number: str = Field(default_factory=generate_meeting_number, unique=True, index=True)
    doctor_id: str = Field(foreign_key="users.id")
    patient_id: str = Field(foreign_key="users.id")
    status: AppointmentStatus = Field(default=AppointmentStatus.PENDING)
    room_id: str = Field(default_factory=lambda: str(uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    doctor: Optional[User] = Relationship(
        back_populates="doctor_appointments",
        sa_relationship_kwargs={"foreign_keys": "[Appointment.doctor_id]"}
    )
    patient: Optional[User] = Relationship(
        back_populates="patient_appointments",
        sa_relationship_kwargs={"foreign_keys": "[Appointment.patient_id]"}
    )
    interview: Optional["Interview"] = Relationship(back_populates="appointment")
    consent: Optional["Consent"] = Relationship(back_populates="appointment")


class AppointmentCreate(AppointmentBase):
    doctor_id: str


class AppointmentRead(AppointmentBase):
    id: str
    meeting_number: str
    doctor_id: str
    patient_id: str
    status: AppointmentStatus
    room_id: str
    created_at: datetime
    doctor: Optional[UserRead] = None
    patient: Optional[UserRead] = None


class AppointmentUpdate(SQLModel):
    status: Optional[AppointmentStatus] = None
    scheduled_time: Optional[datetime] = None
    notes: Optional[str] = None


# Consent Models
class ConsentBase(SQLModel):
    appointment_id: str = Field(foreign_key="appointments.id")


class Consent(ConsentBase, table=True):
    __tablename__ = "consents"
    
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    patient_id: str = Field(foreign_key="users.id")
    status: ConsentStatus = Field(default=ConsentStatus.PENDING)
    consent_text: str = Field(
        default="I consent to the recording and transcription of this medical interview for documentation purposes."
    )
    granted_at: Optional[datetime] = None
    ip_address: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    appointment: Optional[Appointment] = Relationship(back_populates="consent")


class ConsentCreate(SQLModel):
    appointment_id: str


class ConsentUpdate(SQLModel):
    status: ConsentStatus
    ip_address: Optional[str] = None


class ConsentRead(SQLModel):
    id: str
    appointment_id: str
    patient_id: str
    status: ConsentStatus
    consent_text: str
    granted_at: Optional[datetime]
    created_at: datetime


# Interview Models
class InterviewBase(SQLModel):
    appointment_id: str = Field(foreign_key="appointments.id", unique=True)


class Interview(InterviewBase, table=True):
    __tablename__ = "interviews"
    
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    recording_path: Optional[str] = None
    transcript_path: Optional[str] = None
    transcript_text: Optional[str] = None
    summary_text: Optional[str] = None
    key_points: Optional[str] = None  # JSON string of key points
    duration_seconds: Optional[int] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    appointment: Optional[Appointment] = Relationship(back_populates="interview")


class InterviewCreate(SQLModel):
    appointment_id: str


class InterviewRead(SQLModel):
    id: str
    appointment_id: str
    recording_path: Optional[str]
    transcript_path: Optional[str]
    transcript_text: Optional[str]
    summary_text: Optional[str]
    key_points: Optional[str]
    duration_seconds: Optional[int]
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    created_at: datetime


class InterviewUpdate(SQLModel):
    recording_path: Optional[str] = None
    transcript_path: Optional[str] = None
    transcript_text: Optional[str] = None
    summary_text: Optional[str] = None
    key_points: Optional[str] = None
    duration_seconds: Optional[int] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None


# Audit Log Models
class AuditAction(str, Enum):
    LOGIN = "login"
    LOGOUT = "logout"
    VIEW_APPOINTMENT = "view_appointment"
    CREATE_APPOINTMENT = "create_appointment"
    UPDATE_APPOINTMENT = "update_appointment"
    JOIN_INTERVIEW = "join_interview"
    START_RECORDING = "start_recording"
    STOP_RECORDING = "stop_recording"
    VIEW_RECORDING = "view_recording"
    VIEW_TRANSCRIPT = "view_transcript"
    GRANT_CONSENT = "grant_consent"
    DENY_CONSENT = "deny_consent"


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_logs"
    
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="users.id")
    action: AuditAction
    resource_type: str
    resource_id: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    user: Optional[User] = Relationship(back_populates="audit_logs")


class AuditLogCreate(SQLModel):
    action: AuditAction
    resource_type: str
    resource_id: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None


class AuditLogRead(SQLModel):
    id: str
    user_id: str
    action: AuditAction
    resource_type: str
    resource_id: Optional[str]
    details: Optional[str]
    ip_address: Optional[str]
    created_at: datetime


# Token Models
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(SQLModel):
    user_id: Optional[str] = None
    role: Optional[UserRole] = None
