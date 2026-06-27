"""Conversation memory — per-session message history for the agent."""

from typing import Dict
from langchain.memory import ConversationBufferWindowMemory

_memories: Dict[str, ConversationBufferWindowMemory] = {}

def get_memory(session_id: str) -> ConversationBufferWindowMemory:
    if session_id not in _memories:
        _memories[session_id] = ConversationBufferWindowMemory(
            memory_key="chat_history", return_messages=True, k=20,
            input_key="input", output_key="output")
    return _memories[session_id]

def clear_memory(session_id: str):
    _memories.pop(session_id, None)
