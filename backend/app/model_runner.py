import os
from openai import OpenAI
from dotenv import load_dotenv
import concurrent.futures

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# List of available models for users
OPENROUTER_MODELS = [
    {
        "id": "openai/gpt-4-turbo",
        "name": "GPT-4 Turbo",
        "description": "OpenAI's GPT-4 Turbo",
        "category": "Chat/Code",
    },
    {
        "id": "anthropic/claude-3-opus",
        "name": "Claude 3 Opus",
        "description": "Anthropic's Claude 3 Opus",
        "category": "Chat/Code",
    },
    {
        "id": "deepseek/deepseek-chat-v3-0324:free",
        "name": "DeepSeek Chat V3 (Free)",
        "description": "DeepSeek Chat V3 (Free Tier)",
        "category": "Vision/Language",
    },
    {
        "id": "anthropic/claude-3-sonnet-20240229",
        "name": "Claude 3.5 Sonnet",
        "description": "Anthropic's Claude 3.5 Sonnet (2024-02-29)",
        "category": "Chat/Code",
    },
    {
        "id": "anthropic/claude-3.7-sonnet",
        "name": "Claude 3.7 Sonnet",
        "description": "Anthropic's Claude 3.7 Sonnet",
        "category": "Chat/Code",
    },
    {
        "id": "anthropic/claude-sonnet-4",
        "name": "Claude Sonnet 4",
        "description": "Anthropic's Claude Sonnet 4",
        "category": "Chat/Code",
    },
    {
        "id": "openai/gpt-4o",
        "name": "GPT-4o",
        "description": "OpenAI's GPT-4o (4.1)",
        "category": "Chat/Code",
    },
    {
        "id": "deepseek/deepseek-r1:free",
        "name": "DeepSeek R1 (Free)",
        "description": "DeepSeek R1 (Free Tier)",
        "category": "Language/Reasoning",
    },
    {
        "id": "google/gemini-2.5-pro",
        "name": "Gemini 2.5 Pro",
        "description": "Google's Gemini 2.5 Pro",
        "category": "Chat/Code",
    },
    {
        "id": "google/gemini-2.0-flash-lite-001",
        "name": "Gemini 2.0 Flash Lite",
        "description": "Google's Gemini 2.0 Flash Lite (001)",
        "category": "Chat/Code",
    },
    {
        "id": "google/gemini-2.0-flash-001",
        "name": "Gemini 2.0 Flash",
        "description": "Google's Gemini 2.0 Flash (001)",
        "category": "Chat/Code",
    },
    {
        "id": "google/gemini-2.0-flash-exp:free",
        "name": "Gemini 2.0 Flash Exp (Free)",
        "description": "Google's Gemini 2.0 Flash Exp (Free Tier)",
        "category": "Chat/Code",
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
