from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from app.model_runner import run_models
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

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
    models: List[str]


class CompareResponse(BaseModel):
    results: Dict[str, str]
    metadata: Dict[str, Any]


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
        results = await run_models(req.input_data, req.models)
        
        # Add metadata
        metadata = {
            "input_length": len(req.input_data),
            "models_requested": len(req.models),
            "models_processed": len(results),
            "timestamp": datetime.now().isoformat()
        }
        
        return CompareResponse(results=results, metadata=metadata)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing request: {str(e)}")


@app.get("/models")
async def get_available_models():
    """Get list of available models"""
    models = [
        {"id": "gpt-4", "name": "GPT-4", "description": "OpenAI's most advanced language model", "category": "Language"},
        {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "description": "Fast and efficient language model", "category": "Language"},
        {"id": "claude-3", "name": "Claude 3", "description": "Anthropic's latest AI assistant", "category": "Language"},
        {"id": "bert-base", "name": "BERT Base", "description": "Google's bidirectional transformer", "category": "Language"},
        {"id": "t5-base", "name": "T5 Base", "description": "Text-to-Text Transfer Transformer", "category": "Language"},
    ]
    return {"models": models}
