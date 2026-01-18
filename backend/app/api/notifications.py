from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core import get_session
from app.services.notification import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.post("/check-reminders")
async def check_reminders(
    session: AsyncSession = Depends(get_session)
):
    """
    Manually trigger a check for upcoming appointment reminders.
    In production, this would be a CRON job.
    """
    service = NotificationService(session)
    count = await service.check_upcoming_appointments()
    return {"message": f"Sent {count} reminders"}
