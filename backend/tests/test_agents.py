"""Tests for MVP agents using mocked LLM calls."""
from __future__ import annotations
import asyncio
import pytest
from unittest.mock import AsyncMock, patch

from models import (
    ContextPayload,
    ExcelRow,
    ChatMessage,
    RetrievedDocs,
    RetrievedDoc,
    DataAnalystOutput,
    InterventionAdapterOutput,
    RiskMneOutput,
    KPI,
)
from agents.data_analyst import run_data_analyst
from agents.intervention_adapter import run_intervention_adapter
from agents.risk_mne_agent import run_risk_mne_agent
from agents.synthesizer import run_synthesizer


# ── Fixtures ───────────────────────────────────────────────────────────────────

@pytest.fixture
def sample_context():
    """Sample context payload for testing."""
    return ContextPayload(
        run_id="test-123",
        excel_data=[
            ExcelRow(data={"farmer_name": "Juan", "plot_size_ha": 2.1, "yield_t_ha": 1.9}),
            ExcelRow(data={"farmer_name": "Maria", "plot_size_ha": 1.8, "yield_t_ha": 2.0}),
        ],
        chat_messages=[
            ChatMessage(role="user", content="We are in coastal Cebu, growing rice"),
            ChatMessage(role="user", content="Typhoon season is June-November"),
        ],
    )


@pytest.fixture
def sample_retrieved():
    """Sample retrieved documents for testing."""
    return RetrievedDocs(
        specialized=[
            RetrievedDoc(
                text="System of Rice Intensification (SRI) increases yields by 20-50%",
                source="FAO 2023",
                source_type="specialized",
            ),
        ],
        org_uploads=[
            RetrievedDoc(
                text="Baseline survey shows average yield of 1.9 t/ha",
                source="cebu_baseline.pdf",
                source_type="org_upload",
            ),
        ],
    )


@pytest.fixture
def sse_queue():
    """Mock SSE queue for testing."""
    return asyncio.Queue()


