"""
Pytest tests for Section 09 Backend API endpoints.
Tests all routes: run, input, sources, compare
"""

import asyncio
import io
import json
from unittest.mock import Mock, patch, AsyncMock

import pytest
from fastapi.testclient import TestClient

from main import app
from models import (
    ContextPayload,
    ExcelRow,
    ChatMessage,
    CompareRequest,
    ProgramOutput,
    InterventionAdapterOutput,
    RiskMneOutput,
)


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def sample_context_payload():
    """Sample context payload for testing."""
    return ContextPayload(
        run_id="test-run-123",
        excel_data=[
            ExcelRow(data={"beneficiary_count": 5000, "crop_type": "rice"}),
            ExcelRow(data={"region": "coastal", "income_drop_pct": 45.0}),
        ],
        chat_messages=[
            ChatMessage(role="user", content="We have 5000 farmers"),
            ChatMessage(role="assistant", content="What is your budget?"),
        ],
    )


# ── Test /run endpoint ─────────────────────────────────────────────────────────


def test_post_run_returns_run_id(client, sample_context_payload):
    """Test POST /run returns a valid run_id."""
    response = client.post("/run", json=sample_context_payload.model_dump())
    
    assert response.status_code == 200
    data = response.json()
    assert "run_id" in data
    assert isinstance(data["run_id"], str)
    assert len(data["run_id"]) > 0


def test_post_run_starts_pipeline_async(client, sample_context_payload):
    """Test POST /run starts pipeline asynchronously."""
    with patch("routes.run.run_pipeline") as mock_pipeline:
        mock_pipeline.return_value = AsyncMock()
        
        response = client.post("/run", json=sample_context_payload.model_dump())
        
        assert response.status_code == 200
        # Pipeline should be triggered (we can't easily test async task creation)


def test_get_stream_invalid_run_id(client):
    """Test GET /stream/{run_id} with invalid run_id returns 404."""
    response = client.get("/stream/invalid-run-id")
    
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_get_result_invalid_run_id(client):
    """Test GET /result/{run_id} with invalid run_id returns 404."""
    response = client.get("/result/invalid-run-id")
    
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# ── Test /upload endpoint ──────────────────────────────────────────────────────


