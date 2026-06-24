from __future__ import annotations

from models import ChatMessage
from agents.base import call_llm, extract_json
from config import GROQ_FAST

# Context fields the intake assistant tracks. Required ones must be captured
# before the pipeline can run; optional ones enrich the program but don't gate it.
REQUIRED_FIELDS = ["region", "crop", "beneficiaries"]
OPTIONAL_FIELDS = ["budget", "staff"]
ALL_FIELDS = REQUIRED_FIELDS + OPTIONAL_FIELDS

SYSTEM_PROMPT = """You are the intake assistant for AniKonsulta, a tool that designs \
context-adapted social programs for smallholder agriculture and livelihood NGOs.

Your job in this conversation is to gather the context needed to generate a program, \
while being genuinely helpful. You can:
- Answer the user's questions directly and intelligently.
- Help the user reason through a field they are unsure about (e.g. suggest how to \
estimate a budget from beneficiary count, or how to describe their region).
- Reference the parsed spreadsheet data when it is provided.

You track these context fields:
- region        (REQUIRED) — area and local conditions (infrastructure, weather, terrain)
- crop          (REQUIRED) — the crop or livelihood activity
- beneficiaries (REQUIRED) — roughly how many people are targeted
- budget        (optional) — total funds and period
- staff         (optional) — number and roles of field staff

Rules:
- Consider both the chat conversation AND the spreadsheet summary when deciding which \
fields are captured. A field counts as captured if it is clearly present in either.
- Ask for ONE missing REQUIRED field at a time, with a concrete, data-aware question. \
Do not interrogate — keep it conversational.
- If all REQUIRED fields are captured, set "ready" to true and invite the user to \
generate the program (they may still add budget/staff for a richer plan).
- If the user is stuck on a required field, help them think it through instead of just \
repeating the question.
- Never invent data the user did not provide.

Return ONLY valid JSON, no prose outside it:
{
  "reply": "your conversational message to the user",
  "captured_fields": ["region", "crop", ...],
  "ready": true or false
}
"""


def _excel_summary(excel_preview: dict | None) -> str:
    """One-line-ish summary of the parsed spreadsheet for the prompt."""
    if not excel_preview:
        return "No spreadsheet uploaded."
    filename = excel_preview.get("filename", "spreadsheet")
    rows = excel_preview.get("rows", "?")
    cols = excel_preview.get("cols", "?")
    headers = excel_preview.get("headers", []) or []
    headers_str = ", ".join(str(h) for h in headers) if headers else "none detected"
    return f"File '{filename}': {rows} rows x {cols} columns. Columns: {headers_str}."


async def run_chat_assistant(
    chat_messages: list[ChatMessage],
    excel_preview: dict | None = None,
) -> dict:
    """Conversational intake assistant (GROQ_FAST).

    Returns {"reply": str, "captured_fields": list[str], "ready": bool}. Decides
    readiness from the chat history plus the parsed Excel summary. Falls back to a
    safe ask on any LLM/parse failure so the chat never breaks.
    """
    transcript = "\n".join(f"{m.role}: {m.content}" for m in chat_messages) or "(no messages yet)"

    user_prompt = f"""Spreadsheet summary:
{_excel_summary(excel_preview)}

Conversation so far:
{transcript}

Respond to the latest user message and report which context fields are captured."""

    try:
        raw = await call_llm(
            provider="groq",
            model=GROQ_FAST,
            prompt=user_prompt,
            system_prompt=SYSTEM_PROMPT,
        )
        parsed = extract_json(raw)
        if not isinstance(parsed, dict):
            raise ValueError("expected a JSON object")

        reply = str(parsed.get("reply") or "").strip()
        captured = [f for f in parsed.get("captured_fields", []) if f in ALL_FIELDS]
        # Trust the model's readiness only if it is consistent with required coverage.
        ready = bool(parsed.get("ready")) and all(f in captured for f in REQUIRED_FIELDS)
        if not ready:
            ready = all(f in captured for f in REQUIRED_FIELDS)

        if not reply:
            reply = _fallback_reply(captured)

        return {"reply": reply, "captured_fields": captured, "ready": ready}

    except Exception:
        return {
            "reply": _fallback_reply([]),
            "captured_fields": [],
            "ready": False,
        }


def _fallback_reply(captured: list[str]) -> str:
    """Deterministic next-question when the LLM output is unusable."""
    for field in REQUIRED_FIELDS:
        if field not in captured:
            prompts = {
                "region": "Which region is this for, and what are the local conditions "
                "(infrastructure, weather, terrain)?",
                "crop": "What crop or livelihood activity is the focus?",
                "beneficiaries": "Roughly how many beneficiaries are you targeting?",
            }
            return prompts[field]
    return "I have the essentials — you can generate the program now, or add budget and staff for a richer plan."
