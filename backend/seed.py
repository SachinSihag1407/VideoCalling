import asyncio
from sqlmodel import select
from app.core.database import async_session, init_db
from app.core.security import get_password_hash
from app.models import User, UserRole


async def seed_data():
    """Seed the database with demo data."""
    await init_db()
    
    async with async_session() as session:
        # Check if data already exists
        result = await session.execute(select(User).limit(1))
        if result.scalar_one_or_none():
            print("Database already seeded. Skipping...")
            return
        
        # Create demo doctors
        doctors = [
            User(
                email="dr.smith@hospital.com",
                full_name="Dr. John Smith",
                role=UserRole.DOCTOR,
                password_hash=get_password_hash("doctor123"),
                phone="+1 (555) 100-0001",
                specialization="Cardiology",
                license_number="MD-12345-2020",
                hospital_affiliation="City General Hospital",
                years_of_experience=15
            ),
            User(
                email="dr.johnson@hospital.com",
                full_name="Dr. Emily Johnson",
                role=UserRole.DOCTOR,
                password_hash=get_password_hash("doctor123"),
                phone="+1 (555) 100-0002",
                specialization="Dermatology",
                license_number="MD-23456-2018",
                hospital_affiliation="Metro Medical Center",
                years_of_experience=10
            ),
            User(
                email="dr.williams@hospital.com",
                full_name="Dr. Michael Williams",
                role=UserRole.DOCTOR,
                password_hash=get_password_hash("doctor123"),
                phone="+1 (555) 100-0003",
                specialization="General Medicine",
                license_number="MD-34567-2015",
                hospital_affiliation="Community Health Center",
                years_of_experience=20
            ),
        ]
        
        # Create demo patients
        patients = [
            User(
                email="patient1@email.com",
                full_name="Alice Brown",
                role=UserRole.PATIENT,
                password_hash=get_password_hash("patient123"),
                phone="+1 (555) 200-0001",
                date_of_birth="1990-05-15",
                blood_group="A+",
                emergency_contact="+1 (555) 999-0001",
                address="123 Main St, New York, NY 10001"
            ),
            User(
                email="patient2@email.com",
                full_name="Bob Wilson",
                role=UserRole.PATIENT,
                password_hash=get_password_hash("patient123"),
                phone="+1 (555) 200-0002",
                date_of_birth="1985-08-22",
                blood_group="O+",
                emergency_contact="+1 (555) 999-0002",
                address="456 Oak Ave, Los Angeles, CA 90001"
            ),
            User(
                email="patient3@email.com",
                full_name="Carol Davis",
                role=UserRole.PATIENT,
                password_hash=get_password_hash("patient123"),
                phone="+1 (555) 200-0003",
                date_of_birth="1995-12-10",
                blood_group="B-",
                emergency_contact="+1 (555) 999-0003",
                address="789 Pine Rd, Chicago, IL 60601"
            ),
        ]
        
        # Add all users
        for user in doctors + patients:
            session.add(user)
        
        await session.commit()
        
        print(" Database seeded successfully!")
        print("\n📋 Demo Accounts:")
        print("\nDoctors:")
        print("  - dr.smith@hospital.com / doctor123")
        print("  - dr.johnson@hospital.com / doctor123")
        print("  - dr.williams@hospital.com / doctor123")
        print("\nPatients:")
        print("  - patient1@email.com / patient123")
        print("  - patient2@email.com / patient123")
        print("  - patient3@email.com / patient123")


if __name__ == "__main__":
    asyncio.run(seed_data())
