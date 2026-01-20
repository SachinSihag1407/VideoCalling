"""
Scheduler Service for Automated Appointment Reminders
Handles automated sending of 24-hour, 1-hour, and 15-minute reminders.
"""
from datetime import timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel

from app.core.config import get_settings
from app.services.notification import NotificationService
from app.models import NotificationType

settings = get_settings()


class NotificationScheduler:
    """Manages scheduled notifications for appointments."""
    
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.engine = None
        self.async_session = None
        
    async def initialize(self):
        """Initialize database connection for scheduler."""
        self.engine = create_async_engine(
            settings.database_url,
            echo=False,
            future=True
        )
        
        self.async_session = sessionmaker(
            self.engine,
            class_=AsyncSession,
            expire_on_commit=False
        )
        
    async def send_24hr_reminders(self):
        """Send reminders for appointments 24 hours away."""
        try:
            async with self.async_session() as session:
                service = NotificationService(session)
                count = await service.send_upcoming_reminders(
                    timedelta(hours=24),
                    NotificationType.APPOINTMENT_REMINDER
                )
                print(f"Sent {count} 24-hour reminders")
        except Exception as e:
            print(f"Error sending 24-hour reminders: {e}")
    
    async def send_1hr_reminders(self):
        """Send reminders for appointments 1 hour away."""
        try:
            async with self.async_session() as session:
                service = NotificationService(session)
                count = await service.send_upcoming_reminders(
                    timedelta(hours=1),
                    NotificationType.UPCOMING_REMINDER_1HR
                )
                if count > 0:
                    print(f"Sent {count} 1-hour reminders")
        except Exception as e:
            print(f"Error sending 1-hour reminders: {e}")
    
    async def send_15min_reminders(self):
        """Send reminders for appointments 15 minutes away."""
        try:
            async with self.async_session() as session:
                service = NotificationService(session)
                count = await service.send_upcoming_reminders(
                    timedelta(minutes=15),
                    NotificationType.UPCOMING_REMINDER_15MIN
                )
                if count > 0:
                    print(f"Sent {count} 15-minute reminders")
        except Exception as e:
            print(f"Error sending 15-minute reminders: {e}")
    
    def start(self):
        """Start the scheduler with all reminder jobs."""
        if not settings.enable_scheduler:
            print("Scheduler disabled by configuration")
            return
        
        # 24-hour reminders - Run once daily at 8:00 AM
        self.scheduler.add_job(
            self.send_24hr_reminders,
            trigger=CronTrigger(hour=8, minute=0),
            id='24hr_reminders',
            name='Send 24-hour appointment reminders',
            replace_existing=True
        )
        
        # 1-hour reminders - Run every 10 minutes
        self.scheduler.add_job(
            self.send_1hr_reminders,
            trigger=IntervalTrigger(minutes=10),
            id='1hr_reminders',
            name='Send 1-hour appointment reminders',
            replace_existing=True
        )
        
        # 15-minute reminders - Run every 5 minutes
        self.scheduler.add_job(
            self.send_15min_reminders,
            trigger=IntervalTrigger(minutes=5),
            id='15min_reminders',
            name='Send 15-minute appointment reminders',
            replace_existing=True
        )
        
        self.scheduler.start()
        print("Notification scheduler started")
        print("   - 24-hour reminders: Daily at 8:00 AM")
        print("   - 1-hour reminders: Every 10 minutes")
        print("   - 15-minute reminders: Every 5 minutes")
    
    def shutdown(self):
        """Gracefully shutdown the scheduler."""
        if self.scheduler.running:
            self.scheduler.shutdown()
            print("Notification scheduler stopped")


# Global scheduler instance
_scheduler = None


async def get_scheduler() -> NotificationScheduler:
    """Get or create the global scheduler instance."""
    global _scheduler
    if _scheduler is None:
        _scheduler = NotificationScheduler()
        await _scheduler.initialize()
    return _scheduler
