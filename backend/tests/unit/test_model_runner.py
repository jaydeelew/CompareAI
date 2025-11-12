"""
Unit tests for model runner functionality.

Tests cover:
- Model calling (mock mode)
- Conversation history truncation
- Tier limits
- Error handling
- Concurrent model processing
"""
import pytest
from unittest.mock import patch, MagicMock
from app.model_runner import (
    call_openrouter,
    call_openrouter_streaming,
    truncate_conversation_history,
    run_models,
)


class TestModelRunnerMockMode:
    """Tests for model runner in mock mode."""
    
    def test_call_openrouter_mock_mode(self):
        """Test calling OpenRouter in mock mode."""
        result = call_openrouter(
            prompt="Test prompt",
            model_id="gpt-4",
            tier="standard",
            use_mock=True
        )
        assert isinstance(result, str)
        assert len(result) > 0
    
    def test_call_openrouter_streaming_mock_mode(self):
        """Test streaming OpenRouter in mock mode."""
        chunks = list(call_openrouter_streaming(
            prompt="Test prompt",
            model_id="gpt-4",
            tier="standard",
            use_mock=True
        ))
        assert len(chunks) > 0
        # All chunks should be strings
        assert all(isinstance(chunk, str) for chunk in chunks)
    
    def test_call_openrouter_different_tiers(self):
        """Test calling OpenRouter with different tiers."""
        standard_result = call_openrouter(
            prompt="Test",
            model_id="gpt-4",
            tier="standard",
            use_mock=True
        )
        extended_result = call_openrouter(
            prompt="Test",
            model_id="gpt-4",
            tier="extended",
            use_mock=True
        )
        
        # All should return strings
        assert isinstance(standard_result, str)
        assert isinstance(extended_result, str)


class TestConversationHistoryTruncation:
    """Tests for conversation history truncation."""
    
    def test_truncate_conversation_history_short(self):
        """Test truncation with short history."""
        history = [
            {"role": "user", "content": "Question 1"},
            {"role": "assistant", "content": "Answer 1"},
        ]
        
        truncated, was_truncated, original_count = truncate_conversation_history(
            history, max_messages=20
        )
        
        assert was_truncated is False
        assert original_count == 2
        assert len(truncated) == 2
    
    def test_truncate_conversation_history_long(self):
        """Test truncation with long history."""
        # Create history with more than 20 messages
        history = []
        for i in range(30):
            history.append({"role": "user", "content": f"Question {i}"})
            history.append({"role": "assistant", "content": f"Answer {i}"})
        
        truncated, was_truncated, original_count = truncate_conversation_history(
            history, max_messages=20
        )
        
        assert was_truncated is True
        assert original_count == 60  # 30 user + 30 assistant
        assert len(truncated) <= 20
    
    def test_truncate_conversation_history_empty(self):
        """Test truncation with empty history."""
        truncated, was_truncated, original_count = truncate_conversation_history(
            [], max_messages=20
        )
        
        assert was_truncated is False
        assert original_count == 0
        assert len(truncated) == 0
    
    def test_truncate_conversation_history_exact_limit(self):
        """Test truncation with exactly max messages."""
        history = []
        for i in range(20):
            history.append({"role": "user", "content": f"Question {i}"})
        
        truncated, was_truncated, original_count = truncate_conversation_history(
            history, max_messages=20
        )
        
        assert was_truncated is False
        assert original_count == 20
        assert len(truncated) == 20


class TestModelRunnerConcurrentProcessing:
    """Tests for concurrent processing of models."""
    
    @patch('app.model_runner.call_openrouter')
    def test_run_models_mock_mode(self, mock_call):
        """Test running multiple models concurrently."""
        # Mock the call_openrouter function
        mock_call.return_value = "Mock response"
        
        models = ["gpt-4", "claude-3-opus"]
        
        results = run_models(
            prompt="Test prompt",
            model_list=models,
            tier="standard"
        )
        
        assert isinstance(results, dict)
        assert len(results) == len(models)
        for model_id in models:
            assert model_id in results
    
    def test_run_models_empty(self):
        """Test running models with empty model list."""
        results = run_models(
            prompt="Test prompt",
            model_list=[],
            tier="standard"
        )
        
        assert isinstance(results, dict)
        assert len(results) == 0


class TestModelRunnerErrorHandling:
    """Tests for error handling in model runner."""
    
    @patch('app.model_runner.client')
    def test_call_openrouter_api_error(self, mock_client):
        """Test handling API errors."""
        # Mock API error
        mock_client.chat.completions.create.side_effect = Exception("API Error")
        
        result = call_openrouter(
            prompt="Test",
            model_id="gpt-4",
            tier="standard",
            use_mock=False
        )
        
        # Should return error message
        assert isinstance(result, str)
        assert "Error:" in result
    
    @patch('app.model_runner.client')
    def test_call_openrouter_timeout(self, mock_client):
        """Test handling timeout errors."""
        import asyncio
        mock_client.chat.completions.create.side_effect = asyncio.TimeoutError("Timeout")
        
        result = call_openrouter(
            prompt="Test",
            model_id="gpt-4",
            tier="standard",
            use_mock=False
        )
        
        # Should return error message
        assert isinstance(result, str)
        assert "Error:" in result
    
    @patch('app.model_runner.call_openrouter')
    def test_run_models_partial_failure(self, mock_call):
        """Test concurrent processing with partial failures."""
        # Mock call_openrouter to raise error for one model
        def side_effect(prompt, model_id, tier, conversation_history=None):
            if model_id == "invalid-model":
                raise Exception("Model not found")
            return "Success response"
        
        mock_call.side_effect = side_effect
        
        models = ["gpt-4", "invalid-model"]
        
        results = run_models(
            prompt="Test prompt",
            model_list=models,
            tier="standard"
        )
        
        # Should have results for all models (even if some are errors)
        assert len(results) == len(models)
        for model_id in models:
            assert model_id in results


class TestModelRunnerTierLimits:
    """Tests for tier-based limits."""
    
    def test_standard_tier_limits(self):
        """Test standard tier token limits."""
        result = call_openrouter(
            prompt="Test prompt",
            model_id="gpt-4",
            tier="standard",
            use_mock=True
        )
        assert isinstance(result, str)
    
    def test_extended_tier_limits(self):
        """Test extended tier token limits."""
        result = call_openrouter(
            prompt="Test prompt",
            model_id="gpt-4",
            tier="extended",
            use_mock=True
        )
        assert isinstance(result, str)
    
    def test_conversation_history_with_tiers(self):
        """Test conversation history handling with different tiers."""
        history = [
            {"role": "user", "content": "Question 1"},
            {"role": "assistant", "content": "Answer 1"},
        ]
        
        for tier in ["standard", "extended"]:
            result = call_openrouter(
                prompt="Follow-up question",
                model_id="gpt-4",
                tier=tier,
                conversation_history=history,
                use_mock=True
            )
            assert isinstance(result, str)

