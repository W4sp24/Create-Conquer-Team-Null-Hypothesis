"""
Block 2 skeleton tests — runs with only: pydantic, python-dotenv, fastapi, pytest
No LLM calls, no ChromaDB, no sentence-transformers needed.

  pip install pydantic python-dotenv fastapi pytest
  cd backend
  pytest tests/test_skeleton.py -v
"""
import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from models import ContextPayload, ProgramOutput, SSEEvent
from orchestrator import run_pipeline


def _make_context(run_id: str = "test-001") -> ContextPayload:
    return ContextPayload(run_id=run_id, excel_data=[], chat_messages=[])


def _drain_queue(queue: asyncio.Queue) -> list[SSEEvent]:
    events: list[SSEEvent] = []
    while not queue.empty():
        events.append(queue.get_nowait())
    return events


# ── Pipeline output ────────────────────────────────────────────────────────────

class TestRunPipeline:
    def test_returns_program_output(self):
        queue = asyncio.Queue()
        result = asyncio.run(run_pipeline(_make_context("r-001"), "r-001", queue))
        assert isinstance(result, ProgramOutput)

    def test_run_id_is_stamped(self):
        queue = asyncio.Queue()
        result = asyncio.run(run_pipeline(_make_context("r-002"), "r-002", queue))
        assert result.run_id == "r-002"

    def test_fields_are_populated(self):
        queue = asyncio.Queue()
        result = asyncio.run(run_pipeline(_make_context("r-003"), "r-003", queue))
        assert result.title
        assert result.target_beneficiaries
        assert len(result.rollout_phases) > 0
        assert len(result.kpis) > 0
        assert len(result.adaptations_made) > 0
        assert len(result.citations) > 0

    def test_confidence_level_in_range(self):
        queue = asyncio.Queue()
        result = asyncio.run(run_pipeline(_make_context("r-004"), "r-004", queue))
        assert 0.0 <= result.confidence_level <= 1.0

    def test_nested_risk_assessment(self):
        queue = asyncio.Queue()
        result = asyncio.run(run_pipeline(_make_context("r-005"), "r-005", queue))
        assert result.risk_assessment.risk_level in ("low", "medium", "high", "unknown")
        assert isinstance(result.risk_assessment.kpis, list)


# ── SSE events ─────────────────────────────────────────────────────────────────

class TestSSEEvents:
    def test_all_agent_names_present(self):
        queue = asyncio.Queue()
        asyncio.run(run_pipeline(_make_context("s-001"), "s-001", queue))
        events = _drain_queue(queue)
        agent_names = {e.agent for e in events}
        assert "evidence_retriever" in agent_names
        assert "data_analyst" in agent_names
        assert "intervention_adapter" in agent_names
        assert "risk_mne_agent" in agent_names
        assert "synthesizer" in agent_names

    def test_all_agents_reach_done(self):
        queue = asyncio.Queue()
        asyncio.run(run_pipeline(_make_context("s-002"), "s-002", queue))
        events = _drain_queue(queue)
        done_agents = {e.agent for e in events if e.status == "done"}
        assert "evidence_retriever" in done_agents
        assert "data_analyst" in done_agents
        assert "intervention_adapter" in done_agents
        assert "risk_mne_agent" in done_agents
        assert "synthesizer" in done_agents

    def test_phase_1_completes_before_phase_2_starts(self):
        queue = asyncio.Queue()
        asyncio.run(run_pipeline(_make_context("s-003"), "s-003", queue))
        events = _drain_queue(queue)
        agent_sequence = [e.agent for e in events]
        status_sequence = [(e.agent, e.status) for e in events]

        er_done_idx = next(
            i for i, e in enumerate(events)
            if e.agent == "evidence_retriever" and e.status == "done"
        )
        da_running_idx = next(
            i for i, e in enumerate(events)
            if e.agent == "data_analyst" and e.status == "running"
        )
        assert er_done_idx < da_running_idx

    def test_synthesizer_runs_after_analysis_agents(self):
        queue = asyncio.Queue()
        asyncio.run(run_pipeline(_make_context("s-004"), "s-004", queue))
        events = _drain_queue(queue)

        synth_running_idx = next(
            i for i, e in enumerate(events)
            if e.agent == "synthesizer" and e.status == "running"
        )
        for agent in ("data_analyst", "intervention_adapter", "risk_mne_agent"):
            done_idx = next(
                i for i, e in enumerate(events)
                if e.agent == agent and e.status == "done"
            )
            assert done_idx < synth_running_idx


# ── main.py app ────────────────────────────────────────────────────────────────

class TestMainApp:
    def test_app_title(self):
        from main import app
        assert app.title == "AIS — Adaptive Intervention Synthesizer"

    def test_health_route_exists(self):
        from main import app
        routes = [r.path for r in app.routes]
        assert "/health" in routes
