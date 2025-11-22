"""
Model runner for OpenRouter API integration.

This module handles communication with OpenRouter API to access 50+ AI models
from various providers. It provides both synchronous and streaming interfaces
for model comparisons, with support for conversation history, tier-based limits,
and error handling.

Key Features:
- Concurrent model execution for fast comparisons
- Server-Sent Events (SSE) streaming support
- Token counting and tier limit enforcement
- Mock mode for testing (admin feature)
- Connection quality tracking
"""

import os
from openai import OpenAI
from dotenv import load_dotenv
import concurrent.futures
from typing import Dict, List, Any, Optional, Generator, Tuple
import time
import re
import tiktoken
from .mock_responses import stream_mock_response, get_mock_response
from .types import ConnectionQualityDict

# Import configuration
from .config import settings, TIER_LIMITS, get_tier_max_tokens

OPENROUTER_API_KEY = settings.openrouter_api_key

# List of available models organized by providers
MODELS_BY_PROVIDER = {
    "Anthropic": [
        {
            "id": "anthropic/claude-sonnet-4.5",
            "name": "Claude Sonnet 4.5",
            "description": 'Claude Sonnet 4.5 is Anthropic’s most advanced Sonnet model to date, optimized for real-world agents and coding workflows.',
            "category": "Language",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-haiku-4.5",
            "name": "Claude Haiku 4.5",
            "description": 'Claude Haiku 4.5 is Anthropic’s fastest and most efficient model, delivering near-frontier intelligence at a fraction of the cost and latency of larger Claude models.',
            "category": "Language",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-opus-4.1",
            "name": "Claude Opus 4.1",
            "description": 'Claude Opus 4.1 is an updated version of Anthropic’s flagship model, offering improved performance in coding, reasoning, and agentic tasks.',
            "category": "Language/Code",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-sonnet-4",
            "name": "Claude 4 Sonnet",
            "description": 'Claude Sonnet 4 significantly enhances the capabilities of its predecessor, Sonnet 3.7, excelling in both coding and reasoning tasks with improved precision and controllability.',
            "category": "Language",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-3.7-sonnet",
            "name": "Claude 3.7 Sonnet",
            "description": 'Claude 3.7 Sonnet is an advanced large language model with improved reasoning, coding, and problem-solving capabilities.',
            "category": "Language/Reasoning",
            "provider": "Anthropic",
        },
    ],
    "Cohere": [
        {
            "id": "cohere/command-r-plus-08-2024",
            "name": "Command R+",
            "description": 'command-r-plus-08-2024 is an update of the [Command R+](/models/cohere/command-r-plus) with roughly 50% higher throughput and 25% lower latencies as compared to the previous Command R+ version, while keeping the hardware footprint the same.',
            "category": "Language/Reasoning",
            "provider": "Cohere",
        },
        {
            "id": "cohere/command-r7b-12-2024",
            "name": "Command R7B",
            "description": 'Command R7B (12-2024) is a small, fast update of the Command R+ model, delivered in December 2024.',
            "category": "Language",
            "provider": "Cohere",
        },
        {
            "id": "cohere/command-a",
            "name": "Command A",
            "description": 'Command A is an open-weights 111B parameter model with a 256k context window focused on delivering great performance across agentic, multilingual, and coding use cases.',
            "category": "Language",
            "provider": "Cohere",
        },
    ],
    "DeepSeek": [
        {
            "id": "deepseek/deepseek-r1",
            "name": "DeepSeek R1",
            "description": 'DeepSeek R1 is here: Performance on par with [OpenAI o1](/openai/o1), but open-sourced and with fully open reasoning tokens.',
            "category": "Reasoning",
            "provider": "DeepSeek",
        },
        {
            "id": "deepseek/deepseek-v3.2-exp",
            "name": "DeepSeek V3.2 Exp",
            "description": 'DeepSeek-V3.2-Exp is an experimental large language model released by DeepSeek as an intermediate step between V3.1 and future architectures.',
            "category": "Language/Reasoning",
            "provider": "DeepSeek",
        },
        {
            "id": "deepseek/deepseek-chat-v3.1",
            "name": "DeepSeek Chat V3.1",
            "description": 'DeepSeek-V3.1 is a large hybrid reasoning model (671B parameters, 37B active) that supports both thinking and non-thinking modes via prompt templates.',
            "category": "Language/Reasoning",
            "provider": "DeepSeek",
        },
    ],
    "Google": [
        {
            "id": "google/gemini-2.5-pro",
            "name": "Gemini 2.5 Pro",
            "description": 'Gemini 2.5 Pro is Google’s state-of-the-art AI model designed for advanced reasoning, coding, mathematics, and scientific tasks.',
            "category": "Language",
            "provider": "Google",
        },
        {
            "id": "google/gemini-2.5-flash",
            "name": "Gemini 2.5 Flash",
            "description": "Gemini 2.5 Flash is Google's state-of-the-art workhorse model, specifically designed for advanced reasoning, coding, mathematics, and scientific tasks.",
            "category": "Language",
            "provider": "Google",
        },
    
        {
            "id": "google/gemini-3-pro-preview",
            "name": "Gemini 3 Pro Preview",
            "description": 'Gemini 3 Pro is Google’s flagship frontier model for high-precision multimodal reasoning, combining strong performance across text, image, video, audio, and code with a 1M-token context window.',
            "category": "Language",
            "provider": "Google",
        },],
    "Meta": [
        {
            "id": "meta-llama/llama-4-maverick",
            "name": "Llama 4 Maverick",
            "description": 'Llama 4 Maverick 17B Instruct (128E) is a high-capacity multimodal language model from Meta, built on a mixture-of-experts (MoE) architecture with 128 experts and 17 billion active parameters per forward pass (400B total).',
            "category": "Multimodal",
            "provider": "Meta",
        },        {
            "id": "meta-llama/llama-4-scout",
            "name": "Llama 4 Scout",
            "description": 'Llama 4 Scout 17B Instruct (16E) is a mixture-of-experts (MoE) language model developed by Meta, activating 17 billion parameters out of a total of 109B.',
            "category": "Multimodal",
            "provider": "Meta",
        },        {
            "id": "meta-llama/llama-3.3-70b-instruct",
            "name": "Llama 3.3 70B Instruct",
            "description": 'The Meta Llama 3.3 multilingual large language model (LLM) is a pretrained and instruction tuned generative model in 70B (text in/text out).',
            "category": "Code/Language",
            "provider": "Meta",
        },
        {
            "id": "meta-llama/llama-3.3-70b-instruct:free",
            "name": "Llama 3.3 70B Instruct (Free)",
            "description": 'The Meta Llama 3.3 multilingual large language model (LLM) is a pretrained and instruction tuned generative model in 70B (text in/text out).',
            "category": "Code/Language",
            "provider": "Meta",
        },
    ],
    "Microsoft": [
        {
            "id": "microsoft/wizardlm-2-8x22b",
            "name": "WizardLM-2 8x22B",
            "description": "WizardLM-2 8x22B is Microsoft AI's most advanced Wizard model.",
            "category": "Language/Reasoning",
            "provider": "Microsoft",
        },
        {
            "id": "microsoft/phi-4-reasoning-plus",
            "name": "Phi 4 Reasoning Plus",
            "description": 'Phi-4-reasoning-plus is an enhanced 14B parameter model from Microsoft, fine-tuned from Phi-4 with additional reinforcement learning to boost accuracy on math, science, and code reasoning tasks.',
            "category": "Reasoning",
            "provider": "Microsoft",
        },
        {
            "id": "microsoft/phi-4",
            "name": "Phi 4",
            "description": '[Microsoft Research](/microsoft) Phi-4 is designed to perform well in complex reasoning tasks and can operate efficiently in situations with limited memory or where quick responses are needed.',
            "category": "Language/Reasoning",
            "provider": "Microsoft",
        },
        {
            "id": "microsoft/mai-ds-r1:free",
            "name": "MAI-DS-R1 (Free)",
            "description": 'MAI-DS-R1 is a post-trained variant of DeepSeek-R1 developed by the Microsoft AI team to improve the model’s responsiveness on previously blocked topics while enhancing its safety profile.',
            "category": "Reasoning",
            "provider": "Microsoft",
        },
    ],
    "Mistral": [
        {
            "id": "mistralai/mistral-large",
            "name": "Mistral Large",
            "description": "This is Mistral AI's flagship model, Mistral Large 2 (version `mistral-large-2407`).",
            "category": "Language/Reasoning",
            "provider": "Mistral",
        },
        {
            "id": "mistralai/mistral-medium-3.1",
            "name": "Mistral Medium 3.1",
            "description": 'Mistral Medium 3.1 is an updated version of Mistral Medium 3, which is a high-performance enterprise-grade language model designed to deliver frontier-level capabilities at significantly reduced operational cost.',
            "category": "Language",
            "provider": "Mistral",
        },
        {
            "id": "mistralai/mistral-small-3.2-24b-instruct",
            "name": "Mistral Small 3.2 24B",
            "description": 'Mistral-Small-3.2-24B-Instruct-2506 is an updated 24B parameter model from Mistral optimized for instruction following, repetition reduction, and improved function calling.',
            "category": "Multimodal",
            "provider": "Mistral",
        },
        {
            "id": "mistralai/devstral-medium",
            "name": "Devstral Medium",
            "description": 'Devstral Medium is a high-performance code generation and agentic reasoning model developed jointly by Mistral AI and All Hands AI.',
            "category": "Code",
            "provider": "Mistral",
        },
        {
            "id": "mistralai/devstral-small",
            "name": "Devstral Small",
            "description": 'Devstral Small 1.1 is a 24B parameter open-weight language model for software engineering agents, developed by Mistral AI in collaboration with All Hands AI.',
            "category": "Code",
            "provider": "Mistral",
        },
        {
            "id": "mistralai/codestral-2508",
            "name": "Codestral 2508",
            "description": "Mistral's cutting-edge language model for coding released end of July 2025.",
            "category": "Code",
            "provider": "Mistral",
        },
    ],
    "OpenAI": [
        {
            "id": "openai/gpt-5.1",
            "name": "GPT-5.1",
            "description": 'GPT-5.1 is the latest frontier-grade model in the GPT-5 series, offering stronger general-purpose reasoning, improved instruction adherence, and a more natural conversational style compared to GPT-5.',
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-5.1-chat",
            "name": "GPT-5.1 Chat",
            "description": 'GPT-5.1 Chat (AKA Instant is the fast, lightweight member of the 5.1 family, optimized for low-latency chat while retaining strong general intelligence.',
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-5.1-codex",
            "name": "GPT-5.1-Codex",
            "description": 'GPT-5.1-Codex is a specialized version of GPT-5.1 optimized for software engineering and coding workflows.',
            "category": "Code",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-5.1-codex-mini",
            "name": "GPT-5.1-Codex-Mini",
            "description": 'GPT-5.1-Codex-Mini is a smaller and faster version of GPT-5.1-Codex',
            "category": "Code",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-5",
            "name": "GPT-5",
            "description": 'GPT-5 is OpenAI’s most advanced model, offering major improvements in reasoning, code quality, and user experience.',
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-5-mini",
            "name": "GPT-5 Mini",
            "description": 'GPT-5 Mini is a compact version of GPT-5, designed to handle lighter-weight reasoning tasks.',
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-5-nano",
            "name": "GPT-5 Nano",
            "description": 'GPT-5-Nano is the smallest and fastest variant in the GPT-5 system, optimized for developer tools, rapid interactions, and ultra-low latency environments.',
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-5-codex",
            "name": "GPT-5 Codex",
            "description": 'GPT-5-Codex is a specialized version of GPT-5 optimized for software engineering and coding workflows.',
            "category": "Code",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-5-chat",
            "name": "GPT-5 Chat",
            "description": 'GPT-5 Chat is designed for advanced, natural, multimodal, and context-aware conversations for enterprise applications.',
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-4o",
            "name": "GPT-4o",
            "description": "GPT-4o (\"o\" for \"omni\") is OpenAI's latest AI model, supporting both text and image inputs with text outputs.",
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/o3",
            "name": "o3",
            "description": 'o3 is a well-rounded and powerful model across domains.',
            "category": "Reasoning",
            "provider": "OpenAI",
        },
        {
            "id": "openai/o3-mini",
            "name": "o3 Mini",
            "description": 'OpenAI o3-mini is a cost-efficient language model optimized for STEM reasoning tasks, particularly excelling in science, mathematics, and coding.',
            "category": "Reasoning",
            "provider": "OpenAI",
        },
    ],
    "Qwen": [
        {
            "id": "qwen/qwen3-vl-235b-a22b-thinking",
            "name": "Qwen3 VL 235B A22B Thinking",
            "description": 'Qwen3-VL-235B-A22B Thinking is a multimodal model that unifies strong text generation with visual understanding across images and video.',
            "category": "Multimodal/Reasoning",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-next-80b-a3b-thinking",
            "name": "Qwen3 Next 80B A3B Thinking",
            "description": 'Qwen3-Next-80B-A3B-Thinking is a reasoning-first chat model in the Qwen3-Next line that outputs structured “thinking” traces by default.',
            "category": "Language/Reasoning",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-next-80b-a3b-instruct",
            "name": "Qwen3 Next 80B A3B Instruct",
            "description": 'Qwen3-Next-80B-A3B-Instruct is an instruction-tuned chat model in the Qwen3-Next series optimized for fast, stable responses without “thinking” traces.',
            "category": "Language",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-max",
            "name": "Qwen3 Max",
            "description": 'Qwen3-Max is an updated release built on the Qwen3 series, offering major improvements in reasoning, instruction following, multilingual support, and long-tail knowledge coverage compared to the January 2025 version.',
            "category": "Language",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-coder-plus",
            "name": "Qwen3 Coder Plus",
            "description": "Qwen3 Coder Plus is Alibaba's proprietary version of the Open Source Qwen3 Coder 480B A35B.",
            "category": "Code",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-coder-flash",
            "name": "Qwen3 Coder Flash",
            "description": "Qwen3 Coder Flash is Alibaba's fast and cost efficient version of their proprietary Qwen3 Coder Plus.",
            "category": "Code",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-coder",
            "name": "Qwen3 Coder 480B A35B",
            "description": 'Qwen3-Coder-480B-A35B-Instruct is a Mixture-of-Experts (MoE) code generation model developed by the Qwen team.',
            "category": "Code",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-30b-a3b-instruct-2507",
            "name": "Qwen3 30B A3B Instruct 2507",
            "description": 'Qwen3-30B-A3B-Instruct-2507 is a 30.5B-parameter mixture-of-experts language model from Qwen, with 3.3B active parameters per inference.',
            "category": "Language",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-235b-a22b",
            "name": "Qwen3 235B A22B",
            "description": 'Qwen3-235B-A22B is a 235B parameter mixture-of-experts (MoE) model developed by Qwen, activating 22B parameters per forward pass.',
            "category": "Language",
            "provider": "Qwen",
        },
    ],
    "xAI": [
        {
            "id": "x-ai/grok-5",
            "name": "Grok 5 (Coming Soon)",
            "description": "xAI's upcoming Grok 5 model expected by end of 2025. This model is not yet available for selection.",
            "category": "Language",
            "provider": "xAI",
            "available": False,
        },
        {
            "id": "x-ai/grok-4",
            "name": "Grok 4",
            "description": "Grok 4 is xAI's latest reasoning model with a 256k context window.",
            "category": "Language",
            "provider": "xAI",
        },
        {
            "id": "x-ai/grok-4-fast",
            "name": "Grok 4 Fast",
            "description": "Grok 4 Fast is xAI's latest multimodal model with SOTA cost-efficiency and a 2M token context window.",
            "category": "Language",
            "provider": "xAI",
        },
        {
            "id": "x-ai/grok-4.1-fast",
            "name": "Grok 4.1 Fast",
            "description": "Grok 4.1 Fast is xAI's best agentic tool calling model that shines in real-world use cases like customer support and deep research.",
            "category": "Language",
            "provider": "xAI",
        },],
}

