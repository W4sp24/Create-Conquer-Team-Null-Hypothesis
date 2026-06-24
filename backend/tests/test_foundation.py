"""
Block 1 foundation tests — runs with only: pydantic, python-dotenv, pytest
No LLM calls, no ChromaDB, no sentence-transformers needed.

  pip install pydantic python-dotenv pytest
  cd backend
  pytest tests/test_foundation.py -v
"""
import json
import sys
import os
import asyncio

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from models import (
    ExcelRow,
    ChatMessage,
    ContextPayload,
    RetrievedDoc,
    RetrievedDocs,
    DataAnalystOutput,
    InterventionAdapterOutput,
    KPI,
    RiskMneOutput,
    RolloutPhase,
    ProgramOutput,
    SSEEvent,
    SourceMetadata,
    CompareRequest,
)
from agents.base import extract_json, call_llm
import config


# ─── ContextPayload ────────────────────────────────────────────────────────────

class TestContextPayload:
    def test_creates_with_valid_data(self):
        payload = ContextPayload(
            run_id="test-001",
            excel_data=[ExcelRow(data={"crop": "rice", "yield": 1.9})],
            chat_messages=[ChatMessage(role="user", content="Budget is P2M")],
        )
        assert payload.run_id == "test-001"
        assert len(payload.excel_data) == 1
        assert len(payload.chat_messages) == 1

    def test_excel_row_accepts_any_keys(self):
        row = ExcelRow(data={"anything": 123, "whatever_column": "value"})
        assert row.data["anything"] == 123

    def test_empty_excel_and_chat_allowed(self):
        payload = ContextPayload(run_id="x", excel_data=[], chat_messages=[])
        assert payload.excel_data == []

    def test_missing_run_id_raises(self):
        with pytest.raises(Exception):
            ContextPayload(excel_data=[], chat_messages=[])

    def test_chat_message_roles(self):
        user_msg = ChatMessage(role="user", content="hello")
        sys_msg = ChatMessage(role="system", content="You are an assistant")
        assert user_msg.role == "user"
        assert sys_msg.role == "system"


# ─── RetrievedDocs ─────────────────────────────────────────────────────────────

class TestRetrievedDocs:
    def test_creates_with_empty_lists(self):
        docs = RetrievedDocs(specialized=[], org_uploads=[])
        assert docs.specialized == []
        assert docs.org_uploads == []

    def test_creates_with_docs(self):
        doc = RetrievedDoc(text="some content", source="fao.pdf", source_type="specialized")
        docs = RetrievedDocs(specialized=[doc], org_uploads=[])
        assert docs.specialized[0].source == "fao.pdf"
        assert docs.specialized[0].source_type == "specialized"

    def test_org_upload_source_type(self):
        doc = RetrievedDoc(text="org data", source="cebu_baseline.pdf", source_type="org_upload")
        assert doc.source_type == "org_upload"


# ─── Agent outputs ─────────────────────────────────────────────────────────────

class TestDataAnalystOutput:
    def test_all_fields_optional(self):
        out = DataAnalystOutput()
        assert out.beneficiary_count is None
        assert out.crop_type is None
        assert out.raw_metrics == {}

    def test_with_full_values(self):
        out = DataAnalystOutput(
            beneficiary_count=5000,
            crop_type="rice",
            region="coastal",
            baseline_yield_t_ha=1.9,
            income_drop_pct=45.0,
            staff_count=12,
            raw_metrics={"plot_size_ha": 2.1},
        )
        assert out.beneficiary_count == 5000
        assert out.raw_metrics["plot_size_ha"] == 2.1

    def test_partial_values_allowed(self):
        out = DataAnalystOutput(crop_type="corn", beneficiary_count=200)
        assert out.crop_type == "corn"
        assert out.region is None


class TestInterventionAdapterOutput:
    def test_requires_intervention_name(self):
        with pytest.raises(Exception):
            InterventionAdapterOutput(
                description="desc",
                adaptations=[],
                implementation_steps=[],
            )

    def test_creates_successfully(self):
        out = InterventionAdapterOutput(
            intervention_name="SRI Rice",
            description="System of Rice Intensification for coastal context",
            adaptations=["Reduced water use due to saltwater intrusion risk"],
            implementation_steps=["Training", "Seed procurement", "Field demo"],
        )
        assert out.intervention_name == "SRI Rice"
        assert len(out.adaptations) == 1
        assert len(out.implementation_steps) == 3

    def test_empty_lists_allowed(self):
        out = InterventionAdapterOutput(
            intervention_name="Test",
            description="desc",
            adaptations=[],
            implementation_steps=[],
        )
        assert out.adaptations == []


