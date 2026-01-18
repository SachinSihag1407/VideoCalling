from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from pydantic import BaseModel

from app.core import get_session, get_current_user
from app.models import (
    User, UserRole,
    Appointment, AppointmentStatus,
    Interview, InterviewCreate, InterviewRead, InterviewUpdate,
    Consent, ConsentStatus,
    AuditAction
)
from app.services import (
    get_audit_service,
    get_storage_provider, generate_storage_key,
    get_transcription_service
)

router = APIRouter(prefix="/interviews", tags=["Interviews"])


# Request models for real-time transcription
class TranscriptChunkRequest(BaseModel):
    text: str
    speaker: Optional[str] = None


@router.post("/", response_model=InterviewRead, status_code=status.HTTP_201_CREATED)
async def create_interview(
    interview_data: InterviewCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create an interview record for an appointment."""
    # Verify appointment exists
    result = await session.execute(
        select(Appointment).where(Appointment.id == interview_data.appointment_id)
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
    
    # Check if interview already exists
    result = await session.execute(
        select(Interview).where(Interview.appointment_id == interview_data.appointment_id)
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Interview already exists for this appointment"
        )
    
    # Create interview
    interview = Interview(
        appointment_id=interview_data.appointment_id,
        started_at=datetime.utcnow()
    )
    
    session.add(interview)
    await session.commit()
    await session.refresh(interview)
    
    # Log
    audit_service = get_audit_service(session)
    client_ip = request.client.host if request.client else None
    await audit_service.log_interview_join(current_user.id, interview_data.appointment_id, client_ip)
    
    return _interview_to_read(interview)


@router.get("/{appointment_id}", response_model=InterviewRead)
async def get_interview(
    appointment_id: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get interview details for an appointment."""
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
    
    # Get interview
    result = await session.execute(
        select(Interview).where(Interview.appointment_id == appointment_id)
    )
    interview = result.scalar_one_or_none()
    
    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found"
        )
    
    return _interview_to_read(interview)


@router.get("/", response_model=List[InterviewRead])
async def list_interviews(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List all interviews for current user."""
    # Get user's appointments first
    if current_user.role == UserRole.DOCTOR:
        appointment_query = select(Appointment.id).where(Appointment.doctor_id == current_user.id)
    else:
        appointment_query = select(Appointment.id).where(Appointment.patient_id == current_user.id)
    
    result = await session.execute(appointment_query)
    appointment_ids = [row[0] for row in result.fetchall()]
    
    # Get interviews for those appointments
    result = await session.execute(
        select(Interview).where(Interview.appointment_id.in_(appointment_ids))
    )
    interviews = result.scalars().all()
    
    return [_interview_to_read(i) for i in interviews]


@router.post("/{appointment_id}/start-recording", response_model=dict)
async def start_recording(
    appointment_id: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Start recording an interview (requires consent)."""
    # Verify consent is granted
    result = await session.execute(
        select(Consent).where(Consent.appointment_id == appointment_id)
    )
    consent = result.scalar_one_or_none()
    
    if not consent or consent.status != ConsentStatus.GRANTED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recording requires patient consent"
        )
    
    # Get or create interview
    result = await session.execute(
        select(Interview).where(Interview.appointment_id == appointment_id)
    )
    interview = result.scalar_one_or_none()
    
    if not interview:
        interview = Interview(
            appointment_id=appointment_id,
            started_at=datetime.utcnow()
        )
        session.add(interview)
        await session.commit()
        await session.refresh(interview)
    
    # Log recording start
    audit_service = get_audit_service(session)
    client_ip = request.client.host if request.client else None
    await audit_service.log_recording_start(current_user.id, interview.id, client_ip)
    
    return {
        "status": "recording_started",
        "interview_id": interview.id,
        "appointment_id": appointment_id
    }


