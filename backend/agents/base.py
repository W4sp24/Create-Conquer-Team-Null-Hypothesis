from __future__ import annotations
import asyncio
import json
import os
import re

from dotenv import load_dotenv

load_dotenv()


async def call_llm(provider: str, model: str, prompt: str) -> str:
    """Provider-agnostic LLM call. Swap model by changing the caller — nothing else changes."""
    if provider == "groq":
        return await asyncio.to_thread(_call_groq, model, prompt)
    elif provider == "gemini":
        return await asyncio.to_thread(_call_gemini, model, prompt)
    else:
        raise ValueError(f"Unknown provider: {provider!r}")


def _call_groq(model: str, prompt: str) -> str:
    from groq import Groq
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )
    return resp.choices[0].message.content


def _call_gemini(model: str, prompt: str) -> str:
    import google.generativeai as genai
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    m = genai.GenerativeModel(model)
    return m.generate_content(prompt).text


def extract_json(text: str) -> dict:
    """Strip markdown fences if present, then parse JSON. Used by all agents."""
    match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
    raw = match.group(1) if match else text.strip()
    return json.loads(raw)
