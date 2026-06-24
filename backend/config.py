"""Central config — model names, paths, and chunking constants."""

# ── LLM models ────────────────────────────────────────────────────────────────
GROQ_FAST  = "llama-3.1-8b-instant"    # Evidence Retriever, Context Profiler, Data Analyst
GROQ_LARGE = "llama-3.3-70b-versatile" # Intervention Adapter, Budget Planner
GROQ_EVAL  = "gemma2-9b-it"            # Risk & M&E Agent
GEMINI_MAIN = "gemini-1.5-flash"       # Synthesizer

# ── ChromaDB paths ─────────────────────────────────────────────────────────────
CHROMA_SPECIALIZED = "./knowledge_base/chroma_db/specialized"
CHROMA_ORG         = "./knowledge_base/chroma_db/org_uploads"

# ── Embeddings ─────────────────────────────────────────────────────────────────
EMBED_MODEL = "all-MiniLM-L6-v2"

# ── Chunking ───────────────────────────────────────────────────────────────────
CHUNK_SIZE    = 500  # words
CHUNK_OVERLAP = 50   # words
