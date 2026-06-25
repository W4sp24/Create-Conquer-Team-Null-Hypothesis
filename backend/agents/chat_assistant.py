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
- Read and reason about the uploaded spreadsheet. When a spreadsheet is provided you \
are given per-column statistics (count, and for numeric columns min/mean/max/sum) plus \
a few sample rows. Use these to answer questions about the data directly — e.g. report \
the average of a numeric column from its "mean", or a range from min/max. Do not invent \
numbers beyond what the statistics and samples show; if a question needs detail the \
summary doesn't contain, say so.

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
  "field_values": {"region": "short plain-language value you understood", ...},
  "ready": true or false
}

For every field listed in captured_fields, include a short (under 12 words)
plain-language value for it in field_values -- what you actually understood
from the conversation or spreadsheet, not a restatement of the question.
"""


def _excel_summary(excel_preview: dict | None) -> str:
    """Render a compact, data-aware spreadsheet summary for the prompt.

    Includes per-column statistics (numeric min/mean/max/sum, or example text
    values) and a few sample rows so the assistant can actually read the data.
    """
    if not excel_preview:
        return "No spreadsheet uploaded."

    filename = excel_preview.get("filename", "spreadsheet")
    rows = excel_preview.get("rows", "?")
    cols = excel_preview.get("cols", "?")
    columns = excel_preview.get("columns") or []
    sample_rows = excel_preview.get("sample_rows") or []

    lines = [f"File '{filename}': {rows} rows x {cols} columns."]

    if columns:
        lines.append("Columns:")
        for c in columns:
            name = c.get("name", "?")
            if c.get("kind") == "number":
                lines.append(
                    f"- {name} (number: mean {c.get('mean')}, min {c.get('min')}, "
                    f"max {c.get('max')}, sum {c.get('sum')}, n={c.get('count')})"
                )
            else:
                examples = ", ".join(str(e) for e in (c.get("examples") or [])[:5])
                detail = f", e.g. {examples}" if examples else ""
                lines.append(f"- {name} (text, {c.get('count')} values{detail})")
    else:
        headers = excel_preview.get("headers", []) or []
        headers_str = ", ".join(str(h) for h in headers) if headers else "none detected"
        lines.append(f"Columns: {headers_str}")

    if sample_rows:
        lines.append("Sample rows:")
        for r in sample_rows[:5]:
            lines.append(f"  {r}")

    return "\n".join(lines)


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
        raw_values = parsed.get("field_values") or {}
        field_values = {
            f: str(raw_values[f]).strip()
            for f in captured
            if f in raw_values and str(raw_values[f]).strip()
        }
        # Trust the model's readiness only if it is consistent with required coverage.
        ready = bool(parsed.get("ready")) and all(f in captured for f in REQUIRED_FIELDS)
        if not ready:
            ready = all(f in captured for f in REQUIRED_FIELDS)

        if not reply:
            reply = _fallback_reply(captured)

        return {
            "reply": reply,
            "captured_fields": captured,
            "field_values": field_values,
            "ready": ready,
        }

    except Exception:
        return {
            "reply": _fallback_reply([]),
            "captured_fields": [],
            "field_values": {},
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
