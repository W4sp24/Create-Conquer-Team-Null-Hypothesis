from __future__ import annotations
import chromadb
from config import CHROMA_SPECIALIZED, CHROMA_ORG

# Module-level singletons — created once, reused across all requests.
_specialized_client = chromadb.PersistentClient(path=CHROMA_SPECIALIZED)
specialized_collection = _specialized_client.get_or_create_collection(
    name="specialized_knowledge",
    metadata={"hnsw:space": "cosine"},
)

_org_client = chromadb.PersistentClient(path=CHROMA_ORG)
org_collection = _org_client.get_or_create_collection(
    name="org_knowledge",
    metadata={"hnsw:space": "cosine"},
)
