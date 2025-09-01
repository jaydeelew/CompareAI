import os
from openai import OpenAI
from dotenv import load_dotenv
import concurrent.futures

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# List of available models for users
OPENROUTER_MODELS = [
    {
        "id": "anthropic/claude-sonnet-4",
        "name": "Claude Sonnet 4",
        "description": "Anthropic's top-ranked model with exceptional performance and capability",
        "category": "Language",
    },
    {
        "id": "anthropic/claude-3-5-sonnet",
        "name": "Claude 3.5 Sonnet",
        "description": "Anthropic's highly capable model with excellent reasoning and writing abilities",
        "category": "Language",
    },
    {
        "id": "openai/gpt-4o",
        "name": "GPT-4o",
        "description": "OpenAI's latest multimodal model with enhanced reasoning and code capabilities",
        "category": "Language",
    },
    {
        "id": "openai/gpt-4-turbo",
        "name": "GPT-4 Turbo",
        "description": "OpenAI's fast and efficient GPT-4 variant for complex reasoning tasks",
        "category": "Language",
    },
    {
        "id": "google/gemini-flash-1.5",
        "name": "Gemini 1.5 Flash",
        "description": "Google's fast and efficient model for quick responses and reasoning",
        "category": "Language",
    },
    {
        "id": "google/gemini-pro-1.5",
        "name": "Gemini 1.5 Pro",
        "description": "Google's advanced model with superior performance on complex tasks",
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
        "id": "meta-llama/llama-3.2-90b-vision-instruct",
        "name": "Llama 3.2 90B Vision",
        "description": "Meta's large multimodal model with vision and text capabilities",
        "category": "Language",
    },
    {
        "id": "mistralai/mixtral-8x7b-instruct",
        "name": "Mixtral 8x7B Instruct",
        "description": "Mistral's mixture of experts model optimized for instruction following",
        "category": "Language/Reasoning",
    },
    {
        "id": "anthropic/claude-3.7-sonnet",
        "name": "Claude 3.7 Sonnet",
        "description": "Anthropic's earlier Sonnet model with reliable performance",
        "category": "Language",
    },
    {
        "id": "openai/gpt-4o-mini",
        "name": "GPT-4o Mini",
        "description": "OpenAI's efficient model balancing performance and speed",
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
