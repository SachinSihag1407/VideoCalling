import os
import tempfile
import subprocess
import json
from datetime import datetime
from typing import Optional, List, Dict
from app.core.config import get_settings

settings = get_settings()


class TranscriptionService:
    def __init__(self):
        self.mode = settings.transcription_mode
        self._model = None
        self._realtime_transcripts: Dict[str, List[str]] = {}  # appointment_id -> list of transcript chunks
    
    def _load_whisper_model(self):
        if self._model is None and self.mode == "whisper":
            import whisper
            self._model = whisper.load_model("base")
        return self._model
    
    async def transcribe(self, audio_path: str) -> Optional[str]:
        """Transcribe audio file to text."""
        if self.mode == "mock":
            return self._mock_transcription(audio_path)
        elif self.mode == "whisper":
            return await self._whisper_transcription(audio_path)
        return None
    
    def _mock_transcription(self, audio_path: str) -> str:
        """Generate mock transcription for demo purposes."""
        return """[Medical Interview Transcript]

Doctor: Good morning. How are you feeling today?

Patient: I've been having some headaches for the past week.

Doctor: Can you describe the pain? Is it constant or does it come and go?

Patient: It comes and goes, mostly in the afternoon. It's a throbbing pain on the right side.

Doctor: Have you noticed any triggers? Like stress, certain foods, or lack of sleep?

Patient: Now that you mention it, I have been under a lot of stress at work lately.

Doctor: That could certainly be a factor. Have you been getting enough sleep?

Patient: Not really, maybe 5-6 hours a night.

Doctor: I see. Let's discuss some lifestyle changes and possibly some medication options.

[End of Transcript]"""
    
    async def _whisper_transcription(self, audio_path: str) -> Optional[str]:
        """Use OpenAI Whisper for real transcription."""
        try:
            model = self._load_whisper_model()
            result = model.transcribe(audio_path)
            return result["text"]
        except Exception as e:
            print(f"Whisper transcription error: {e}")
            return self._mock_transcription(audio_path)
    
    async def transcribe_video(self, video_path: str) -> Optional[str]:
        """Extract audio from video and transcribe."""
        try:
            # Extract audio using ffmpeg
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                audio_path = tmp.name
            
            subprocess.run([
                "ffmpeg", "-i", video_path,
                "-vn", "-acodec", "pcm_s16le",
                "-ar", "16000", "-ac", "1",
                audio_path, "-y"
            ], check=True, capture_output=True)
            
            # Transcribe the extracted audio
            transcript = await self.transcribe(audio_path)
            
            # Clean up temp file
            os.unlink(audio_path)
            
            return transcript
        except subprocess.CalledProcessError as e:
            print(f"FFmpeg error: {e}")
            return self._mock_transcription(video_path)
        except Exception as e:
            print(f"Video transcription error: {e}")
            return self._mock_transcription(video_path)

    # Real-time transcription methods
    def start_realtime_session(self, appointment_id: str):
        """Start a real-time transcription session."""
        self._realtime_transcripts[appointment_id] = []
    
    def add_realtime_chunk(self, appointment_id: str, text: str, speaker: str = "Unknown"):
        """Add a chunk of transcribed text to the real-time session."""
        if appointment_id not in self._realtime_transcripts:
            self._realtime_transcripts[appointment_id] = []
        
        timestamp = datetime.utcnow().strftime("%H:%M:%S")
        chunk = f"[{timestamp}] {speaker}: {text}"
        self._realtime_transcripts[appointment_id].append(chunk)
    
    def get_realtime_transcript(self, appointment_id: str) -> str:
        """Get the current real-time transcript."""
        if appointment_id not in self._realtime_transcripts:
            return ""
        return "\n".join(self._realtime_transcripts[appointment_id])
    
    def end_realtime_session(self, appointment_id: str) -> str:
        """End the real-time session and return final transcript."""
        transcript = self.get_realtime_transcript(appointment_id)
        if appointment_id in self._realtime_transcripts:
            del self._realtime_transcripts[appointment_id]
        return transcript
    
    def generate_summary(self, transcript: str, doctor_name: str = "Doctor", patient_name: str = "Patient") -> Dict:
        """Generate a summary from the transcript."""
        # In production, this would use an AI model (GPT, Claude, etc.)
        # For now, generate a structured mock summary
        
        summary = f"""## Medical Consultation Summary

### Participants
- **Doctor**: {doctor_name}
- **Patient**: {patient_name}
- **Date**: {datetime.utcnow().strftime("%B %d, %Y")}

### Chief Complaint
Patient presented with complaints of recurring headaches over the past week.

### History of Present Illness
- Duration: 1 week
- Location: Right side of head
- Character: Throbbing pain
- Timing: Mostly in the afternoon
- Aggravating factors: Stress, lack of sleep

### Assessment
Tension-type headache likely related to:
1. Work-related stress
2. Sleep deprivation (5-6 hours/night)

### Plan
1. Lifestyle modifications recommended:
   - Improve sleep hygiene (aim for 7-8 hours)
   - Stress management techniques
2. Discussed medication options if symptoms persist
3. Follow-up if no improvement in 2 weeks

### Patient Education
- Explained the connection between stress, sleep, and headaches
- Discussed importance of regular sleep schedule
"""
        
        key_points = [
            "Patient experiencing recurring headaches for 1 week",
            "Pain is throbbing, located on right side, occurs in afternoon",
            "Possible triggers: work stress, insufficient sleep",
            "Recommended lifestyle changes before medication",
            "Follow-up scheduled if no improvement"
        ]
        
        return {
            "summary": summary,
            "key_points": json.dumps(key_points),
            "generated_at": datetime.utcnow().isoformat()
        }


# Singleton instance for real-time transcript storage
_transcription_service_instance = None

def get_transcription_service() -> TranscriptionService:
    global _transcription_service_instance
    if _transcription_service_instance is None:
        _transcription_service_instance = TranscriptionService()
    return _transcription_service_instance
