from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core import get_session, get_settings, get_password_hash, verify_password, create_access_token, get_current_user
from app.models import User, UserCreate, UserRead, UserLogin, Token, UserRole
from app.services import get_audit_service, AuditService

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    session: AsyncSession = Depends(get_session)
):
    """Register a new user (doctor or patient)."""
    # Check if email already exists
    result = await session.execute(select(User).where(User.email == user_data.email))
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        role=user_data.role,
        phone=user_data.phone,
        password_hash=get_password_hash(user_data.password),
        # Patient-specific fields
        date_of_birth=user_data.date_of_birth,
        blood_group=user_data.blood_group,
        emergency_contact=user_data.emergency_contact,
        address=user_data.address,
        # Doctor-specific fields
        specialization=user_data.specialization,
        license_number=user_data.license_number,
        hospital_affiliation=user_data.hospital_affiliation,
        years_of_experience=user_data.years_of_experience
    )
    
    session.add(user)
    await session.commit()
    await session.refresh(user)
    
    return user


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_session)
):
    """Login and get access token."""
    # Find user by email
    result = await session.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is inactive"
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.id, "role": user.role.value},
        expires_delta=access_token_expires
    )
    
    # Log the login
    audit_service = get_audit_service(session)
    client_ip = request.client.host if request.client else None
    await audit_service.log_login(user.id, client_ip)
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user_id": user.id,
        "role": user.role
    }


@router.post("/login/json", response_model=Token)
async def login_json(
    request: Request,
    credentials: UserLogin,
    session: AsyncSession = Depends(get_session)
):
    """Login with JSON body and get access token."""
    result = await session.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is inactive"
        )
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.id, "role": user.role.value},
        expires_delta=access_token_expires
    )
    
    audit_service = get_audit_service(session)
    client_ip = request.client.host if request.client else None
    await audit_service.log_login(user.id, client_ip)
    
    return Token(
        access_token=access_token, 
        token_type="bearer",
        user_id=user.id,
        role=user.role
    )


@router.get("/me", response_model=UserRead)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current logged-in user information."""
    return current_user


@router.get("/doctors", response_model=list[UserRead])
async def list_doctors(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List all doctors (for patients to select)."""
    result = await session.execute(
        select(User).where(User.role == UserRole.DOCTOR, User.is_active == True)
    )
    doctors = result.scalars().all()
    return doctors
