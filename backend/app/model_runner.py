import os
from openai import OpenAI
from dotenv import load_dotenv
import concurrent.futures
from typing import Dict, List, Any
import time
import re
import tiktoken
from .mock_responses import stream_mock_response, get_mock_response

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# Configuration optimized for 9-model limit (Pro tier maximum)
MAX_CONCURRENT_REQUESTS = 9  # Matches Pro tier limit of 9 models
INDIVIDUAL_MODEL_TIMEOUT = 120  # Increased timeout for very long, detailed responses
BATCH_SIZE = 9  # Process all 9 models in single batch for optimal performance

# Connection quality optimizations
# For slower connections, you may want to reduce MAX_CONCURRENT_REQUESTS to 6-8
# and increase INDIVIDUAL_MODEL_TIMEOUT to 60-90 seconds

# List of available models organized by providers
MODELS_BY_PROVIDER = {
    "Anthropic": [
        {
            "id": "anthropic/claude-sonnet-4.5",
            "name": "Claude Sonnet 4.5",
            "description": "Anthropic's latest Claude Sonnet 4.5 with enhanced coding and reasoning capabilities",
            "category": "Language",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-sonnet-4",
            "name": "Claude 4 Sonnet",
            "description": "Anthropic's Claude Sonnet 4 with advanced reasoning capabilities and enhanced performance",
            "category": "Language",
            "provider": "Anthropic",
        },
    ],
    "Cohere": [
        {
            "id": "cohere/command-r7b-12-2024",
            "name": "Command R7B",
            "description": "Cohere's compact model with excellent efficiency and performance, optimized for various language tasks",
            "category": "Language",
            "provider": "Cohere",
        },
        {
            "id": "cohere/command-r-plus-08-2024",
            "name": "Command R+",
            "description": "Cohere's most powerful model with enhanced reasoning, instruction following, and improved capabilities",
            "category": "Language/Reasoning",
            "provider": "Cohere",
        },
        {
            "id": "cohere/command-a",
            "name": "Command A",
            "description": "Cohere's Command A model for general language tasks with enhanced capabilities",
            "category": "Language",
            "provider": "Cohere",
        },
    ],
    "DeepSeek": [
        {
            "id": "deepseek/deepseek-v3.2-exp",
            "name": "DeepSeek V3.2 Exp",
            "description": "DeepSeek's experimental V3.2 model with DeepSeek Sparse Attention to lower computational costs and enhance performance",
            "category": "Language/Reasoning",
            "provider": "DeepSeek",
        },
        {
            "id": "deepseek/deepseek-r1",
            "name": "DeepSeek R1",
            "description": "DeepSeek's latest reasoning model with advanced problem-solving capabilities",
            "category": "Reasoning",
            "provider": "DeepSeek",
        },
        {
            "id": "deepseek/deepseek-chat-v3.1",
            "name": "DeepSeek Chat V3.1",
            "description": "DeepSeek's most advanced conversational model with superior reasoning capabilities",
            "category": "Language/Reasoning",
            "provider": "DeepSeek",
        },
    ],
    "Google": [
        {
            "id": "google/gemini-2.5-pro",
            "name": "Gemini 2.5 Pro",
            "description": "Google's most advanced Gemini 2.5 Pro with 'Deep Think' mode designed for complex tasks like math and coding",
            "category": "Language",
            "provider": "Google",
        },
        {
            "id": "google/gemini-2.5-flash",
            "name": "Gemini 2.5 Flash",
            "description": "Google's latest fast Gemini 2.5 model optimized for speed and efficiency",
            "category": "Language",
            "provider": "Google",
        },
    ],
    "Meta": [
        {
            "id": "meta-llama/llama-4-scout:free",
            "name": "Llama 4 Scout (Free)",
            "description": "Meta's Llama 4 Scout, part of advanced multimodal AI systems that can process text, video, images, and audio - free tier",
            "category": "Multimodal",
            "provider": "Meta",
        },
        {
            "id": "meta-llama/llama-4-scout",
            "name": "Llama 4 Scout",
            "description": "Meta's Llama 4 Scout, part of advanced multimodal AI systems that can process text, video, images, and audio",
            "category": "Multimodal",
            "provider": "Meta",
        },
        {
            "id": "meta-llama/llama-4-maverick:free",
            "name": "Llama 4 Maverick (Free)",
            "description": "Meta's flagship Llama 4 Maverick, their most advanced multimodal model for handling text, video, images, and audio - free tier",
            "category": "Multimodal",
            "provider": "Meta",
        },
        {
            "id": "meta-llama/llama-4-maverick",
            "name": "Llama 4 Maverick",
            "description": "Meta's flagship Llama 4 Maverick, their most advanced multimodal model for handling text, video, images, and audio",
            "category": "Multimodal",
            "provider": "Meta",
        },
        {
            "id": "meta-llama/llama-3.3-70b-instruct:free",
            "name": "Llama 3.3 70B Instruct (Free)",
            "description": "Meta's Llama 3.3 with enhanced text and code generation capabilities - free tier",
            "category": "Code/Language",
            "provider": "Meta",
        },
        {
            "id": "meta-llama/llama-3.3-70b-instruct",
            "name": "Llama 3.3 70B Instruct",
            "description": "Meta's latest major release with significant improvements in text and code generation capabilities",
            "category": "Code/Language",
            "provider": "Meta",
        },
    ],
    "Microsoft": [
        {
            "id": "microsoft/wizardlm-2-8x22b",
            "name": "WizardLM-2 8x22B",
            "description": "Microsoft's powerful mixture of experts model for complex tasks with enhanced reasoning capabilities",
            "category": "Language/Reasoning",
            "provider": "Microsoft",
        },
        {
            "id": "microsoft/phi-4-reasoning-plus",
            "name": "Phi 4 Reasoning Plus",
            "description": "Microsoft's enhanced Phi 4 model optimized for complex reasoning tasks with improved performance",
            "category": "Reasoning",
            "provider": "Microsoft",
        },
        {
            "id": "microsoft/phi-4",
            "name": "Phi 4",
            "description": "Microsoft's latest compact model with strong reasoning capabilities and enhanced performance",
            "category": "Language/Reasoning",
            "provider": "Microsoft",
        },
        {
            "id": "microsoft/mai-ds-r1:free",
            "name": "MAI-DS-R1 (Free)",
            "description": "Microsoft's MAI-DS-R1 reasoning model with enhanced capabilities - free tier",
            "category": "Reasoning",
            "provider": "Microsoft",
        },
    ],
    "Mistral": [
        {
            "id": "mistralai/mistral-small-3.2-24b-instruct",
            "name": "Mistral Small 3.2 24B",
            "description": "Mistral's latest efficient model with excellent performance-to-cost ratio and image understanding capabilities",
            "category": "Multimodal",
            "provider": "Mistral",
        },
        {
            "id": "mistralai/mistral-medium-3.1",
            "name": "Mistral Medium 3.1",
            "description": "Mistral's enterprise model available for on-premise deployment with strong capabilities",
            "category": "Language",
            "provider": "Mistral",
        },
        {
            "id": "mistralai/mistral-large",
            "name": "Mistral Large",
            "description": "Mistral's most powerful model for complex reasoning and analysis",
            "category": "Language/Reasoning",
            "provider": "Mistral",
        },
        {
            "id": "mistralai/devstral-small",
            "name": "Devstral Small",
            "description": "Mistral's small development-focused model for coding tasks with enhanced capabilities",
            "category": "Code",
            "provider": "Mistral",
        },
        {
            "id": "mistralai/devstral-medium",
            "name": "Devstral Medium",
            "description": "Mistral's medium development-focused model for advanced coding with enhanced capabilities",
            "category": "Code",
            "provider": "Mistral",
        },
        {
            "id": "mistralai/codestral-2508",
            "name": "Codestral 2508",
            "description": "Mistral's specialized code model from August 2025 with enhanced programming capabilities",
            "category": "Code",
            "provider": "Mistral",
        },
    ],
    "OpenAI": [
        {
            "id": "openai/gpt-5-pro",
            "name": "GPT-5 Pro",
            "description": "OpenAI's professional-tier GPT-5 model with enhanced coding and problem-solving abilities and improved capabilities over GPT-4",
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-5-nano",
            "name": "GPT-5 Nano",
            "description": "OpenAI's ultra-lightweight GPT-5 model optimized for efficiency with enhanced coding and problem-solving capabilities",
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-5-mini",
            "name": "GPT-5 Mini",
            "description": "GPT-5 Mini is a compact version of GPT-5 with enhanced coding abilities, designed for lighter-weight reasoning tasks with reduced latency and cost",
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-5-codex",
            "name": "GPT-5 Codex",
            "description": "OpenAI's GPT-5 Codex specialized for code generation and programming tasks with enhanced coding abilities",
            "category": "Code",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-5-chat",
            "name": "GPT-5 Chat",
            "description": "OpenAI's GPT-5 Chat optimized for conversational interactions with enhanced coding and problem-solving abilities",
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-5",
            "name": "GPT-5",
            "description": "OpenAI's most advanced model with enhanced coding and problem-solving abilities, representing a significant leap from GPT-4",
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/o3",
            "name": "o3",
            "description": "OpenAI's latest reasoning model optimized for complex problem-solving, mathematical reasoning, and code generation",
            "category": "Reasoning",
            "provider": "OpenAI",
        },
        {
            "id": "openai/o3-mini",
            "name": "o3 Mini",
            "description": "OpenAI's compact reasoning model optimized for efficient problem-solving and mathematical tasks",
            "category": "Reasoning",
            "provider": "OpenAI",
        },
        {
            "id": "openai/o1-pro",
            "name": "o1-pro",
            "description": "OpenAI's advanced reasoning model designed for complex mathematical problems and logical reasoning tasks",
            "category": "Reasoning",
            "provider": "OpenAI",
        },
        {
            "id": "openai/o1",
            "name": "o1",
            "description": "OpenAI's reasoning model optimized for mathematical problem-solving and complex reasoning tasks",
            "category": "Reasoning",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-4o",
            "name": "GPT-4o",
            "description": "OpenAI's latest multimodal model with enhanced reasoning and code capabilities",
            "category": "Language",
            "provider": "OpenAI",
        },
    ],
    "Qwen": [
        {
            "id": "qwen/qwen3-vl-235b-a22b-thinking",
            "name": "Qwen3 VL 235B A22B Thinking",
            "description": "Qwen's vision-language model with thinking capabilities, trained on 36 trillion tokens across 119 languages",
            "category": "Multimodal/Reasoning",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-next-80b-a3b-thinking",
            "name": "Qwen3 Next 80B A3B Thinking",
            "description": "Qwen's Qwen3-Next with hybrid attention mechanism and highly sparse mixture-of-experts structure for enhanced performance",
            "category": "Language/Reasoning",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-next-80b-a3b-instruct",
            "name": "Qwen3 Next 80B A3B Instruct",
            "description": "Qwen's Qwen3-Next instruction model with hybrid attention and sparse MoE for higher throughput",
            "category": "Language",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-max",
            "name": "Qwen3 Max",
            "description": "Qwen's maximum capability model with top performance, trained on 36 trillion tokens in 119 languages",
            "category": "Language",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-coder-plus",
            "name": "Qwen3 Coder Plus",
            "description": "Qwen's enhanced code model with advanced programming capabilities and reasoning support",
            "category": "Code",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-coder-flash",
            "name": "Qwen3 Coder Flash",
            "description": "Qwen's fast code model optimized for speed with enhanced reasoning capabilities",
            "category": "Code",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-coder",
            "name": "Qwen3 Coder 480B A35B",
            "description": "Qwen's specialized large model for code generation and programming with multilingual support",
            "category": "Code",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-30b-a3b-instruct-2507",
            "name": "Qwen3 30B A3B Instruct 2507",
            "description": "Qwen's 30B instruction model from July 2025 with multilingual capabilities",
            "category": "Language",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-235b-a22b-thinking-2507",
            "name": "Qwen3 235B A22B Thinking 2507",
            "description": "Qwen's 235B thinking model from July 2025 with advanced reasoning capabilities",
            "category": "Language/Reasoning",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-235b-a22b",
            "name": "Qwen3 235B A22B",
            "description": "Qwen's flagship large language model with exceptional capabilities, trained on 36 trillion tokens",
            "category": "Language",
            "provider": "Qwen",
        },
    ],
    "xAI": [
        {
            "id": "x-ai/grok-4-fast",
            "name": "Grok 4 Fast",
            "description": "xAI's fast Grok 4 model optimized for speed with enhanced reasoning capabilities",
            "category": "Language",
            "provider": "xAI",
        },
        {
            "id": "x-ai/grok-4",
            "name": "Grok 4",
            "description": "xAI's most intelligent model with native tool use, real-time search, and enhanced reasoning capabilities",
            "category": "Language",
            "provider": "xAI",
        },
        {
            "id": "x-ai/grok-5",
            "name": "Grok 5 (Coming Soon)",
            "description": "xAI's upcoming Grok 5 model expected by end of 2025. This model is not yet available for selection.",
            "category": "Language",
            "provider": "xAI",
            "available": False,
        },
    ],
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


def count_conversation_tokens(messages: list) -> int:
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


def truncate_conversation_history(conversation_history: list, max_messages: int = 20) -> tuple:
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
    prompt: str, model_id: str, tier: str = "standard", conversation_history: list = None, use_mock: bool = False
):
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
        tier: Response tier ('brief', 'standard', or 'extended')
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
                {"role": "system", "content": "Provide complete responses. Finish your thoughts and explanations fully."}
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

        # Get tier-based max_tokens limit
        tier_limits = {"brief": 2000, "standard": 4000, "extended": 8192}
        tier_max_tokens = tier_limits.get(tier, 4000)

        # Don't exceed model's maximum capability
        model_max_tokens = get_model_max_tokens(model_id)
        max_tokens = min(tier_max_tokens, model_max_tokens)

        # Enable streaming
        response = client.chat.completions.create(
            model=model_id,
            messages=messages,
            timeout=INDIVIDUAL_MODEL_TIMEOUT,
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
                "brief": "\n\n⚠️ **Brief tier limit reached.** Response truncated at 2,000 tokens. Upgrade to Standard (4,000) or Extended (8,000) for longer responses.",
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
            yield f"Error: Timeout ({INDIVIDUAL_MODEL_TIMEOUT}s)"
        elif "rate limit" in error_str or "429" in error_str:
            yield f"Error: Rate limited"
        elif "not found" in error_str or "404" in error_str:
            yield f"Error: Model not available"
        elif "unauthorized" in error_str or "401" in error_str:
            yield f"Error: Authentication failed"
        else:
            yield f"Error: {str(e)[:100]}"


def call_openrouter(
    prompt: str, model_id: str, tier: str = "standard", conversation_history: list = None, use_mock: bool = False
) -> str:
    """
    Non-streaming version of OpenRouter call (kept for backward compatibility).
    For better performance, use call_openrouter_streaming instead.

    Args:
        prompt: User prompt text
        model_id: Model identifier
        tier: Response tier ('brief', 'standard', or 'extended')
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
                {"role": "system", "content": "Provide complete responses. Finish your thoughts and explanations fully."}
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

        # Get tier-based max_tokens limit
        tier_limits = {"brief": 2000, "standard": 4000, "extended": 8192}
        tier_max_tokens = tier_limits.get(tier, 4000)

        # Don't exceed model's maximum capability
        model_max_tokens = get_model_max_tokens(model_id)
        max_tokens = min(tier_max_tokens, model_max_tokens)

        response = client.chat.completions.create(
            model=model_id, messages=messages, timeout=INDIVIDUAL_MODEL_TIMEOUT, max_tokens=max_tokens  # Use tier-based limit
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
                "brief": "⚠️ **Brief tier limit reached.** Response truncated at 2,000 tokens. Upgrade to Standard (4,000) or Extended (8,000) for longer responses.",
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
            return f"Error: Timeout ({INDIVIDUAL_MODEL_TIMEOUT}s)"
        elif "rate limit" in error_str or "429" in error_str:
            return f"Error: Rate limited"
        elif "not found" in error_str or "404" in error_str:
            return f"Error: Model not available"
        elif "unauthorized" in error_str or "401" in error_str:
            return f"Error: Authentication failed"
        else:
            return f"Error: {str(e)[:100]}"  # Truncate long error messages


def run_models_batch(
    prompt: str, model_batch: List[str], tier: str = "standard", conversation_history: list = None
) -> Dict[str, str]:
    """Run a batch of models with limited concurrency"""
    results = {}

    def call(model_id):
        try:
            return model_id, call_openrouter(prompt, model_id, tier, conversation_history)
        except Exception as e:
            return model_id, f"Error: {str(e)}"

    # Use a limited number of threads to prevent overwhelming the API
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_CONCURRENT_REQUESTS) as executor:
        # Submit all futures
        future_to_model = {executor.submit(call, model_id): model_id for model_id in model_batch}

        # Set a generous timeout for the entire batch to match individual model timeouts
        batch_timeout = min(300, len(model_batch) * 50)  # 50 seconds per model in batch, max 300s (5 minutes)

        try:
            # Wait for all futures to complete or timeout
            for future in concurrent.futures.as_completed(future_to_model, timeout=batch_timeout):
                model_id = future_to_model[future]
                try:
                    _, result = future.result(timeout=2)  # Quick result retrieval
                    results[model_id] = result
                except Exception as e:
                    results[model_id] = f"Error: {str(e)}"

        except concurrent.futures.TimeoutError:
            # Handle batch timeout - get results from completed futures and mark others as failed
            pass

        # Handle any remaining incomplete futures
        for future, model_id in future_to_model.items():
            if model_id not in results:
                if future.done():
                    try:
                        _, result = future.result(timeout=1)
                        results[model_id] = result
                    except Exception as e:
                        results[model_id] = f"Error: {str(e)}"
                else:
                    future.cancel()
                    results[model_id] = f"Error: Timeout after {batch_timeout}s"

    return results


def run_models(prompt: str, model_list: List[str], tier: str = "standard", conversation_history: list = None) -> Dict[str, str]:
    """Run models with batching to prevent timeouts and API overload"""
    all_results = {}

    # Process models in batches
    for i in range(0, len(model_list), BATCH_SIZE):
        batch = model_list[i : i + BATCH_SIZE]
        try:
            batch_results = run_models_batch(prompt, batch, tier, conversation_history)
            all_results.update(batch_results)
        except Exception as e:
            # If a batch fails entirely, mark all models in that batch as failed
            for model_id in batch:
                all_results[model_id] = f"Error: Batch processing failed - {str(e)}"

    return all_results


def test_connection_quality() -> Dict[str, Any]:
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

        return {"response_time": response_time, "quality": quality, "time_multiplier": multiplier, "success": True}

    except Exception as e:
        return {"response_time": 0, "quality": "poor", "time_multiplier": 3.0, "success": False, "error": str(e)}