class TestRiskMneOutput:
    def test_creates_successfully(self):
        kpi = KPI(name="Yield increase", target="2.8 t/ha", measurement="Harvest survey")
        out = RiskMneOutput(
            risk_level="medium",
            risk_flags=["Typhoon season overlap"],
            mitigations=["Phase 1 before June"],
            kpis=[kpi],
            confidence_score=0.72,
        )
        assert out.risk_level == "medium"
        assert out.confidence_score == 0.72
        assert out.kpis[0].name == "Yield increase"

    def test_kpi_structure(self):
        kpi = KPI(name="Income recovery", target="₱18,000/season", measurement="Household survey")
        assert kpi.name == "Income recovery"
        assert kpi.target == "₱18,000/season"

    def test_empty_flags_and_mitigations(self):
        out = RiskMneOutput(
            risk_level="low",
            risk_flags=[],
            mitigations=[],
            kpis=[],
            confidence_score=0.9,
        )
        assert out.risk_level == "low"


# ─── ProgramOutput ─────────────────────────────────────────────────────────────

def _make_program(run_id: str = "run-001") -> ProgramOutput:
    intervention = InterventionAdapterOutput(
        intervention_name="SRI Rice",
        description="Coastal-adapted SRI",
        adaptations=["Shifted to dry-season planting cycle"],
        implementation_steps=["Training", "Demo plot", "Rollout"],
    )
    risk = RiskMneOutput(
        risk_level="medium",
        risk_flags=["Typhoon overlap"],
        mitigations=["Phase before June"],
        kpis=[KPI(name="Yield", target="2.8 t/ha", measurement="Harvest survey")],
        confidence_score=0.75,
    )
    phase = RolloutPhase(
        phase=1,
        name="Pilot",
        duration="3 months",
        activities=["Farmer training", "Demo plot setup"],
    )
    return ProgramOutput(
        run_id=run_id,
        title="Coastal Rice Rehabilitation Program",
        target_beneficiaries="5,000 smallholder farmers in Cebu coastal barangays",
        intervention=intervention,
        rollout_phases=[phase],
        staff_roles=["Field officer", "M&E coordinator"],
        per_beneficiary_cost_usd=None,
        total_budget_estimate="P2,000,000",
        kpis=[KPI(name="Yield", target="2.8 t/ha", measurement="Harvest survey")],
        risk_assessment=risk,
        adaptations_made=["Shifted to dry-season planting cycle"],
        citations=["[Global: FAO 2023]", "[Org: cebu_baseline.pdf]"],
        confidence_level=0.75,
    )


class TestProgramOutput:
    def test_creates_successfully(self):
        program = _make_program()
        assert program.run_id == "run-001"
        assert program.title == "Coastal Rice Rehabilitation Program"

    def test_optional_cost_can_be_none(self):
        program = _make_program()
        assert program.per_beneficiary_cost_usd is None

    def test_citations_present(self):
        program = _make_program()
        assert "[Global: FAO 2023]" in program.citations
        assert "[Org: cebu_baseline.pdf]" in program.citations

    def test_adaptations_made_present(self):
        program = _make_program()
        assert "Shifted to dry-season planting cycle" in program.adaptations_made

    def test_nested_intervention(self):
        program = _make_program()
        assert program.intervention.intervention_name == "SRI Rice"

    def test_rollout_phases(self):
        program = _make_program()
        assert program.rollout_phases[0].phase == 1
        assert len(program.rollout_phases[0].activities) == 2


# ─── SSEEvent ──────────────────────────────────────────────────────────────────

class TestSSEEvent:
    def test_valid_statuses(self):
        for status in ("pending", "running", "done", "error"):
            ev = SSEEvent(agent="data_analyst", status=status)
            assert ev.status == status

    def test_requires_both_fields(self):
        with pytest.raises(Exception):
            SSEEvent(agent="data_analyst")

    def test_agent_names(self):
        agents = [
            "evidence_retriever", "data_analyst",
            "intervention_adapter", "risk_mne_agent", "synthesizer",
        ]
        for name in agents:
            ev = SSEEvent(agent=name, status="running")
            assert ev.agent == name


# ─── SourceMetadata ────────────────────────────────────────────────────────────

