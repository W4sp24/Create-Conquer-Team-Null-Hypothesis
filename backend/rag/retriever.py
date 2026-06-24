from __future__ import annotations
from sentence_transformers import SentenceTransformer

from config import EMBED_MODEL
from models import RetrievedDoc, RetrievedDocs
from rag.chroma_client import specialized_collection, org_collection

# Lazy — model only downloads on first retrieve() call, not at import time.
_embedder: SentenceTransformer | None = None


def _get_embedder() -> SentenceTransformer:
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer(EMBED_MODEL)
    return _embedder


def retrieve(query: str, n_results: int = 5) -> RetrievedDocs:
    embedding = _get_embedder().encode(query).tolist()

    spec = specialized_collection.query(
        query_embeddings=[embedding],
        n_results=n_results,
        include=["documents", "metadatas"],
    )
    org = org_collection.query(
        query_embeddings=[embedding],
        n_results=n_results,
        include=["documents", "metadatas"],
    )

    def _parse(results: dict, source_type: str) -> list[RetrievedDoc]:
        if not results["documents"] or not results["documents"][0]:
            return []
        return [
            RetrievedDoc(
                text=text,
                source=meta.get("source", "unknown"),
                source_type=source_type,
            )
            for text, meta in zip(results["documents"][0], results["metadatas"][0])
        ]

    return RetrievedDocs(
        specialized=_parse(spec, "specialized"),
        org_uploads=_parse(org, "org_upload"),
    )
