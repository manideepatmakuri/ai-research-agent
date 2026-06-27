"""Tool 3: Advanced RAG — FAISS vector store + BM25 hybrid search.

Full pipeline:
  1. Document ingestion with configurable chunking strategies
  2. FAISS vector store with HuggingFace embeddings (local, free)
  3. BM25 keyword index for hybrid retrieval
  4. Reciprocal Rank Fusion to merge semantic + keyword results
  5. Lightweight re-ranking for precision
  6. Multi-query expansion for better recall
  7. Contextual compression to remove noise
  8. Rich metadata per chunk: source, page, tokens, timestamps
  9. Vector store analytics and chunk browsing
"""

import os
import re
import math
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Literal
from dataclasses import dataclass, field
from collections import Counter

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.tools import Tool
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import TextLoader, PyPDFLoader
from langchain_core.documents import Document as LCDocument

from backend.config import settings

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════
# DATA CLASSES
# ═══════════════════════════════════════════════════════════════

@dataclass
class ChunkResult:
    content: str
    score: float
    source: str
    chunk_index: int = 0
    page: int = 0
    token_estimate: int = 0
    doc_id: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class RAGResponse:
    answer_context: str
    chunks: List[ChunkResult]
    total_chunks_searched: int
    search_strategy: str
    query_used: str
    expanded_queries: List[str] = field(default_factory=list)

@dataclass
class VectorStoreStats:
    total_chunks: int
    total_documents: int
    documents: List[Dict[str, Any]]
    embedding_model: str
    embedding_dimensions: int
    index_size_bytes: int
    avg_chunk_length: float
    chunk_length_distribution: Dict[str, int]

# ═══════════════════════════════════════════════════════════════
# BM25 KEYWORD INDEX (no external dependency)
# ═══════════════════════════════════════════════════════════════

class BM25Index:
    """Lightweight BM25 for keyword-based retrieval alongside FAISS."""

    def __init__(self, k1=1.5, b=0.75):
        self.k1, self.b = k1, b
        self.docs: List[LCDocument] = []
        self.doc_freqs: List[Counter] = []
        self.idf: Dict[str, float] = {}
        self.avg_dl = 0.0
        self.dl: List[int] = []

    def _tokenize(self, text: str) -> List[str]:
        return re.findall(r'\w+', text.lower())

    def index(self, documents: List[LCDocument]):
        self.docs = documents
        self.doc_freqs, self.dl = [], []
        df = Counter()
        for doc in documents:
            tokens = self._tokenize(doc.page_content)
            freq = Counter(tokens)
            self.doc_freqs.append(freq)
            self.dl.append(len(tokens))
            for t in set(tokens):
                df[t] += 1
        n = len(documents)
        self.avg_dl = sum(self.dl) / n if n else 0
        self.idf = {w: math.log((n - f + 0.5) / (f + 0.5) + 1) for w, f in df.items()}

    def search(self, query: str, k: int = 10) -> List[tuple]:
        tokens = self._tokenize(query)
        scores = []
        for i, doc in enumerate(self.docs):
            score = 0.0
            for t in tokens:
                if t in self.doc_freqs[i]:
                    tf = self.doc_freqs[i][t]
                    num = tf * (self.k1 + 1)
                    den = tf + self.k1 * (1 - self.b + self.b * self.dl[i] / max(self.avg_dl, 1))
                    score += self.idf.get(t, 0) * num / den
            scores.append((doc, score))
        scores.sort(key=lambda x: x[1], reverse=True)
        return [(d, s) for d, s in scores[:k] if s > 0]

# ═══════════════════════════════════════════════════════════════
# RE-RANKER (lightweight — no extra model download)
# ═══════════════════════════════════════════════════════════════

