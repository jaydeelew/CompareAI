import os
from openai import OpenAI
from dotenv import load_dotenv
import concurrent.futures
from typing import Dict, List, Any
import time

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# Configuration optimized for 12-model limit
MAX_CONCURRENT_REQUESTS = 12  # Perfect match for 12-model limit
INDIVIDUAL_MODEL_TIMEOUT = 30  # Reduced timeout for faster failure detection
BATCH_SIZE = 12  # Process all 12 models in single batch for optimal performance

# Connection quality optimizations
# For slower connections, you may want to reduce MAX_CONCURRENT_REQUESTS to 6-8
# and increase INDIVIDUAL_MODEL_TIMEOUT to 60-90 seconds

# List of available models organized by providers
MODELS_BY_PROVIDER = {
    "Anthropic": [
        {
            "id": "anthropic/claude-3-haiku",
            "name": "Claude 3 Haiku",
            "description": "Anthropic's fast and efficient Claude 3 model for quick responses",
            "category": "Language",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-3-opus",
            "name": "Claude 3 Opus (Generic)",
            "description": "Anthropic's Claude 3 Opus model with general availability",
            "category": "Language",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-3-opus-20240229",
            "name": "Claude 3 Opus (Feb 29, 2024)",
            "description": "Anthropic's most powerful Claude 3 model with exceptional reasoning capabilities",
            "category": "Language",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-3.5-haiku",
            "name": "Claude 3.5 Haiku (Generic)",
            "description": "Anthropic's Claude 3.5 Haiku model with general availability",
            "category": "Language",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-3.5-haiku-20241022",
            "name": "Claude 3.5 Haiku (Oct 22, 2024)",
            "description": "Anthropic's fastest and most efficient Claude 3.5 model optimized for speed",
            "category": "Language",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-3.5-sonnet",
            "name": "Claude 3.5 Sonnet (Generic)",
            "description": "Anthropic's Claude 3.5 Sonnet model with general availability",
            "category": "Language",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-3.5-sonnet-20240620",
            "name": "Claude 3.5 Sonnet (Jun 20, 2024)",
            "description": "Anthropic's Claude 3.5 Sonnet model from June 2024 release",
            "category": "Language",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-3.5-sonnet-20241022",
            "name": "Claude 3.5 Sonnet (Oct 22, 2024)",
            "description": "Anthropic's most advanced Claude 3.5 Sonnet model with enhanced capabilities",
            "category": "Language",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-3.7-sonnet",
            "name": "Claude 3.7 Sonnet",
            "description": "Anthropic's Claude 3.7 Sonnet model with enhanced performance over Claude 3.5",
            "category": "Language",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-sonnet-4",
            "name": "Claude 4 Sonnet",
            "description": "Anthropic's latest and most advanced Claude 4 model with exceptional capabilities",
            "category": "Language",
            "provider": "Anthropic",
        },
    ],
    "Cohere": [
        {
            "id": "cohere/command-r7b-12-2024",
            "name": "Command R7B (Dec 2024)",
            "description": "Cohere's latest compact model with excellent efficiency and performance",
            "category": "Language",
            "provider": "Cohere",
        },
        {
            "id": "cohere/command-r-08-2024",
            "name": "Command R (Aug 2024)",
            "description": "Cohere's latest command model with enhanced capabilities for general tasks",
            "category": "Language",
            "provider": "Cohere",
        },
        {
            "id": "cohere/command-r-plus-08-2024",
            "name": "Command R+ (Aug 2024)",
            "description": "Cohere's most powerful model with enhanced reasoning and instruction following",
            "category": "Language/Reasoning",
            "provider": "Cohere",
        },
    ],
    "DeepSeek": [
        {
            "id": "deepseek/deepseek-chat",
            "name": "DeepSeek Chat (Standard)",
            "description": "DeepSeek's proven conversational model with strong reasoning capabilities",
            "category": "Language/Reasoning",
            "provider": "DeepSeek",
        },
        {
            "id": "deepseek/deepseek-chat-v3.1",
            "name": "DeepSeek Chat V3.1",
            "description": "DeepSeek's most advanced conversational model with superior reasoning",
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
    ],
    "Google": [
        {
            "id": "google/gemini-flash-1.5",
            "name": "Gemini 1.5 Flash",
            "description": "Google's fast and efficient Gemini 1.5 model optimized for speed",
            "category": "Language",
            "provider": "Google",
        },
        {
            "id": "google/gemini-pro-1.5",
            "name": "Gemini 1.5 Pro",
            "description": "Google's advanced Gemini 1.5 model with superior reasoning",
            "category": "Language",
            "provider": "Google",
        },
        {
            "id": "google/gemini-flash-1.5-8b",
            "name": "Gemini 1.5 Flash 8B",
            "description": "Google's compact and efficient Gemini 1.5 model with 8B parameters",
            "category": "Language",
            "provider": "Google",
        },
        {
            "id": "google/gemini-2.0-flash-001",
            "name": "Gemini 2.0 Flash",
            "description": "Google's latest Gemini 2.0 Flash with significantly faster time to first token",
            "category": "Language",
            "provider": "Google",
        },
        {
            "id": "google/gemini-2.0-flash-lite-001",
            "name": "Gemini 2.0 Flash Lite",
            "description": "Google's lightweight Gemini 2.0 Flash model optimized for speed",
            "category": "Language",
            "provider": "Google",
        },
        # Previous models that were commented out - now with correct IDs above
        # {
        #     "id": "google/gemini-2.0-flash-experimental",  # OLD - INCORRECT ID
        #     "name": "Gemini 2.0 Flash Experimental",
        #     "description": "Google's cutting-edge experimental Gemini 2.0 model with latest capabilities",
        #     "category": "Language",
        #     "provider": "Google"
        # },
        # {
        #     "id": "google/gemini-2.0-flash-thinking-experimental",  # OLD - INCORRECT ID
        #     "name": "Gemini 2.0 Flash Thinking Experimental",
        #     "description": "Google's experimental Gemini 2.0 with advanced reasoning capabilities",
        #     "category": "Language",
        #     "provider": "Google"
        # },
        {
            "id": "google/gemini-2.5-flash",
            "name": "Gemini 2.5 Flash",
            "description": "Google's latest fast Gemini 2.5 model optimized for speed and efficiency",
            "category": "Language",
            "provider": "Google",
        },
        {
            "id": "google/gemini-2.5-pro",
            "name": "Gemini 2.5 Pro",
            "description": "Google's most advanced Gemini 2.5 model with superior reasoning and capabilities",
            "category": "Language",
            "provider": "Google",
        },
        {
            "id": "google/gemma-3-27b-it",
            "name": "Gemma 3 27B Instruct",
            "description": "Google's large Gemma 3 model optimized for instruction following",
            "category": "Language",
            "provider": "Google",
        },
    ],
    "Meta": [
        {
            "id": "meta-llama/llama-3.1-70b-instruct",
            "name": "Llama 3.1 70B Instruct",
            "description": "Meta's large language model optimized for text and code generation",
            "category": "Code/Language",
            "provider": "Meta",
        },
        {
            "id": "meta-llama/llama-3.1-405b-instruct",
            "name": "Llama 3.1 405B Instruct",
            "description": "Meta's largest and most capable model for complex reasoning and analysis",
            "category": "Language/Reasoning",
            "provider": "Meta",
        },
        {
            "id": "meta-llama/llama-3.2-3b-instruct",
            "name": "Llama 3.2 3B Instruct",
            "description": "Meta's compact model optimized for efficiency and fast responses",
            "category": "Language",
            "provider": "Meta",
        },
        {
            "id": "meta-llama/llama-3.3-70b-instruct",
            "name": "Llama 3.3 70B Instruct",
            "description": "Meta's latest major release with significant improvements in text and code generation",
            "category": "Code/Language",
            "provider": "Meta",
        },
        {
            "id": "meta-llama/llama-4-maverick",
            "name": "Llama 4 Maverick",
            "description": "Meta's latest flagship Llama 4 model with advanced reasoning and code capabilities",
            "category": "Code/Language",
            "provider": "Meta",
        },
        {
            "id": "meta-llama/llama-4-scout",
            "name": "Llama 4 Scout",
            "description": "Meta's optimized Llama 4 model for rapid deployment and efficient inference",
            "category": "Language",
            "provider": "Meta",
        },
    ],
    "Microsoft": [
        {
            "id": "microsoft/phi-3.5-mini-128k-instruct",
            "name": "Phi-3.5 Mini 128K",
            "description": "Microsoft's efficient model with extended context length for long documents",
            "category": "Language",
            "provider": "Microsoft",
        },
        {
            "id": "microsoft/phi-4",
            "name": "Phi 4",
            "description": "Microsoft's latest compact model with strong reasoning capabilities",
            "category": "Language/Reasoning",
            "provider": "Microsoft",
        },
        {
            "id": "microsoft/phi-4-reasoning-plus",
            "name": "Phi 4 Reasoning Plus",
            "description": "Microsoft's enhanced Phi 4 model optimized for complex reasoning tasks",
            "category": "Reasoning",
            "provider": "Microsoft",
        },
        {
            "id": "microsoft/wizardlm-2-8x22b",
            "name": "WizardLM-2 8x22B",
            "description": "Microsoft's powerful mixture of experts model for complex tasks",
            "category": "Language/Reasoning",
            "provider": "Microsoft",
        },
    ],
    "Mistral": [
        {
            "id": "mistralai/devstral-small-2505",
            "name": "Devstral Small 2505",
            "description": "Mistral's specialized model for development and coding tasks",
            "category": "Code",
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
            "id": "mistralai/mistral-nemo",
            "name": "Mistral Nemo",
            "description": "Mistral's balanced model for general-purpose language tasks",
            "category": "Language",
            "provider": "Mistral",
        },
        {
            "id": "mistralai/mistral-small-3.2-24b-instruct",
            "name": "Mistral Small 3.2 24B",
            "description": "Mistral's latest efficient model with excellent performance-to-cost ratio",
            "category": "Language",
            "provider": "Mistral",
        },
        {
            "id": "mistralai/mixtral-8x7b-instruct",
            "name": "Mixtral 8x7B Instruct",
            "description": "Mistral's mixture of experts model optimized for instruction following",
            "category": "Language/Reasoning",
            "provider": "Mistral",
        },
    ],
    "OpenAI": [
        {
            "id": "openai/o1-mini",
            "name": "o1-mini",
            "description": "OpenAI's efficient reasoning model for faster complex problem solving",
            "category": "Reasoning",
            "provider": "OpenAI",
        },
        {
            "id": "openai/o1",
            "name": "OpenAI o1",
            "description": "OpenAI's latest reasoning model designed to think before responding",
            "category": "Reasoning",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-4o-2024-11-20",
            "name": "GPT-4o (Nov 20, 2024)",
            "description": "OpenAI's most advanced GPT-4o model with enhanced capabilities",
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-4o-mini",
            "name": "GPT-4o Mini",
            "description": "OpenAI's efficient and fast GPT-4o model optimized for speed",
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-4-turbo",
            "name": "GPT-4 Turbo",
            "description": "OpenAI's fast and efficient GPT-4 variant for complex reasoning tasks",
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-4o",
            "name": "GPT-4o (Standard)",
            "description": "OpenAI's latest multimodal model with enhanced reasoning and code capabilities",
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-5",
            "name": "GPT-5",
            "description": "OpenAI's most advanced model, offering major improvements in reasoning, code quality, and user experience",
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-5-mini",
            "name": "GPT-5 Mini",
            "description": "GPT-5 Mini is a compact version of GPT-5, designed to handle lighter-weight reasoning tasks with reduced latency and cost",
            "category": "Language",
            "provider": "OpenAI",
        },
    ],
    "Qwen": [
        {
            "id": "qwen/qwen3-14b",
            "name": "Qwen3 14B",
            "description": "Qwen's balanced model offering good performance for general tasks",
            "category": "Language",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-235b-a22b",
            "name": "Qwen3 235B A22B",
            "description": "Qwen's flagship large language model with exceptional capabilities",
            "category": "Language",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-coder",
            "name": "Qwen3 Coder 480B",
            "description": "Qwen's specialized large model for code generation and programming",
            "category": "Code",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwq-32b",
            "name": "QwQ 32B",
            "description": "Qwen's reasoning-focused model optimized for complex problem solving",
            "category": "Reasoning",
            "provider": "Qwen",
        },
    ],
    "xAI": [
        {
            "id": "x-ai/grok-3",
            "name": "Grok 3",
            "description": "xAI's advanced Grok model with enhanced reasoning and text capabilities",
            "category": "Language",
            "provider": "xAI",
        },
        {
            "id": "x-ai/grok-4",
            "name": "Grok 4",
            "description": "xAI's most intelligent model with native tool use and real-time search",
            "category": "Language",
            "provider": "xAI",
        },
        {
            "id": "x-ai/grok-code-fast-1",
            "name": "Grok Code Fast 1",
            "description": "xAI's speedy model optimized for agentic coding and low cost",
            "category": "Code/Language",
            "provider": "xAI",
        },
    ],
}

# Flatten the models for backward compatibility
OPENROUTER_MODELS = []
for provider, models in MODELS_BY_PROVIDER.items():
    OPENROUTER_MODELS.extend(models)

client = OpenAI(api_key=OPENROUTER_API_KEY, base_url="https://openrouter.ai/api/v1")


def call_openrouter(prompt: str, model_id: str, conversation_history: list = None) -> str:
    try:
        # Build messages array - use standard format like official AI providers
        messages = []

        # Add conversation history if provided (include both user and assistant messages)
        if conversation_history:
            for msg in conversation_history:
                messages.append({"role": msg.role, "content": msg.content})

        # Add the current prompt as user message
        messages.append({"role": "user", "content": prompt})

        response = client.chat.completions.create(model=model_id, messages=messages, timeout=INDIVIDUAL_MODEL_TIMEOUT)
        content = response.choices[0].message.content
        return content if content is not None else "No response generated"
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


def run_models_batch(prompt: str, model_batch: List[str], conversation_history: list = None) -> Dict[str, str]:
    """Run a batch of models with limited concurrency"""
    results = {}

    def call(model_id):
        try:
            return model_id, call_openrouter(prompt, model_id, conversation_history)
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
            print(f"Batch timeout after {batch_timeout}s, processing completed results...")

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


def run_models(prompt: str, model_list: List[str], conversation_history: list = None) -> Dict[str, str]:
    """Run models with batching to prevent timeouts and API overload"""
    import time

    start_time = time.time()

    all_results = {}

    print(f"Starting model processing: {len(model_list)} models total")
    if conversation_history:
        print(f"Using conversation context with {len(conversation_history)} previous messages")

    # Process models in batches
    for i in range(0, len(model_list), BATCH_SIZE):
        batch = model_list[i : i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (len(model_list) + BATCH_SIZE - 1) // BATCH_SIZE
        batch_start = time.time()
        print(f"Processing batch {batch_num}/{total_batches}: {len(batch)} models")

        try:
            batch_results = run_models_batch(prompt, batch, conversation_history)
            all_results.update(batch_results)
            batch_duration = time.time() - batch_start
            print(f"Batch {batch_num} completed in {batch_duration:.2f}s: {len(batch_results)} results")
        except Exception as e:
            # If a batch fails entirely, mark all models in that batch as failed
            batch_duration = time.time() - batch_start
            print(f"Batch {batch_num} failed after {batch_duration:.2f}s with error: {e}")
            for model_id in batch:
                all_results[model_id] = f"Error: Batch processing failed - {str(e)}"

    total_duration = time.time() - start_time
    successful_count = sum(1 for result in all_results.values() if not result.startswith("Error:"))
    print(f"Total processing completed in {total_duration:.2f}s: {successful_count}/{len(model_list)} successful")

    return all_results


def test_connection_quality() -> Dict[str, Any]:
    """Test connection quality by making a quick API call"""
    test_model = "anthropic/claude-3-haiku"  # Fast, reliable model for testing
    test_prompt = "Hello"

    print("Testing connection quality...")
    start_time = time.time()

    try:
        response = client.chat.completions.create(
            model=test_model, messages=[{"role": "user", "content": test_prompt}], timeout=10  # Short timeout for connection test
        )

        end_time = time.time()
        response_time = end_time - start_time

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

        print(f"Connection test completed in {response_time:.2f}s - Quality: {quality}")

        return {"response_time": response_time, "quality": quality, "time_multiplier": multiplier, "success": True}

    except Exception as e:
        print(f"Connection test failed: {e}")
        return {"response_time": 0, "quality": "poor", "time_multiplier": 3.0, "success": False, "error": str(e)}
