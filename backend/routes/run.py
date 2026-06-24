from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from typing import Dict, Any
import asyncio
import json
from datetime import datetime
import uuid
from models import RunRequest, RunResponse, PipelineStatus, AgentStatus, ProgramOutput

router = APIRouter()

# In-memory storage for pipeline runs
pipeline_runs: Dict[str, Dict[str, Any]] = {}


@router.post("/run", response_model=RunResponse)
async def start_pipeline(request: RunRequest):
    """
    Start pipeline → returns run_id, fires agents async
    
    Initiates the two-phase pipeline execution. Returns immediately with run_id.
    Agents run asynchronously in the background.
    """
    run_id = str(uuid.uuid4())
    
    # Initialize pipeline run
    pipeline_runs[run_id] = {
        'run_id': run_id,
        'status': 'running',
        'phase': 1,
        'context': request.context.dict(),
        'excel_data': request.excel_data,
        'started_at': datetime.utcnow(),
        'completed_at': None,
        'agents': {
            'evidence_retriever': {'status': 'pending', 'result': None},
            'context_profiler': {'status': 'pending', 'result': None},
            'data_analyst': {'status': 'pending', 'result': None},
            'intervention_adapter': {'status': 'pending', 'result': None},
            'budget_planner': {'status': 'pending', 'result': None},
            'risk_mne_agent': {'status': 'pending', 'result': None},
            'synthesizer': {'status': 'pending', 'result': None}
        },
        'result': None
    }
    
    # Start pipeline execution in background
    asyncio.create_task(execute_pipeline(run_id, request))
    
    return RunResponse(
        run_id=run_id,
        message="Pipeline started successfully",
        status="running"
    )


async def execute_pipeline(run_id: str, request: RunRequest):
    """
    Execute the two-phase pipeline
    
    Phase 1: Evidence Retriever (~100ms, no LLM)
    Phase 2: 5 agents in parallel (all receive retrieved_docs)
    Synthesis: Combine all outputs
    """
    run = pipeline_runs[run_id]
    
    try:
        # PHASE 1 - Evidence Retrieval
        run['phase'] = 1
        run['agents']['evidence_retriever']['status'] = 'running'
        
        # Simulate evidence retrieval
        await asyncio.sleep(0.1)  # ~100ms
        retrieved_docs = {
            'specialized': ['doc1', 'doc2', 'doc3'],
            'org_uploads': ['upload1', 'upload2']
        }
        
        run['agents']['evidence_retriever']['status'] = 'completed'
        run['agents']['evidence_retriever']['result'] = retrieved_docs
        
        # PHASE 2 - Analysis Layer (5 agents in parallel)
        run['phase'] = 2
        
        # Start all 5 agents concurrently
        agent_tasks = [
            run_context_profiler(run_id, request.context, retrieved_docs),
            run_data_analyst(run_id, request.context, request.excel_data, retrieved_docs),
            run_intervention_adapter(run_id, request.context, retrieved_docs),
            run_budget_planner(run_id, request.context, retrieved_docs),
            run_risk_mne_agent(run_id, request.context, retrieved_docs)
        ]
        
        # Wait for all agents to complete
        results = await asyncio.gather(*agent_tasks, return_exceptions=True)
        
        # Check for failures
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                agent_names = ['context_profiler', 'data_analyst', 'intervention_adapter', 
                              'budget_planner', 'risk_mne_agent']
                run['agents'][agent_names[i]]['status'] = 'failed'
                run['agents'][agent_names[i]]['error'] = str(result)
        
        # SYNTHESIS - Combine all outputs
        run['agents']['synthesizer']['status'] = 'running'
        await asyncio.sleep(1.0)  # Simulate synthesis
        
        # Create final program output
        final_output = {
            'intervention': run['agents']['intervention_adapter']['result'] or {},
            'adaptations_mode': run['agents']['context_profiler']['result'] or {},
            'rollout': {'phases': [], 'timeline': []},
            'budget': run['agents']['budget_planner']['result'] or {},
            'kpis': run['agents']['risk_mne_agent']['result'].get('kpis', {}) if run['agents']['risk_mne_agent']['result'] else {},
            'risk': run['agents']['risk_mne_agent']['result'].get('risk', {}) if run['agents']['risk_mne_agent']['result'] else {},
            'citations': []
        }
        
        run['agents']['synthesizer']['status'] = 'completed'
        run['agents']['synthesizer']['result'] = final_output
        
        # Mark pipeline as completed
        run['status'] = 'completed'
        run['completed_at'] = datetime.utcnow()
        run['result'] = final_output
        
    except Exception as e:
        run['status'] = 'failed'
        run['error'] = str(e)
        run['completed_at'] = datetime.utcnow()


async def run_context_profiler(run_id: str, context: Any, retrieved_docs: Dict):
    """Context Profiler agent - qualitative extraction"""
    run = pipeline_runs[run_id]
    run['agents']['context_profiler']['status'] = 'running'
    
    await asyncio.sleep(2.0)  # Simulate LLM call
    
    result = {
        'infrastructure_gaps': [],
        'cultural_barriers': [],
        'governance_structures': [],
        'seasonal_constraints': []
    }
    
    run['agents']['context_profiler']['status'] = 'completed'
    run['agents']['context_profiler']['result'] = result
    return result


