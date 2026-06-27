"""Tool 1: DuckDuckGo Web Search — free, no API key."""

from langchain.tools import Tool
from langchain_community.tools import DuckDuckGoSearchResults
from langchain_community.utilities import DuckDuckGoSearchAPIWrapper


def create_search_tool() -> Tool:
    wrapper = DuckDuckGoSearchAPIWrapper(max_results=5, region="wt-wt", time="m")
    search = DuckDuckGoSearchResults(api_wrapper=wrapper)
    return Tool(
        name="web_search",
        func=search.run,
        description=(
            "Search the web for current, real-time information. "
            "Use for recent news, live data, latest software versions, or anything that changes. "
            "Input: a search query string."
        ),
    )