# ── Data Analyst Tests ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_data_analyst_success(sample_context, sse_queue):
    """Test data analyst with successful LLM response."""
    mock_response = """{
        "beneficiary_count": 5000,
        "crop_type": "rice",
        "region": "coastal",
        "baseline_yield_t_ha": 1.9,
        "income_drop_pct": 45.0,
        "staff_count": 12,
        "raw_metrics": {"plot_size_ha": 2.1}
    }"""
    
    with patch("agents.data_analyst.call_llm", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_response
        
        result = await run_data_analyst(sample_context, sse_queue)
        
        assert isinstance(result, DataAnalystOutput)
        assert result.beneficiary_count == 5000
        assert result.crop_type == "rice"
        assert result.region == "coastal"
        assert result.baseline_yield_t_ha == 1.9
        
        # Verify LLM was called
        mock_llm.assert_called_once()
        
        # Verify SSE events
        assert sse_queue.qsize() == 2  # running + done


@pytest.mark.asyncio
async def test_data_analyst_fallback(sample_context, sse_queue):
    """Test data analyst fallback on LLM failure."""
    with patch("agents.data_analyst.call_llm", new_callable=AsyncMock) as mock_llm:
        mock_llm.side_effect = Exception("LLM error")
        
        result = await run_data_analyst(sample_context, sse_queue)
        
        assert isinstance(result, DataAnalystOutput)
        # Should return empty output on failure
        assert result.beneficiary_count is None
        assert result.crop_type is None


@pytest.mark.asyncio
async def test_data_analyst_invalid_json(sample_context, sse_queue):
    """Test data analyst with invalid JSON response."""
    with patch("agents.data_analyst.call_llm", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = "not valid json"
        
        result = await run_data_analyst(sample_context, sse_queue)
        
        assert isinstance(result, DataAnalystOutput)
        # Should return empty output on parse failure
        assert result.beneficiary_count is None


# ── Intervention Adapter Tests ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_intervention_adapter_success(sample_context, sample_retrieved, sse_queue):
    """Test intervention adapter with successful LLM response."""
    mock_response = """{
        "intervention_name": "System of Rice Intensification (SRI)",
        "description": "A set of principles for increasing rice yields",
        "adaptations": ["Shifted to dry-season planting", "Reduced transplanting density"],
        "implementation_steps": ["Conduct farmer training", "Establish demo plots"]
    }"""
    
    with patch("agents.intervention_adapter.call_llm", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_response
        
        result = await run_intervention_adapter(sample_context, sample_retrieved, sse_queue)
        
        assert isinstance(result, InterventionAdapterOutput)
        assert result.intervention_name == "System of Rice Intensification (SRI)"
        assert len(result.adaptations) == 2
        assert len(result.implementation_steps) == 2
        
        mock_llm.assert_called_once()
        assert sse_queue.qsize() == 2


@pytest.mark.asyncio
async def test_intervention_adapter_fallback(sample_context, sample_retrieved, sse_queue):
    """Test intervention adapter fallback on LLM failure."""
    with patch("agents.intervention_adapter.call_llm", new_callable=AsyncMock) as mock_llm:
        mock_llm.side_effect = Exception("LLM error")
        
        result = await run_intervention_adapter(sample_context, sample_retrieved, sse_queue)
        
        assert isinstance(result, InterventionAdapterOutput)
        assert result.intervention_name == "Context-Adapted Agricultural Support"


# ── Risk & M&E Agent Tests ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_risk_mne_success(sample_context, sample_retrieved, sse_queue):
    """Test risk & M&E agent with successful LLM response."""
    mock_response = """{
        "risk_level": "medium",
        "risk_flags": ["Typhoon season overlaps with Phase 1"],
        "mitigations": ["Begin Phase 1 before June"],
        "kpis": [
            {
                "name": "Yield per hectare",
                "target": "2.8 t/ha",
                "measurement": "End-of-season harvest survey"
            }
        ],
        "confidence_score": 0.72
    }"""
    
    with patch("agents.risk_mne_agent.call_llm", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_response
        
        result = await run_risk_mne_agent(sample_context, sample_retrieved, sse_queue)
        
        assert isinstance(result, RiskMneOutput)
        assert result.risk_level == "medium"
        assert len(result.risk_flags) == 1
        assert len(result.kpis) == 1
        assert result.confidence_score == 0.72
        
        mock_llm.assert_called_once()
        assert sse_queue.qsize() == 2


@pytest.mark.asyncio
async def test_risk_mne_invalid_risk_level(sample_context, sample_retrieved, sse_queue):
    """Test risk & M&E agent normalizes invalid risk_level."""
    mock_response = """{
        "risk_level": "extreme",
        "risk_flags": [],
        "mitigations": [],
        "kpis": [],
        "confidence_score": 0.5
    }"""
    
    with patch("agents.risk_mne_agent.call_llm", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_response
        
        result = await run_risk_mne_agent(sample_context, sample_retrieved, sse_queue)
        
        # Should normalize to "medium" if invalid
        assert result.risk_level == "medium"


@pytest.mark.asyncio
async def test_risk_mne_fallback(sample_context, sample_retrieved, sse_queue):
    """Test risk & M&E agent fallback on LLM failure."""
    with patch("agents.risk_mne_agent.call_llm", new_callable=AsyncMock) as mock_llm:
        mock_llm.side_effect = Exception("LLM error")
        
        result = await run_risk_mne_agent(sample_context, sample_retrieved, sse_queue)
        
        assert isinstance(result, RiskMneOutput)
        assert result.risk_level == "medium"
        assert result.confidence_score == 0.5


# ── Synthesizer Tests ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_synthesizer_success(sample_retrieved, sse_queue):
    """Test synthesizer with successful LLM response."""
    analyst = DataAnalystOutput(
        beneficiary_count=5000,
        crop_type="rice",
        region="coastal",
        baseline_yield_t_ha=1.9,
        staff_count=12,
    )
    
    adapter = InterventionAdapterOutput(
        intervention_name="SRI",
        description="Rice intensification",
        adaptations=["Dry-season planting"],
        implementation_steps=["Training", "Demo plots"],
    )
    
    risk = RiskMneOutput(
        risk_level="medium",
        risk_flags=["Typhoon risk"],
        mitigations=["Early planting"],
        kpis=[KPI(name="Yield", target="2.8 t/ha", measurement="Survey")],
        confidence_score=0.72,
    )
    
    mock_response = """{
        "title": "SRI — Coastal Rice Program",
        "target_beneficiaries": "5,000 smallholder rice farmers",
        "rollout_phases": [
            {
                "phase": 1,
                "name": "Pilot",
                "duration": "3 months",
                "activities": ["Training", "Demo setup"]
            }
        ],
        "staff_roles": ["Field officer (×10)", "M&E coordinator (×1)"]
    }"""
    
    with patch("agents.synthesizer.call_llm", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_response
        
        result = await run_synthesizer(
            sample_retrieved, analyst, adapter, risk, "test-123", sse_queue
        )
        
        assert result.run_id == "test-123"
        assert "SRI" in result.title
        assert len(result.rollout_phases) >= 1
        assert len(result.citations) > 0
        assert result.confidence_level == 0.72
        
        mock_llm.assert_called_once()
        assert sse_queue.qsize() == 2


@pytest.mark.asyncio
async def test_synthesizer_fallback(sample_retrieved, sse_queue):
    """Test synthesizer fallback on LLM failure."""
    analyst = DataAnalystOutput(crop_type="rice", region="coastal")
    adapter = InterventionAdapterOutput(
        intervention_name="Test",
        description="Test",
        adaptations=[],
        implementation_steps=[],
    )
    risk = RiskMneOutput(
        risk_level="low",
        risk_flags=[],
        mitigations=[],
        kpis=[],
        confidence_score=0.5,
    )
    
    with patch("agents.synthesizer.call_llm", new_callable=AsyncMock) as mock_llm:
        mock_llm.side_effect = Exception("LLM error")
        
        result = await run_synthesizer(
            sample_retrieved, analyst, adapter, risk, "test-123", sse_queue
        )
        
        # Should still return valid output with fallback values
        assert result.run_id == "test-123"
        assert len(result.rollout_phases) >= 2  # Fallback phases
        assert len(result.staff_roles) >= 1

