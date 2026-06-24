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


def extract_json(text: str) -> dict:
    """Strip markdown fences if present, then parse JSON. Used by all agents."""
    match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
    raw = match.group(1) if match else text.strip()
    return json.loads(raw)