def test_post_upload_valid_excel(client):
    """Test POST /upload with valid Excel file."""
    # Create a simple Excel file in memory
    import pandas as pd
    
    df = pd.DataFrame({
        "Beneficiary Count": [5000],
        "Crop Type": ["rice"],
        "Region": ["coastal"],
    })
    
    excel_buffer = io.BytesIO()
    df.to_excel(excel_buffer, index=False)
    excel_buffer.seek(0)
    
    response = client.post(
        "/upload",
        files={"file": ("test.xlsx", excel_buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "rows" in data
    assert "row_count" in data
    assert data["row_count"] > 0
    assert isinstance(data["rows"], list)


def test_post_upload_invalid_file_type(client):
    """Test POST /upload with invalid file type returns 400."""
    response = client.post(
        "/upload",
        files={"file": ("test.txt", b"not an excel file", "text/plain")}
    )
    
    assert response.status_code == 400
    assert "invalid file type" in response.json()["detail"].lower()


def test_post_upload_no_file(client):
    """Test POST /upload without file returns 422."""
    response = client.post("/upload")
    
    assert response.status_code == 422


# ── Test /chat endpoint ────────────────────────────────────────────────────────


def test_post_chat_returns_reply_and_state(client):
    """POST /chat returns the assistant reply plus captured-context state."""
    fake = {
        "reply": "What crop is the focus?",
        "captured_fields": ["region"],
        "ready": False,
    }
    with patch("routes.input.run_chat_assistant", new=AsyncMock(return_value=fake)):
        response = client.post(
            "/chat",
            json={"chat_messages": [{"role": "user", "content": "We farm in coastal Cebu"}]},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["reply"] == "What crop is the focus?"
    assert data["captured_fields"] == ["region"]
    assert data["ready"] is False
    # region captured → crop + beneficiaries still required
    assert set(data["missing_required"]) == {"crop", "beneficiaries"}


def test_post_chat_ready_when_required_captured(client):
    """When all required fields are captured, ready is true and nothing is missing."""
    fake = {
        "reply": "I have the essentials — generate when ready.",
        "captured_fields": ["region", "crop", "beneficiaries"],
        "ready": True,
    }
    with patch("routes.input.run_chat_assistant", new=AsyncMock(return_value=fake)):
        response = client.post(
            "/chat",
            json={
                "chat_messages": [{"role": "user", "content": "Cebu rice, 5000 farmers"}],
                "excel_preview": {
                    "filename": "f.xlsx",
                    "rows": 5000,
                    "cols": 3,
                    "headers": ["farmer", "crop"],
                },
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert data["ready"] is True
    assert data["missing_required"] == []


def test_post_chat_requires_chat_messages(client):
    """The new contract requires chat_messages; the old {message} shape is rejected."""
    response = client.post("/chat", json={"message": "hi"})
    assert response.status_code == 422


# ── Test /sources endpoints ────────────────────────────────────────────────────


def test_post_sources_upload_valid_pdf(client):
    """Test POST /sources/upload with valid PDF file (ingestor mocked)."""
    with patch("routes.sources.ingest_file", return_value=3):
        pdf_content = b"%PDF-1.4 fake pdf content"

        response = client.post(
            "/sources/upload",
            files={"file": ("test.pdf", pdf_content, "application/pdf")}
        )

    assert response.status_code == 200
    data = response.json()
    assert "filename" in data
    assert data["filename"] == "test.pdf"
    assert "status" in data


def test_post_sources_upload_invalid_file_type(client):
    """Test POST /sources/upload with invalid file type returns 400."""
    response = client.post(
        "/sources/upload",
        files={"file": ("test.exe", b"executable", "application/x-msdownload")}
    )
    
    assert response.status_code == 400
    assert "unsupported" in response.json()["detail"].lower()


def test_get_sources_returns_list(client):
    """Test GET /sources returns list of sources."""
    response = client.get("/sources")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_get_specialized_sources_returns_list(client):
    """GET /sources/specialized returns the curated KB metadata (empty until ingested)."""
    response = client.get("/sources/specialized")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    for item in data:
        assert item["source_type"] == "specialized"


def test_delete_sources_invalid_filename(client):
    """Test DELETE /sources/{filename} with non-existent file returns 404."""
    response = client.delete("/sources/nonexistent.pdf")
    
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# ── Test /compare endpoint ─────────────────────────────────────────────────────


def test_post_compare_two_profiles(client, sample_context_payload):
    """Test POST /compare with two context profiles."""
    profile_b = sample_context_payload.model_copy()
    profile_b.chat_messages.append(
        ChatMessage(role="user", content="Different context")
    )
    
    compare_request = CompareRequest(
        profile_a=sample_context_payload,
        profile_b=profile_b,
    )
    
    with patch("routes.compare.run_pipeline") as mock_pipeline:
        # Mock successful pipeline execution
        mock_result = ProgramOutput(
            run_id="test-123",
            title="Test Program",
            target_beneficiaries="5000 farmers",
            intervention=InterventionAdapterOutput(
                intervention_name="SRI",
                description="Test intervention",
                adaptations=["adaptation1"],
                implementation_steps=["step1"],
            ),
            rollout_phases=[],
            staff_roles=["Field officer"],
            per_beneficiary_cost_usd=None,
            total_budget_estimate=None,
            kpis=[],
            risk_assessment=RiskMneOutput(
                risk_level="medium",
                risk_flags=["flag1"],
                mitigations=["mitigation1"],
                kpis=[],
                confidence_score=0.75,
            ),
            adaptations_made=["adaptation1"],
            citations=["citation1"],
            confidence_level=0.75,
        )
        mock_pipeline.return_value = mock_result
        
        response = client.post("/compare", json=compare_request.model_dump())
        
        assert response.status_code == 200
        data = response.json()
        assert "profile_a" in data
        assert "profile_b" in data


# ── Test Excel Parser ──────────────────────────────────────────────────────────


def test_excel_parser_valid_file():
    """Test excel_parser.parse_excel with valid Excel content."""
    import pandas as pd
    from parsers.excel_parser import parse_excel
    
    df = pd.DataFrame({
        "Column1": [1, 2, 3],
        "Column2": ["A", "B", "C"],
    })
    
    excel_buffer = io.BytesIO()
    df.to_excel(excel_buffer, index=False)
    excel_content = excel_buffer.getvalue()
    
    rows = parse_excel(excel_content)
    
    assert len(rows) == 3
    assert all(isinstance(row, ExcelRow) for row in rows)
    assert "Column1" in rows[0].data
    assert "Column2" in rows[0].data


def test_excel_parser_invalid_content():
    """Test excel_parser.parse_excel with invalid content raises ValueError."""
    from parsers.excel_parser import parse_excel
    
    with pytest.raises(ValueError):
        parse_excel(b"not an excel file")


# ── Integration Tests ──────────────────────────────────────────────────────────


def test_full_workflow_upload_chat_run(client):
    """Test complete workflow: upload Excel, chat, then run pipeline."""
    import pandas as pd
    
    # Step 1: Upload Excel
    df = pd.DataFrame({
        "Beneficiary Count": [5000],
        "Crop Type": ["rice"],
    })
    excel_buffer = io.BytesIO()
    df.to_excel(excel_buffer, index=False)
    excel_buffer.seek(0)
    
    upload_response = client.post(
        "/upload",
        files={"file": ("test.xlsx", excel_buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    )
    assert upload_response.status_code == 200
    excel_data = upload_response.json()["rows"]
    
    # Step 2: Chat (LLM assistant mocked)
    fake = {
        "reply": "Got it — budget noted.",
        "captured_fields": ["region", "crop", "beneficiaries", "budget"],
        "ready": True,
    }
    with patch("routes.input.run_chat_assistant", new=AsyncMock(return_value=fake)):
        chat_response = client.post(
            "/chat",
            json={"chat_messages": [{"role": "user", "content": "Our budget is $50,000"}]},
        )
    assert chat_response.status_code == 200
    
    # Step 3: Run pipeline
    context = ContextPayload(
        run_id="test-workflow",
        excel_data=[ExcelRow(**row) for row in excel_data],
        chat_messages=[
            ChatMessage(role="user", content="Our budget is $50,000")
        ],
    )
    
    run_response = client.post("/run", json=context.model_dump())
    assert run_response.status_code == 200
    assert "run_id" in run_response.json()


def test_health_endpoint(client):
    """Test /health endpoint returns ok status."""
    response = client.get("/health")
    
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

# Made with Bob
