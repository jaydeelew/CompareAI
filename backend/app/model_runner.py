import os
from openai import OpenAI
from dotenv import load_dotenv
import concurrent.futures
from typing import Dict, List, Any
import time
import re

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# Configuration optimized for 12-model limit
MAX_CONCURRENT_REQUESTS = 12  # Perfect match for 12-model limit
INDIVIDUAL_MODEL_TIMEOUT = 120  # Increased timeout for very long, detailed responses
BATCH_SIZE = 12  # Process all 12 models in single batch for optimal performance

# Connection quality optimizations
# For slower connections, you may want to reduce MAX_CONCURRENT_REQUESTS to 6-8
# and increase INDIVIDUAL_MODEL_TIMEOUT to 60-90 seconds

# List of available models organized by providers
MODELS_BY_PROVIDER = {
    "Anthropic": [
        {
            "id": "anthropic/claude-3-haiku",
            "name": "Claude 3 Haiku",
            "description": "Anthropic's fast and efficient Claude 3 model for quick responses",
            "category": "Language",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-3-opus",
            "name": "Claude 3 Opus (Generic)",
            "description": "Anthropic's Claude 3 Opus model with general availability",
            "category": "Language",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-3-opus-20240229",
            "name": "Claude 3 Opus",
            "description": "Anthropic's most powerful Claude 3 model with exceptional reasoning capabilities",
            "category": "Language",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-3.5-haiku",
            "name": "Claude 3.5 Haiku (Generic)",
            "description": "Anthropic's Claude 3.5 Haiku model with general availability",
            "category": "Language",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-3.5-haiku-20241022",
            "name": "Claude 3.5 Haiku",
            "description": "Anthropic's fastest and most efficient Claude 3.5 model optimized for speed",
            "category": "Language",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-3.5-sonnet",
            "name": "Claude 3.5 Sonnet (Generic)",
            "description": "Anthropic's Claude 3.5 Sonnet model with general availability",
            "category": "Language",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-3.5-sonnet-20240620",
            "name": "Claude 3.5 Sonnet",
            "description": "Anthropic's Claude 3.5 Sonnet model from June 2024 release",
            "category": "Language",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-3.5-sonnet-20241022",
            "name": "Claude 3.5 Sonnet",
            "description": "Anthropic's most advanced Claude 3.5 Sonnet model with enhanced capabilities",
            "category": "Language",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-3.7-sonnet",
            "name": "Claude 3.7 Sonnet",
            "description": "Anthropic's Claude 3.7 Sonnet model with enhanced performance over Claude 3.5",
            "category": "Language",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-sonnet-4",
            "name": "Claude 4 Sonnet",
            "description": "Anthropic's latest and most advanced Claude 4 model with exceptional capabilities",
            "category": "Language",
            "provider": "Anthropic",
        },
    ],
    "Cohere": [
        {
            "id": "cohere/command-r7b-12-2024",
            "name": "Command R7B",
            "description": "Cohere's latest compact model with excellent efficiency and performance",
            "category": "Language",
            "provider": "Cohere",
        },
        {
            "id": "cohere/command-r-08-2024",
            "name": "Command R",
            "description": "Cohere's latest command model with enhanced capabilities for general tasks",
            "category": "Language",
            "provider": "Cohere",
        },
        {
            "id": "cohere/command-r-plus-08-2024",
            "name": "Command R+",
            "description": "Cohere's most powerful model with enhanced reasoning and instruction following",
            "category": "Language/Reasoning",
            "provider": "Cohere",
        },
    ],
    "DeepSeek": [
        {
            "id": "deepseek/deepseek-chat",
            "name": "DeepSeek Chat",
            "description": "DeepSeek's proven conversational model with strong reasoning capabilities",
            "category": "Language/Reasoning",
            "provider": "DeepSeek",
        },
        {
            "id": "deepseek/deepseek-chat-v3.1",
            "name": "DeepSeek Chat V3.1",
            "description": "DeepSeek's most advanced conversational model with superior reasoning",
            "category": "Language/Reasoning",
            "provider": "DeepSeek",
        },
        {
            "id": "deepseek/deepseek-r1",
            "name": "DeepSeek R1",
            "description": "DeepSeek's latest reasoning model with advanced problem-solving capabilities",
            "category": "Reasoning",
            "provider": "DeepSeek",
        },
    ],
    "Google": [
        {
            "id": "google/gemini-flash-1.5",
            "name": "Gemini 1.5 Flash",
            "description": "Google's fast and efficient Gemini 1.5 model optimized for speed",
            "category": "Language",
            "provider": "Google",
        },
        {
            "id": "google/gemini-pro-1.5",
            "name": "Gemini 1.5 Pro",
            "description": "Google's advanced Gemini 1.5 model with superior reasoning",
            "category": "Language",
            "provider": "Google",
        },
        {
            "id": "google/gemini-flash-1.5-8b",
            "name": "Gemini 1.5 Flash 8B",
            "description": "Google's compact and efficient Gemini 1.5 model with 8B parameters",
            "category": "Language",
            "provider": "Google",
        },
        {
            "id": "google/gemini-2.0-flash-001",
            "name": "Gemini 2.0 Flash",
            "description": "Google's latest Gemini 2.0 Flash with significantly faster time to first token",
            "category": "Language",
            "provider": "Google",
        },
        {
            "id": "google/gemini-2.0-flash-lite-001",
            "name": "Gemini 2.0 Flash Lite",
            "description": "Google's lightweight Gemini 2.0 Flash model optimized for speed",
            "category": "Language",
            "provider": "Google",
        },
        {
            "id": "google/gemini-2.5-flash",
            "name": "Gemini 2.5 Flash",
            "description": "Google's latest fast Gemini 2.5 model optimized for speed and efficiency",
            "category": "Language",
            "provider": "Google",
        },
        {
            "id": "google/gemini-2.5-pro",
            "name": "Gemini 2.5 Pro",
            "description": "Google's most advanced Gemini 2.5 model with superior reasoning and capabilities",
            "category": "Language",
            "provider": "Google",
        },
        {
            "id": "google/gemma-3-27b-it",
            "name": "Gemma 3 27B Instruct",
            "description": "Google's large Gemma 3 model optimized for instruction following",
            "category": "Language",
            "provider": "Google",
        },
    ],
    "Meta": [
        {
            "id": "meta-llama/llama-3.1-70b-instruct",
            "name": "Llama 3.1 70B Instruct",
            "description": "Meta's large language model optimized for text and code generation",
            "category": "Code/Language",
            "provider": "Meta",
        },
        {
            "id": "meta-llama/llama-3.1-405b-instruct",
            "name": "Llama 3.1 405B Instruct",
            "description": "Meta's largest and most capable model for complex reasoning and analysis",
            "category": "Language/Reasoning",
            "provider": "Meta",
        },
        {
            "id": "meta-llama/llama-3.2-3b-instruct",
            "name": "Llama 3.2 3B Instruct",
            "description": "Meta's compact model optimized for efficiency and fast responses",
            "category": "Language",
            "provider": "Meta",
        },
        {
            "id": "meta-llama/llama-3.3-70b-instruct",
            "name": "Llama 3.3 70B Instruct",
            "description": "Meta's latest major release with significant improvements in text and code generation",
            "category": "Code/Language",
            "provider": "Meta",
        },
        {
            "id": "meta-llama/llama-4-maverick",
            "name": "Llama 4 Maverick",
            "description": "Meta's latest flagship Llama 4 model with advanced reasoning and code capabilities",
            "category": "Code/Language",
            "provider": "Meta",
        },
        {
            "id": "meta-llama/llama-4-scout",
            "name": "Llama 4 Scout",
            "description": "Meta's optimized Llama 4 model for rapid deployment and efficient inference",
            "category": "Language",
            "provider": "Meta",
        },
    ],
    "Microsoft": [
        {
            "id": "microsoft/phi-3.5-mini-128k-instruct",
            "name": "Phi-3.5 Mini 128K",
            "description": "Microsoft's efficient model with extended context length for long documents",
            "category": "Language",
            "provider": "Microsoft",
        },
        {
            "id": "microsoft/phi-4",
            "name": "Phi 4",
            "description": "Microsoft's latest compact model with strong reasoning capabilities",
            "category": "Language/Reasoning",
            "provider": "Microsoft",
        },
        {
            "id": "microsoft/phi-4-reasoning-plus",
            "name": "Phi 4 Reasoning Plus",
            "description": "Microsoft's enhanced Phi 4 model optimized for complex reasoning tasks",
            "category": "Reasoning",
            "provider": "Microsoft",
        },
        {
            "id": "microsoft/wizardlm-2-8x22b",
            "name": "WizardLM-2 8x22B",
            "description": "Microsoft's powerful mixture of experts model for complex tasks",
            "category": "Language/Reasoning",
            "provider": "Microsoft",
        },
    ],
    "Mistral": [
        {
            "id": "mistralai/devstral-small-2505",
            "name": "Devstral Small 2505",
            "description": "Mistral's specialized model for development and coding tasks",
            "category": "Code",
            "provider": "Mistral",
        },
        {
            "id": "mistralai/mistral-large",
            "name": "Mistral Large",
            "description": "Mistral's most powerful model for complex reasoning and analysis",
            "category": "Language/Reasoning",
            "provider": "Mistral",
        },
        {
            "id": "mistralai/mistral-nemo",
            "name": "Mistral Nemo",
            "description": "Mistral's balanced model for general-purpose language tasks",
            "category": "Language",
            "provider": "Mistral",
        },
        {
            "id": "mistralai/mistral-small-3.2-24b-instruct",
            "name": "Mistral Small 3.2 24B",
            "description": "Mistral's latest efficient model with excellent performance-to-cost ratio",
            "category": "Language",
            "provider": "Mistral",
        },
        {
            "id": "mistralai/mixtral-8x7b-instruct",
            "name": "Mixtral 8x7B Instruct",
            "description": "Mistral's mixture of experts model optimized for instruction following",
            "category": "Language/Reasoning",
            "provider": "Mistral",
        },
    ],
    "OpenAI": [
        {
            "id": "openai/o1",
            "name": "o1",
            "description": "OpenAI's latest reasoning model designed to think before responding",
            "category": "Reasoning",
            "provider": "OpenAI",
        },
        {
            "id": "openai/o1-mini",
            "name": "o1-mini",
            "description": "OpenAI's efficient reasoning model for faster complex problem solving",
            "category": "Reasoning",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-4o-2024-11-20",
            "name": "GPT-4o",
            "description": "OpenAI's most advanced GPT-4o model with enhanced capabilities",
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-4o-mini",
            "name": "GPT-4o Mini",
            "description": "OpenAI's efficient and fast GPT-4o model optimized for speed",
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-4-turbo",
            "name": "GPT-4 Turbo",
            "description": "OpenAI's fast and efficient GPT-4 variant for complex reasoning tasks",
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-4o",
            "name": "GPT-4o",
            "description": "OpenAI's latest multimodal model with enhanced reasoning and code capabilities",
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-5",
            "name": "GPT-5",
            "description": "OpenAI's most advanced model, offering major improvements in reasoning, code quality, and user experience",
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-5-mini",
            "name": "GPT-5 Mini",
            "description": "GPT-5 Mini is a compact version of GPT-5, designed to handle lighter-weight reasoning tasks with reduced latency and cost",
            "category": "Language",
            "provider": "OpenAI",
        },
    ],
    "Qwen": [
        {
            "id": "qwen/qwen3-14b",
            "name": "Qwen3 14B",
            "description": "Qwen's balanced model offering good performance for general tasks",
            "category": "Language",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-235b-a22b",
            "name": "Qwen3 235B A22B",
            "description": "Qwen's flagship large language model with exceptional capabilities",
            "category": "Language",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-coder",
            "name": "Qwen3 Coder 480B",
            "description": "Qwen's specialized large model for code generation and programming",
            "category": "Code",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwq-32b",
            "name": "QwQ 32B",
            "description": "Qwen's reasoning-focused model optimized for complex problem solving",
            "category": "Reasoning",
            "provider": "Qwen",
        },
    ],
    "xAI": [
        {
            "id": "x-ai/grok-3",
            "name": "Grok 3",
            "description": "xAI's advanced Grok model with enhanced reasoning and text capabilities",
            "category": "Language",
            "provider": "xAI",
        },
        {
            "id": "x-ai/grok-4",
            "name": "Grok 4",
            "description": "xAI's most intelligent model with native tool use and real-time search",
            "category": "Language",
            "provider": "xAI",
        },
        {
            "id": "x-ai/grok-code-fast-1",
            "name": "Grok Code Fast 1",
            "description": "xAI's speedy model optimized for agentic coding and low cost",
            "category": "Code/Language",
            "provider": "xAI",
        },
    ],
}

