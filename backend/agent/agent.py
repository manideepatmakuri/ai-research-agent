"""ReAct Agent — Reasoning + Acting loop with 3 tools.

Loop: Thought → Action → Observation → Thought → ... → Final Answer
"""

import logging
from dataclasses import dataclass
from typing import Optional

from langchain.agents import AgentExecutor, create_react_agent
from langchain_core.prompts import PromptTemplate
from langchain_ollama import ChatOllama

from backend.config import settings
from backend.agent.memory import get_memory
from backend.agent.tools import create_search_tool, create_wiki_tool, create_rag_tool

logger = logging.getLogger(__name__)


def _user_friendly_llm_error(*errors: Exception) -> str:
    """Map Ollama / connection failures to actionable text (Ollama may be up but model may not fit in RAM)."""
    for err in errors:
        msg = str(err)
        low = msg.lower()
        if "requires more system memory" in msg or "more system memory" in msg:
            return (
                f"Ollama is running; model `{settings.OLLAMA_MODEL}` needs more free RAM than is available right now "
                f"(Ollama error: {msg}). "
                "Free RAM by closing browsers, games, and other heavy apps, or switch to a much smaller model "
                "(`ollama pull tinyllama` or `ollama pull qwen2:0.5b`, then set OLLAMA_MODEL in `.env` and restart the API)."
            )
        if "connection refused" in low or "failed to establish" in low or "name or service not known" in low:
            return (
                "Could not connect to Ollama. Start it with `ollama serve` or set OLLAMA_BASE_URL to your server URL."
            )
        if "status code: 404" in low or ("model" in low and ("not found" in low or "pull" in low)):
            return (
                "The configured Ollama model was not found. Run `ollama pull <model>` or update OLLAMA_MODEL in .env."
            )
        if len(msg) <= 500:
            return f"Model error: {msg}"
    return "The language model returned an error. See server logs for details."

REACT_PROMPT = PromptTemplate.from_template("""You are an AI Research Agent that answers complex questions
by choosing and using specialized tools. You reason step-by-step.

Tools available:
{tools}

Tool names: {tool_names}

INSTRUCTIONS:
- Use web_search for current events, recent news, live data
- Use wikipedia for established facts, definitions, history, science
- Use knowledge_base for uploaded files: resumes/CVs, notes, reports, and any user-specific facts. If the user asks about their name, experience, skills, education, jobs, or "what you know about me" / "from your knowledge" in the context of their uploads, you MUST call knowledge_base first with a short search query (e.g. full name, work experience, skills, resume). Do not answer from memory alone for those questions.
- After a knowledge_base Observation, base your Final Answer on the retrieved excerpts; cite [Source: ...]. Only say the documents do not contain the info if the Observation truly lacks it. Never refuse as "I have no personal data" when the tool returned resume or profile text.
- You can use multiple tools in sequence for complex questions
- Only skip tools for clearly general questions that cannot relate to the user's uploads

Chat history:
{chat_history}

Format:
Question: the question to answer
Thought: reason about what to do
Action: tool name (one of [{tool_names}])
Action Input: input for the tool
Observation: tool result
... (repeat as needed)
Thought: I now know the final answer
Final Answer: complete answer

Begin!

Question: {input}
Thought: {agent_scratchpad}""")


@dataclass
class AgentResponse:
    answer: str
    tool_used: Optional[str] = None
    tools_log: Optional[str] = None
    sources: Optional[str] = None

_executor: Optional[AgentExecutor] = None

def _build():
    llm = ChatOllama(model=settings.OLLAMA_MODEL, base_url=settings.OLLAMA_BASE_URL, temperature=0.3, num_predict=2048)
    tools = [create_rag_tool(), create_search_tool(), create_wiki_tool()]
    agent = create_react_agent(llm=llm, tools=tools, prompt=REACT_PROMPT)
    return AgentExecutor(agent=agent, tools=tools, verbose=True, handle_parsing_errors=True,
                         max_iterations=6, return_intermediate_steps=True, early_stopping_method="generate")

def get_agent():
    global _executor
    if _executor is None:
        logger.info("Building ReAct agent...")
        _executor = _build()
    return _executor

async def run_agent(query: str, session_id: str) -> AgentResponse:
    agent = get_agent()
    memory = get_memory(session_id)
    try:
        result = await agent.ainvoke({"input": query, "chat_history": memory.buffer_as_messages})
        answer = result.get("output", "I couldn't generate a response.")

        tool_used, log_parts, sources = None, [], []
        for action, obs in result.get("intermediate_steps", []):
            tool_used = action.tool
            log_parts.append(f"Tool: {action.tool}\nInput: {action.tool_input}\nResult: {str(obs)[:500]}")
            if action.tool == "knowledge_base" and "[Source:" in str(obs):
                sources.append(str(obs)[:300])

        memory.save_context({"input": query}, {"output": answer})
        return AgentResponse(answer=answer, tool_used=tool_used,
                             tools_log="\n---\n".join(log_parts) if log_parts else None,
                             sources="\n".join(sources) if sources else None)
    except Exception as e:
        logger.error("Agent error: %s", e, exc_info=True)
        try:
            llm = ChatOllama(model=settings.OLLAMA_MODEL, base_url=settings.OLLAMA_BASE_URL, temperature=0.3)
            direct = await llm.ainvoke(query)
            memory.save_context({"input": query}, {"output": direct.content})
            return AgentResponse(answer=direct.content, tools_log=f"Fallback (agent error): {e}")
        except Exception as e2:
            return AgentResponse(
                answer=_user_friendly_llm_error(e, e2),
                tools_log=f"Agent error: {e}\nFallback LLM error: {e2}",
            )
