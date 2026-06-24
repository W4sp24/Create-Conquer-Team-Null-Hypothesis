from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ChromaDB clients and embedder init will be added here when feat/rag-layer merges
    yield


app = FastAPI(title="AIS — Adaptive Intervention Synthesizer", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


# Routers added here when feat/api-endpoints merges:
# from routes import run, input, sources, compare
# app.include_router(run.router)
# app.include_router(input.router)
# app.include_router(sources.router)
# app.include_router(compare.router)