@router.post("/{appointment_id}/stop-recording", response_model=InterviewRead)
async def stop_recording(
    appointment_id: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Stop recording and finalize interview."""
    result = await session.execute(
        select(Interview).where(Interview.appointment_id == appointment_id)
    )
    interview = result.scalar_one_or_none()
    
    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found"
        )
    
    interview.ended_at = datetime.utcnow()
    if interview.started_at:
        interview.duration_seconds = int((interview.ended_at - interview.started_at).total_seconds())
    
    await session.commit()
    await session.refresh(interview)
    
    # Log recording stop
    audit_service = get_audit_service(session)
    client_ip = request.client.host if request.client else None
    await audit_service.log_recording_stop(current_user.id, interview.id, client_ip)
    
    return _interview_to_read(interview)


@router.post("/{appointment_id}/upload-recording", response_model=InterviewRead)
async def upload_recording(
    appointment_id: str,
    request: Request,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Upload a recording file for an interview."""
    # Verify consent
    result = await session.execute(
        select(Consent).where(Consent.appointment_id == appointment_id)
    )
    consent = result.scalar_one_or_none()
    
    if not consent or consent.status != ConsentStatus.GRANTED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recording upload requires patient consent"
        )
    
    # Get interview
    result = await session.execute(
        select(Interview).where(Interview.appointment_id == appointment_id)
    )
    interview = result.scalar_one_or_none()
    
    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found"
        )
    
    # Save recording
    storage = get_storage_provider()
    file_extension = file.filename.split(".")[-1] if file.filename else "webm"
    storage_key = generate_storage_key(
        "recordings",
        interview.id,
        "interview",
        file_extension
    )
    
    content = await file.read()
    await storage.save(content, storage_key)
    
    interview.recording_path = storage_key
    interview.ended_at = datetime.utcnow()
    if interview.started_at:
        interview.duration_seconds = int((interview.ended_at - interview.started_at).total_seconds())
    
    await session.commit()
    await session.refresh(interview)
    
    # Start transcription
    transcription_service = get_transcription_service()
    transcript = await transcription_service.transcribe_video(
        storage._get_full_path(storage_key) if hasattr(storage, '_get_full_path') else storage_key
    )
    
    if transcript:
        # Save transcript
        transcript_key = generate_storage_key(
            "transcripts",
            interview.id,
            "transcript",
            "txt"
        )
        await storage.save(transcript.encode(), transcript_key)
        
        interview.transcript_path = transcript_key
        interview.transcript_text = transcript
        
        await session.commit()
        await session.refresh(interview)
    
    return _interview_to_read(interview)


