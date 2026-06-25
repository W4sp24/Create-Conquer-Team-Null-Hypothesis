import pytest
from unittest.mock import AsyncMock, patch

from models import ChatMessage
from agents.chat_assistant import run_chat_assistant


@pytest.mark.asyncio
async def test_run_chat_assistant_returns_field_values():
    """field_values carries the assistant's extracted value for each captured field."""
    mock_response = """{
        "reply": "Got it -- what crop is the focus?",
        "captured_fields": ["region"],
        "field_values": {"region": "Coastal Cebu, typhoon-prone"},
        "ready": false
    }"""
    with patch("agents.chat_assistant.call_llm_chat", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_response

        result = await run_chat_assistant(
            [ChatMessage(role="user", content="We farm in coastal Cebu")], None
        )

        assert result["field_values"] == {"region": "Coastal Cebu, typhoon-prone"}


@pytest.mark.asyncio
async def test_run_chat_assistant_drops_values_for_uncaptured_fields():
    """field_values is filtered to only the fields actually in captured_fields."""
    mock_response = """{
        "reply": "What crop is the focus?",
        "captured_fields": ["region"],
        "field_values": {"region": "Coastal Cebu", "crop": "should be dropped"},
        "ready": false
    }"""
    with patch("agents.chat_assistant.call_llm_chat", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_response

        result = await run_chat_assistant(
            [ChatMessage(role="user", content="We farm in coastal Cebu")], None
        )

        assert result["field_values"] == {"region": "Coastal Cebu"}
        assert "crop" not in result["field_values"]


@pytest.mark.asyncio
async def test_run_chat_assistant_field_values_empty_on_llm_failure():
    """On any LLM/parse failure, field_values falls back to an empty dict."""
    with patch("agents.chat_assistant.call_llm_chat", new_callable=AsyncMock) as mock_llm:
        mock_llm.side_effect = Exception("LLM error")

        result = await run_chat_assistant(
            [ChatMessage(role="user", content="hello")], None
        )

        assert result["field_values"] == {}