class LightweightReranker:
    """Re-ranks by combining vector score, keyword overlap, position signals."""

    def rerank(self, query: str, chunks: List[ChunkResult], top_k: int = 5) -> List[ChunkResult]:
        q_tokens = set(re.findall(r'\w+', query.lower()))
        scored = []
        for c in chunks:
            ct = set(re.findall(r'\w+', c.content.lower()))
            exact = 2.0 if query.lower() in c.content.lower() else 0.0
            overlap = len(q_tokens & ct) / max(len(q_tokens), 1)
            first200 = set(re.findall(r'\w+', c.content[:200].lower()))
            pos = len(q_tokens & first200) / max(len(q_tokens), 1)
            vec = max(0, 1 - c.score / 2)
            combined = 0.40 * vec + 0.25 * overlap + 0.20 * pos + 0.15 * exact
            scored.append((c, combined))
        scored.sort(key=lambda x: x[1], reverse=True)
        out = []
        for c, s in scored[:top_k]:
            c.score = round(s, 4)
            out.append(c)
        return out

# ═══════════════════════════════════════════════════════════════
# MULTI-QUERY EXPANSION
# ═══════════════════════════════════════════════════════════════

def expand_query(query: str) -> List[str]:
    queries = [query]
    words = query.split()
    if len(words) > 4:
        mid = len(words) // 2
        queries.append(" ".join(words[:mid]))
        queries.append(" ".join(words[mid:]))
    cleaned = re.sub(r'^(what|how|why|when|where|who|which|explain|describe|tell me about)\s+', '', query.lower()).strip()
    if cleaned and cleaned != query.lower():
        queries.append(cleaned)
    return list(dict.fromkeys(queries))

# ═══════════════════════════════════════════════════════════════
# CONTEXTUAL COMPRESSION
# ═══════════════════════════════════════════════════════════════

def compress_chunk(text: str, query: str, max_sents: int = 8) -> str:
    sents = re.split(r'(?<=[.!?])\s+', text)
    if len(sents) <= max_sents:
        return text
    q_tokens = set(re.findall(r'\w+', query.lower()))
    scored = [(i, len(q_tokens & set(re.findall(r'\w+', s.lower())))) for i, s in enumerate(sents)]
    scored.sort(key=lambda x: x[1], reverse=True)
    keep = set()
    for idx, _ in scored[:max_sents]:
        keep.update([max(0, idx - 1), idx, min(len(sents) - 1, idx + 1)])
    return " ".join(sents[i] for i in sorted(keep))

# ═══════════════════════════════════════════════════════════════
# CHUNKING STRATEGIES
# ═══════════════════════════════════════════════════════════════

ChunkStrategy = Literal["recursive", "by_paragraph", "by_page", "small_precise"]

CHUNK_CONFIGS = {
    "recursive":     {"chunk_size": 800,  "chunk_overlap": 150, "separators": ["\n\n", "\n", ". ", " ", ""]},
    "by_paragraph":  {"chunk_size": 1200, "chunk_overlap": 100, "separators": ["\n\n", "\n\n\n"]},
    "by_page":       {"chunk_size": 3000, "chunk_overlap": 200, "separators": ["\f", "\n\n\n", "\n\n"]},
    "small_precise": {"chunk_size": 400,  "chunk_overlap": 80,  "separators": ["\n\n", "\n", ". ", " "]},
}

def get_splitter(strategy: ChunkStrategy = "recursive") -> RecursiveCharacterTextSplitter:
    cfg = CHUNK_CONFIGS.get(strategy, CHUNK_CONFIGS["recursive"])
    return RecursiveCharacterTextSplitter(chunk_size=cfg["chunk_size"], chunk_overlap=cfg["chunk_overlap"], separators=cfg["separators"])

# ═══════════════════════════════════════════════════════════════
# CORE: EMBEDDINGS & VECTOR STORE SINGLETONS
# ═══════════════════════════════════════════════════════════════

_embeddings: Optional[HuggingFaceEmbeddings] = None
_vector_store: Optional[FAISS] = None
_bm25: Optional[BM25Index] = None
_reranker = LightweightReranker()


