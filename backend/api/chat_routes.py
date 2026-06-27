"""Chat endpoints: send messages to agent, manage sessions and history."""

import uuid
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.db import get_db
from backend.database.models import User, ChatSession, ChatMessage
from backend.auth.auth import get_current_user
from backend.agent.agent import run_agent
from backend.agent.memory import clear_memory

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChatOut(BaseModel):
    session_id: str
    message: str
    tool_used: Optional[str] = None
    tools_log: Optional[str] = None
    sources: Optional[str] = None
    created_at: datetime

class SessionOut(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    tool_used: Optional[str] = None
    tools_log: Optional[str] = None
    sources: Optional[str] = None
    created_at: datetime


@router.post("", response_model=ChatOut)
async def chat(req: ChatRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if req.session_id:
        r = await db.execute(select(ChatSession).where(ChatSession.id == uuid.UUID(req.session_id), ChatSession.user_id == user.id))
        session = r.scalar_one_or_none()
        if not session:
            raise HTTPException(404, "Session not found")
    else:
        session = ChatSession(user_id=user.id, title=req.message[:80])
        db.add(session)
        await db.flush()

    db.add(ChatMessage(session_id=session.id, role="user", content=req.message))
    await db.flush()

    resp = await run_agent(req.message, str(session.id))

    msg = ChatMessage(session_id=session.id, role="assistant", content=resp.answer,
                      tool_used=resp.tool_used, tools_log=resp.tools_log, sources=resp.sources)
    db.add(msg)
    await db.flush()
    return ChatOut(session_id=str(session.id), message=resp.answer, tool_used=resp.tool_used,
                   tools_log=resp.tools_log, sources=resp.sources, created_at=msg.created_at)


@router.get("/sessions", response_model=List[SessionOut])
async def list_sessions(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(ChatSession).where(ChatSession.user_id == user.id).order_by(ChatSession.updated_at.desc()))
    out = []
    for s in r.scalars().all():
        cnt = (await db.execute(select(func.count(ChatMessage.id)).where(ChatMessage.session_id == s.id))).scalar() or 0
        out.append(SessionOut(id=str(s.id), title=s.title, created_at=s.created_at, updated_at=s.updated_at, message_count=cnt))
    return out


@router.get("/history/{session_id}", response_model=List[MessageOut])
async def get_history(session_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(ChatSession).where(ChatSession.id == uuid.UUID(session_id), ChatSession.user_id == user.id))
    if not r.scalar_one_or_none():
        raise HTTPException(404, "Session not found")
    r = await db.execute(select(ChatMessage).where(ChatMessage.session_id == uuid.UUID(session_id)).order_by(ChatMessage.created_at))
    return [MessageOut(id=str(m.id), role=m.role, content=m.content, tool_used=m.tool_used,
                       tools_log=m.tools_log, sources=m.sources, created_at=m.created_at) for m in r.scalars().all()]


@router.delete("/history/{session_id}")
async def delete_session(session_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(ChatSession).where(ChatSession.id == uuid.UUID(session_id), ChatSession.user_id == user.id))
    s = r.scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Session not found")
    await db.delete(s)
    clear_memory(session_id)
    return {"detail": "Deleted"}
