"""Authentication — JWT tokens, password hashing, user CRUD."""

from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import settings
from backend.database.db import get_db
from backend.database.models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ── Schemas ──────────────────────────────────────────────────────────
class SignupRequest(BaseModel):
    email: str
    username: str
    password: str
    full_name: Optional[str] = None

    @field_validator("email")
    @classmethod
    def clean_email(cls, v):
        if "@" not in v:
            raise ValueError("Invalid email")
        return v.lower().strip()

    @field_validator("password")
    @classmethod
    def check_pw(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    username: str
    email: str
    full_name: Optional[str] = None


class UserOut(BaseModel):
    id: str
    email: str
    username: str
    full_name: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Helpers ──────────────────────────────────────────────────────────
def hash_password(pw: str) -> str:
    return pwd_context.hash(pw)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({**data, "exp": expire}, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


# ── Dependencies ─────────────────────────────────────────────────────
async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    cred_err = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials", headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        uid = payload.get("sub")
        if not uid:
            raise cred_err
    except JWTError:
        raise cred_err
    result = await db.execute(select(User).where(User.id == UUID(uid)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise cred_err
    return user


# ── Service ──────────────────────────────────────────────────────────
async def create_user(db: AsyncSession, req: SignupRequest) -> User:
    for field, col in [("email", User.email), ("username", User.username)]:
        r = await db.execute(select(User).where(col == getattr(req, field)))
        if r.scalar_one_or_none():
            raise HTTPException(400, f"{field.title()} already taken")
    user = User(email=req.email, username=req.username, hashed_password=hash_password(req.password), full_name=req.full_name)
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, login: str, password: str) -> Optional[User]:
    for col in [User.username, User.email]:
        r = await db.execute(select(User).where(col == login))
        user = r.scalar_one_or_none()
        if user and verify_password(password, user.hashed_password):
            return user
    return None
