from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Any
from app.model_runner import run_models, OPENROUTER_MODELS
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import asyncio

app = FastAPI(title="CompareAI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Frontend dev server
        "http://localhost:3000",  # Alternative frontend port
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CompareRequest(BaseModel):
    input_data: str
    models: list[str]


class CompareResponse(BaseModel):
    results: dict[str, str]
    metadata: dict[str, Any]


@app.get("/")
async def root():
    return {"message": "CompareAI API is running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/compare")
async def compare(req: CompareRequest) -> CompareResponse:
    if not req.input_data.strip():
        raise HTTPException(status_code=400, detail="Input data cannot be empty")

    if not req.models:
        raise HTTPException(status_code=400, detail="At least one model must be selected")

    try:
        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(None, run_models, req.input_data, req.models)

        # Add metadata
        metadata = {
            "input_length": len(req.input_data),
            "models_requested": len(req.models),
            "models_processed": len(results),
            "timestamp": datetime.now().isoformat(),
        }

        return CompareResponse(results=results, metadata=metadata)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing request: {str(e)}")


@app.get("/models")
async def get_available_models():
    return {"models": OPENROUTER_MODELS}
