#!/usr/bin/env python3
"""
Test script to check which Gemini 2.0 model IDs work on OpenRouter
"""
import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
client = OpenAI(api_key=OPENROUTER_API_KEY, base_url="https://openrouter.ai/api/v1")

# Test different Gemini 2.0 model IDs
test_model_ids = [
    "google/gemini-2.0-flash-exp",
    "google/gemini-2.0-flash-experimental", 
    "google/gemini-2.0-flash-thinking-exp",
    "google/gemini-2.0-flash",
    "google/gemini-exp-1206",
    "google/gemini-exp-1114",
    "google/gemini-2.0",
    "google/gemini-flash-2.0",
    "google/gemini-2.0-thinking"
]

def test_model(model_id):
    """Test if a model ID works"""
    try:
        response = client.chat.completions.create(
            model=model_id,
            messages=[{"role": "user", "content": "Hi"}],
            timeout=10,
            max_tokens=10
        )
        return True, "Success"
    except Exception as e:
        error_str = str(e).lower()
        if "not found" in error_str or "404" in error_str:
            return False, "Model not found"
        elif "rate limit" in error_str or "429" in error_str:
            return False, "Rate limited (model may exist)"
        elif "timeout" in error_str:
            return False, "Timeout (model may exist)"
        else:
            return False, f"Error: {str(e)[:100]}"

print("Testing Gemini 2.0 model IDs on OpenRouter...")
print("=" * 60)

working_models = []
for model_id in test_model_ids:
    print(f"Testing: {model_id:<35}", end=" ")
    success, message = test_model(model_id)
    
    if success:
        print("✅ WORKS")
        working_models.append(model_id)
    else:
        print(f"❌ {message}")

print("\n" + "=" * 60)
if working_models:
    print("Working Gemini 2.0 model IDs:")
    for model in working_models:
        print(f"  ✅ {model}")
else:
    print("❌ No working Gemini 2.0 model IDs found")
    print("\nThis could mean:")
    print("  - The model IDs have changed")
    print("  - The models are not available in your region")
    print("  - OpenRouter API key permissions")
    print("  - Models are temporarily unavailable")