#!/usr/bin/env python3
"""
Get the official list of available models from OpenRouter API
"""
import os
import requests
from dotenv import load_dotenv
import json

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

def get_openrouter_models():
    """Get the official list of models from OpenRouter"""
    try:
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }
        
        response = requests.get("https://openrouter.ai/api/v1/models", headers=headers, timeout=30)
        
        if response.status_code == 200:
            return response.json()
        else:
            print(f"❌ Error fetching models: {response.status_code}")
            print(f"Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Exception: {e}")
        return None

print("📋 Fetching official OpenRouter model list...")
print("=" * 80)

models_data = get_openrouter_models()

if models_data and 'data' in models_data:
    models = models_data['data']
    print(f"✅ Found {len(models)} total models")
    
    # Filter for Gemini models
    gemini_models = [model for model in models if 'gemini' in model['id'].lower()]
    
    print(f"\n🔍 Found {len(gemini_models)} Gemini models:")
    print("-" * 80)
    
    for model in sorted(gemini_models, key=lambda x: x['id']):
        model_id = model['id']
        name = model.get('name', 'No name')
        description = model.get('description', 'No description')
        
        print(f"📝 ID: {model_id}")
        print(f"   Name: {name}")
        print(f"   Description: {description[:100]}{'...' if len(description) > 100 else ''}")
        print()
    
    # Look specifically for any 2.0 models
    gemini_2_models = [model for model in models if '2.0' in model['id'] or '2.0' in model.get('name', '')]
    
    if gemini_2_models:
        print(f"\n🎯 Found {len(gemini_2_models)} Gemini 2.0 models:")
        print("-" * 80)
        for model in gemini_2_models:
            print(f"✅ {model['id']} - {model.get('name', 'No name')}")
    else:
        print(f"\n❌ No Gemini 2.0 models found in official list")
        
    # Look for experimental models
    experimental_models = [model for model in models if any(keyword in model['id'].lower() or keyword in model.get('name', '').lower() 
                                                          for keyword in ['exp', 'experimental', 'preview', 'beta', 'thinking'])]
    
    if experimental_models:
        print(f"\n🧪 Found {len(experimental_models)} experimental/preview models:")
        print("-" * 80)
        for model in experimental_models[:10]:  # Show first 10
            print(f"🔬 {model['id']} - {model.get('name', 'No name')}")
        if len(experimental_models) > 10:
            print(f"... and {len(experimental_models) - 10} more")
    
    # Save full list to file for reference
    with open('/app/openrouter_models.json', 'w') as f:
        json.dump(models_data, f, indent=2)
    print(f"\n💾 Full model list saved to openrouter_models.json")
    
else:
    print("❌ Failed to fetch models from OpenRouter API")
    print("This could be due to:")
    print("  • API key issues")
    print("  • Network connectivity")
    print("  • OpenRouter API temporarily unavailable")