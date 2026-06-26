from __future__ import annotations
import re

from models import ChatMessage
from agents.base import call_llm_chat, extract_json
from config import GROQ_FAST

# Context fields the intake assistant tracks. Required ones must be captured
# before the pipeline can run; optional ones enrich the program but don't gate it.
REQUIRED_FIELDS = ["goal", "region", "crop", "beneficiaries"]
OPTIONAL_FIELDS = ["budget", "staff"]
ALL_FIELDS = REQUIRED_FIELDS + OPTIONAL_FIELDS

_RICHNESS_WEIGHTS = {"goal": 15, "region": 20, "crop": 20, "beneficiaries": 20, "budget": 20, "staff": 15}

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

_SYSTEM_PROMPT_TEMPLATE = """{{CAPTURED_HEADER}}

You are the intake assistant for AniKonsulta, a tool that designs \
context-adapted social programs for smallholder agriculture and livelihood NGOs.

Your job is to gather context needed to generate a program while being genuinely helpful.

You track these context fields:
- goal          (REQUIRED) — the type of program the user wants to design. Ask this FIRST. \
Examples: farmer training, market linkage, input supply, credit & finance, extension services, \
post-harvest management, cooperative development. Accept free-form answers — the user knows \
what they need.
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
- GOAL: ██ NEVER infer 'goal' from spreadsheet data. ██ Spreadsheets contain field \
survey measurements — they describe WHO is being surveyed and WHAT they grow, not WHAT \
PROGRAM TYPE the organization wants. 'goal' must be explicitly stated by the user in \
the conversation. A column named "training_type" or "activity" is NOT a program goal.

If a field is clearly present in the data, capture it immediately. Only ask about fields \
that are genuinely absent from the spreadsheet AND the conversation.
═══════════════════════════════════════════════════════════════════════════

STRICT RULES:
1. ██ ALREADY CAPTURED fields listed at the top of this prompt are FINAL. NEVER ask about \
them again — not even for clarification. Treat them as confirmed ground truth.
2. Extract from ALL sources — spreadsheet columns, sample values, statistics, and chat. \
Exception: 'goal' ONLY from chat — never from spreadsheet data.
3. captured_fields must always include everything from ALREADY CAPTURED plus new finds. \
Never shrink the list.
4. Ask for exactly ONE missing field per reply. Priority: goal → region → crop → \
beneficiaries → budget → staff. Once all required fields are captured, switch to \
open-ended enrichment questions (see Rule 6). Never stack questions. \
Questions MUST be phrased as actual questions ending with '?' — never state \
"I'd like to confirm X" or "I need to know X"; ask directly: "What is X?"
5. Set "ready": true only after all four REQUIRED fields (goal, region, crop, \
beneficiaries) are captured AND you have asked about budget and staff at least once \
(even if the user skips them). If the user says "skip", "no budget", or equivalent, \
accept that and move on.
6. ██ WHEN ALL REQUIRED FIELDS ARE ALREADY CAPTURED: set "ready": true AND write a reply \
that does THREE things: (a) briefly confirm the core context — "You're designing a \
[goal] for [count] [crop] farmers in [region].", (b) tell the user the Generate \
button is now available, (c) invite one open-ended follow-up — "Anything else I \
should factor in — specific challenges, local constraints, or existing programs in \
the area?" Do NOT re-ask captured fields. Treat this as the start of enrichment, \
not the end of the conversation.
7. Never invent data. If a value is ambiguous, describe what you see and ask to confirm.
8. Be conversational — acknowledge what you found in the data before asking the next \
question.
9. AFTER "ready": true — when the user shares additional information, acknowledge it \
specifically: "I've noted that [X] — this will shape the program design." Then invite \
more or confirm they can generate. Never re-ask captured fields. Keep "ready": true \
in every subsequent response.

Return ONLY valid JSON:
{
  "reply": "your conversational message to the user",
  "captured_fields": ["goal", "region", "crop", ...],
  "field_values": {"goal": "short plain-language value", ...},
  "ready": true or false
}

field_values must contain a short (under 15 words) plain-language value for every \
captured field — what the data actually shows, not a restatement of the question.
"""


def _build_system_prompt(captured: list[str]) -> str:
    """Inject currently-captured fields at the very top of the system prompt.

    Placing them in the system prompt (not just the user message) ensures the LLM
    treats them as authoritative instructions, not background context it can ignore.
    """
    if captured:
        header = (
            "██ ALREADY CAPTURED — DO NOT ASK ABOUT THESE AGAIN: "
            + ", ".join(captured)
            + " ██"
        )
    else:
        header = "ALREADY CAPTURED: none yet — start by asking the user for their program goal."
    return _SYSTEM_PROMPT_TEMPLATE.replace("{{CAPTURED_HEADER}}", header)


_MAX_COLS = 8
_MAX_EXAMPLES = 3
_MAX_SAMPLE_ROWS = 2


