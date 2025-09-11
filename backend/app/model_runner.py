import os
from openai import OpenAI
from dotenv import load_dotenv
import concurrent.futures

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# List of available models organized by providers
MODELS_BY_PROVIDER = {
    "Anthropic": [
        {
            "id": "anthropic/claude-3-haiku",
            "name": "Claude 3 Haiku",
            "description": "Anthropic's fast and efficient Claude 3 model for quick responses",
            "category": "Language",
            "provider": "Anthropic"
        },
        {
            "id": "anthropic/claude-3-opus",
            "name": "Claude 3 Opus (Generic)",
            "description": "Anthropic's Claude 3 Opus model with general availability",
            "category": "Language",
            "provider": "Anthropic"
        },
        {
            "id": "anthropic/claude-3-opus-20240229",
            "name": "Claude 3 Opus (Feb 29, 2024)",
            "description": "Anthropic's most powerful Claude 3 model with exceptional reasoning capabilities",
            "category": "Language",
            "provider": "Anthropic"
        },
        {
            "id": "anthropic/claude-3.5-haiku",
            "name": "Claude 3.5 Haiku (Generic)",
            "description": "Anthropic's Claude 3.5 Haiku model with general availability",
            "category": "Language",
            "provider": "Anthropic"
        },
        {
            "id": "anthropic/claude-3.5-haiku-20241022",
            "name": "Claude 3.5 Haiku (Oct 22, 2024)",
            "description": "Anthropic's fastest and most efficient Claude 3.5 model optimized for speed",
            "category": "Language",
            "provider": "Anthropic"
        },
        {
            "id": "anthropic/claude-3.5-sonnet",
            "name": "Claude 3.5 Sonnet (Generic)",
            "description": "Anthropic's Claude 3.5 Sonnet model with general availability",
            "category": "Language",
            "provider": "Anthropic"
        },
        {
            "id": "anthropic/claude-3.5-sonnet-20240620",
            "name": "Claude 3.5 Sonnet (Jun 20, 2024)",
            "description": "Anthropic's Claude 3.5 Sonnet model from June 2024 release",
            "category": "Language",
            "provider": "Anthropic"
        },
        {
            "id": "anthropic/claude-3.5-sonnet-20241022",
            "name": "Claude 3.5 Sonnet (Oct 22, 2024)",
            "description": "Anthropic's most advanced Claude 3.5 Sonnet model with enhanced capabilities",
            "category": "Language",
            "provider": "Anthropic"
        },
        {
            "id": "anthropic/claude-3.7-sonnet",
            "name": "Claude 3.7 Sonnet",
            "description": "Anthropic's Claude 3.7 Sonnet model with enhanced performance over Claude 3.5",
            "category": "Language",
            "provider": "Anthropic"
        },
        {
            "id": "anthropic/claude-sonnet-4",
            "name": "Claude 4 Sonnet",
            "description": "Anthropic's latest and most advanced Claude 4 model with exceptional capabilities",
            "category": "Language",
            "provider": "Anthropic"
        }
    ],
    "Cohere": [
        {
            "id": "cohere/command",
            "name": "Command",
            "description": "Cohere's foundational command model for instruction following",
            "category": "Language",
            "provider": "Cohere"
        },
        {
            "id": "cohere/command-r",
            "name": "Command R (Standard)",
            "description": "Cohere's proven command model for general language tasks",
            "category": "Language",
            "provider": "Cohere"
        },
        {
            "id": "cohere/command-r-08-2024",
            "name": "Command R (Aug 2024)",
            "description": "Cohere's latest command-optimized model for business and enterprise use",
            "category": "Language",
            "provider": "Cohere"
        },
        {
            "id": "cohere/command-r-plus-08-2024",
            "name": "Command R+ (Aug 2024)",
            "description": "Cohere's most powerful model with enhanced reasoning and instruction following",
            "category": "Language/Reasoning",
            "provider": "Cohere"
        },
        {
            "id": "cohere/command-r7b-12-2024",
            "name": "Command R7B (Dec 2024)",
            "description": "Cohere's latest compact model with excellent efficiency and performance",
            "category": "Language",
            "provider": "Cohere"
        }
    ],
    "DeepSeek": [
        {
            "id": "deepseek/deepseek-chat",
            "name": "DeepSeek Chat (Standard)",
            "description": "DeepSeek's proven conversational model with strong reasoning capabilities",
            "category": "Language/Reasoning",
            "provider": "DeepSeek"
        },
        {
            "id": "deepseek/deepseek-chat-v3.1",
            "name": "DeepSeek Chat V3.1",
            "description": "DeepSeek's most advanced conversational model with superior reasoning",
            "category": "Language/Reasoning",
            "provider": "DeepSeek"
        },
        {
            "id": "deepseek/deepseek-coder",
            "name": "DeepSeek Coder",
            "description": "DeepSeek's specialized model for code generation and programming tasks",
            "category": "Code",
            "provider": "DeepSeek"
        },
        {
            "id": "deepseek/deepseek-r1",
            "name": "DeepSeek R1",
            "description": "DeepSeek's latest reasoning model with advanced problem-solving capabilities",
            "category": "Reasoning",
            "provider": "DeepSeek"
        }
    ],
    "Google": [
        {
            "id": "google/gemini-flash-1.5",
            "name": "Gemini 1.5 Flash",
            "description": "Google's fast and efficient Gemini 1.5 model optimized for speed",
            "category": "Language",
            "provider": "Google"
        },
        {
            "id": "google/gemini-pro-1.5",
            "name": "Gemini 1.5 Pro",
            "description": "Google's advanced Gemini 1.5 model with superior reasoning",
            "category": "Language",
            "provider": "Google"
        },
        {
            "id": "google/gemini-2.0-flash-exp",
            "name": "Gemini 2.0 Flash Experimental",
            "description": "Google's cutting-edge experimental Gemini 2.0 model with latest capabilities",
            "category": "Language",
            "provider": "Google"
        },
        {
            "id": "google/gemini-2.5-flash",
            "name": "Gemini 2.5 Flash",
            "description": "Google's latest fast Gemini 2.5 model optimized for speed and efficiency",
            "category": "Language",
            "provider": "Google"
        },
        {
            "id": "google/gemini-2.5-pro",
            "name": "Gemini 2.5 Pro",
            "description": "Google's most advanced Gemini 2.5 model with superior reasoning and capabilities",
            "category": "Language",
            "provider": "Google"
        },
        {
            "id": "google/gemma-3-27b-it",
            "name": "Gemma 3 27B Instruct",
            "description": "Google's large Gemma 3 model optimized for instruction following",
            "category": "Language",
            "provider": "Google"
        }
    ],
    "Meta": [
        {
            "id": "meta-llama/llama-3.1-70b-instruct",
            "name": "Llama 3.1 70B Instruct",
            "description": "Meta's large language model optimized for text and code generation",
            "category": "Code/Language",
            "provider": "Meta"
        },
        {
            "id": "meta-llama/llama-3.1-405b-instruct",
            "name": "Llama 3.1 405B Instruct",
            "description": "Meta's largest and most capable model for complex reasoning and analysis",
            "category": "Language/Reasoning",
            "provider": "Meta"
        },
        {
            "id": "meta-llama/llama-3.2-3b-instruct",
            "name": "Llama 3.2 3B Instruct",
            "description": "Meta's compact model optimized for efficiency and fast responses",
            "category": "Language",
            "provider": "Meta"
        },
        {
            "id": "meta-llama/llama-3.3-70b-instruct",
            "name": "Llama 3.3 70B Instruct",
            "description": "Meta's latest major release with significant improvements in text and code generation",
            "category": "Code/Language",
            "provider": "Meta"
        },
        {
            "id": "meta-llama/llama-4-maverick",
            "name": "Llama 4 Maverick",
            "description": "Meta's latest flagship Llama 4 model with advanced reasoning and code capabilities",
            "category": "Code/Language",
            "provider": "Meta"
        },
        {
            "id": "meta-llama/llama-4-scout",
            "name": "Llama 4 Scout",
            "description": "Meta's optimized Llama 4 model for rapid deployment and efficient inference",
            "category": "Language",
            "provider": "Meta"
        }
    ],
    "Microsoft": [
        {
            "id": "microsoft/phi-3.5-mini-128k-instruct",
            "name": "Phi-3.5 Mini 128K",
            "description": "Microsoft's efficient model with extended context length for long documents",
            "category": "Language",
            "provider": "Microsoft"
        },
        {
            "id": "microsoft/phi-4",
            "name": "Phi 4",
            "description": "Microsoft's latest compact model with strong reasoning capabilities",
            "category": "Language/Reasoning",
            "provider": "Microsoft"
        },
        {
            "id": "microsoft/phi-4-reasoning-plus",
            "name": "Phi 4 Reasoning Plus",
            "description": "Microsoft's enhanced Phi 4 model optimized for complex reasoning tasks",
            "category": "Reasoning",
            "provider": "Microsoft"
        },
        {
            "id": "microsoft/wizardlm-2-8x22b",
            "name": "WizardLM-2 8x22B",
            "description": "Microsoft's powerful mixture of experts model for complex tasks",
            "category": "Language/Reasoning",
            "provider": "Microsoft"
        }
    ],
    "Mistral": [
        {
            "id": "mistralai/devstral-small-2505",
            "name": "Devstral Small 2505",
            "description": "Mistral's specialized model for development and coding tasks",
            "category": "Code",
            "provider": "Mistral"
        },
        {
            "id": "mistralai/mistral-large",
            "name": "Mistral Large",
            "description": "Mistral's most powerful model for complex reasoning and analysis",
            "category": "Language/Reasoning",
            "provider": "Mistral"
        },
        {
            "id": "mistralai/mistral-nemo",
            "name": "Mistral Nemo",
            "description": "Mistral's balanced model for general-purpose language tasks",
            "category": "Language",
            "provider": "Mistral"
        },
        {
            "id": "mistralai/mistral-small-3.2-24b-instruct",
            "name": "Mistral Small 3.2 24B",
            "description": "Mistral's latest efficient model with excellent performance-to-cost ratio",
            "category": "Language",
            "provider": "Mistral"
        },
        {
            "id": "mistralai/mixtral-8x7b-instruct",
            "name": "Mixtral 8x7B Instruct",
            "description": "Mistral's mixture of experts model optimized for instruction following",
            "category": "Language/Reasoning",
            "provider": "Mistral"
        }
    ],
    "OpenAI": [
        {
            "id": "openai/gpt-4-turbo",
            "name": "GPT-4 Turbo",
            "description": "OpenAI's fast and efficient GPT-4 variant for complex reasoning tasks",
            "category": "Language",
            "provider": "OpenAI"
        },
        {
            "id": "openai/gpt-4o",
            "name": "GPT-4o (Standard)",
            "description": "OpenAI's latest multimodal model with enhanced reasoning and code capabilities",
            "category": "Language",
            "provider": "OpenAI"
        },
        {
            "id": "openai/gpt-4o-2024-11-20",
            "name": "GPT-4o (Nov 20, 2024)",
            "description": "OpenAI's most advanced GPT-4o model with enhanced capabilities",
            "category": "Language",
            "provider": "OpenAI"
        },
        {
            "id": "openai/gpt-4o-mini",
            "name": "GPT-4o Mini",
            "description": "OpenAI's efficient and fast GPT-4o model optimized for speed",
            "category": "Language", 
            "provider": "OpenAI"
        },
        {
            "id": "openai/o1-mini",
            "name": "o1-mini",
            "description": "OpenAI's efficient reasoning model for faster complex problem solving",
            "category": "Reasoning",
            "provider": "OpenAI"
        },
        {
            "id": "openai/o1-preview",
            "name": "o1-preview",
            "description": "OpenAI's reasoning model designed for complex problem-solving tasks",
            "category": "Reasoning",
            "provider": "OpenAI"
        }
    ],
    "Qwen": [
        {
            "id": "qwen/qwen3-14b",
            "name": "Qwen3 14B",
            "description": "Qwen's balanced model offering good performance for general tasks",
            "category": "Language",
            "provider": "Qwen"
        },
        {
            "id": "qwen/qwen3-235b-a22b",
            "name": "Qwen3 235B A22B",
            "description": "Qwen's flagship large language model with exceptional capabilities",
            "category": "Language",
            "provider": "Qwen"
        },
        {
            "id": "qwen/qwen3-coder",
            "name": "Qwen3 Coder 480B",
            "description": "Qwen's specialized large model for code generation and programming",
            "category": "Code",
            "provider": "Qwen"
        },
        {
            "id": "qwen/qwq-32b",
            "name": "QwQ 32B",
            "description": "Qwen's reasoning-focused model optimized for complex problem solving",
            "category": "Reasoning",
            "provider": "Qwen"
        }
    ],
    "xAI": [
        {
            "id": "x-ai/grok-3",
            "name": "Grok 3",
            "description": "xAI's advanced Grok model with enhanced reasoning and text capabilities",
            "category": "Language",
            "provider": "xAI"
        },
        {
            "id": "x-ai/grok-4",
            "name": "Grok 4",
            "description": "xAI's most intelligent model with native tool use and real-time search",
            "category": "Language",
            "provider": "xAI"
        },
        {
            "id": "x-ai/grok-code-fast-1",
            "name": "Grok Code Fast 1",
            "description": "xAI's speedy model optimized for agentic coding and low cost",
            "category": "Code/Language",
            "provider": "xAI"
        }
    ]
}

# Flatten the models for backward compatibility
OPENROUTER_MODELS = []
for provider, models in MODELS_BY_PROVIDER.items():
    OPENROUTER_MODELS.extend(models)

client = OpenAI(api_key=OPENROUTER_API_KEY, base_url="https://openrouter.ai/api/v1")


def call_openrouter(prompt: str, model_id: str) -> str:
    response = client.chat.completions.create(
        model=model_id,
        messages=[{"role": "user", "content": prompt}],
    )
    content = response.choices[0].message.content
    return content if content is not None else "No response generated"


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
