"""AI Summarization Service using Google Gemini."""
import os
import json
from typing import Optional
from datetime import datetime

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    print("Warning: google-generativeai not installed. Summarization feature disabled.")


class SummarizationService:
    """Service for generating AI-powered medical interview summaries using Google Gemini."""
    
    def __init__(self):
        self.model = None
        self.api_key = os.getenv("GEMINI_API_KEY")
        
        if GEMINI_AVAILABLE and self.api_key:
            try:
                genai.configure(api_key=self.api_key)
                self.model = genai.GenerativeModel('gemini-pro')
                print("Gemini summarization service initialized successfully")
            except Exception as e:
                print(f"Failed to initialize Gemini: {e}")
    
    def is_available(self) -> bool:
        """Check if summarization service is available."""
        return self.model is not None
    
    async def generate_summary(self, transcript_text: str) -> dict:
        """
        Generate medical summary from interview transcript.
        
        Args:
            transcript_text: The interview transcript
            
        Returns:
            dict with 'summary' and 'key_points'
        """
        if not self.is_available():
            raise Exception("Gemini summarization service not available. Check API key.")
        
        prompt = self._build_prompt(transcript_text)
        
        try:
            # Generate summary using Gemini
            response = self.model.generate_content(prompt)
            summary_text = response.text
            
            # Extract key points
            key_points = self._extract_key_points(summary_text)
            
            return {
                "summary": summary_text,
                "key_points": json.dumps(key_points)
            }
            
        except Exception as e:
            print(f"Summarization error: {e}")
            raise Exception(f"Failed to generate summary: {str(e)}")
    
    def _build_prompt(self, transcript: str) -> str:
        """Build the prompt for Gemini."""
        return f"""You are a medical assistant helping doctors document patient consultations.

Analyze this doctor-patient interview transcript and provide a professional medical summary.

Structure your summary as follows:

**CHIEF COMPLAINT**
[Main reason for visit]

**SYMPTOMS**
[Key symptoms discussed with relevant details]

**MEDICAL HISTORY**
[Any past medical history mentioned]

**ASSESSMENT**
[Doctor's observations and diagnosis]

**TREATMENT PLAN**
[Recommended treatments, medications, or actions]

**FOLLOW-UP**
[Any follow-up recommendations]

Keep the summary concise, professional, and focused on medically relevant information.

TRANSCRIPT:
{transcript}

SUMMARY:"""
    
    def _extract_key_points(self, summary: str) -> list:
        """Extract key points from summary as bullet points."""
        key_points = []
        
        # Look for sections in the summary
        sections = summary.split("**")
        for i, section in enumerate(sections):
            if section.strip() and i % 2 == 1:  # Section headers
                header = section.strip()
                if i + 1 < len(sections):
                    content = sections[i + 1].strip()
                    if content:
                        # Take first line or first 100 chars
                        first_line = content.split('\n')[0][:100]
                        if first_line:
                            key_points.append(f"{header}: {first_line}")
        
        # If no points extracted, create generic ones
        if not key_points:
            lines = [line.strip() for line in summary.split('\n') if line.strip()]
            key_points = lines[:5]  # Take first 5 non-empty lines
        
        return key_points[:10]  # Max 10 key points


# Singleton instance
_summarization_service = None


def get_summarization_service() -> SummarizationService:
    """Get or create summarization service instance."""
    global _summarization_service
    if _summarization_service is None:
        _summarization_service = SummarizationService()
    return _summarization_service
