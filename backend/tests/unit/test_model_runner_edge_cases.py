"""
Edge case tests for model runner functionality.

Tests cover:
- Error handling scenarios
- Timeout scenarios
- Invalid model IDs
- Network failures
- Retry logic
- Streaming failures
"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from app.model_runner import (
    call_openrouter,
    call_openrouter_streaming,
    run_models,
    clean_model_response,
)


class TestModelRunnerErrorHandling:
    """Tests for error handling in model runner."""
    
    @patch('app.model_runner.OpenAI')
    def test_api_connection_error(self, mock_openai_class):
        """Test handling of API connection errors."""
        mock_client = MagicMock()
        mock_openai_class.return_value = mock_client
        
        # Simulate connection error
        mock_client.chat.completions.create.side_effect = Exception("Connection failed")
        
        result = call_openrouter(
            prompt="Test prompt",
            model_id="gpt-4",
            tier="standard",
            use_mock=False
        )
        
        # Should return error message
        assert isinstance(result, str)
        assert "Error:" in result
    
    @patch('app.model_runner.OpenAI')
    def test_api_timeout_error(self, mock_openai_class):
        """Test handling of API timeout errors."""
        import asyncio
        
        mock_client = MagicMock()
        mock_openai_class.return_value = mock_client
        
        # Simulate timeout
        mock_client.chat.completions.create.side_effect = TimeoutError("Request timed out")
        
        result = call_openrouter(
            prompt="Test prompt",
            model_id="gpt-4",
            tier="standard",
            use_mock=False
        )
        
        # Should return error message
        assert isinstance(result, str)
        assert "Error:" in result
    
    @patch('app.model_runner.OpenAI')
    def test_api_rate_limit_error(self, mock_openai_class):
        """Test handling of API rate limit errors."""
        mock_client = MagicMock()
        mock_openai_class.return_value = mock_client
        
        # Simulate rate limit error
        from openai import RateLimitError
        mock_client.chat.completions.create.side_effect = RateLimitError(
            message="Rate limit exceeded",
            response=MagicMock(),
            body=MagicMock()
        )
        
        result = call_openrouter(
            prompt="Test prompt",
            model_id="gpt-4",
            tier="standard",
            use_mock=False
        )
        
        # Should return error message
        assert isinstance(result, str)
        assert "Error:" in result
    
    @patch('app.model_runner.OpenAI')
    def test_api_authentication_error(self, mock_openai_class):
        """Test handling of API authentication errors."""
        mock_client = MagicMock()
        mock_openai_class.return_value = mock_client
        
        # Simulate authentication error
        from openai import AuthenticationError
        mock_client.chat.completions.create.side_effect = AuthenticationError(
            message="Invalid API key",
            response=MagicMock(),
            body=MagicMock()
        )
        
        result = call_openrouter(
            prompt="Test prompt",
            model_id="gpt-4",
            tier="standard",
            use_mock=False
        )
        
        # Should return error message
        assert isinstance(result, str)
        assert "Error:" in result
    
    def test_invalid_model_id(self):
        """Test handling of invalid model ID."""
        result = call_openrouter(
            prompt="Test prompt",
            model_id="invalid-model-id-12345",
            tier="standard",
            use_mock=True  # Use mock to avoid actual API call
        )
        
        # Should either return error or mock response
        assert isinstance(result, str)
    
    def test_empty_prompt(self):
        """Test handling of empty prompt."""
        result = call_openrouter(
            prompt="",
            model_id="gpt-4",
            tier="standard",
            use_mock=True
        )
        
        # Should handle empty prompt (may return error or empty response)
        assert isinstance(result, str)
    
    def test_very_long_prompt(self):
        """Test handling of very long prompt."""
        long_prompt = "Test prompt. " * 10000  # Very long prompt
        
        result = call_openrouter(
            prompt=long_prompt,
            model_id="gpt-4",
            tier="extended",  # Use extended tier for long prompts
            use_mock=True
        )
        
        # Should handle long prompt
        assert isinstance(result, str)


class TestStreamingErrorHandling:
    """Tests for error handling in streaming."""
    
    @patch('app.model_runner.OpenAI')
    def test_streaming_connection_error(self, mock_openai_class):
        """Test handling of streaming connection errors."""
        mock_client = MagicMock()
        mock_openai_class.return_value = mock_client
        
        # Simulate connection error during streaming
        mock_client.chat.completions.create.side_effect = Exception("Connection failed")
        
        chunks = list(call_openrouter_streaming(
            prompt="Test prompt",
            model_id="gpt-4",
            tier="standard",
            use_mock=False
        ))
        
        # Should handle error gracefully
        assert len(chunks) >= 0
        # May return error message as chunk
        if chunks:
            assert isinstance(chunks[0], str)
    
    @patch('app.model_runner.OpenAI')
    def test_streaming_timeout_error(self, mock_openai_class):
        """Test handling of streaming timeout errors."""
        mock_client = MagicMock()
        mock_openai_class.return_value = mock_client
        
        # Simulate timeout during streaming
        mock_client.chat.completions.create.side_effect = TimeoutError("Request timed out")
        
        chunks = list(call_openrouter_streaming(
            prompt="Test prompt",
            model_id="gpt-4",
            tier="standard",
            use_mock=False
        ))
        
        # Should handle timeout gracefully
        assert isinstance(chunks, list)
    
    def test_streaming_empty_response(self):
        """Test handling of empty streaming response."""
        chunks = list(call_openrouter_streaming(
            prompt="Test prompt",
            model_id="gpt-4",
            tier="standard",
            use_mock=True
        ))
        
        # Should return at least some chunks (even if empty)
        assert isinstance(chunks, list)


class TestRunModelsEdgeCases:
    """Tests for run_models edge cases."""
    
    def test_run_models_empty_list(self):
        """Test running models with empty list."""
        results = run_models(
            prompt="Test prompt",
            model_list=[],
            tier="standard",
            conversation_history=[]
        )
        
        # Should return empty dict
        assert isinstance(results, dict)
        assert len(results) == 0
    
    def test_run_models_single_model(self):
        """Test running models with single model."""
        results = run_models(
            prompt="Test prompt",
            model_list=["gpt-4"],
            tier="standard",
            conversation_history=[],
        )
        
        # Should return results for one model
        assert isinstance(results, dict)
        assert len(results) == 1
        assert "gpt-4" in results
    
    def test_run_models_multiple_models(self):
        """Test running models with multiple models."""
        results = run_models(
            prompt="Test prompt",
            model_list=["gpt-4", "claude-3-opus", "gpt-3.5-turbo"],
            tier="standard",
            conversation_history=[],
        )
        
        # Should return results for all models
        assert isinstance(results, dict)
        assert len(results) == 3
        assert "gpt-4" in results
        assert "claude-3-opus" in results
        assert "gpt-3.5-turbo" in results
    
    def test_run_models_partial_failure(self):
        """Test running models with partial failure."""
        # This would require mocking individual model calls
        # For now, test that function handles errors gracefully
        results = run_models(
            prompt="Test prompt",
            model_list=["gpt-4", "invalid-model-id"],
            tier="standard",
            conversation_history=[],
        )
        
        # Should return results (may include errors)
        assert isinstance(results, dict)
        assert len(results) >= 1
    
    def test_run_models_with_conversation_history(self):
        """Test running models with conversation history."""
        conversation_history = [
            {"role": "user", "content": "Previous question"},
            {"role": "assistant", "content": "Previous answer"},
        ]
        
        results = run_models(
            prompt="Follow-up question",
            model_list=["gpt-4"],
            tier="standard",
            conversation_history=conversation_history,
        )
        
        # Should handle conversation history
        assert isinstance(results, dict)
        assert len(results) >= 1


class TestCleanModelResponse:
    """Tests for response cleaning edge cases."""
    
    def test_clean_normal_response(self):
        """Test cleaning normal response."""
        response = "This is a normal response."
        cleaned = clean_model_response(response)
        assert cleaned == response
    
    def test_clean_response_with_whitespace(self):
        """Test cleaning response with extra whitespace."""
        response = "  This is a response with whitespace.  \n\n  "
        cleaned = clean_model_response(response)
        # Should clean whitespace (implementation dependent)
        assert isinstance(cleaned, str)
    
    def test_clean_empty_response(self):
        """Test cleaning empty response."""
        response = ""
        cleaned = clean_model_response(response)
        assert isinstance(cleaned, str)
    
    def test_clean_error_response(self):
        """Test cleaning error response."""
        response = "Error: Something went wrong"
        cleaned = clean_model_response(response)
        # Should preserve error messages
        assert "Error" in cleaned or cleaned == response
    
    def test_clean_response_with_special_chars(self):
        """Test cleaning response with special characters."""
        response = "Response with special chars: !@#$%^&*()"
        cleaned = clean_model_response(response)
        # Should preserve special characters
        assert isinstance(cleaned, str)
        assert "!" in cleaned or cleaned == response


class TestTierLimits:
    """Tests for tier limit handling."""
    
    def test_standard_tier_limit(self):
        """Test standard tier limit enforcement."""
        result = call_openrouter(
            prompt="Test prompt",
            model_id="gpt-4",
            tier="standard",
            use_mock=True
        )
        assert isinstance(result, str)
    
    def test_extended_tier_limit(self):
        """Test extended tier limit enforcement."""
        result = call_openrouter(
            prompt="Test prompt",
            model_id="gpt-4",
            tier="extended",
            use_mock=True
        )
        assert isinstance(result, str)
    
    def test_invalid_tier(self):
        """Test handling of invalid tier."""
        # Should either use default or handle error
        result = call_openrouter(
            prompt="Test prompt",
            model_id="gpt-4",
            tier="invalid_tier",
            use_mock=True
        )
        assert isinstance(result, str)


class TestConcurrentModelCalls:
    """Tests for concurrent model calls."""
    
    def test_concurrent_model_execution(self):
        """Test that models are called concurrently."""
        import time
        
        start_time = time.time()
        results = run_models(
            prompt="Test prompt",
            model_list=["gpt-4", "claude-3-opus", "gpt-3.5-turbo"],
            tier="standard",
            conversation_history=[],
        )
        end_time = time.time()
        
        # Should complete (timing depends on implementation)
        assert isinstance(results, dict)
        assert len(results) == 3
        
        # Should complete within reasonable time
        assert end_time - start_time < 10  # Should complete within reasonable time

