"""Tool 2: Wikipedia — factual knowledge lookup, free."""

from langchain.tools import Tool
from langchain_community.tools import WikipediaQueryRun
from langchain_community.utilities import WikipediaAPIWrapper


def create_wiki_tool() -> Tool:
    wiki = WikipediaQueryRun(api_wrapper=WikipediaAPIWrapper(top_k_results=2, doc_content_chars_max=3000))
    return Tool(
        name="wikipedia",
        func=wiki.run,
        description=(
            "Look up factual information on Wikipedia. "
            "Use for definitions, history, science, biographies, and established knowledge. "
            "Input: a topic or question."
        ),
    )
