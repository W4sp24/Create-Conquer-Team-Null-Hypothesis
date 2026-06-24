"""
RAG layer tests — no API keys needed, no real ChromaDB paths touched.
Uses temp directories and mocked embeddings to stay fast and isolated.

    cd backend && pytest tests/test_rag.py -v
"""
import asyncio
import os
import tempfile
from unittest.mock import patch, MagicMock

import chromadb
import numpy as np
import pytest

from models import ContextPayload, ExcelRow, ChatMessage, RetrievedDocs, RetrievedDoc
from rag.ingestor import _chunk_text, _extract_text, ingest_file, delete_source, list_sources


# ── Fixtures ───────────────────────────────────────────────────────────────────

@pytest.fixture
def temp_collection(tmp_path):
    """Per-test isolated ChromaDB collection — each test gets a fresh directory."""
    client = chromadb.PersistentClient(path=str(tmp_path / "chroma"))
    yield client.get_or_create_collection(
        name="test_col",
        metadata={"hnsw:space": "cosine"},
    )


@pytest.fixture
def txt_file(tmp_path):
    """100-word text file."""
    f = tmp_path / "sample.txt"
    f.write_text(" ".join(f"word{i}" for i in range(100)))
    return str(f)


def _fake_embed(texts, *args, **kwargs):
    """Returns deterministic unit vectors — no model download needed."""
    return np.tile([1.0] + [0.0] * 383, (len(texts), 1))


# ── Chunking ───────────────────────────────────────────────────────────────────

class TestChunkText:
    def test_short_text_is_single_chunk(self):
        text = " ".join(f"w{i}" for i in range(100))
        assert len(_chunk_text(text)) == 1

    def test_long_text_produces_multiple_chunks(self):
        # 1000 words → step=450 → 3 chunks (0, 450, 900)
        text = " ".join(f"w{i}" for i in range(1000))
        assert len(_chunk_text(text)) == 3

    def test_overlap_carries_words_to_next_chunk(self):
        # 900 words → step=450 → range(0,900,450)=[0,450] → 2 chunks; second starts at w450
        words = [f"w{i}" for i in range(900)]
        chunks = _chunk_text(" ".join(words))
        assert len(chunks) == 2
        assert chunks[1].startswith("w450")

    def test_empty_text_returns_empty_list(self):
        assert _chunk_text("") == []

    def test_whitespace_only_returns_empty_list(self):
        assert _chunk_text("   \n  \t  ") == []

    def test_each_chunk_has_at_most_chunk_size_words(self):
        from config import CHUNK_SIZE
        text = " ".join(f"w{i}" for i in range(2000))
        for chunk in _chunk_text(text):
            assert len(chunk.split()) <= CHUNK_SIZE


# ── Text extraction ────────────────────────────────────────────────────────────

class TestExtractText:
    def test_extracts_txt_file(self, tmp_path):
        f = tmp_path / "doc.txt"
        f.write_text("hello world")
        assert _extract_text(str(f)) == "hello world"

    def test_unsupported_extension_raises(self, tmp_path):
        f = tmp_path / "doc.csv"
        f.write_text("a,b,c")
        with pytest.raises(ValueError, match="Unsupported"):
            _extract_text(str(f))


# ── Ingestor ───────────────────────────────────────────────────────────────────

