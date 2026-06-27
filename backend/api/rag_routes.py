"""RAG Explorer: vector store analytics, chunk browser, search playground."""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from backend.database.models import User
from backend.auth.auth import get_current_user
from backend.agent.tools.rag_tool import (
    get_vector_store_stats, get_chunk_preview, similarity_search_with_details,
    advanced_rag_search, CHUNK_CONFIGS,
)

router = APIRouter(prefix="/api/rag", tags=["rag"])


class StatsOut(BaseModel):
    total_chunks: int; total_documents: int; documents: List[Dict[str, Any]]
    embedding_model: str; embedding_dimensions: int
    index_size_bytes: int; index_size_readable: str
    avg_chunk_length: float; chunk_length_distribution: Dict[str, int]

class ChunkOut(BaseModel):
    content_preview: str; full_content: str; char_count: int; token_estimate: int
    source: str; chunk_index: int; page: int; chunk_strategy: str

class SearchOut(BaseModel):
    content: str; score: float; source: str; chunk_index: int
    page: int; token_estimate: int; char_count: int; metadata: Dict[str, str]

class AdvSearchReq(BaseModel):
    query: str; k: int = 5; search_mode: str = "hybrid"
    use_multi_query: bool = True; use_reranking: bool = True; use_compression: bool = True

class AdvSearchOut(BaseModel):
    answer_context: str; chunks: List[Dict[str, Any]]; total_chunks_searched: int
    search_strategy: str; query_used: str; expanded_queries: List[str]


@router.get("/stats", response_model=StatsOut)
async def stats(user: User = Depends(get_current_user)):
    s = get_vector_store_stats()
    if not s:
        raise HTTPException(404, "No vector store. Upload documents first.")
    sz = s.index_size_bytes
    readable = f"{sz} B" if sz < 1024 else f"{sz/1024:.1f} KB" if sz < 1048576 else f"{sz/1048576:.1f} MB"
    return StatsOut(total_chunks=s.total_chunks, total_documents=s.total_documents, documents=s.documents,
                    embedding_model=s.embedding_model, embedding_dimensions=s.embedding_dimensions,
                    index_size_bytes=sz, index_size_readable=readable, avg_chunk_length=s.avg_chunk_length,
                    chunk_length_distribution=s.chunk_length_distribution)

@router.get("/chunks", response_model=List[ChunkOut])
async def chunks(source: Optional[str] = None, limit: int = Query(20, ge=1, le=100), user: User = Depends(get_current_user)):
    data = get_chunk_preview(source, limit)
    if not data:
        raise HTTPException(404, "No chunks found.")
    return [ChunkOut(**d) for d in data]

@router.get("/search", response_model=List[SearchOut])
async def search(q: str = Query(..., min_length=1), k: int = Query(5, ge=1, le=20), user: User = Depends(get_current_user)):
    data = similarity_search_with_details(q, k)
    if not data:
        raise HTTPException(404, "No results.")
    return [SearchOut(**d) for d in data]

@router.post("/advanced-search", response_model=AdvSearchOut)
async def adv_search(req: AdvSearchReq, user: User = Depends(get_current_user)):
    r = advanced_rag_search(req.query, req.k, req.use_multi_query, req.use_reranking, req.use_compression, req.search_mode)
    return AdvSearchOut(
        answer_context=r.answer_context,
        chunks=[{"content": c.content, "score": c.score, "source": c.source, "chunk_index": c.chunk_index,
                 "page": c.page, "token_estimate": c.token_estimate, "doc_id": c.doc_id} for c in r.chunks],
        total_chunks_searched=r.total_chunks_searched, search_strategy=r.search_strategy,
        query_used=r.query_used, expanded_queries=r.expanded_queries)

@router.get("/strategies")
async def strategies(user: User = Depends(get_current_user)):
    descs = {"recursive": "Balanced default.", "by_paragraph": "Large paragraph chunks.",
             "by_page": "Full page chunks.", "small_precise": "Small exact chunks."}
    return {k: {**v, "description": descs.get(k, "")} for k, v in CHUNK_CONFIGS.items()}
