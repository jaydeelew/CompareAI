"""
Dev API router for development-only endpoints.

This module contains endpoints that are only available in development mode,
such as renderer testing and AI fix generation.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime
import os
import json
import logging

from ..database import get_db
from ..dependencies import get_current_user
from ..models import User

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Dev"])

# Only allow in development mode
def check_dev_mode():
    """Check if we're in development mode"""
    if os.environ.get("ENVIRONMENT") != "development" and not os.environ.get("DEV_MODE"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is only available in development mode"
        )


# ============================================================================
# Request/Response Models
# ============================================================================

class GenerateRendererFixRequest(BaseModel):
    model_id: str
    raw_response: str
    rendered_html: str
    screenshot_base64: Optional[str] = None
    error_description: str
    current_config: Optional[Dict[str, Any]] = None


class RendererFixResponse(BaseModel):
    suggested_fix: Dict[str, Any]
    explanation: str
    confidence: float


class ApplyRendererFixRequest(BaseModel):
    stage_overrides: Optional[Dict[str, Any]] = None
    preprocessing: Optional[Dict[str, Any]] = None
    markdown_processing: Optional[Dict[str, Any]] = None
    katex_options: Optional[Dict[str, Any]] = None


# ============================================================================
# API Endpoints
# ============================================================================

@router.get("/dev/model-config/{model_id}")
async def get_model_config(
    model_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Get the current renderer configuration for a model.
    Dev mode only.
    """
    check_dev_mode()
    
    try:
        # Load model configs from JSON file
        config_path = os.path.join(
            os.path.dirname(__file__),
            "..",
            "..",
            "frontend",
            "src",
            "config",
            "model_renderer_configs.json"
        )
        
        if not os.path.exists(config_path):
            return JSONResponse(content={})
        
        with open(config_path, 'r', encoding='utf-8') as f:
            configs = json.load(f)
        
        # Find config for this model
        model_config = next(
            (cfg for cfg in configs if cfg.get("modelId") == model_id),
            None
        )
        
        return JSONResponse(content=model_config or {})
    except Exception as e:
        logger.error(f"Error loading model config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load model config: {str(e)}"
        )


@router.post("/dev/generate-renderer-fix", response_model=RendererFixResponse)
async def generate_renderer_fix(
    request: GenerateRendererFixRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Generate an AI-powered fix for rendering issues.
    Dev mode only.
    
    This endpoint uses AI to analyze rendering errors and suggest fixes
    to the model's renderer configuration.
    """
    check_dev_mode()
    
    try:
        # TODO: Integrate with AI service (OpenRouter, OpenAI, etc.)
        # For now, return a placeholder response
        
        # In a real implementation, this would:
        # 1. Analyze the error description and screenshot
        # 2. Compare raw response vs rendered HTML
        # 3. Identify which stage is causing the issue
        # 4. Generate a fix (stage override, preprocessing change, etc.)
        # 5. Return the suggested fix with explanation
        
        # Placeholder: Return a basic fix structure
        suggested_fix = {
            "preprocessing": {
                "removeMathML": True,
                "removeSVG": True,
            },
            "markdown_processing": {
                "processBoldItalic": True,
                "processHeaders": True,
            }
        }
        
        # If error description mentions specific issues, customize the fix
        error_lower = request.error_description.lower()
        if "math" in error_lower or "latex" in error_lower:
            suggested_fix["preprocessing"]["fixEscapedDollars"] = True
        
        if "markdown" in error_lower:
            suggested_fix["markdown_processing"]["processHeaders"] = True
            suggested_fix["markdown_processing"]["processLists"] = True
        
        return RendererFixResponse(
            suggested_fix=suggested_fix,
            explanation=f"Suggested fix based on error: {request.error_description}. This is a placeholder response - AI integration needed.",
            confidence=0.7
        )
    except Exception as e:
        logger.error(f"Error generating renderer fix: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate fix: {str(e)}"
        )


@router.post("/dev/apply-renderer-fix/{model_id}")
async def apply_renderer_fix(
    model_id: str,
    fix: ApplyRendererFixRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Apply a suggested fix to a model's renderer configuration.
    Dev mode only.
    
    This updates the model_renderer_configs.json file with the new configuration.
    """
    check_dev_mode()
    
    try:
        # Load existing configs
        config_path = os.path.join(
            os.path.dirname(__file__),
            "..",
            "..",
            "frontend",
            "src",
            "config",
            "model_renderer_configs.json"
        )
        
        if not os.path.exists(config_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Model config file not found"
            )
        
        with open(config_path, 'r', encoding='utf-8') as f:
            configs = json.load(f)
        
        # Find and update the model config
        model_config = next(
            (cfg for cfg in configs if cfg.get("modelId") == model_id),
            None
        )
        
        if not model_config:
            # Create new config if it doesn't exist
            model_config = {
                "modelId": model_id,
                "version": "1.0.0",
                "displayMathDelimiters": [],
                "inlineMathDelimiters": [],
                "codeBlockPreservation": {
                    "enabled": True,
                    "extractBeforeProcessing": True,
                    "restoreAfterProcessing": True
                }
            }
            configs.append(model_config)
        
        # Apply the fix
        if fix.preprocessing:
            model_config["preprocessing"] = {
                **model_config.get("preprocessing", {}),
                **fix.preprocessing
            }
        
        if fix.markdown_processing:
            model_config["markdownProcessing"] = {
                **model_config.get("markdownProcessing", {}),
                **fix.markdown_processing
            }
        
        if fix.katex_options:
            model_config["katexOptions"] = {
                **model_config.get("katexOptions", {}),
                **fix.katex_options
            }
        
        if fix.stage_overrides:
            # Stage overrides are more complex - they need to be functions
            # For now, we'll store them as metadata to be processed later
            if "metadata" not in model_config:
                model_config["metadata"] = {}
            model_config["metadata"]["stageOverrides"] = fix.stage_overrides
            model_config["metadata"]["updatedAt"] = datetime.now().isoformat()
        
        # Save updated configs
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(configs, f, indent=2, ensure_ascii=False)
        
        return JSONResponse(content={
            "success": True,
            "message": f"Fix applied to {model_id}",
            "config": model_config
        })
    except Exception as e:
        logger.error(f"Error applying renderer fix: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to apply fix: {str(e)}"
        )

