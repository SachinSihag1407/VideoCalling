from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core import init_db
from app.api import api_router
from app.services.scheduler import get_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    
    # Initialize and start notification scheduler
    scheduler = await get_scheduler()
    scheduler.start()
    
    yield
    
    # Shutdown
    scheduler.shutdown()


app = FastAPI(
    title="Doctor-Patient Interview Platform",
    description="A secure platform for medical consultations with video calls, consent management, and transcription",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router)


@app.get("/")
async def root():
    return {
        "message": "Doctor-Patient Interview Platform API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
