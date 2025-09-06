import os
from openai import OpenAI
from dotenv import load_dotenv
import concurrent.futures

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# List of available models for users
OPENROUTER_MODELS = [
    {
        "id": "anthropic/claude-3-5-sonnet",
        "name": "Claude 3.5 Sonnet",
        "description": "Anthropic's highly capable model with excellent reasoning and writing abilities",
        "category": "Language",
    },
    {
        "id": "anthropic/claude-3.7-sonnet",
        "name": "Claude 3.7 Sonnet",
        "description": "Anthropic's earlier Sonnet model with reliable performance",
        "category": "Language",
    },
    {
        "id": "anthropic/claude-sonnet-4",
        "name": "Claude Sonnet 4",
        "description": "Anthropic's top-ranked model with exceptional performance and capability",
        "category": "Language",
    },
    {
        "id": "deepseek/deepseek-chat",
        "name": "DeepSeek Chat",
        "description": "DeepSeek's conversational model with strong reasoning capabilities",
        "category": "Language/Reasoning",
    },
    {
        "id": "deepseek/deepseek-r1",
        "name": "DeepSeek R1",
        "description": "DeepSeek's reasoning-focused model with enhanced analytical abilities",
        "category": "Language/Reasoning",
    },
    {
        "id": "google/gemini-2.0-flash-001",
        "name": "Gemini 2.0 Flash",
        "description": "Google's stable Gemini 2.0 model with reliable performance and speed",
        "category": "Language",
    },
    {
        "id": "google/gemini-2.5-flash",
        "name": "Gemini 2.5 Flash",
        "description": "Google's latest fast Gemini model optimized for speed and efficiency",
        "category": "Language",
    },
    {
        "id": "google/gemini-2.5-pro",
        "name": "Gemini 2.5 Pro",
        "description": "Google's most advanced Gemini 2.5 model with superior reasoning and capabilities",
        "category": "Language",
    },
    {
        "id": "meta-llama/llama-3.1-70b-instruct",
        "name": "Llama 3.1 70B Instruct",
        "description": "Meta's large language model optimized for text and code generation",
        "category": "Code/Language",
    },
    {
        "id": "meta-llama/llama-3.3-70b-instruct",
        "name": "Llama 3.3 70B Instruct",
        "description": "Meta's latest major release with significant improvements in text and code generation",
        "category": "Code/Language",
    },
    {
        "id": "meta-llama/llama-4-maverick",
        "name": "Llama 4 Maverick",
        "description": "Meta's latest flagship Llama 4 model with advanced reasoning and code capabilities",
        "category": "Code/Language",
    },
    {
        "id": "mistralai/mixtral-8x7b-instruct",
        "name": "Mixtral 8x7B Instruct",
        "description": "Mistral's mixture of experts model optimized for instruction following",
        "category": "Language/Reasoning",
    },
    {
        "id": "openai/gpt-4o",
        "name": "GPT-4o",
        "description": "OpenAI's latest multimodal model with enhanced reasoning and code capabilities",
        "category": "Language",
    },
    {
        "id": "openai/gpt-4o-mini",
        "name": "GPT-4o Mini",
        "description": "OpenAI's efficient model balancing performance and speed",
        "category": "Language",
    },
    {
        "id": "openai/gpt-4-turbo",
        "name": "GPT-4 Turbo",
        "description": "OpenAI's fast and efficient GPT-4 variant for complex reasoning tasks",
        "category": "Language",
    },
    {
        "id": "x-ai/grok-code-fast-1",
        "name": "Grok Code Fast 1",
        "description": "xAI's speedy model optimized for agentic coding and low cost",
        "category": "Code/Language",
    },
    {
        "id": "x-ai/grok-3",
        "name": "Grok 3",
        "description": "xAI's advanced Grok model with enhanced reasoning and text capabilities",
        "category": "Language",
    },
    {
        "id": "x-ai/grok-4",
        "name": "Grok 4",
        "description": "xAI's most intelligent model with native tool use and real-time search",
        "category": "Language",
    },
]

client = OpenAI(api_key=OPENROUTER_API_KEY, base_url="https://openrouter.ai/api/v1")


def call_openrouter(prompt: str, model_id: str) -> str:
    response = client.chat.completions.create(
        model=model_id,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content


def run_models(prompt: str, model_list: list[str]) -> dict[str, str]:
    results = {}

    def call(model_id):
        try:
            return model_id, call_openrouter(prompt, model_id)
        except Exception as e:
            return model_id, f"Error: {str(e)}"

    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = [executor.submit(call, model_id) for model_id in model_list]
        for future in concurrent.futures.as_completed(futures):
            model_id, result = future.result()
            results[model_id] = result

    return results
