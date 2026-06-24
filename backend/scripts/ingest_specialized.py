"""
One-shot ingestion script for the specialized knowledge base.
Place PDFs/DOCX/TXT files in knowledge_base/raw_docs/ then run:

    cd backend && python scripts/ingest_specialized.py

Idempotent: re-running ingests only files not yet in the collection.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from rag.chroma_client import specialized_collection
from rag.ingestor import ingest_file

RAW_DOCS_DIR = os.path.join(os.path.dirname(__file__), "..", "knowledge_base", "raw_docs")
SUPPORTED = {".pdf", ".docx", ".doc", ".txt"}


def _already_ingested(source_name: str) -> bool:
    results = specialized_collection.get(
        where={"source": source_name},
        include=[],
        limit=1,
    )
    return bool(results["ids"])


def main() -> None:
    raw_docs = os.path.abspath(RAW_DOCS_DIR)
    if not os.path.isdir(raw_docs):
        print(f"raw_docs directory not found: {raw_docs}")
        sys.exit(1)

    files = [
        f for f in sorted(os.listdir(raw_docs))
        if os.path.splitext(f)[1].lower() in SUPPORTED
    ]
    if not files:
        print("No supported files in knowledge_base/raw_docs/")
        print(f"Supported: {', '.join(sorted(SUPPORTED))}")
        sys.exit(0)

    print(f"Found {len(files)} file(s). Ingesting into specialized KB...")
    total_chunks = 0
    skipped = 0

    for filename in files:
        if _already_ingested(filename):
            print(f"  — {filename} (already ingested, skipping)")
            skipped += 1
            continue
        path = os.path.join(raw_docs, filename)
        try:
            n = ingest_file(path, specialized_collection, source_name=filename)
            print(f"  ✓ {filename} → {n} chunks")
            total_chunks += n
        except Exception as exc:
            print(f"  ✗ {filename} — {exc}")

    print(f"\nDone. {total_chunks} new chunks stored. {skipped} file(s) skipped.")


if __name__ == "__main__":
    main()
