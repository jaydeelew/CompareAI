import os
import requests

# List of model IDs to check
MODEL_IDS = [
    "EleutherAI/gpt-neo-125M",
    "EleutherAI/gpt-neo-1.3B",
    "bigscience/bloom-560m",
    "facebook/opt-1.3b",
    "bigcode/starcoder",
    "bigcode/santacoder",
    "tiiuae/falcon-7b-instruct",
    "microsoft/phi-2",
    "mistralai/Mistral-7B-Instruct-v0.2",
    "meta-llama/Llama-2-7b-hf",
]

HF_API_TOKEN = os.getenv("HF_API_TOKEN")

if not HF_API_TOKEN:
    print("Please set the HF_API_TOKEN environment variable.")
    exit(1)

headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}

for model_id in MODEL_IDS:
    url = f"https://api-inference.huggingface.co/models/{model_id}"
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            print(f"✅ {model_id} is available for Hosted inference API.")
        elif response.status_code == 503:
            print(f"⏳ {model_id} is loading (should be available soon).")
        elif response.status_code == 404:
            print(f"❌ {model_id} is NOT available for Hosted inference API.")
        elif response.status_code == 401:
            print(f"🔒 Unauthorized for {model_id} (check your token permissions).")
        else:
            print(f"⚠️  {model_id} returned status {response.status_code}: {response.text}")
    except Exception as e:
        print(f"❌ {model_id} check failed: {e}") 