class TestIngestFile:
    def test_returns_chunk_count(self, temp_collection, txt_file):
        with patch("rag.ingestor._get_embedder") as mock_emb:
            mock_emb.return_value = MagicMock(encode=_fake_embed)
            n = ingest_file(txt_file, temp_collection, "sample.txt")
        assert n == 1  # 100 words < 500 → 1 chunk

    def test_chunks_stored_in_collection(self, temp_collection, txt_file):
        with patch("rag.ingestor._get_embedder") as mock_emb:
            mock_emb.return_value = MagicMock(encode=_fake_embed)
            ingest_file(txt_file, temp_collection, "sample.txt")
        results = temp_collection.get(include=["metadatas"])
        assert len(results["ids"]) == 1

    def test_metadata_source_name_stored(self, temp_collection, txt_file):
        with patch("rag.ingestor._get_embedder") as mock_emb:
            mock_emb.return_value = MagicMock(encode=_fake_embed)
            ingest_file(txt_file, temp_collection, "my_doc.txt")
        results = temp_collection.get(include=["metadatas"])
        assert results["metadatas"][0]["source"] == "my_doc.txt"

    def test_metadata_uploaded_at_stored(self, temp_collection, txt_file):
        with patch("rag.ingestor._get_embedder") as mock_emb:
            mock_emb.return_value = MagicMock(encode=_fake_embed)
            ingest_file(txt_file, temp_collection, "doc.txt", uploaded_at="2024-01-01T00:00:00+00:00")
        results = temp_collection.get(include=["metadatas"])
        assert results["metadatas"][0]["uploaded_at"] == "2024-01-01T00:00:00+00:00"

    def test_metadata_uploaded_at_defaults_to_now(self, temp_collection, txt_file):
        with patch("rag.ingestor._get_embedder") as mock_emb:
            mock_emb.return_value = MagicMock(encode=_fake_embed)
            ingest_file(txt_file, temp_collection, "doc.txt")
        results = temp_collection.get(include=["metadatas"])
        assert results["metadatas"][0]["uploaded_at"] != ""

    def test_empty_file_returns_zero(self, temp_collection, tmp_path):
        f = tmp_path / "empty.txt"
        f.write_text("")
        with patch("rag.ingestor._get_embedder") as mock_emb:
            mock_emb.return_value = MagicMock(encode=_fake_embed)
            n = ingest_file(str(f), temp_collection, "empty.txt")
        assert n == 0

    def test_chunk_index_increments(self, temp_collection, tmp_path):
        # 1000 words → 3 chunks → chunk_index 0, 1, 2
        f = tmp_path / "long.txt"
        f.write_text(" ".join(f"w{i}" for i in range(1000)))
        with patch("rag.ingestor._get_embedder") as mock_emb:
            mock_emb.return_value = MagicMock(encode=_fake_embed)
            ingest_file(str(f), temp_collection, "long.txt")
        results = temp_collection.get(include=["metadatas"])
        indices = sorted(m["chunk_index"] for m in results["metadatas"])
        assert indices == [0, 1, 2]


# ── Delete source ──────────────────────────────────────────────────────────────

class TestDeleteSource:
    def test_removes_all_chunks(self, temp_collection, txt_file):
        with patch("rag.ingestor._get_embedder") as mock_emb:
            mock_emb.return_value = MagicMock(encode=_fake_embed)
            ingest_file(txt_file, temp_collection, "doc.txt")

        delete_source(temp_collection, "doc.txt")

        after = temp_collection.get(where={"source": "doc.txt"}, include=[])
        assert after["ids"] == []

    def test_only_removes_named_source(self, temp_collection, tmp_path):
        for name in ("a.txt", "b.txt"):
            f = tmp_path / name
            f.write_text("word " * 100)
            with patch("rag.ingestor._get_embedder") as mock_emb:
                mock_emb.return_value = MagicMock(encode=_fake_embed)
                ingest_file(str(f), temp_collection, name)

        delete_source(temp_collection, "a.txt")

        remaining = temp_collection.get(include=["metadatas"])
        sources = {m["source"] for m in remaining["metadatas"]}
        assert "a.txt" not in sources
        assert "b.txt" in sources

    def test_nonexistent_source_is_noop(self, temp_collection):
        delete_source(temp_collection, "ghost.txt")  # must not raise


# ── List sources ───────────────────────────────────────────────────────────────

class TestListSources:
    def test_empty_collection_returns_empty(self, temp_collection):
        assert list_sources(temp_collection) == []

    def test_returns_one_entry_per_source(self, temp_collection, tmp_path):
        for name in ("a.txt", "b.txt"):
            f = tmp_path / name
            f.write_text("word " * 100)
            with patch("rag.ingestor._get_embedder") as mock_emb:
                mock_emb.return_value = MagicMock(encode=_fake_embed)
                ingest_file(str(f), temp_collection, name)

        sources = list_sources(temp_collection)
        assert len(sources) == 2

    def test_chunk_count_is_accurate(self, temp_collection, tmp_path):
        # 1000 words → 3 chunks
        f = tmp_path / "long.txt"
        f.write_text(" ".join(f"w{i}" for i in range(1000)))
        with patch("rag.ingestor._get_embedder") as mock_emb:
            mock_emb.return_value = MagicMock(encode=_fake_embed)
            ingest_file(str(f), temp_collection, "long.txt")

        sources = list_sources(temp_collection)
        assert sources[0]["chunk_count"] == 3

    def test_source_name_present(self, temp_collection, txt_file):
        with patch("rag.ingestor._get_embedder") as mock_emb:
            mock_emb.return_value = MagicMock(encode=_fake_embed)
            ingest_file(txt_file, temp_collection, "sample.txt")

        sources = list_sources(temp_collection)
        assert sources[0]["source_name"] == "sample.txt"


