import os
import tempfile
import subprocess
import json
from datetime import datetime
from typing import Optional, List, Dict


class TranscriptionService:
    """
    Production-grade transcription service using OpenAI Whisper.
    Requires: pip install openai-whisper
    """
    
    def __init__(self):
        self.model = None
        self._realtime_transcripts: Dict[str, List[str]] = {}
        self._load_model()
    
    def _load_model(self):
        """Load Whisper model on initialization."""
        try:
            import whisper
            self.model = whisper.load_model("base")
            print("Whisper model loaded successfully")
        except ImportError:
            print("WARNING: openai-whisper not installed. Transcription will fail.")
            print("   Install with: pip install openai-whisper")
            self.model = None
        except Exception as e:
            print(f"WARNING: Failed to load Whisper model: {e}")
            self.model = None
    
    @property
    def is_available(self) -> bool:
        """Check if Whisper is available."""
        return self.model is not None
    
    async def transcribe(self, audio_path: str) -> str:
        """Transcribe audio file using Whisper AI."""
        if not self.model:
            raise RuntimeError(
                "Whisper model not loaded. Please install openai-whisper: "
                "pip install openai-whisper"
            )
        
        try:
            result = self.model.transcribe(audio_path, language="en")
            return result["text"].strip()
        except Exception as e:
            raise RuntimeError(f"Transcription failed: {str(e)}") from e
    
    async def transcribe_video(self, video_path: str) -> Optional[str]:
        """Extract audio from video and transcribe using Whisper AI."""
        audio_path = None
        try:
            # Extract audio using ffmpeg
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                audio_path = tmp.name
            
            subprocess.run([
                "ffmpeg", "-i", video_path,
                "-vn", "-acodec", "pcm_s16le",
                "-ar", "16000", "-ac", "1",
                audio_path, "-y"
            ], check=True, capture_output=True, text=True)
            
            # Transcribe the extracted audio
            transcript = await self.transcribe(audio_path)
            
            return transcript
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"FFmpeg audio extraction failed: {e.stderr}") from e
        except Exception as e:
            raise RuntimeError(f"Video transcription error: {str(e)}") from e
        finally:
            # Clean up temp file
            if audio_path and os.path.exists(audio_path):
                os.unlink(audio_path)
    
    # Real-time transcription methods
    def start_realtime_session(self, appointment_id: str):
        """Start a real-time transcription session."""
        # Only initialize if no existing transcript (preserve on restart)
        if appointment_id not in self._realtime_transcripts:
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
    
    def generate_summary(
        self, 
        transcript: str, 
        doctor_name: str = "Doctor",
        patient_name: str = "Patient"
    ) -> dict:
        """
        Generate a summary and key points from a transcript.
        
        Note: In production, this should use an LLM API (OpenAI GPT, Claude, etc.)
        for medical-grade summarization. This is a basic implementation.
        """
        if not transcript or len(transcript.strip()) < 10:
            raise ValueError("Transcript is too short or empty to generate a summary")
        
        # Simple extraction for now (replace with LLM in production)
        lines = [line.strip() for line in transcript.split('\n') if line.strip()]
        
        # Extract key dialogue points
        key_points = []
        for line in lines:
            # Look for medically relevant statements
            if any(keyword in line.lower() for keyword in 
                   ['pain', 'symptom', 'feel', 'hurt', 'problem', 'medication', 
                    'treatment', 'diagnosis', 'concern', 'history']):
                # Clean up and add
                clean_line = line.split(':', 1)[-1].strip() if ':' in line else line
                if clean_line and len(clean_line) > 10:
                    key_points.append(clean_line)
        
        # Limit to top 5 most relevant
        key_points = key_points[:5]
        
        if not key_points:
            key_points = ["Medical consultation completed", "Full transcript available for review"]
        
        # Generate summary
        word_count = len(transcript.split())
        line_count = len(lines)
        
        summary = (
            f"Medical consultation between {doctor_name} and {patient_name}. "
            f"Transcript contains {line_count} dialogue exchanges ({word_count} words). "
            f"{len(key_points)} key points identified. "
            "Review full transcript for complete medical details."
        )
        
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