def _excel_summary(excel_preview: dict | None) -> str:
    """Compact spreadsheet summary — enough for the LLM to identify context fields."""
    if not excel_preview:
        return "No spreadsheet uploaded."

    filename = excel_preview.get("filename", "spreadsheet")
    rows = excel_preview.get("rows", "?")
    cols = excel_preview.get("cols", "?")
    columns = excel_preview.get("columns") or []
    sample_rows = excel_preview.get("sample_rows") or []

    lines = [f"File '{filename}': {rows} rows x {cols} cols."]

    shown_cols = columns[:_MAX_COLS]
    if columns:
        lines.append("Columns:")
        for c in shown_cols:
            name = c.get("name", "?")
            if c.get("kind") == "number":
                lines.append(f"- {name} (num: mean={c.get('mean')}, n={c.get('count')})")
            else:
                examples = ", ".join(str(e) for e in (c.get("examples") or [])[:_MAX_EXAMPLES])
                detail = f" e.g. {examples}" if examples else ""
                lines.append(f"- {name} (text,{detail})")
        if len(columns) > _MAX_COLS:
            lines.append(f"  ...and {len(columns) - _MAX_COLS} more columns")
    else:
        headers = excel_preview.get("headers", []) or []
        lines.append(f"Columns: {', '.join(str(h) for h in headers) or 'none'}")

    if sample_rows:
        lines.append("Sample rows:")
        for r in sample_rows[:_MAX_SAMPLE_ROWS]:
            lines.append(f"  {r}")

    return "\n".join(lines)


def _build_messages(
    chat_messages: list[ChatMessage],
    excel_preview: dict | None,
    previously_captured: list[str],
) -> list[dict]:
    """Build the multi-turn messages array for the Groq API.

    No history trimming — conversations are 8–12 turns (well within context
    limits) and trimming assistant turns breaks Q&A pair coherence, making
    the LLM appear confused and less engaged. The token savings from trimming
    a short conversation are negligible compared to the quality harm.
    Captured fields stay in the system prompt only (not duplicated here).
    """
    messages: list[dict] = []
    for m in chat_messages:
        if m.role == "user":
            messages.append({"role": "user", "content": m.content})
        else:
            messages.append({"role": "assistant", "content": m.content})

    # Chat APIs require user-first turn order. When the conversation starts with
    # an assistant message (e.g. the initial upload acknowledgment before the user
    # has typed anything), insert a minimal synthetic opener. Without this the model
    # sees an assistant-first array, loses track of conversation state, and
    # "continues" its previous reply instead of writing a new one — producing duplication.
    if messages and messages[0]["role"] == "assistant":
        messages.insert(0, {"role": "user", "content": "[Spreadsheet uploaded — begin intake]"})

    excel_block = f"Spreadsheet summary:\n{_excel_summary(excel_preview)}"

    if messages and messages[-1]["role"] == "user":
        messages[-1] = {
            "role": "user",
            "content": (
                messages[-1]["content"]
                + f"\n\n---\n{excel_block}\n\n"
                "Respond to the user message above. "
                "Report which context fields are now captured."
            ),
        }
    else:
        # Conversation ends on assistant turn. Tell the model exactly what to produce next
        # so it doesn't echo its previous reply.
        next_missing = next(
            (f for f in REQUIRED_FIELDS if f not in previously_captured), None
        )
        if next_missing:
            ask_instruction = (
                f"Ask the user for '{next_missing}' — ONE direct question ending with '?'. "
                "Do NOT restate what you found in the spreadsheet."
            )
        else:
            ask_instruction = (
                "All required fields are captured. Invite the user to share any additional "
                "context (challenges, constraints, existing programs)."
            )
        messages.append({
            "role": "user",
            "content": (
                f"{excel_block}\n\n"
                f"[New data is available — write your NEXT reply to the user. "
                f"{ask_instruction} "
                "Your reply MUST start with entirely new words — "
                "do NOT begin with any sentence or phrase from your previous message.]"
            ),
        })

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
            system_prompt=_build_system_prompt(enhanced_captured),
        )
        parsed = extract_json(raw)
        if not isinstance(parsed, dict):
            raise ValueError("expected a JSON object")

        reply = str(parsed.get("reply") or "").strip()
        llm_captured = [f for f in parsed.get("captured_fields", []) if f in ALL_FIELDS]
        # 'goal' can only be captured when the user has sent at least one message.
        # This blocks the LLM from inferring it from spreadsheet columns on upload
        # (before any conversation has happened). Prior-turn captures (in captured_so_far)
        # are always kept — they came from a real conversation.
        user_has_spoken = any(m.role == "user" for m in chat_messages)
        if "goal" in llm_captured and "goal" not in captured_so_far and not user_has_spoken:
            llm_captured = [f for f in llm_captured if f != "goal"]
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
        "goal": "What kind of program are you looking to design? For example: farmer training, "
                "market linkage, input supply, credit & finance, or extension services.",
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