async def run_data_analyst(run_id: str, context: Any, excel_data: Any, retrieved_docs: Dict):
    """Data Analyst agent - quantitative metrics"""
    run = pipeline_runs[run_id]
    run['agents']['data_analyst']['status'] = 'running'
    
    await asyncio.sleep(2.0)  # Simulate LLM call
    
    result = {
        'beneficiary_count': 5000,
        'yield_figures': {},
        'income_metrics': {},
        'plot_size': {},
        'staff_count': 10,
        'crop_type': context.crop_type if hasattr(context, 'crop_type') else None
    }
    
    run['agents']['data_analyst']['status'] = 'completed'
    run['agents']['data_analyst']['result'] = result
    return result


async def run_intervention_adapter(run_id: str, context: Any, retrieved_docs: Dict):
    """Intervention Adapter agent - design intervention"""
    run = pipeline_runs[run_id]
    run['agents']['intervention_adapter']['status'] = 'running'
    
    await asyncio.sleep(3.0)  # Simulate LLM call
    
    result = {
        'what_to_do': 'Implement improved seed distribution program',
        'how_to_adapt': 'Adapt to local constraints and context',
        'activities': [],
        'timeline': []
    }
    
    run['agents']['intervention_adapter']['status'] = 'completed'
    run['agents']['intervention_adapter']['result'] = result
    return result


async def run_budget_planner(run_id: str, context: Any, retrieved_docs: Dict):
    """Budget & Resource Planner agent"""
    run = pipeline_runs[run_id]
    run['agents']['budget_planner']['status'] = 'running'
    
    await asyncio.sleep(2.5)  # Simulate LLM call
    
    result = {
        'rollout_phases': [],
        'staff_assignments': [],
        'per_beneficiary_cost': 0,
        'timeline': [],
        'cost_breakdown': {}
    }
    
    run['agents']['budget_planner']['status'] = 'completed'
    run['agents']['budget_planner']['result'] = result
    return result


async def run_risk_mne_agent(run_id: str, context: Any, retrieved_docs: Dict):
    """Risk & M&E Agent - risk assessment + KPI design"""
    run = pipeline_runs[run_id]
    run['agents']['risk_mne_agent']['status'] = 'running'
    
    await asyncio.sleep(2.5)  # Simulate LLM call
    
    result = {
        'risk': {
            'level': 'medium',
            'flags': [],
            'mitigations': []
        },
        'kpis': [],
        'measurement_plan': [],
        'confidence_score': 0.85
    }
    
    run['agents']['risk_mne_agent']['status'] = 'completed'
    run['agents']['risk_mne_agent']['result'] = result
    return result


@router.get("/stream/{run_id}")
async def stream_agent_status(run_id: str):
    """
    SSE endpoint → streams agent status to React
    
    Server-Sent Events endpoint that streams real-time agent status updates
    to the frontend. Shows pending → running → done for each agent.
    """
    if run_id not in pipeline_runs:
        raise HTTPException(status_code=404, detail="Run not found")
    
    async def event_generator():
        """Generate SSE events for agent status updates"""
        last_status = None
        
        while True:
            run = pipeline_runs.get(run_id)
            if not run:
                break
            
            # Create current status snapshot
            current_status = {
                'run_id': run_id,
                'status': run['status'],
                'phase': run['phase'],
                'agents': []
            }
            
            for agent_name, agent_data in run['agents'].items():
                current_status['agents'].append({
                    'name': agent_name,
                    'status': agent_data['status']
                })
            
            # Only send if status changed
            if current_status != last_status:
                yield f"data: {json.dumps(current_status)}\n\n"
                last_status = current_status
            
            # Stop streaming if pipeline completed or failed
            if run['status'] in ['completed', 'failed']:
                break
            
            await asyncio.sleep(0.5)  # Poll every 500ms
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.get("/result/{run_id}", response_model=ProgramOutput)
async def get_result(run_id: str):
    """
    Retrieve completed program JSON
    
    Returns the final synthesized program output after pipeline completion.
    """
    if run_id not in pipeline_runs:
        raise HTTPException(status_code=404, detail="Run not found")
    
    run = pipeline_runs[run_id]
    
    if run['status'] != 'completed':
        raise HTTPException(status_code=400, detail=f"Pipeline not completed. Current status: {run['status']}")
    
    if not run['result']:
        raise HTTPException(status_code=500, detail="No result available")
    
    return ProgramOutput(
        run_id=run_id,
        **run['result']
    )


@router.get("/status/{run_id}")
async def get_pipeline_status(run_id: str):
    """Get current pipeline status"""
    if run_id not in pipeline_runs:
        raise HTTPException(status_code=404, detail="Run not found")
    
    run = pipeline_runs[run_id]
    
    agents = []
    for agent_name, agent_data in run['agents'].items():
        agents.append(AgentStatus(
            agent_name=agent_name,
            status=agent_data['status'],
            result=agent_data.get('result'),
            error=agent_data.get('error')
        ))
    
    return PipelineStatus(
        run_id=run_id,
        status=run['status'],
        phase=run['phase'],
        agents=agents,
        started_at=run['started_at'],
        completed_at=run.get('completed_at')
    )

# Made with Bob
