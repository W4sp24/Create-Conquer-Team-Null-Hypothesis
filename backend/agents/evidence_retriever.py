from __future__ import annotations
import asyncio

from models import ContextPayload, RetrievedDocs, SSEEvent
from rag.retriever import retrieve


async def run_evidence_retriever(
    context: ContextPayload,
    sse_queue: asyncio.Queue,
) -> RetrievedDocs:
    await sse_queue.put(SSEEvent(agent="evidence_retriever", status="running"))

    # Build query from Excel column values + last 3 user chat messages
    query_parts: list[str] = []
    if context.excel_data:
        query_parts.extend(
            str(v) for v in context.excel_data[0].data.values() if v
        )
    for msg in context.chat_messages[-3:]:
        if msg.role == "user":
            query_parts.append(msg.content)

    query = " ".join(query_parts) if query_parts else "smallholder agriculture intervention program"

    retrieved = await asyncio.to_thread(retrieve, query, 5)

    await sse_queue.put(SSEEvent(agent="evidence_retriever", status="done"))
    return retrieved