def get_embeddings() -> HuggingFaceEmbeddings:
    global _embeddings
    if _embeddings is None:
        logger.info("Loading embedding model: %s", settings.EMBEDDING_MODEL)
        _embeddings = HuggingFaceEmbeddings(
            model_name=settings.EMBEDDING_MODEL,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
    return _embeddings


def get_vector_store() -> Optional[FAISS]:
    global _vector_store
    if _vector_store is None:
        idx = os.path.join(settings.FAISS_INDEX_PATH, "index.faiss")
        if os.path.exists(idx):
            logger.info("Loading FAISS index from disk")
            _vector_store = FAISS.load_local(settings.FAISS_INDEX_PATH, get_embeddings(), allow_dangerous_deserialization=True)
            _rebuild_bm25()
    return _vector_store


def _rebuild_bm25():
    global _bm25
    if _vector_store is None:
        return
    try:
        docs = list(_vector_store.docstore._dict.values())
        _bm25 = BM25Index()
        _bm25.index(docs)
        logger.info("BM25 index built: %d chunks", len(docs))
    except Exception as e:
        logger.warning("BM25 rebuild failed: %s", e)


def _estimate_tokens(text: str) -> int:
    return len(text) // 4

# ═══════════════════════════════════════════════════════════════
# INGESTION
# ═══════════════════════════════════════════════════════════════

def ingest_file(file_path: str, strategy: ChunkStrategy = "recursive", doc_id: str = "") -> int:
    global _vector_store
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".pdf":
        loader = PyPDFLoader(file_path)
    elif ext in (".txt", ".md"):
        loader = TextLoader(file_path, encoding="utf-8")
    else:
        raise ValueError(f"Unsupported: {ext}")

    docs = loader.load()
    chunks = get_splitter(strategy).split_documents(docs)
    if not chunks:
        return 0

    fname = os.path.basename(file_path)
    fhash = hashlib.md5(open(file_path, "rb").read()).hexdigest()[:12]
    now = datetime.now(timezone.utc).isoformat()
    for i, c in enumerate(chunks):
        c.metadata.update({
            "source": fname, "doc_id": doc_id or fhash, "chunk_index": i,
            "total_chunks": len(chunks), "page": c.metadata.get("page", 0),
            "char_count": len(c.page_content), "token_estimate": _estimate_tokens(c.page_content),
            "chunk_strategy": strategy, "ingested_at": now, "file_hash": fhash,
        })

    emb = get_embeddings()
    if _vector_store is None:
        _vector_store = FAISS.from_documents(chunks, emb)
    else:
        _vector_store.add_documents(chunks)

    os.makedirs(settings.FAISS_INDEX_PATH, exist_ok=True)
    _vector_store.save_local(settings.FAISS_INDEX_PATH)
    _rebuild_bm25()
    logger.info("Ingested %d chunks from %s [%s]", len(chunks), fname, strategy)
    return len(chunks)

# ═══════════════════════════════════════════════════════════════
# SEARCH STRATEGIES
# ═══════════════════════════════════════════════════════════════

def _faiss_search(query: str, k: int = 8) -> List[ChunkResult]:
    store = get_vector_store()
    if not store:
        return []
    return [
        ChunkResult(content=d.page_content, score=float(s), source=d.metadata.get("source", "?"),
                    chunk_index=d.metadata.get("chunk_index", 0), page=d.metadata.get("page", 0),
                    token_estimate=d.metadata.get("token_estimate", 0), doc_id=d.metadata.get("doc_id", ""), metadata=d.metadata)
        for d, s in store.similarity_search_with_score(query, k=k)
    ]

def _bm25_search(query: str, k: int = 8) -> List[ChunkResult]:
    if not _bm25 or not _bm25.docs:
        return []
    return [
        ChunkResult(content=d.page_content, score=float(s), source=d.metadata.get("source", "?"),
                    chunk_index=d.metadata.get("chunk_index", 0), page=d.metadata.get("page", 0),
                    token_estimate=d.metadata.get("token_estimate", 0), doc_id=d.metadata.get("doc_id", ""), metadata=d.metadata)
        for d, s in _bm25.search(query, k=k)
    ]

def hybrid_search(query: str, k: int = 6, sem_w: float = 0.6, kw_w: float = 0.4) -> List[ChunkResult]:
    """Fuse FAISS semantic + BM25 keyword results with Reciprocal Rank Fusion."""
    sem = _faiss_search(query, k=k * 2)
    kw = _bm25_search(query, k=k * 2)
    rrf_k = 60
    scores: Dict[str, float] = {}
    cmap: Dict[str, ChunkResult] = {}
    for rank, c in enumerate(sem):
        key = f"{c.source}:{c.chunk_index}"
        scores[key] = scores.get(key, 0) + sem_w / (rrf_k + rank + 1)
        cmap[key] = c
    for rank, c in enumerate(kw):
        key = f"{c.source}:{c.chunk_index}"
        scores[key] = scores.get(key, 0) + kw_w / (rrf_k + rank + 1)
        if key not in cmap:
            cmap[key] = c
    result = []
    for key in sorted(scores, key=scores.get, reverse=True)[:k]:
        c = cmap[key]
        c.score = round(scores[key], 6)
        result.append(c)
    return result

def advanced_rag_search(query: str, k=5, use_multi_query=True, use_reranking=True, use_compression=True, search_mode="hybrid") -> RAGResponse:
    """Full RAG pipeline: expand → search → rerank → compress."""
    store = get_vector_store()
    if not store:
        return RAGResponse(answer_context="No documents ingested yet. Upload documents first.", chunks=[], total_chunks_searched=0, search_strategy=search_mode, query_used=query)

    queries = expand_query(query) if use_multi_query else [query]
    all_chunks: Dict[str, ChunkResult] = {}
    for q in queries:
        fn = {"hybrid": hybrid_search, "keyword": _bm25_search, "semantic": _faiss_search}.get(search_mode, hybrid_search)
        for c in fn(q, k=k * 2):
            key = f"{c.source}:{c.chunk_index}"
            if key not in all_chunks or c.score > all_chunks[key].score:
                all_chunks[key] = c

    candidates = list(all_chunks.values())
    total = len(candidates)

    if use_reranking and len(candidates) > k:
        candidates = _reranker.rerank(query, candidates, top_k=k)
    else:
        candidates = sorted(candidates, key=lambda x: x.score, reverse=True)[:k]

    if use_compression:
        for c in candidates:
            c.content = compress_chunk(c.content, query)

    parts = []
    for c in candidates:
        parts.append(f"[Source: {c.source} | Page: {c.page} | Chunk #{c.chunk_index} | Score: {c.score:.4f}]\n{c.content}")

    return RAGResponse(
        answer_context="\n\n---\n\n".join(parts) or "No relevant info found.",
        chunks=candidates, total_chunks_searched=total,
        search_strategy=search_mode, query_used=query, expanded_queries=queries,
    )

# ═══════════════════════════════════════════════════════════════
# VECTOR STORE ANALYTICS
# ═══════════════════════════════════════════════════════════════

def get_vector_store_stats() -> Optional[VectorStoreStats]:
    store = get_vector_store()
    if not store:
        return None
    docs = list(store.docstore._dict.values())
    if not docs:
        return None

    groups: Dict[str, Dict] = {}
    lengths = []
    for d in docs:
        src = d.metadata.get("source", "unknown")
        if src not in groups:
            groups[src] = {"filename": src, "chunk_count": 0, "total_chars": 0, "total_tokens": 0,
                           "pages": set(), "strategy": d.metadata.get("chunk_strategy", "?"), "ingested_at": d.metadata.get("ingested_at", "?")}
        g = groups[src]
        g["chunk_count"] += 1
        g["total_chars"] += len(d.page_content)
        g["total_tokens"] += d.metadata.get("token_estimate", len(d.page_content) // 4)
        g["pages"].add(d.metadata.get("page", 0))
        lengths.append(len(d.page_content))

    doc_list = [{"filename": g["filename"], "chunk_count": g["chunk_count"], "total_chars": g["total_chars"],
                 "total_tokens": g["total_tokens"], "page_count": len(g["pages"]),
                 "chunk_strategy": g["strategy"], "ingested_at": g["ingested_at"]} for g in groups.values()]

    buckets = {"0-200": 0, "200-500": 0, "500-800": 0, "800-1200": 0, "1200+": 0}
    for l in lengths:
        if l < 200: buckets["0-200"] += 1
        elif l < 500: buckets["200-500"] += 1
        elif l < 800: buckets["500-800"] += 1
        elif l < 1200: buckets["800-1200"] += 1
        else: buckets["1200+"] += 1

    idx_size = sum(os.path.getsize(os.path.join(settings.FAISS_INDEX_PATH, f))
                   for f in os.listdir(settings.FAISS_INDEX_PATH)
                   if os.path.isfile(os.path.join(settings.FAISS_INDEX_PATH, f))) if os.path.exists(settings.FAISS_INDEX_PATH) else 0

    dims = len(get_embeddings().embed_query("test"))

    return VectorStoreStats(total_chunks=len(docs), total_documents=len(groups), documents=doc_list,
                            embedding_model=settings.EMBEDDING_MODEL, embedding_dimensions=dims,
                            index_size_bytes=idx_size, avg_chunk_length=round(sum(lengths)/len(lengths), 1),
                            chunk_length_distribution=buckets)


def get_chunk_preview(source: Optional[str] = None, limit: int = 20) -> List[Dict]:
    store = get_vector_store()
    if not store:
        return []
    docs = list(store.docstore._dict.values())
    if source:
        docs = [d for d in docs if d.metadata.get("source") == source]
    docs.sort(key=lambda d: (d.metadata.get("source", ""), d.metadata.get("chunk_index", 0)))
    return [{"content_preview": d.page_content[:300], "full_content": d.page_content,
             "char_count": len(d.page_content), "token_estimate": d.metadata.get("token_estimate", 0),
             "source": d.metadata.get("source", "?"), "chunk_index": d.metadata.get("chunk_index", 0),
             "page": d.metadata.get("page", 0), "chunk_strategy": d.metadata.get("chunk_strategy", "?")}
            for d in docs[:limit]]


def similarity_search_with_details(query: str, k: int = 5) -> List[Dict]:
    store = get_vector_store()
    if not store:
        return []
    return [{"content": d.page_content, "score": round(float(s), 4), "source": d.metadata.get("source", "?"),
             "chunk_index": d.metadata.get("chunk_index", 0), "page": d.metadata.get("page", 0),
             "token_estimate": d.metadata.get("token_estimate", 0), "char_count": len(d.page_content),
             "metadata": {k: str(v) for k, v in d.metadata.items()}}
            for d, s in store.similarity_search_with_score(query, k=k)]

# ═══════════════════════════════════════════════════════════════
# AGENT TOOL INTERFACE
# ═══════════════════════════════════════════════════════════════

def rag_search(query: str) -> str:
    """Agent-facing function: full hybrid RAG pipeline."""
    r = advanced_rag_search(query, k=5, use_multi_query=True, use_reranking=True, use_compression=True, search_mode="hybrid")
    return r.answer_context

def create_rag_tool() -> Tool:
    return Tool(
        name="knowledge_base",
        func=rag_search,
        description=(
            "Search the user's uploaded documents (PDFs, resumes/CVs, notes) via hybrid semantic + keyword RAG. "
            "REQUIRED when they ask about themselves: name, experience, skills, jobs, education, background, "
            "or phrasing like 'what do you know about me' / 'from your knowledge' about their career or profile. "
            "Input: focused keywords, not conversational filler (e.g. 'full name work experience education skills' "
            "or 'resume summary projects')."
        ),
    )
