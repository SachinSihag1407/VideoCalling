import os
from functools import lru_cache
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://ombiradar@localhost:5432/care_platform"
    
    # JWT
    secret_key: str = "your-super-secret-key-change-in-production-min-32-chars"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    
    # Storage
    storage_provider: str = "local"
    local_storage_path: str = "./storage"
    
    # Transcription
    transcription_mode: str = "mock"  # 'whisper' or 'mock'
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
