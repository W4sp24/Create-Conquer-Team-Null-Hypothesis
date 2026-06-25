from __future__ import annotations
import re

from models import ChatMessage
from agents.base import call_llm_chat, extract_json
from config import GROQ_FAST

# Context fields the intake assistant tracks. Required ones must be captured
# before the pipeline can run; optional ones enrich the program but don't gate it.
REQUIRED_FIELDS = ["region", "crop", "beneficiaries"]
OPTIONAL_FIELDS = ["budget", "staff"]
ALL_FIELDS = REQUIRED_FIELDS + OPTIONAL_FIELDS

_RICHNESS_WEIGHTS = {"region": 20, "crop": 20, "beneficiaries": 20, "budget": 20, "staff": 15}

# Known crop/activity values — used to classify columns by their data, not just name
_CROP_VALUES = {
    "rice", "corn", "maize", "palay", "cassava", "wheat", "sorghum", "sugarcane",
    "coconut", "banana", "mango", "pineapple", "coffee", "cacao", "abaca", "tobacco",
    "vegetables", "vegetable", "legumes", "mongo", "peanut", "soybean", "camote",
    "gabi", "ube", "kangkong", "pechay", "fishing", "aquaculture", "livestock",
    "poultry", "cattle", "swine", "goat", "carabao", "farming", "agriculture",
}

# Column name token keywords (fast path for standard naming)
_CROP_NAME_TOKENS = {"crop", "commodity", "activity", "livelihood", "product", "species", "variety"}
_REGION_NAME_TOKENS = {"region", "province", "location", "area", "district", "municipality",
                       "barangay", "place", "site", "zone", "address", "city", "town"}
_BUDGET_NAME_TOKENS = {"budget", "fund", "funding", "cost", "amount", "allocation", "expense"}
_STAFF_NAME_TOKENS = {"staff", "worker", "employee", "personnel", "extension", "agent", "officer"}


def _col_tokens(name: str) -> set[str]:
    return set(re.split(r"[\s_\-/]+", name.lower().strip()))


def _best_text_value(col: dict, sample_rows: list[dict]) -> str:
    """Return the most representative text value for a column."""
    examples = [str(e).strip() for e in (col.get("examples") or []) if str(e).strip()]
    if not examples and sample_rows:
        val = str(sample_rows[0].get(col.get("name", ""), "")).strip()
        if val:
            examples = [val]
    return examples[0] if examples else ""


def _extract_excel_context(excel_preview: dict | None) -> tuple[list[str], dict[str, str]]:
    """Deterministically extract context fields from the spreadsheet.

    Two-pass approach:
    1. Row count → beneficiaries (always unambiguous)
    2. Column scan: match on name tokens first, then fall back to checking
       whether the column's VALUES look like crop names (value-based detection).
    The LLM handles anything this misses via semantic analysis of the full summary.
    """
    if not excel_preview:
        return [], {}

    auto_fields: list[str] = []
    auto_values: dict[str, str] = {}

    # Each row = one farmer/beneficiary
    row_count = excel_preview.get("rows") or 0
    if row_count > 0:
        auto_fields.append("beneficiaries")
        auto_values["beneficiaries"] = f"{row_count:,} (from survey rows)"

    columns = excel_preview.get("columns") or []
    sample_rows = excel_preview.get("sample_rows") or []

    # Pass 1: match by column name tokens
    for col in columns:
        tokens = _col_tokens(col.get("name", ""))
        val = _best_text_value(col, sample_rows)
        col_count = col.get("count") or 0

        if "crop" not in auto_fields and tokens & _CROP_NAME_TOKENS and val:
            auto_fields.append("crop")
            auto_values["crop"] = val
        if "region" not in auto_fields and tokens & _REGION_NAME_TOKENS and val:
            auto_fields.append("region")
            auto_values["region"] = val
        if "budget" not in auto_fields and tokens & _BUDGET_NAME_TOKENS and val:
            auto_fields.append("budget")
            auto_values["budget"] = val
        # Staff: use the full column count (computed over all rows), not just the first sample value
        if "staff" not in auto_fields and tokens & _STAFF_NAME_TOKENS and col_count > 0:
            col_name = col.get("name", "")
            auto_fields.append("staff")
            auto_values["staff"] = f"{col_count} (from '{col_name}' column)"

    # Pass 2: value-based crop detection for non-standard column names
    if "crop" not in auto_fields:
        for col in columns:
            examples = [str(e).strip().lower() for e in (col.get("examples") or []) if str(e).strip()]
            if not examples and sample_rows:
                v = str(sample_rows[0].get(col.get("name", ""), "")).strip().lower()
                if v:
                    examples = [v]
            if any(e in _CROP_VALUES for e in examples):
                val = _best_text_value(col, sample_rows)
                if val:
                    auto_fields.append("crop")
                    auto_values["crop"] = val
                    break

    return auto_fields, auto_values


