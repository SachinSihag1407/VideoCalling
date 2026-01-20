#!/usr/bin/env python3
"""
Database migration script to add new columns:
- meeting_number to appointments table
- summary_text, key_points to interviews table
"""
import asyncio
import os
import sys

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


DATABASE_URL = "postgresql+asyncpg://ombiradar@localhost:5432/care_platform"


async def migrate():
    engine = create_async_engine(DATABASE_URL, echo=True)
    
    async with engine.begin() as conn:
        # Add meeting_number column to appointments if not exists
        try:
            await conn.execute(text("""
                ALTER TABLE appointments 
                ADD COLUMN IF NOT EXISTS meeting_number VARCHAR(20);
            """))
            print(" Added meeting_number column to appointments")
        except Exception as e:
            print(f"Note: meeting_number column - {e}")
        
        # Add summary_text column to interviews if not exists
        try:
            await conn.execute(text("""
                ALTER TABLE interviews 
                ADD COLUMN IF NOT EXISTS summary_text TEXT;
            """))
            print(" Added summary_text column to interviews")
        except Exception as e:
            print(f"Note: summary_text column - {e}")
        
        # Add key_points column to interviews if not exists
        try:
            await conn.execute(text("""
                ALTER TABLE interviews 
                ADD COLUMN IF NOT EXISTS key_points TEXT;
            """))
            print(" Added key_points column to interviews")
        except Exception as e:
            print(f"Note: key_points column - {e}")
        
        # Update existing appointments with meeting numbers
        try:
            await conn.execute(text("""
                UPDATE appointments 
                SET meeting_number = CONCAT('CARE-', EXTRACT(YEAR FROM created_at)::TEXT, '-', 
                    UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)))
                WHERE meeting_number IS NULL;
            """))
            print(" Updated existing appointments with meeting numbers")
        except Exception as e:
            print(f"Note: updating meeting numbers - {e}")
    
    await engine.dispose()
    print("\n🎉 Migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(migrate())
