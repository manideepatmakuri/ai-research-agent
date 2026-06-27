from fastapi import APIRouter
from backend.api.auth_routes import router as auth_router
from backend.api.chat_routes import router as chat_router
from backend.api.document_routes import router as doc_router
from backend.api.rag_routes import router as rag_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(chat_router)
api_router.include_router(doc_router)
api_router.include_router(rag_router)