# Flatten the models for backward compatibility
OPENROUTER_MODELS = []
for provider, models in MODELS_BY_PROVIDER.items():
    OPENROUTER_MODELS.extend(models)

client = OpenAI(api_key=OPENROUTER_API_KEY, base_url="https://openrouter.ai/api/v1")


def clean_model_response(text: str) -> str:
    """
    Lightweight cleanup for model responses.
    Heavy cleanup moved to frontend LatexRenderer for better performance.

    NOTE: This function strips leading/trailing whitespace, which is fine for
    complete responses but should NOT be used on streaming chunks (it would
    remove spaces between words at chunk boundaries).
    """
    if not text:
        return text

    # Only do essential cleanup - frontend handles the rest
    # This dramatically improves response speed (200-500ms saved per response)

    # Only remove obviously broken content that ALL models should avoid
    # Remove complete MathML blocks (rarely needed, but fast)
    text = re.sub(r"<math[^>]*>[\s\S]*?</math>", "", text, flags=re.IGNORECASE)

    # Remove w3.org MathML URLs (most common issue from Google Gemini)
    text = re.sub(r"https?://www\.w3\.org/\d+/Math/MathML[^>\s]*>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"www\.w3\.org/\d+/Math/MathML", "", text, flags=re.IGNORECASE)

    # Clean up excessive whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def get_model_max_tokens(model_id: str) -> int:
    """
    Get the appropriate max_tokens limit for each model based on their capabilities.
    This prevents setting max_tokens higher than the model's maximum output capacity.

    All current models support 8192 tokens. If a model needs a different limit in the future,
    you can add it to the model_limits dictionary below.
    """
    # Model-specific token limits for exceptions
    # Currently all models use 8192, but this dict allows for future customization
    model_limits = {
        # Add any models with non-standard limits here
        # Example: "some-provider/model-id": 4096,
    }

    # Return model-specific limit or default to 8192 for all models
    return model_limits.get(model_id, 8192)


def estimate_token_count(text: str) -> int:
    """
    Estimate token count for text using tiktoken.
    Falls back to character-based estimation if tiktoken fails.

    Uses cl100k_base encoding (GPT-4, GPT-3.5-turbo) as a reasonable approximation
    for most modern LLMs.
    """
    try:
        encoding = tiktoken.get_encoding("cl100k_base")
        return len(encoding.encode(text))
    except Exception:
        # Fallback: rough estimate of 1 token ≈ 4 characters
        return len(text) // 4


def count_conversation_tokens(messages: List[Any]) -> int:
    """
    Count total tokens in a conversation history.
    Includes tokens for message formatting overhead.
    """
    total_tokens = 0

    for msg in messages:
        # Count content tokens
        if isinstance(msg, dict):
            content = msg.get("content", "")
        else:
            content = msg.content if hasattr(msg, "content") else ""

        total_tokens += estimate_token_count(str(content))

        # Add overhead for message formatting (~4 tokens per message)
        total_tokens += 4

    return total_tokens


def truncate_conversation_history(conversation_history: List[Any], max_messages: int = 20) -> Tuple[List[Any], bool, int]:
    """
    Truncate conversation history to recent messages to manage context window.
    Returns (truncated_history, was_truncated, original_message_count).

    Industry best practice (2025): Keep sliding window of recent messages
    rather than sending entire conversation history.

    Args:
        conversation_history: List of conversation messages
        max_messages: Maximum number of messages to keep (default: 20)

    Returns:
        Tuple of (truncated messages, whether truncation occurred, original count)
    """
    if not conversation_history:
        return [], False, 0

    original_count = len(conversation_history)

    if original_count <= max_messages:
        return conversation_history, False, original_count

    # Keep the most recent max_messages
    truncated = conversation_history[-max_messages:]

    return truncated, True, original_count


def call_openrouter_streaming(
    prompt: str,
    model_id: str,
    tier: str = "standard",
    conversation_history: Optional[List[Any]] = None,
    use_mock: bool = False,
) -> Generator[str, None, None]:
    """
    Stream OpenRouter responses token-by-token for faster perceived response time.
    Yields chunks of text as they arrive from the model.

    Supports all OpenRouter providers that have streaming enabled:
    - OpenAI, Azure, Anthropic, Fireworks, Mancer, Recursal
    - AnyScale, Lepton, OctoAI, Novita, DeepInfra, Together
    - Cohere, Hyperbolic, Infermatic, Avian, XAI, Cloudflare
    - SFCompute, Nineteen, Liquid, Friendli, Chutes, DeepSeek

    Args:
        prompt: User prompt text
        model_id: Model identifier
        tier: Response tier ('standard' or 'extended')
        conversation_history: Optional conversation history
        use_mock: If True, return mock responses instead of calling API (admin testing feature)
    """
    # Mock mode: return pre-defined responses for testing
    if use_mock:
        print(f"🎭 Mock mode enabled - returning mock {tier} response for {model_id}")
        for chunk in stream_mock_response(tier=tier, chunk_size=50):
            yield chunk
        return

    try:
        # Build messages array - use standard format like official AI providers
        messages = []

        # Add a minimal system message only to encourage complete thoughts
        if not conversation_history:
            messages.append(
                {
                    "role": "system",
                    "content": "Provide complete responses. Finish your thoughts and explanations fully.",
                }
            )

        # Apply context window management (industry best practice 2025)
        # Truncate conversation history to prevent context overflow and manage costs
        truncated_history = conversation_history
        was_truncated = False

        if conversation_history:
            truncated_history, was_truncated, original_count = truncate_conversation_history(conversation_history, max_messages=20)

            # Add truncated conversation history
            for msg in truncated_history:
                messages.append({"role": msg.role, "content": msg.content})

            # If truncated, inform the model about it
            if was_truncated:
                messages.append(
                    {
                        "role": "system",
                        "content": f"Note: Earlier conversation context ({original_count - len(truncated_history)} messages) has been summarized to focus on recent discussion.",
                    }
                )

        # Add the current prompt as user message
        messages.append({"role": "user", "content": prompt})

        # Get tier-based max_tokens limit from configuration
        tier_max_tokens = get_tier_max_tokens(tier)

        # Don't exceed model's maximum capability
        model_max_tokens = get_model_max_tokens(model_id)
        max_tokens = min(tier_max_tokens, model_max_tokens)

        # Enable streaming
        response = client.chat.completions.create(
            model=model_id,
            messages=messages,
            timeout=settings.individual_model_timeout,
            max_tokens=max_tokens,
            stream=True,  # Enable streaming!
        )

        full_content = ""
        finish_reason = None

        # Iterate through chunks as they arrive
        for chunk in response:
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta

                # Yield content chunks as they arrive
                if hasattr(delta, "content") and delta.content:
                    content_chunk = delta.content
                    full_content += content_chunk
                    yield content_chunk

                # Capture finish reason from last chunk
                if chunk.choices[0].finish_reason:
                    finish_reason = chunk.choices[0].finish_reason

        # After streaming completes, handle finish_reason warnings
        if finish_reason == "length":
            tier_messages = {
                "standard": "\n\n⚠️ **Standard tier limit reached.** Response truncated at 4,000 tokens. Upgrade to Extended (8,000) for comprehensive responses.",
                "extended": "\n\n⚠️ **Extended tier limit reached.** Response truncated at 8,000 tokens. This is the maximum response length available.",
            }
            warning = tier_messages.get(tier, "\n\n⚠️ Response truncated - model reached maximum output length.")
            yield warning
        elif finish_reason == "content_filter":
            yield "\n\n⚠️ **Note:** Response stopped by content filter."

    except Exception as e:
        error_str = str(e).lower()
        # Yield error messages in the stream
        if "timeout" in error_str:
            yield f"Error: Timeout ({settings.individual_model_timeout}s)"
        elif "rate limit" in error_str or "429" in error_str:
            yield f"Error: Rate limited"
        elif "not found" in error_str or "404" in error_str:
            yield f"Error: Model not available"
        elif "unauthorized" in error_str or "401" in error_str:
            yield f"Error: Authentication failed"
        else:
            yield f"Error: {str(e)[:100]}"


def call_openrouter(
    prompt: str,
    model_id: str,
    tier: str = "standard",
    conversation_history: Optional[List[Any]] = None,
    use_mock: bool = False,
) -> str:
    """
    Non-streaming version of OpenRouter call (kept for backward compatibility).
    For better performance, use call_openrouter_streaming instead.

    Args:
        prompt: User prompt text
        model_id: Model identifier
        tier: Response tier ('standard' or 'extended')
        conversation_history: Optional conversation history
        use_mock: If True, return mock responses instead of calling API (admin testing feature)
    """
    # Mock mode: return pre-defined responses for testing
    if use_mock:
        print(f"🎭 Mock mode enabled - returning mock {tier} response for {model_id}")
        return get_mock_response(tier=tier)

    try:
        # Build messages array - use standard format like official AI providers
        messages = []

        # Add a minimal system message only to encourage complete thoughts
        # This doesn't force verbosity, just ensures completion
        if not conversation_history:
            messages.append(
                {
                    "role": "system",
                    "content": "Provide complete responses. Finish your thoughts and explanations fully.",
                }
            )

        # Apply context window management (industry best practice 2025)
        truncated_history = conversation_history
        was_truncated = False

        if conversation_history:
            truncated_history, was_truncated, original_count = truncate_conversation_history(conversation_history, max_messages=20)

            # Add truncated conversation history
            for msg in truncated_history:
                messages.append({"role": msg.role, "content": msg.content})

            # If truncated, inform the model about it
            if was_truncated:
                messages.append(
                    {
                        "role": "system",
                        "content": f"Note: Earlier conversation context ({original_count - len(truncated_history)} messages) has been summarized to focus on recent discussion.",
                    }
                )

        # Add the current prompt as user message
        messages.append({"role": "user", "content": prompt})

        # Get tier-based max_tokens limit from configuration
        tier_max_tokens = get_tier_max_tokens(tier)

        # Don't exceed model's maximum capability
        model_max_tokens = get_model_max_tokens(model_id)
        max_tokens = min(tier_max_tokens, model_max_tokens)

        response = client.chat.completions.create(
            model=model_id,
            messages=messages,
            timeout=settings.individual_model_timeout,
            max_tokens=max_tokens,  # Use tier-based limit
        )
        content = response.choices[0].message.content
        finish_reason = response.choices[0].finish_reason

        # Only log issues, not every successful response
        model_name = model_id.split("/")[-1]

        # Detect incomplete responses heuristically
        incomplete_indicators = [
            "Therefore:",
            "In conclusion:",
            "Finally:",
            "Thus:",
            "So:",
            "Hence:",
            "Now,",
            "Next,",
            "Then,",
            "Adding these",
            "Combining",
            "Putting it all together",
        ]

        is_likely_incomplete = False
        if content:
            last_30_chars = content.strip()[-30:] if len(content.strip()) > 30 else content.strip()
            for indicator in incomplete_indicators:
                if last_30_chars.endswith(indicator) or last_30_chars.endswith(indicator.lower()):
                    is_likely_incomplete = True
                    break

        # Detect and warn about incomplete responses
        if finish_reason == "length":
            # Model hit token limit - response was cut off mid-thought
            tier_messages = {
                "standard": "⚠️ **Standard tier limit reached.** Response truncated at 4,000 tokens. Upgrade to Extended (8,000) for comprehensive responses.",
                "extended": "⚠️ **Extended tier limit reached.** Response truncated at 8,000 tokens. This is the maximum response length available.",
            }
            content = (content or "") + f"\n\n{tier_messages.get(tier, 'Response truncated - model reached maximum output length.')}"
        elif finish_reason == "content_filter":
            content = (content or "") + "\n\n⚠️ **Note:** Response stopped by content filter."

        # Clean up MathML and other unwanted markup before returning
        cleaned_content = clean_model_response(content) if content is not None else "No response generated"
        return cleaned_content
    except Exception as e:
        error_str = str(e).lower()
        # More descriptive error messages for faster debugging
        if "timeout" in error_str:
            return f"Error: Timeout ({settings.individual_model_timeout}s)"
        elif "rate limit" in error_str or "429" in error_str:
            return f"Error: Rate limited"
        elif "not found" in error_str or "404" in error_str:
            return f"Error: Model not available"
        elif "unauthorized" in error_str or "401" in error_str:
            return f"Error: Authentication failed"
        else:
            return f"Error: {str(e)[:100]}"  # Truncate long error messages


def run_models(
    prompt: str,
    model_list: List[str],
    tier: str = "standard",
    conversation_history: Optional[List[Any]] = None,
) -> Dict[str, str]:
    """
    Run models concurrently without batching.

    Note: This function is kept for backward compatibility with the non-streaming endpoint.
    The application primarily uses the streaming endpoint (/compare-stream) which processes
    all models concurrently via asyncio tasks.
    """
    results = {}

    def call(model_id):
        try:
            return model_id, call_openrouter(prompt, model_id, tier, conversation_history)
        except Exception as e:
            return model_id, f"Error: {str(e)}"

    # Process all models concurrently without batching limits
    # Uses default ThreadPoolExecutor which handles concurrency automatically
    with concurrent.futures.ThreadPoolExecutor() as executor:
        # Submit all futures
        future_to_model = {executor.submit(call, model_id): model_id for model_id in model_list}

        # Wait for all futures to complete
        for future in concurrent.futures.as_completed(future_to_model):
            model_id = future_to_model[future]
            try:
                _, result = future.result()
                results[model_id] = result
            except Exception as e:
                results[model_id] = f"Error: {str(e)}"

    return results


def test_connection_quality() -> ConnectionQualityDict:
    """Test connection quality by making a quick API call"""
    test_model = "anthropic/claude-3-haiku"  # Fast, reliable model for testing
    test_prompt = "Hello"
    start_time = time.time()

    try:
        response = client.chat.completions.create(
            model=test_model,
            messages=[{"role": "user", "content": test_prompt}],
            timeout=10,  # Short timeout for connection test
            max_tokens=100,  # Small limit for connection test
        )

        response_time = time.time() - start_time

        # Categorize connection quality
        if response_time < 2:
            quality = "excellent"
            multiplier = 1.0
        elif response_time < 4:
            quality = "good"
            multiplier = 1.2
        elif response_time < 7:
            quality = "average"
            multiplier = 1.5
        else:
            quality = "slow"
            multiplier = 2.0

        return {
            "response_time": response_time,
            "quality": quality,
            "time_multiplier": multiplier,
            "success": True,
        }

    except Exception as e:
        return {
            "response_time": 0,
            "quality": "poor",
            "time_multiplier": 3.0,
            "success": False,
            "error": str(e),
        }
