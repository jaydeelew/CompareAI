import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# List of available models for your users (update as needed)
OPENROUTER_MODELS = [
    {"id": "openai/gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "description": "OpenAI's GPT-3.5 Turbo", "category": "Chat/Code"},
    {"id": "openai/gpt-4-turbo", "name": "GPT-4 Turbo", "description": "OpenAI's GPT-4 Turbo", "category": "Chat/Code"},
    {"id": "anthropic/claude-3-opus", "name": "Claude 3 Opus", "description": "Anthropic's Claude 3 Opus", "category": "Chat/Code"},
    {"id": "google/gemini-pro", "name": "Gemini Pro", "description": "Google's Gemini Pro", "category": "Chat/Code"},
]

client = OpenAI(
    api_key=OPENROUTER_API_KEY,
    base_url="https://openrouter.ai/api/v1"
)


def call_openrouter(prompt: str, model_id: str) -> str:
    response = client.chat.completions.create(
        model=model_id,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content


def run_models(prompt: str, model_list: list[str]) -> dict[str, str]:
    results = {}
    for model_id in model_list:
        try:
            results[model_id] = call_openrouter(prompt, model_id)
        except Exception as e:
            results[model_id] = f"Error: {str(e)}"
    return results