def _compute_richness(captured: list[str], excel_preview: dict | None) -> int:
    score = sum(v for k, v in _RICHNESS_WEIGHTS.items() if k in captured)
    if excel_preview:
        score += 5
    return min(score, 100)

SYSTEM_PROMPT = """You are the intake assistant for AniKonsulta, a tool that designs \
context-adapted social programs for smallholder agriculture and livelihood NGOs.

Your job is to gather context needed to generate a program while being genuinely helpful.

You track these context fields:
- region        (REQUIRED) — geographic area and local conditions
- crop          (REQUIRED) — the crop or livelihood activity
- beneficiaries (REQUIRED) — how many people are targeted
- budget        (optional) — total funds available and period
- staff         (optional) — number and roles of field staff

═══ SPREADSHEET ANALYSIS — do this whenever a spreadsheet is present ═══
Analyze every column using BOTH the column name AND its sample values / statistics. \
Do not rely on column names alone — a column named "q1" with values "rice, corn, palay" \
is clearly a crop column. A column with values like "San Isidro, Sta. Cruz, Poblacion" \
is clearly a location/region column regardless of its name.

For each context field, determine the best source column using this logic:
- CROP: find the column whose values are crop names, livelihood activities, or farming \
types (rice, corn, palay, cassava, fishing, livestock, etc.). Use the most common value \
from the examples, not just the first row.
- REGION: find the column whose values are place names — province, city, barangay, \
municipality, region, or any geographic identifier. If multiple geographic columns exist \
(e.g. province AND barangay), prefer the broader one (province > barangay).
- BUDGET: find any column with monetary values or labeled as fund/budget/cost/allocation. \
Report the total or average as appropriate.
- STAFF: find any column indicating staff count or roles.
- BENEFICIARIES: row count is always the beneficiary count (each row = one \
farmer/household). This is already pre-captured — do not ask about it.

If a field is clearly present in the data, capture it immediately. Only ask about fields \
that are genuinely absent from the spreadsheet AND the conversation.
═══════════════════════════════════════════════════════════════════════════

STRICT RULES:
1. [ALREADY CAPTURED] is permanent. Never ask about those fields again.
2. Extract from ALL sources — spreadsheet columns, sample values, statistics, and chat.
3. captured_fields must always include everything from [ALREADY CAPTURED] plus new finds. \
Never shrink the list.
4. Ask for exactly ONE missing field per reply. Priority: required fields first (region → \
crop → beneficiaries), then optional (budget → staff). Never stack questions.
5. Set "ready": true only after all three REQUIRED fields are captured AND you have asked \
about budget and staff at least once (even if the user skips them). If the user says \
"skip", "no budget", or equivalent, accept that and move on.
6. Never invent data. If a value is ambiguous, describe what you see and ask to confirm.
7. Be conversational — acknowledge what you found in the data before asking the next \
question. e.g. "I can see from your spreadsheet that you have 5,000 rice farmers in \
Northern Luzon. What budget do you have available for this program?"

Return ONLY valid JSON:
{
  "reply": "your conversational message to the user",
  "captured_fields": ["region", "crop", ...],
  "field_values": {"region": "short plain-language value", ...},
  "ready": true or false
}

field_values must contain a short (under 15 words) plain-language value for every \
captured field — what the data actually shows, not a restatement of the question.
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


def _build_messages(
    chat_messages: list[ChatMessage],
    excel_preview: dict | None,
    previously_captured: list[str],
) -> list[dict]:
    """Build a proper multi-turn messages array for the Groq API.

    - Frontend role "user"   → API role "user"
    - Frontend role "system" → API role "assistant" (these are the bot's prior replies)
    - Prepends a [CONTEXT] block to the system prompt so the model sees captured fields
      before any user turn, then appends spreadsheet + RAG excerpts to the final user turn.
    """
    messages: list[dict] = []

    for m in chat_messages:
        if m.role == "user":
            messages.append({"role": "user", "content": m.content})
        else:
            # "system" role on the frontend means an assistant reply
            messages.append({"role": "assistant", "content": m.content})

    # Build captured-fields line — placed prominently at the START of the grounding block.
    if previously_captured:
        captured_line = (
            f"[ALREADY CAPTURED — do NOT ask about these again: {', '.join(previously_captured)}]"
        )
    else:
        captured_line = "[ALREADY CAPTURED: none yet]"

    final_turn = (
        f"{captured_line}\n\n"
        f"Spreadsheet summary:\n{_excel_summary(excel_preview)}\n\n"
        "Respond to the latest user message and report which context fields are now captured."
    )

    # If the last message is a user message, augment it with context.
    # If the conversation is empty or ends with an assistant message, append a new user turn.
    if messages and messages[-1]["role"] == "user":
        messages[-1] = {
            "role": "user",
            "content": messages[-1]["content"] + f"\n\n---\n{final_turn}",
        }
    else:
        messages.append({"role": "user", "content": final_turn})

    return messages


async def run_chat_assistant(
    chat_messages: list[ChatMessage],
    excel_preview: dict | None = None,
    previously_captured: list[str] | None = None,
) -> dict:
    """Conversational intake assistant (GROQ_FAST).

    Returns {"reply": str, "captured_fields": list[str], "field_values": dict, "ready": bool}.
    Uses a proper multi-turn messages array so the model maintains correct turn boundaries
    and never re-asks for already-captured fields.
    Falls back to a safe deterministic question on any LLM/parse failure.
    """
    captured_so_far = previously_captured or []

    # Deterministically extract what the spreadsheet itself already provides.
    # These are merged into [ALREADY CAPTURED] so the LLM never re-asks for them.
    excel_auto_fields, excel_auto_values = _extract_excel_context(excel_preview)
    enhanced_captured = list(dict.fromkeys(
        [f for f in ALL_FIELDS if f in (set(captured_so_far) | set(excel_auto_fields))]
    ))

    messages = _build_messages(chat_messages, excel_preview, enhanced_captured)

    try:
        raw = await call_llm_chat(
            provider="groq",
            model=GROQ_FAST,
            messages=messages,
            system_prompt=SYSTEM_PROMPT,
        )
        parsed = extract_json(raw)
        if not isinstance(parsed, dict):
            raise ValueError("expected a JSON object")

        reply = str(parsed.get("reply") or "").strip()
        llm_captured = [f for f in parsed.get("captured_fields", []) if f in ALL_FIELDS]
        # Final merge: enhanced_captured (excel + history) union LLM output — only grows.
        captured = list(dict.fromkeys(
            [f for f in ALL_FIELDS if f in (set(enhanced_captured) | set(llm_captured))]
        ))
        raw_values = parsed.get("field_values") or {}
        llm_values = {
            f: str(raw_values[f]).strip()
            for f in captured
            if f in raw_values and str(raw_values[f]).strip()
        }
        # Excel auto-values as baseline; LLM values (from chat) take precedence.
        field_values = {**excel_auto_values, **llm_values}

        # Trust the LLM's ready signal — it now asks about optional fields before
        # marking ready. Fall back to required-only check if LLM omits the field.
        llm_ready = bool(parsed.get("ready", False))
        required_met = all(f in captured for f in REQUIRED_FIELDS)
        ready = llm_ready and required_met

        if not reply:
            reply = _fallback_reply(captured)

        return {
            "reply": reply,
            "captured_fields": captured,
            "field_values": field_values,
            "ready": ready,
            "context_richness": _compute_richness(captured, excel_preview),
        }

    except Exception:
        return {
            "reply": _fallback_reply(enhanced_captured),
            "captured_fields": enhanced_captured,
            "field_values": excel_auto_values,
            "ready": False,
            "context_richness": _compute_richness(enhanced_captured, excel_preview),
        }


def _fallback_reply(captured: list[str]) -> str:
    """Deterministic next-question when the LLM output is unusable."""
    required_prompts = {
        "region": "Which region is this for, and what are the local conditions "
        "(infrastructure, weather, terrain)?",
        "crop": "What crop or livelihood activity is the focus?",
        "beneficiaries": "Roughly how many beneficiaries are you targeting?",
    }
    optional_prompts = {
        "budget": "What is the total budget available, and over what period?",
        "staff": "How many field staff do you have, and what are their roles?",
    }
    for field in REQUIRED_FIELDS:
        if field not in captured:
            return required_prompts[field]
    for field in OPTIONAL_FIELDS:
        if field not in captured:
            return optional_prompts[field]
    return "I have everything I need — press 'Review your context' to generate the program."
