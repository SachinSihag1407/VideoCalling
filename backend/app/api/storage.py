from fastapi import APIRouter, Depends, HTTPException, Response
from app.core import get_current_user
from app.models import User
from app.services import get_storage_provider

router = APIRouter(prefix="/storage", tags=["Storage"])


@router.get("/{path:path}")
async def get_file(
    path: str,
    current_user: User = Depends(get_current_user)
):
    """Get a file from storage (with authentication)."""
    storage = get_storage_provider()
    
    if not await storage.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    
    content = await storage.get(path)
    
    # Determine content type
    content_type = "application/octet-stream"
    if path.endswith(".txt"):
        content_type = "text/plain"
    elif path.endswith(".webm"):
        content_type = "video/webm"
    elif path.endswith(".mp4"):
        content_type = "video/mp4"
    elif path.endswith(".wav"):
        content_type = "audio/wav"
    elif path.endswith(".mp3"):
        content_type = "audio/mpeg"
    
    return Response(content=content, media_type=content_type)
