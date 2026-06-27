"""Auth endpoints: signup, login, profile."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database.db import get_db
from backend.database.models import User
from backend.auth.auth import (SignupRequest, LoginRequest, TokenResponse, UserOut,
                                create_user, authenticate_user, create_access_token, get_current_user)
from fastapi import HTTPException

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/signup", response_model=TokenResponse, status_code=201)
async def signup(req: SignupRequest, db: AsyncSession = Depends(get_db)):
    user = await create_user(db, req)
    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, user_id=str(user.id), username=user.username, email=user.email, full_name=user.full_name)

@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, req.username, req.password)
    if not user:
        raise HTTPException(401, "Invalid credentials")
    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, user_id=str(user.id), username=user.username, email=user.email, full_name=user.full_name)

@router.get("/me", response_model=UserOut)
async def profile(user: User = Depends(get_current_user)):
    return UserOut(id=str(user.id), email=user.email, username=user.username, full_name=user.full_name, is_active=user.is_active, created_at=user.created_at)
