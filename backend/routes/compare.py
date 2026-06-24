from fastapi import APIRouter, HTTPException
from models import CompareRequest, CompareResponse, ProgramOutput
from typing import Dict, Any

router = APIRouter()


@router.post("/compare", response_model=CompareResponse)
async def compare_programs(request: CompareRequest):
    """
    Run two context profiles → side-by-side programs
    
    Executes the pipeline twice with different context profiles and returns
    both programs side-by-side for comparison. This is the demo's core differentiator -
    showing how the same need + different context = different solution.
    """
    try:
        # In production, this would:
        # 1. Run pipeline with context1
        # 2. Run pipeline with context2
        # 3. Compare the outputs
        # 4. Highlight differences
        
        # For now, return mock comparison data
        
        # Simulate program 1
        program1 = ProgramOutput(
            run_id="compare_run_1",
            intervention={
                "title": "Improved Seed Distribution - Context 1",
                "description": "Adapted for high-resource setting",
                "activities": [
                    "Direct seed distribution",
                    "Training workshops",
                    "Follow-up monitoring"
                ]
            },
            adaptations_mode={
                "infrastructure": "Good road access enables direct distribution",
                "cultural": "Community meetings preferred",
                "governance": "Strong local leadership"
            },
            rollout={
                "phases": [
                    {"phase": 1, "duration": "2 months", "activities": ["Setup"]},
                    {"phase": 2, "duration": "4 months", "activities": ["Distribution"]},
                    {"phase": 3, "duration": "2 months", "activities": ["Monitoring"]}
                ],
                "timeline": "8 months total"
            },
            budget={
                "total": request.context1.budget or 100000,
                "per_beneficiary": 20,
                "breakdown": {
                    "seeds": 40000,
                    "training": 30000,
                    "monitoring": 20000,
                    "admin": 10000
                }
            },
            kpis={
                "primary": [
                    {"name": "Beneficiaries reached", "target": 5000},
                    {"name": "Yield increase", "target": "25%"}
                ],
                "secondary": [
                    {"name": "Training completion", "target": "90%"}
                ]
            },
            risk={
                "level": "low",
                "factors": [
                    {"risk": "Weather dependency", "mitigation": "Flexible timeline"},
                    {"risk": "Seed quality", "mitigation": "Certified suppliers"}
                ]
            },
            citations=[
                {"source": "FAO Guidelines 2023", "type": "specialized"},
                {"source": "Local survey data", "type": "org_upload"}
            ]
        )
        
        # Simulate program 2 with different adaptations
        program2 = ProgramOutput(
            run_id="compare_run_2",
            intervention={
                "title": "Improved Seed Distribution - Context 2",
                "description": "Adapted for low-resource setting",
                "activities": [
                    "Hub-based distribution",
                    "Peer-to-peer training",
                    "Mobile monitoring"
                ]
            },
            adaptations_mode={
                "infrastructure": "Limited road access requires hub model",
                "cultural": "Individual consultations preferred",
                "governance": "Decentralized decision-making"
            },
            rollout={
                "phases": [
                    {"phase": 1, "duration": "3 months", "activities": ["Hub setup"]},
                    {"phase": 2, "duration": "6 months", "activities": ["Distribution"]},
                    {"phase": 3, "duration": "3 months", "activities": ["Monitoring"]}
                ],
                "timeline": "12 months total"
            },
            budget={
                "total": request.context2.budget or 100000,
                "per_beneficiary": 20,
                "breakdown": {
                    "seeds": 35000,
                    "hubs": 25000,
                    "training": 25000,
                    "monitoring": 15000
                }
            },
            kpis={
                "primary": [
                    {"name": "Beneficiaries reached", "target": 5000},
                    {"name": "Yield increase", "target": "20%"}
                ],
                "secondary": [
                    {"name": "Hub utilization", "target": "80%"}
                ]
            },
            risk={
                "level": "medium",
                "factors": [
                    {"risk": "Access challenges", "mitigation": "Hub network"},
                    {"risk": "Communication gaps", "mitigation": "Peer trainers"}
                ]
            },
            citations=[
                {"source": "FAO Guidelines 2023", "type": "specialized"},
                {"source": "Regional assessment", "type": "org_upload"}
            ]
        )
        
        # Identify key differences
        differences = {
            "intervention_approach": {
                "context1": "Direct distribution",
                "context2": "Hub-based distribution",
                "reason": "Infrastructure constraints"
            },
            "timeline": {
                "context1": "8 months",
                "context2": "12 months",
                "reason": "Access challenges require longer rollout"
            },
            "training_method": {
                "context1": "Workshops",
                "context2": "Peer-to-peer",
                "reason": "Cultural preferences differ"
            },
            "risk_level": {
                "context1": "Low",
                "context2": "Medium",
                "reason": "Infrastructure and access challenges"
            },
            "budget_allocation": {
                "context1": "Higher training investment",
                "context2": "Higher hub infrastructure investment",
                "reason": "Different delivery models"
            }
        }
        
        return CompareResponse(
            program1=program1,
            program2=program2,
            differences=differences
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error comparing programs: {str(e)}")


@router.get("/compare/example")
async def get_comparison_example():
    """
    Get an example comparison to demonstrate the feature
    
    Returns a pre-built comparison showing how different contexts
    lead to different program designs.
    """
    return {
        "title": "Coastal vs Mountain Rice Farming",
        "description": "Same need (improve rice yield), different contexts",
        "context1": {
            "name": "Coastal Region",
            "characteristics": [
                "Flat terrain",
                "Good road access",
                "High population density",
                "Irrigation available"
            ]
        },
        "context2": {
            "name": "Mountain Region",
            "characteristics": [
                "Steep terrain",
                "Limited road access",
                "Low population density",
                "Rain-fed agriculture"
            ]
        },
        "key_differences": [
            "Distribution method (direct vs hub-based)",
            "Timeline (8 months vs 12 months)",
            "Training approach (workshops vs peer-to-peer)",
            "Risk level (low vs medium)"
        ]
    }

# Made with Bob
