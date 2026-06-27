"""Document upload and ingestion into FAISS vector store."""

import os, uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import settings
from backend.database.db import get_db
from backend.database.models import User, Document
from backend.auth.auth import get_current_user
from backend.agent.tools.rag_tool import ingest_file

router = APIRouter(prefix="/api/documents", tags=["documents"])


class DocOut(BaseModel):
    id: str; filename: str; file_type: str; file_size: int
    chunk_count: int; chunk_strategy: str; status: str; created_at: str


@router.post("/ingest", response_model=DocOut, status_code=201)
async def upload_and_ingest(
    file: UploadFile = File(...),
    strategy: str = Query("recursive", description="recursive | by_paragraph | by_page | small_precise"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    valid = {"recursive", "by_paragraph", "by_page", "small_precise"}
    if strategy not in valid:
        raise HTTPException(400, f"Invalid strategy. Options: {valid}")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in {".txt", ".md", ".pdf"}:
        raise HTTPException(400, "Only .txt, .md, .pdf supported")

    contents = await file.read()
    if len(contents) / 1048576 > settings.MAX_UPLOAD_SIZE_MB:
        raise HTTPException(400, f"Max size: {settings.MAX_UPLOAD_SIZE_MB}MB")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    safe = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    path = os.path.join(settings.UPLOAD_DIR, safe)
    with open(path, "wb") as f:
        f.write(contents)

    doc = Document(user_id=user.id, filename=file.filename, file_type=ext,
                   file_size=len(contents), chunk_strategy=strategy, status="processing")
    db.add(doc)
    await db.flush()

    try:
        doc.chunk_count = ingest_file(path, strategy=strategy, doc_id=str(doc.id))
        doc.status = "ready"
    except Exception as e:
        doc.status = "error"
        doc.error_message = str(e)
        raise HTTPException(500, f"Ingestion failed: {e}")

    return DocOut(id=str(doc.id), filename=doc.filename, file_type=doc.file_type, file_size=doc.file_size,
                  chunk_count=doc.chunk_count, chunk_strategy=doc.chunk_strategy, status=doc.status, created_at=str(doc.created_at))


@router.get("", response_model=List[DocOut])
async def list_docs(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Document).where(Document.user_id == user.id).order_by(Document.created_at.desc()))
    return [DocOut(id=str(d.id), filename=d.filename, file_type=d.file_type, file_size=d.file_size or 0,
                   chunk_count=d.chunk_count or 0, chunk_strategy=d.chunk_strategy or "recursive",
                   status=d.status, created_at=str(d.created_at)) for d in r.scalars().all()]


@router.delete("/{doc_id}")
async def delete_doc(doc_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Document).where(Document.id == uuid.UUID(doc_id), Document.user_id == user.id))
    d = r.scalar_one_or_none()
    if not d:
        raise HTTPException(404, "Not found")
    await db.delete(d)
    return {"detail": "Deleted"}
