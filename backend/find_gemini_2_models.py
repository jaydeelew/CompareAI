#!/usr/bin/env python3
"""
Comprehensive test to find working Gemini 2.0 model IDs on OpenRouter
"""
import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
client = OpenAI(api_key=OPENROUTER_API_KEY, base_url="https://openrouter.ai/api/v1")

# Comprehensive list of possible Gemini 2.0 model IDs
test_model_ids = [
    # Standard Gemini 2.0 variations
    "google/gemini-2.0",
    "google/gemini-2.0-flash",
    "google/gemini-2.0-pro",
    "google/gemini-2.0-ultra",
    
    # Experimental variations
    "google/gemini-2.0-experimental",
    "google/gemini-2.0-exp",
    "google/gemini-2.0-flash-exp",
    "google/gemini-2.0-pro-exp",
    
    # Thinking models
    "google/gemini-2.0-thinking",
    "google/gemini-2.0-flash-thinking",
    "google/gemini-2.0-pro-thinking",
    
    # Date-based experimental models
    "google/gemini-exp-1206",
    "google/gemini-exp-1219",
    "google/gemini-exp-1121",
    "google/gemini-exp-0827",
    
    # Alternative naming patterns
    "gemini-2.0-flash",
    "gemini-2.0-pro", 
    "gemini-2.0-experimental",
    
    # With version numbers
    "google/gemini-2.0.0",
    "google/gemini-2.0-v1",
    "google/gemini-2.0-latest",
    
    # Flash variations
    "google/gemini-flash-2.0",
    "google/gemini-pro-2.0",
    
    # Recent experimental models that might exist
    "google/gemini-2.0-flash-thinking-experimental-1219",
    "google/gemini-2.0-flash-experimental-1206",
    "google/gemini-2.0-thinking-experimental",
    
    # Alternative experimental naming
    "google/gemini-experimental-2.0",
    "google/gemini-preview-2.0",
    "google/gemini-beta-2.0",
    
    # Chat/instruct variants
    "google/gemini-2.0-chat",
    "google/gemini-2.0-instruct",
    "google/gemini-2.0-flash-instruct"
]

def test_model(model_id):
    """Test if a model ID works"""
    try:
        response = client.chat.completions.create(
            model=model_id,
            messages=[{"role": "user", "content": "Hi"}],
            timeout=15,
            max_tokens=5
        )
        return True, "✅ SUCCESS - Model works!"
    except Exception as e:
        error_str = str(e).lower()
        if "not found" in error_str or "404" in error_str:
            return False, "❌ Model not found"
        elif "rate limit" in error_str or "429" in error_str:
            return True, "🔄 Rate limited (model exists)"
        elif "timeout" in error_str:
            return True, "⏱️  Timeout (model likely exists)"
        elif "400" in str(e) and "not a valid model" in str(e):
            return False, "❌ Invalid model ID"
        elif "insufficient_quota" in error_str:
            return True, "💰 Quota exceeded (model exists)"
        elif "unauthorized" in error_str:
            return True, "🔐 Unauthorized (model exists, need permission)"
        else:
            return False, f"❌ Error: {str(e)[:80]}"

print("🔍 Comprehensive Gemini 2.0 Model ID Search")
print("=" * 80)
print(f"Testing {len(test_model_ids)} possible model IDs...\n")

working_models = []
likely_working = []

for i, model_id in enumerate(test_model_ids, 1):
    print(f"[{i:2d}/{len(test_model_ids)}] Testing: {model_id:<45}", end=" ")
    success, message = test_model(model_id)
    
    if success:
        if "SUCCESS" in message:
            working_models.append((model_id, message))
        else:
            likely_working.append((model_id, message))
    
    print(message)

print("\n" + "=" * 80)
print("📊 RESULTS SUMMARY")
print("=" * 80)

if working_models:
    print("🎉 CONFIRMED WORKING MODELS:")
    for model_id, status in working_models:
        print(f"  ✅ {model_id} - {status}")
else:
    print("❌ No confirmed working Gemini 2.0 models found")

if likely_working:
    print("\n🤔 LIKELY WORKING (but rate limited/auth issues):")
    for model_id, status in likely_working:
        print(f"  🔄 {model_id} - {status}")

print(f"\n📈 STATISTICS:")
print(f"  • Total tested: {len(test_model_ids)}")
print(f"  • Confirmed working: {len(working_models)}")
print(f"  • Likely working: {len(likely_working)}")
print(f"  • Failed/Invalid: {len(test_model_ids) - len(working_models) - len(likely_working)}")

if working_models or likely_working:
    print(f"\n🛠️  RECOMMENDED MODEL IDs TO ADD:")
    all_good_models = working_models + likely_working
    for model_id, status in all_good_models:
        print(f"  📝 \"{model_id}\"")
else:
    print(f"\n💡 SUGGESTIONS:")
    print(f"  • Gemini 2.0 models might not be available on OpenRouter yet")
    print(f"  • Check OpenRouter's model documentation for updates")
    print(f"  • Try again later as new models are added regularly")
    print(f"  • Verify your API key has access to experimental models")