# ── Evidence retriever ─────────────────────────────────────────────────────────

class TestEvidenceRetriever:
    def test_returns_retrieved_docs(self):
        from agents.evidence_retriever import run_evidence_retriever

        mock_docs = RetrievedDocs(
            specialized=[RetrievedDoc(text="t", source="s", source_type="specialized")],
            org_uploads=[],
        )
        with patch("agents.evidence_retriever.retrieve", return_value=mock_docs):
            queue = asyncio.Queue()
            ctx = ContextPayload(
                run_id="er-001",
                excel_data=[ExcelRow(data={"crop": "rice", "region": "coastal"})],
                chat_messages=[ChatMessage(role="user", content="Budget is $50,000")],
            )
            result = asyncio.run(run_evidence_retriever(ctx, queue))

        assert isinstance(result, RetrievedDocs)
        assert len(result.specialized) == 1

    def test_emits_running_then_done(self):
        from agents.evidence_retriever import run_evidence_retriever

        with patch("agents.evidence_retriever.retrieve", return_value=RetrievedDocs(specialized=[], org_uploads=[])):
            queue = asyncio.Queue()
            asyncio.run(run_evidence_retriever(
                ContextPayload(run_id="er-002", excel_data=[], chat_messages=[]),
                queue,
            ))

        events = []
        while not queue.empty():
            events.append(queue.get_nowait())

        statuses = [(e.agent, e.status) for e in events]
        assert ("evidence_retriever", "running") in statuses
        assert ("evidence_retriever", "done") in statuses
        running_idx = statuses.index(("evidence_retriever", "running"))
        done_idx = statuses.index(("evidence_retriever", "done"))
        assert running_idx < done_idx

    def test_empty_context_uses_default_query(self):
        from agents.evidence_retriever import run_evidence_retriever

        captured = {}

        def mock_retrieve(query, n_results):
            captured["query"] = query
            return RetrievedDocs(specialized=[], org_uploads=[])

        with patch("agents.evidence_retriever.retrieve", side_effect=mock_retrieve):
            asyncio.run(run_evidence_retriever(
                ContextPayload(run_id="er-003", excel_data=[], chat_messages=[]),
                asyncio.Queue(),
            ))

        assert captured["query"] == "smallholder agriculture intervention program"

    def test_query_includes_excel_values(self):
        from agents.evidence_retriever import run_evidence_retriever

        captured = {}

        def mock_retrieve(query, n_results):
            captured["query"] = query
            return RetrievedDocs(specialized=[], org_uploads=[])

        with patch("agents.evidence_retriever.retrieve", side_effect=mock_retrieve):
            asyncio.run(run_evidence_retriever(
                ContextPayload(
                    run_id="er-004",
                    excel_data=[ExcelRow(data={"crop": "maize", "region": "highland"})],
                    chat_messages=[],
                ),
                asyncio.Queue(),
            ))

        assert "maize" in captured["query"]
        assert "highland" in captured["query"]

    def test_query_includes_user_chat_messages(self):
        from agents.evidence_retriever import run_evidence_retriever

        captured = {}

        def mock_retrieve(query, n_results):
            captured["query"] = query
            return RetrievedDocs(specialized=[], org_uploads=[])

        with patch("agents.evidence_retriever.retrieve", side_effect=mock_retrieve):
            asyncio.run(run_evidence_retriever(
                ContextPayload(
                    run_id="er-005",
                    excel_data=[],
                    chat_messages=[
                        ChatMessage(role="assistant", content="What is your budget?"),
                        ChatMessage(role="user", content="Our budget is $75,000"),
                    ],
                ),
                asyncio.Queue(),
            ))

        assert "$75,000" in captured["query"]

    def test_assistant_messages_excluded_from_query(self):
        from agents.evidence_retriever import run_evidence_retriever

        captured = {}

        def mock_retrieve(query, n_results):
            captured["query"] = query
            return RetrievedDocs(specialized=[], org_uploads=[])

        with patch("agents.evidence_retriever.retrieve", side_effect=mock_retrieve):
            asyncio.run(run_evidence_retriever(
                ContextPayload(
                    run_id="er-006",
                    excel_data=[],
                    chat_messages=[
                        ChatMessage(role="assistant", content="ASSISTANT_ONLY_TEXT"),
                    ],
                ),
                asyncio.Queue(),
            ))

        assert "ASSISTANT_ONLY_TEXT" not in captured["query"]