class TestSourceMetadata:
    def test_creates_successfully(self):
        meta = SourceMetadata(
            filename="cebu_baseline.pdf",
            source_type="org_upload",
            chunk_count=42,
            uploaded_at="2026-06-24T10:00:00",
        )
        assert meta.chunk_count == 42
        assert meta.source_type == "org_upload"

    def test_specialized_source_type(self):
        meta = SourceMetadata(
            filename="fao_sri_guide.pdf",
            source_type="specialized",
            chunk_count=120,
            uploaded_at="2026-01-01T00:00:00",
        )
        assert meta.source_type == "specialized"


# ─── CompareRequest ────────────────────────────────────────────────────────────

class TestCompareRequest:
    def test_two_different_payloads(self):
        a = ContextPayload(run_id="a", excel_data=[], chat_messages=[])
        b = ContextPayload(run_id="b", excel_data=[], chat_messages=[])
        req = CompareRequest(profile_a=a, profile_b=b)
        assert req.profile_a.run_id == "a"
        assert req.profile_b.run_id == "b"

    def test_requires_both_profiles(self):
        with pytest.raises(Exception):
            a = ContextPayload(run_id="a", excel_data=[], chat_messages=[])
            CompareRequest(profile_a=a)


# ─── extract_json ──────────────────────────────────────────────────────────────

class TestExtractJson:
    def test_strips_markdown_fences(self):
        text = '```json\n{"key": "value"}\n```'
        assert extract_json(text) == {"key": "value"}

    def test_plain_json_no_fences(self):
        text = '{"crop": "rice", "yield": 1.9}'
        result = extract_json(text)
        assert result["crop"] == "rice"
        assert result["yield"] == 1.9

    def test_nested_json(self):
        text = '{"kpis": [{"name": "yield", "target": "2.5 t/ha"}]}'
        result = extract_json(text)
        assert result["kpis"][0]["name"] == "yield"

    def test_invalid_json_raises(self):
        with pytest.raises(json.JSONDecodeError):
            extract_json("this is not json")

    def test_text_before_fence_is_ignored(self):
        text = 'Here is the result:\n```json\n{"status": "ok"}\n```'
        assert extract_json(text)["status"] == "ok"

    def test_empty_object(self):
        assert extract_json("{}") == {}

    def test_array_json(self):
        # agents sometimes return arrays
        text = '```json\n[{"name": "a"}, {"name": "b"}]\n```'
        result = extract_json(text)
        assert isinstance(result, list)
        assert result[0]["name"] == "a"


# ─── call_llm provider guard ───────────────────────────────────────────────────

class TestCallLlmProviderGuard:
    def test_unknown_provider_raises_value_error(self):
        with pytest.raises(ValueError, match="Unknown provider"):
            asyncio.run(call_llm("openai", "gpt-4", "test"))

    def test_unknown_provider_message_contains_name(self):
        with pytest.raises(ValueError, match="badprovider"):
            asyncio.run(call_llm("badprovider", "some-model", "test"))


# ─── config ────────────────────────────────────────────────────────────────────

class TestConfig:
    def test_groq_model_names_are_strings(self):
        assert isinstance(config.GROQ_FAST, str)
        assert isinstance(config.GROQ_LARGE, str)
        assert isinstance(config.GROQ_EVAL, str)

    def test_gemini_model_is_string(self):
        assert isinstance(config.GEMINI_MAIN, str)

    def test_chroma_paths_are_strings(self):
        assert isinstance(config.CHROMA_SPECIALIZED, str)
        assert isinstance(config.CHROMA_ORG, str)

    def test_embed_model_is_string(self):
        assert isinstance(config.EMBED_MODEL, str)

    def test_chunk_settings_are_ints(self):
        assert isinstance(config.CHUNK_SIZE, int)
        assert isinstance(config.CHUNK_OVERLAP, int)

    def test_overlap_smaller_than_chunk(self):
        assert config.CHUNK_OVERLAP < config.CHUNK_SIZE

    def test_known_groq_models(self):
        # Must match Groq's current production lineup
        # (gemma2-9b-it was decommissioned; GROQ_EVAL → openai/gpt-oss-20b)
        KNOWN_GROQ_MODELS = {
            "llama-3.1-8b-instant",
            "llama-3.3-70b-versatile",
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
        }
        assert config.GROQ_FAST in KNOWN_GROQ_MODELS
        assert config.GROQ_LARGE in KNOWN_GROQ_MODELS
        assert config.GROQ_EVAL in KNOWN_GROQ_MODELS

    def test_known_gemini_model(self):
        assert "gemini" in config.GEMINI_MAIN