@router.get("/{appointment_id}/transcript", response_model=dict)
async def get_transcript(
    appointment_id: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get the transcript for an interview."""
    # Verify access
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
    
    # Get interview
    result = await session.execute(
        select(Interview).where(Interview.appointment_id == appointment_id)
    )
    interview = result.scalar_one_or_none()
    
    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found"
        )
    
    # Log transcript view
    audit_service = get_audit_service(session)
    client_ip = request.client.host if request.client else None
    await audit_service.log(
        user_id=current_user.id,
        action=AuditAction.VIEW_TRANSCRIPT,
        resource_type="interview",
        resource_id=interview.id,
        ip_address=client_ip
    )
    
    return {
        "interview_id": interview.id,
        "appointment_id": appointment_id,
        "transcript": interview.transcript_text,
        "transcript_path": interview.transcript_path
    }


# Real-time transcription endpoints
@router.post("/{appointment_id}/realtime/start", response_model=dict)
async def start_realtime_transcription(
    appointment_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Start real-time transcription session."""
    # Verify access
    result = await session.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = result.scalar_one_or_none()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    if current_user.id not in [appointment.doctor_id, appointment.patient_id]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    transcription_service = get_transcription_service()
    transcription_service.start_realtime_session(appointment_id)
    
    return {
        "status": "started",
        "appointment_id": appointment_id,
        "meeting_number": appointment.meeting_number
    }


@router.post("/{appointment_id}/realtime/chunk", response_model=dict)
async def add_transcript_chunk(
    appointment_id: str,
    chunk_data: TranscriptChunkRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Add a chunk of transcribed text in real-time."""
    # Verify appointment exists and user has access
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

    transcription_service = get_transcription_service()
    
    # Determine speaker based on role
    speaker = chunk_data.speaker
    if not speaker:
        speaker = "Doctor" if current_user.role == UserRole.DOCTOR else "Patient"
    
    transcription_service.add_realtime_chunk(appointment_id, chunk_data.text, speaker)
    
    return {
        "status": "added",
        "current_transcript": transcription_service.get_realtime_transcript(appointment_id)
    }


@router.get("/{appointment_id}/realtime/transcript", response_model=dict)
async def get_realtime_transcript(
    appointment_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get the current real-time transcript."""
    transcription_service = get_transcription_service()
    
    return {
        "appointment_id": appointment_id,
        "transcript": transcription_service.get_realtime_transcript(appointment_id)
    }


@router.post("/{appointment_id}/realtime/end", response_model=dict)
async def end_realtime_transcription(
    appointment_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """End real-time transcription and save to interview."""
    transcription_service = get_transcription_service()
    final_transcript = transcription_service.end_realtime_session(appointment_id)
    
    # Save to interview record
    result = await session.execute(
        select(Interview).where(Interview.appointment_id == appointment_id)
    )
    interview = result.scalar_one_or_none()
    
    if interview:
        interview.transcript_text = final_transcript
        await session.commit()
    
    return {
        "status": "ended",
        "appointment_id": appointment_id,
        "final_transcript": final_transcript
    }


# Summary endpoint
@router.post("/{appointment_id}/generate-summary", response_model=dict)
async def generate_interview_summary(
    appointment_id: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Generate a summary from the interview transcript."""
    # Verify access - only doctors can generate summaries
    if current_user.role != UserRole.DOCTOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors can generate summaries"
        )
    
    # Get appointment with relationships
    result = await session.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = result.scalar_one_or_none()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Get doctor and patient names
    result = await session.execute(select(User).where(User.id == appointment.doctor_id))
    doctor = result.scalar_one_or_none()
    
    result = await session.execute(select(User).where(User.id == appointment.patient_id))
    patient = result.scalar_one_or_none()
    
    # Get interview
    result = await session.execute(
        select(Interview).where(Interview.appointment_id == appointment_id)
    )
    interview = result.scalar_one_or_none()
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    if not interview.transcript_text:
        raise HTTPException(status_code=400, detail="No transcript available to summarize")
    
    # Generate summary
    transcription_service = get_transcription_service()
    summary_data = transcription_service.generate_summary(
        interview.transcript_text,
        doctor_name=doctor.full_name if doctor else "Doctor",
        patient_name=patient.full_name if patient else "Patient"
    )
    
    # Update interview with summary
    interview.summary_text = summary_data["summary"]
    interview.key_points = summary_data["key_points"]
    
    await session.commit()
    await session.refresh(interview)
    
    return {
        "interview_id": interview.id,
        "appointment_id": appointment_id,
        "meeting_number": appointment.meeting_number,
        "summary": summary_data["summary"],
        "key_points": summary_data["key_points"],
        "generated_at": summary_data["generated_at"]
    }


@router.get("/{appointment_id}/summary", response_model=dict)
async def get_interview_summary(
    appointment_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get the summary for an interview."""
    # Verify access
    result = await session.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = result.scalar_one_or_none()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    if current_user.id not in [appointment.doctor_id, appointment.patient_id]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get interview
    result = await session.execute(
        select(Interview).where(Interview.appointment_id == appointment_id)
    )
    interview = result.scalar_one_or_none()
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    return {
        "interview_id": interview.id,
        "appointment_id": appointment_id,
        "meeting_number": appointment.meeting_number,
        "summary": interview.summary_text,
        "key_points": interview.key_points,
        "transcript": interview.transcript_text,
        "duration_seconds": interview.duration_seconds
    }


def _interview_to_read(interview: Interview) -> InterviewRead:
    return InterviewRead(
        id=interview.id,
        appointment_id=interview.appointment_id,
        recording_path=interview.recording_path,
        transcript_path=interview.transcript_path,
        transcript_text=interview.transcript_text,
        summary_text=interview.summary_text,
        key_points=interview.key_points,
        duration_seconds=interview.duration_seconds,
        started_at=interview.started_at,
        ended_at=interview.ended_at,
        created_at=interview.created_at
    )
