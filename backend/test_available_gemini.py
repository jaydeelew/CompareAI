#!/usr/bin/env python3
"""
Test script to check available Google/Gemini models on OpenRouter
"""
import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
client = OpenAI(api_key=OPENROUTER_API_KEY, base_url="https://openrouter.ai/api/v1")

# Test currently available Gemini models
test_model_ids = [
    # Known working Gemini models
    "google/gemini-flash-1.5",
    "google/gemini-pro-1.5",
    "google/gemini-flash-1.5-8b",
    "google/gemini-flash-1.5-exp",
    "google/gemini-pro-1.5-exp",
    
    # Possible 2.0 variants
    "google/gemini-flash-2.0-exp",
    "google/gemini-pro-2.0",
    "google/gemini-pro-2.0-exp",
    "google/gemini-2.0-flash-thinking-experimental",
    "google/gemini-exp-1121",
    "google/gemini-exp-1206",
    
    # Alternative naming
    "gemini-2.0-flash-experimental",
    "gemini-flash-2.0",
    "google/gemini-2.0-experimental"
]

def test_model(model_id):
    """Test if a model ID works"""
    try:
        response = client.chat.completions.create(
            model=model_id,
            messages=[{"role": "user", "content": "Test"}],
            timeout=10,
            max_tokens=5
        )
        return True, "Success"
    except Exception as e:
        error_str = str(e).lower()
        if "not found" in error_str or "404" in error_str:
            return False, "Model not found"
        elif "rate limit" in error_str or "429" in error_str:
            return True, "Rate limited (model exists)"
        elif "timeout" in error_str:
            return True, "Timeout (model exists)"
        elif "400" in str(e) and "not a valid model" in str(e):
            return False, "Invalid model ID"
        else:
            return False, f"Error: {str(e)[:100]}"

print("Testing Google/Gemini models on OpenRouter...")
print("=" * 60)

working_models = []
for model_id in test_model_ids:
    print(f"Testing: {model_id:<40}", end=" ")
    success, message = test_model(model_id)
    
    if success:
        print("✅ AVAILABLE")
        working_models.append(model_id)
    else:
        print(f"❌ {message}")

print("\n" + "=" * 60)
if working_models:
    print("Available Gemini model IDs:")
    for model in working_models:
        print(f"  ✅ {model}")
else:
    print("❌ No working Gemini model IDs found")

print(f"\nTotal working models: {len(working_models)}")