from __future__ import annotations
import asyncio

from models import ContextPayload, DataAnalystOutput, SSEEvent
from agents.base import call_llm, extract_json
from config import GROQ_FAST


async def run_data_analyst(
    context: ContextPayload,
    sse_queue: asyncio.Queue,
) -> DataAnalystOutput:
    """Extract structured metrics from Excel + chat using GROQ_FAST."""
    
    await sse_queue.put(SSEEvent(agent="data_analyst", status="running"))
    
    try:
        # Build Excel summary
        excel_summary = _summarize_excel(context.excel_data)
        
        # Build chat summary
        chat_summary = "\n".join(
            f"{msg.role}: {msg.content}" for msg in context.chat_messages
        )
        
        # System prompt
        system_prompt = """You are a data analyst extracting key metrics from field data.
Return ONLY valid JSON matching this schema:
{
  "beneficiary_count": int or null,
  "crop_type": string or null,
  "region": string or null,
  "baseline_yield_t_ha": float or null,
  "income_drop_pct": float or null,
  "staff_count": int or null,
  "raw_metrics": {}
}

Rules:
- Extract only what is explicitly present in the data
- Use null for missing fields
- raw_metrics can contain any additional numeric data found
- Be conservative — if unsure, use null"""

        # User prompt
        user_prompt = f"""Excel data summary:
{excel_summary}

Chat context:
{chat_summary}

Extract structured metrics as JSON."""

        # Call LLM
        raw_response = await call_llm(
            provider="groq",
            model=GROQ_FAST,
            prompt=user_prompt,
            system_prompt=system_prompt,
        )
        
        # Parse JSON
        parsed = extract_json(raw_response)
        
        # Ensure we have a dict
        if not isinstance(parsed, dict):
            parsed = {}
        
        # Build output
        result = DataAnalystOutput(
            beneficiary_count=parsed.get("beneficiary_count"),
            crop_type=parsed.get("crop_type"),
            region=parsed.get("region"),
            baseline_yield_t_ha=parsed.get("baseline_yield_t_ha"),
            income_drop_pct=parsed.get("income_drop_pct"),
            staff_count=parsed.get("staff_count"),
            raw_metrics=parsed.get("raw_metrics", {}),
        )
        
        await sse_queue.put(SSEEvent(agent="data_analyst", status="done"))
        return result
        
    except Exception:
        # Fallback on any error
        await sse_queue.put(SSEEvent(agent="data_analyst", status="done"))
        return DataAnalystOutput()


def _summarize_excel(rows: list) -> str:
    """Convert Excel rows to a readable summary."""
    if not rows:
        return "No Excel data provided."
    
    # Show first 5 rows as sample
    lines = [f"Total rows: {len(rows)}", "Sample rows:"]
    for i, row in enumerate(rows[:5], 1):
        lines.append(f"Row {i}: {row.data}")
    
    if len(rows) > 5:
        lines.append(f"... and {len(rows) - 5} more rows")
    
    return "\n".join(lines)
