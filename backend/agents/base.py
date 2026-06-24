from __future__ import annotations
import asyncio
import json
import os
import re

from dotenv import load_dotenv

load_dotenv()


async def call_llm(
    provider: str,
    model: str,
    prompt: str,
    system_prompt: str = "",
) -> str:
    """Provider-agnostic async LLM call with one silent retry on transient failure."""
    if provider not in ("groq", "gemini"):
        raise ValueError(f"Unknown provider: {provider!r}")

    last_exc: Exception | None = None
    for attempt in range(2):
        try:
            if provider == "groq":
                return await asyncio.to_thread(_call_groq, model, system_prompt, prompt)
            else:
                return await asyncio.to_thread(_call_gemini, model, system_prompt, prompt)
        except Exception as exc:
            last_exc = exc
            if attempt == 0:
                await asyncio.sleep(1)  # brief pause before retry

    raise last_exc  # type: ignore[misc]


def _call_groq(model: str, system_prompt: str, user_prompt: str) -> str:
    from groq import Groq
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": user_prompt})
    resp = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.2,
    )
    return resp.choices[0].message.content


def _call_gemini(model: str, system_prompt: str, user_prompt: str) -> str:
    import google.generativeai as genai
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    full_prompt = f"{system_prompt}\n\n{user_prompt}" if system_prompt else user_prompt
    m = genai.GenerativeModel(model)
    return m.generate_content(full_prompt).text


def extract_json(text: str) -> dict | list:
    """Parse JSON from an LLM response. Used by all agents.

    Tolerant of how different models wrap output: ```json fences, bare ```
    fences, and JSON preceded/followed by prose. Falls back to slicing the first
    balanced object/array out of the text.
    """
    s = text.strip()

    # Strip a fenced code block — either ```json … ``` or a bare ``` … ```.
    fence = re.search(r"```(?:json)?\s*(.*?)\s*```", s, re.DOTALL)
    if fence:
        s = fence.group(1).strip()

    try:
        return json.loads(s)
    except json.JSONDecodeError:
        # Last resort: grab the first {...} or [...] span and parse that.
        starts = [i for i in (s.find("{"), s.find("[")) if i != -1]
        if starts:
            start = min(starts)
            end = max(s.rfind("}"), s.rfind("]"))
            if end > start:
                return json.loads(s[start : end + 1])
        raise
