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
    storage_provider: str = "local"  # Change to "s3" for production
    local_storage_path: str = "./storage"
    
    # AWS S3 Configuration (required when storage_provider="s3")
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    s3_bucket_name: str = ""
    
    # Email/SMTP Configuration
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    from_email: str = "noreply@careplatform.com"
    
    # Scheduler
    enable_scheduler: bool = True  # Set to False to disable automated reminders
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