# Flatten the models for backward compatibility
OPENROUTER_MODELS = []
for provider, models in MODELS_BY_PROVIDER.items():
    OPENROUTER_MODELS.extend(models)

client = OpenAI(api_key=OPENROUTER_API_KEY, base_url="https://openrouter.ai/api/v1")


def clean_model_response(text: str) -> str:
    """
    Clean up model responses by removing MathML tags, namespace references,
    and other unwanted markup that shouldn't be displayed to users.
    """
    if not text:
        return text
    
    # Check if text contains w3.org before cleaning (for debugging)
    has_w3org_before = 'w3.org' in text.lower()
    
    # Remove complete MathML elements
    text = re.sub(r'<math[^>]*>[\s\S]*?</math>', '', text, flags=re.IGNORECASE)
    
    # Remove inline style attributes that models sometimes add
    # This catches patterns like: style="color:#cc0000">box
    text = re.sub(r'style\s*=\s*["\'][^"\']*["\']>\s*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'style\s*=\s*["\'][^"\']*["\']', '', text, flags=re.IGNORECASE)
    
    # Remove any remaining HTML-style attributes with closing brackets
    text = re.sub(r'\s*class\s*=\s*["\'][^"\']*["\']>\s*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\s*id\s*=\s*["\'][^"\']*["\']>\s*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\s*class\s*=\s*["\'][^"\']*["\']', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\s*id\s*=\s*["\'][^"\']*["\']', '', text, flags=re.IGNORECASE)
    
    # NUCLEAR OPTION: Remove the URL and everything that looks like markup/attributes around it
    # Matches patterns like:
    # - //www.w3.org/1998/Math/MathML">+1 +1+1
    # - //www.w3.org/1998/Math/MathML" display="block">000
    # - //www.w3.org/1998/Math/MathML">x=0x = 0x
    
    # Remove the URL with any attributes and the closing >
    text = re.sub(r'//www\.w3\.org/1998/Math/MathML[^>]*>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'https?://www\.w3\.org/1998/Math/MathML[^>]*>', '', text, flags=re.IGNORECASE)
    
    # Remove any remaining URL fragments with quotes and attributes
    text = re.sub(r'//www\.w3\.org/1998/Math/MathML["\'][^>]*>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'https?://www\.w3\.org/1998/Math/MathML["\'][^>]*>', '', text, flags=re.IGNORECASE)
    
    # Remove just the URL itself if it appears standalone
    text = re.sub(r'//www\.w3\.org/1998/Math/MathML', '', text, flags=re.IGNORECASE)
    text = re.sub(r'https?://www\.w3\.org/1998/Math/MathML', '', text, flags=re.IGNORECASE)
    
    # Remove www.w3.org references without protocol
    text = re.sub(r'www\.w3\.org/1998/Math/MathML[^>]*>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'www\.w3\.org/1998/Math/MathML', '', text, flags=re.IGNORECASE)
    
    # Remove any xmlns attributes
    text = re.sub(r'xmlns\s*=\s*["\']https?://www\.w3\.org/1998/Math/MathML["\']', '', text, flags=re.IGNORECASE)
    
    # Remove any display attributes that are left over
    text = re.sub(r'display\s*=\s*["\']block["\']\s*>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'display\s*=\s*["\']inline["\']\s*>', '', text, flags=re.IGNORECASE)
    
    # Remove all MathML tags while preserving content
    mathml_tags = [
        'math', 'mrow', 'mi', 'mn', 'mo', 'msup', 'msub', 'mfrac', 
        'mfenced', 'mtext', 'mspace', 'msubsup', 'msqrt', 'mroot',
        'mstyle', 'mtable', 'mtr', 'mtd', 'mover', 'munder', 
        'munderover', 'semantics', 'annotation'
    ]
    for tag in mathml_tags:
        text = re.sub(f'</?{tag}[^>]*>', '', text, flags=re.IGNORECASE)
    
    # Don't filter out entire lines - that removes valid content
    # Instead, rely on the regex replacements above to remove just the MathML URLs
    
    # Clean up extra whitespace that may have been left behind
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' {2,}', ' ', text)
    
    # NUCLEAR OPTION: Complete elimination of unwanted escape sequences
    # This is a comprehensive overhaul to fix the persistent escape sequence problem
    
    # Step 1: Remove ALL backslash-space patterns first
    text = re.sub(r'\\\s+', ' ', text)
    
    # Step 2: Remove backslashes before ANY mathematical content
    # This catches patterns like \ f(x), \ x³, \ n, \ -x², \ 1, \ f'(x), etc.
    
    # Remove backslashes before function calls (with or without spaces)
    text = re.sub(r'\\(\s*f\()', r'\1', text)  # \ f( -> f(
    text = re.sub(r'\\(\s*f\'\()', r'\1', text)  # \ f'( -> f'(
    text = re.sub(r'\\(\s*[a-zA-Z]+\()', r'\1', text)  # \ func( -> func(
    
    # Remove backslashes before variables and mathematical terms
    text = re.sub(r'\\(\s*[a-zA-Z]+)', r'\1', text)  # \ x -> x, \ n -> n, \ a -> a
    
    # Remove backslashes before numbers and coefficients
    text = re.sub(r'\\(\s*[+-]?[0-9]+)', r'\1', text)  # \ 1 -> 1, \ -2 -> -2, \ 3 -> 3
    
    # Remove backslashes before mathematical expressions with superscripts
    text = re.sub(r'\\(\s*[0-9]+[²³⁴⁵⁶⁷⁸⁹⁰¹])', r'\1', text)  # \ 2³ -> 2³
    text = re.sub(r'\\(\s*[a-zA-Z]+[²³⁴⁵⁶⁷⁸⁹⁰¹])', r'\1', text)  # \ x² -> x²
    
    # Remove backslashes before coefficients and variables
    text = re.sub(r'\\(\s*[0-9]+[a-zA-Z])', r'\1', text)  # \ 3x -> 3x
    text = re.sub(r'\\(\s*[a-zA-Z]+[0-9])', r'\1', text)  # \ ax -> ax
    
    # Remove backslashes before mathematical operations
    text = re.sub(r'\\(\s*[+-])', r'\1', text)  # \ + -> +, \ - -> -
    text = re.sub(r'\\(\s*[=+\-*/])', r'\1', text)  # \ = -> =, \ * -> *
    
    # Step 3: Remove backslashes before complex mathematical expressions
    # Handle patterns like \ a cdot n cdot xⁿ⁻¹, \ 1 cdot x³, etc.
    text = re.sub(r'\\(\s*[0-9]+\s*cdot)', r'\1', text)  # \ 1 cdot -> 1 cdot
    text = re.sub(r'\\(\s*[a-zA-Z]+\s*cdot)', r'\1', text)  # \ a cdot -> a cdot
    text = re.sub(r'\\(\s*cdot)', r'\1', text)  # \ cdot -> cdot
    
    # Handle patterns like \ n cdot xⁿ⁻¹
    text = re.sub(r'\\(\s*[a-zA-Z]+\s*[a-zA-Z]+\s*[a-zA-Z]+)', r'\1', text)  # \ n cdot x -> n cdot x
    
    # Step 4: Remove backslashes before parentheses and brackets
    text = re.sub(r'\\(\s*[\(\)\[\]])', r'\1', text)  # \ ( -> (, \ ) -> )
    
    # Step 5: Remove backslashes before any remaining mathematical symbols
    text = re.sub(r'\\(\s*[ⁿ⁻¹²³⁴⁵⁶⁷⁸⁹⁰¹])', r'\1', text)  # \ ⁿ -> ⁿ, \ ⁻¹ -> ⁻¹
    
    # Step 6: Final comprehensive cleanup - remove ANY backslash followed by space or common characters
    text = re.sub(r'\\(\s*[a-zA-Z0-9])', r'\1', text)  # \ char -> char
    text = re.sub(r'\\(\s*[+-])', r'\1', text)  # \ +/- -> +/-
    
    # Step 7: Remove any remaining standalone backslashes that aren't part of LaTeX commands
    # Only preserve backslashes that are part of legitimate LaTeX commands
    text = re.sub(r'\\(?=\s|$|[^a-zA-Z()[\]{}])', '', text)
    
    # Step 8: Final cleanup for any remaining backslash-space patterns
    text = re.sub(r'\\\s+', ' ', text)
    
    # Check if cleaning worked (for debugging)
    has_w3org_after = 'w3.org' in text.lower()
    if has_w3org_before:
        if has_w3org_after:
            print(f"⚠️ WARNING: MathML cleanup failed - w3.org still present in response")
            print(f"Sample: {text[:200]}...")
        else:
            print(f"✅ Successfully cleaned MathML references from response")
    
    return text.strip()


def call_openrouter(prompt: str, model_id: str, conversation_history: list = None) -> str:
    try:
        # Build messages array - use standard format like official AI providers
        messages = []
        
        # Add a minimal system message only to encourage complete thoughts
        # This doesn't force verbosity, just ensures completion
        if not conversation_history:
            messages.append({
                "role": "system", 
                "content": "Provide complete responses. Finish your thoughts and explanations fully."
            })

        # Add conversation history if provided (include both user and assistant messages)
        if conversation_history:
            for msg in conversation_history:
                messages.append({"role": msg.role, "content": msg.content})

        # Add the current prompt as user message
        messages.append({"role": "user", "content": prompt})

        # Don't set max_tokens - let each model use its natural maximum output length
        # This allows models to complete their thoughts without artificial truncation
        response = client.chat.completions.create(
            model=model_id, 
            messages=messages, 
            timeout=INDIVIDUAL_MODEL_TIMEOUT
            # No max_tokens parameter - models will use their default maximum
        )
        content = response.choices[0].message.content
        finish_reason = response.choices[0].finish_reason
        
        # Log finish reason for debugging
        model_name = model_id.split('/')[-1]
        print(f"Model {model_name}: finish_reason='{finish_reason}', length={len(content) if content else 0} chars")
        
        # Detect incomplete responses heuristically
        incomplete_indicators = [
            'Therefore:',
            'In conclusion:',
            'Finally:',
            'Thus:',
            'So:',
            'Hence:',
            'Now,',
            'Next,',
            'Then,',
            'Adding these',
            'Combining',
            'Putting it all together',
        ]
        
        is_likely_incomplete = False
        if content:
            last_30_chars = content.strip()[-30:] if len(content.strip()) > 30 else content.strip()
            for indicator in incomplete_indicators:
                if last_30_chars.endswith(indicator) or last_30_chars.endswith(indicator.lower()):
                    is_likely_incomplete = True
                    break
        
        # Detect and warn about incomplete responses
        if finish_reason == "length":
            # Model hit token limit - response was cut off mid-thought
            print(f"⚠️ WARNING: {model_name} hit token limit and was truncated!")
            content = (content or "") + "\n\n⚠️ **Note:** Response truncated - model reached maximum output length."
        elif is_likely_incomplete:
            # Response appears to end mid-thought even with finish_reason="stop"
            print(f"⚠️ WARNING: {model_name} appears to have incomplete ending: '{last_30_chars}'")
        elif finish_reason == "content_filter":
            print(f"⚠️ WARNING: {model_name} stopped due to content filter")
            content = (content or "") + "\n\n⚠️ **Note:** Response stopped by content filter."
        elif finish_reason not in ["stop", "end_turn", None]:
            # Log any other unexpected finish reasons
            print(f"⚠️ WARNING: Unexpected finish_reason for {model_name}: '{finish_reason}'")
        
        # Clean up MathML and other unwanted markup before returning
        cleaned_content = clean_model_response(content) if content is not None else "No response generated"
        return cleaned_content
    except Exception as e:
        error_str = str(e).lower()
        # More descriptive error messages for faster debugging
        if "timeout" in error_str:
            return f"Error: Timeout ({INDIVIDUAL_MODEL_TIMEOUT}s)"
        elif "rate limit" in error_str or "429" in error_str:
            return f"Error: Rate limited"
        elif "not found" in error_str or "404" in error_str:
            return f"Error: Model not available"
        elif "unauthorized" in error_str or "401" in error_str:
            return f"Error: Authentication failed"
        else:
            return f"Error: {str(e)[:100]}"  # Truncate long error messages


def run_models_batch(prompt: str, model_batch: List[str], conversation_history: list = None) -> Dict[str, str]:
    """Run a batch of models with limited concurrency"""
    results = {}

    def call(model_id):
        try:
            return model_id, call_openrouter(prompt, model_id, conversation_history)
        except Exception as e:
            return model_id, f"Error: {str(e)}"

    # Use a limited number of threads to prevent overwhelming the API
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_CONCURRENT_REQUESTS) as executor:
        # Submit all futures
        future_to_model = {executor.submit(call, model_id): model_id for model_id in model_batch}

        # Set a generous timeout for the entire batch to match individual model timeouts
        batch_timeout = min(300, len(model_batch) * 50)  # 50 seconds per model in batch, max 300s (5 minutes)

        try:
            # Wait for all futures to complete or timeout
            for future in concurrent.futures.as_completed(future_to_model, timeout=batch_timeout):
                model_id = future_to_model[future]
                try:
                    _, result = future.result(timeout=2)  # Quick result retrieval
                    results[model_id] = result
                except Exception as e:
                    results[model_id] = f"Error: {str(e)}"

        except concurrent.futures.TimeoutError:
            # Handle batch timeout - get results from completed futures and mark others as failed
            print(f"Batch timeout after {batch_timeout}s, processing completed results...")

        # Handle any remaining incomplete futures
        for future, model_id in future_to_model.items():
            if model_id not in results:
                if future.done():
                    try:
                        _, result = future.result(timeout=1)
                        results[model_id] = result
                    except Exception as e:
                        results[model_id] = f"Error: {str(e)}"
                else:
                    future.cancel()
                    results[model_id] = f"Error: Timeout after {batch_timeout}s"

    return results


def run_models(prompt: str, model_list: List[str], conversation_history: list = None) -> Dict[str, str]:
    """Run models with batching to prevent timeouts and API overload"""
    import time

    start_time = time.time()

    all_results = {}

    print(f"Starting model processing: {len(model_list)} models total")
    if conversation_history:
        print(f"Using conversation context with {len(conversation_history)} previous messages")

    # Process models in batches
    for i in range(0, len(model_list), BATCH_SIZE):
        batch = model_list[i : i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (len(model_list) + BATCH_SIZE - 1) // BATCH_SIZE
        batch_start = time.time()
        print(f"Processing batch {batch_num}/{total_batches}: {len(batch)} models")

        try:
            batch_results = run_models_batch(prompt, batch, conversation_history)
            all_results.update(batch_results)
            batch_duration = time.time() - batch_start
            print(f"Batch {batch_num} completed in {batch_duration:.2f}s: {len(batch_results)} results")
        except Exception as e:
            # If a batch fails entirely, mark all models in that batch as failed
            batch_duration = time.time() - batch_start
            print(f"Batch {batch_num} failed after {batch_duration:.2f}s with error: {e}")
            for model_id in batch:
                all_results[model_id] = f"Error: Batch processing failed - {str(e)}"

    total_duration = time.time() - start_time
    successful_count = sum(1 for result in all_results.values() if not result.startswith("Error:"))
    print(f"Total processing completed in {total_duration:.2f}s: {successful_count}/{len(model_list)} successful")

    return all_results


def test_connection_quality() -> Dict[str, Any]:
    """Test connection quality by making a quick API call"""
    test_model = "anthropic/claude-3-haiku"  # Fast, reliable model for testing
    test_prompt = "Hello"

    print("Testing connection quality...")
    start_time = time.time()

    try:
        response = client.chat.completions.create(
            model=test_model, 
            messages=[{"role": "user", "content": test_prompt}], 
            timeout=10,  # Short timeout for connection test
            max_tokens=100  # Small limit for connection test
        )

        end_time = time.time()
        response_time = end_time - start_time

        # Categorize connection quality
        if response_time < 2:
            quality = "excellent"
            multiplier = 1.0
        elif response_time < 4:
            quality = "good"
            multiplier = 1.2
        elif response_time < 7:
            quality = "average"
            multiplier = 1.5
        else:
            quality = "slow"
            multiplier = 2.0

        print(f"Connection test completed in {response_time:.2f}s - Quality: {quality}")

        return {"response_time": response_time, "quality": quality, "time_multiplier": multiplier, "success": True}

    except Exception as e:
        print(f"Connection test failed: {e}")
        return {"response_time": 0, "quality": "poor", "time_multiplier": 3.0, "success": False, "error": str(e)}
