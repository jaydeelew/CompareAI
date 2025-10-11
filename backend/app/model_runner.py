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
            "id": "anthropic/claude-sonnet-4.5",
            "name": "Claude Sonnet 4.5",
            "description": "Anthropic's latest Claude Sonnet 4.5 with enhanced coding and reasoning capabilities",
            "category": "Language",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-sonnet-4",
            "name": "Claude 4 Sonnet",
            "description": "Anthropic's Claude Sonnet 4 with advanced reasoning capabilities and enhanced performance",
            "category": "Language",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-3.7-sonnet",
            "name": "Claude 3.7 Sonnet",
            "description": "Anthropic's Claude 3.7 Sonnet model with enhanced performance and improved reasoning capabilities",
            "category": "Language",
            "provider": "Anthropic",
        },
        {
            "id": "anthropic/claude-3.5-sonnet-20241022",
            "name": "Claude 3.5 Sonnet",
            "description": "Anthropic's Claude 3.5 Sonnet, presented as the 'smartest AI yet' with a balance of performance and cost",
            "category": "Language",
            "provider": "Anthropic",
        },
    ],
    "Cohere": [
        {
            "id": "cohere/command-r7b-12-2024",
            "name": "Command R7B",
            "description": "Cohere's compact model with excellent efficiency and performance, optimized for various language tasks",
            "category": "Language",
            "provider": "Cohere",
        },
        {
            "id": "cohere/command-r-plus-08-2024",
            "name": "Command R+",
            "description": "Cohere's most powerful model with enhanced reasoning, instruction following, and improved capabilities",
            "category": "Language/Reasoning",
            "provider": "Cohere",
        },
        {
            "id": "cohere/command-a",
            "name": "Command A",
            "description": "Cohere's Command A model for general language tasks with enhanced capabilities",
            "category": "Language",
            "provider": "Cohere",
        },
    ],
    "DeepSeek": [
        {
            "id": "deepseek/deepseek-v3.2-exp",
            "name": "DeepSeek V3.2 Exp",
            "description": "DeepSeek's experimental V3.2 model with DeepSeek Sparse Attention to lower computational costs and enhance performance",
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
        {
            "id": "deepseek/deepseek-chat-v3.1",
            "name": "DeepSeek Chat V3.1",
            "description": "DeepSeek's most advanced conversational model with superior reasoning capabilities",
            "category": "Language/Reasoning",
            "provider": "DeepSeek",
        },
    ],
    "Google": [
        {
            "id": "google/gemini-2.5-pro",
            "name": "Gemini 2.5 Pro",
            "description": "Google's most advanced Gemini 2.5 Pro with 'Deep Think' mode designed for complex tasks like math and coding",
            "category": "Language",
            "provider": "Google",
        },
        {
            "id": "google/gemini-2.5-flash-preview-09-2025",
            "name": "Gemini 2.5 Flash Preview 09 2025",
            "description": "Google's preview version of Gemini 2.5 Flash from September 2025, optimized for fast performance",
            "category": "Language",
            "provider": "Google",
        },
        {
            "id": "google/gemini-2.5-flash-lite",
            "name": "Gemini 2.5 Flash Lite",
            "description": "Google's lightweight Gemini 2.5 Flash model optimized for efficiency and fast performance",
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
            "id": "google/gemini-2.0-flash-001",
            "name": "Gemini 2.0 Flash 001",
            "description": "Google's Gemini 2.0 Flash with faster time to first token",
            "category": "Language",
            "provider": "Google",
        },
    ],
    "Meta": [
        {
            "id": "meta-llama/llama-guard-4-12b",
            "name": "Llama Guard 4 12B",
            "description": "Meta's Llama Guard 4 model for content moderation and safety",
            "category": "Safety",
            "provider": "Meta",
        },
        {
            "id": "meta-llama/llama-guard-3-8b",
            "name": "Llama Guard 3 8B",
            "description": "Meta's Llama Guard 3 model for content safety and filtering",
            "category": "Safety",
            "provider": "Meta",
        },
        {
            "id": "meta-llama/llama-4-scout:free",
            "name": "Llama 4 Scout (Free)",
            "description": "Meta's Llama 4 Scout, part of advanced multimodal AI systems that can process text, video, images, and audio - free tier",
            "category": "Multimodal",
            "provider": "Meta",
        },
        {
            "id": "meta-llama/llama-4-scout",
            "name": "Llama 4 Scout",
            "description": "Meta's Llama 4 Scout, part of advanced multimodal AI systems that can process text, video, images, and audio",
            "category": "Multimodal",
            "provider": "Meta",
        },
        {
            "id": "meta-llama/llama-4-maverick:free",
            "name": "Llama 4 Maverick (Free)",
            "description": "Meta's flagship Llama 4 Maverick, their most advanced multimodal model for handling text, video, images, and audio - free tier",
            "category": "Multimodal",
            "provider": "Meta",
        },
        {
            "id": "meta-llama/llama-4-maverick",
            "name": "Llama 4 Maverick",
            "description": "Meta's flagship Llama 4 Maverick, their most advanced multimodal model for handling text, video, images, and audio",
            "category": "Multimodal",
            "provider": "Meta",
        },
        {
            "id": "meta-llama/llama-3.3-70b-instruct:free",
            "name": "Llama 3.3 70B Instruct (Free)",
            "description": "Meta's Llama 3.3 with enhanced text and code generation capabilities - free tier",
            "category": "Code/Language",
            "provider": "Meta",
        },
        {
            "id": "meta-llama/llama-3.3-70b-instruct",
            "name": "Llama 3.3 70B Instruct",
            "description": "Meta's latest major release with significant improvements in text and code generation capabilities",
            "category": "Code/Language",
            "provider": "Meta",
        },
    ],
    "Microsoft": [
        {
            "id": "microsoft/wizardlm-2-8x22b",
            "name": "WizardLM-2 8x22B",
            "description": "Microsoft's powerful mixture of experts model for complex tasks with enhanced reasoning capabilities",
            "category": "Language/Reasoning",
            "provider": "Microsoft",
        },
        {
            "id": "microsoft/phi-4-reasoning-plus",
            "name": "Phi 4 Reasoning Plus",
            "description": "Microsoft's enhanced Phi 4 model optimized for complex reasoning tasks with improved performance",
            "category": "Reasoning",
            "provider": "Microsoft",
        },
        {
            "id": "microsoft/phi-4",
            "name": "Phi 4",
            "description": "Microsoft's latest compact model with strong reasoning capabilities and enhanced performance",
            "category": "Language/Reasoning",
            "provider": "Microsoft",
        },
        {
            "id": "microsoft/mai-ds-r1:free",
            "name": "MAI-DS-R1 (Free)",
            "description": "Microsoft's MAI-DS-R1 reasoning model with enhanced capabilities - free tier",
            "category": "Reasoning",
            "provider": "Microsoft",
        },
    ],
    "Mistral": [
        {
            "id": "mistralai/mistral-small-3.2-24b-instruct",
            "name": "Mistral Small 3.2 24B",
            "description": "Mistral's latest efficient model with excellent performance-to-cost ratio and image understanding capabilities",
            "category": "Multimodal",
            "provider": "Mistral",
        },
        {
            "id": "mistralai/mistral-medium-3.1",
            "name": "Mistral Medium 3.1",
            "description": "Mistral's enterprise model available for on-premise deployment with strong capabilities",
            "category": "Language",
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
            "id": "mistralai/devstral-small",
            "name": "Devstral Small",
            "description": "Mistral's small development-focused model for coding tasks with enhanced capabilities",
            "category": "Code",
            "provider": "Mistral",
        },
        {
            "id": "mistralai/devstral-medium",
            "name": "Devstral Medium",
            "description": "Mistral's medium development-focused model for advanced coding with enhanced capabilities",
            "category": "Code",
            "provider": "Mistral",
        },
        {
            "id": "mistralai/codestral-2508",
            "name": "Codestral 2508",
            "description": "Mistral's specialized code model from August 2025 with enhanced programming capabilities",
            "category": "Code",
            "provider": "Mistral",
        },
    ],
    "OpenAI": [
        {
            "id": "openai/gpt-5-pro",
            "name": "GPT-5 Pro",
            "description": "OpenAI's professional-tier GPT-5 model with enhanced coding and problem-solving abilities, nearing release with improved capabilities over GPT-4",
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-5-nano",
            "name": "GPT-5 Nano",
            "description": "OpenAI's ultra-lightweight GPT-5 model optimized for efficiency with enhanced coding and problem-solving capabilities",
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-5-mini",
            "name": "GPT-5 Mini",
            "description": "GPT-5 Mini is a compact version of GPT-5 with enhanced coding abilities, designed for lighter-weight reasoning tasks with reduced latency and cost",
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-5-codex",
            "name": "GPT-5 Codex",
            "description": "OpenAI's GPT-5 Codex specialized for code generation and programming tasks with enhanced coding abilities",
            "category": "Code",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-5-chat",
            "name": "GPT-5 Chat",
            "description": "OpenAI's GPT-5 Chat optimized for conversational interactions with enhanced coding and problem-solving abilities",
            "category": "Language",
            "provider": "OpenAI",
        },
        {
            "id": "openai/gpt-5",
            "name": "GPT-5",
            "description": "OpenAI's most advanced model with enhanced coding and problem-solving abilities, representing a significant leap from GPT-4",
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
    ],
    "Qwen": [
        {
            "id": "qwen/qwen3-vl-235b-a22b-thinking",
            "name": "Qwen3 VL 235B A22B Thinking",
            "description": "Qwen's vision-language model with thinking capabilities, trained on 36 trillion tokens across 119 languages",
            "category": "Multimodal/Reasoning",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-next-80b-a3b-thinking",
            "name": "Qwen3 Next 80B A3B Thinking",
            "description": "Qwen's Qwen3-Next with hybrid attention mechanism and highly sparse mixture-of-experts structure for enhanced performance",
            "category": "Language/Reasoning",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-next-80b-a3b-instruct",
            "name": "Qwen3 Next 80B A3B Instruct",
            "description": "Qwen's Qwen3-Next instruction model with hybrid attention and sparse MoE for higher throughput",
            "category": "Language",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-max",
            "name": "Qwen3 Max",
            "description": "Qwen's maximum capability model with top performance, trained on 36 trillion tokens in 119 languages",
            "category": "Language",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-coder-plus",
            "name": "Qwen3 Coder Plus",
            "description": "Qwen's enhanced code model with advanced programming capabilities and reasoning support",
            "category": "Code",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-coder-flash",
            "name": "Qwen3 Coder Flash",
            "description": "Qwen's fast code model optimized for speed with enhanced reasoning capabilities",
            "category": "Code",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-coder",
            "name": "Qwen3 Coder 480B A35B",
            "description": "Qwen's specialized large model for code generation and programming with multilingual support",
            "category": "Code",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-30b-a3b-instruct-2507",
            "name": "Qwen3 30B A3B Instruct 2507",
            "description": "Qwen's 30B instruction model from July 2025 with multilingual capabilities",
            "category": "Language",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-235b-a22b-thinking-2507",
            "name": "Qwen3 235B A22B Thinking 2507",
            "description": "Qwen's 235B thinking model from July 2025 with advanced reasoning capabilities",
            "category": "Language/Reasoning",
            "provider": "Qwen",
        },
        {
            "id": "qwen/qwen3-235b-a22b",
            "name": "Qwen3 235B A22B",
            "description": "Qwen's flagship large language model with exceptional capabilities, trained on 36 trillion tokens",
            "category": "Language",
            "provider": "Qwen",
        },
    ],
    "xAI": [
        {
            "id": "x-ai/grok-4-fast",
            "name": "Grok 4 Fast",
            "description": "xAI's fast Grok 4 model optimized for speed with enhanced reasoning capabilities",
            "category": "Language",
            "provider": "xAI",
        },
        {
            "id": "x-ai/grok-4",
            "name": "Grok 4",
            "description": "xAI's most intelligent model with native tool use, real-time search, and enhanced reasoning capabilities",
            "category": "Language",
            "provider": "xAI",
        },
        {
            "id": "x-ai/grok-3-mini",
            "name": "Grok 3 Mini",
            "description": "xAI's compact Grok 3 model for efficient processing with enhanced capabilities",
            "category": "Language",
            "provider": "xAI",
        },
        {
            "id": "x-ai/grok-3",
            "name": "Grok 3",
            "description": "xAI's Grok 3 model with advanced reasoning capabilities and enhanced performance",
            "category": "Language",
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
    KaTeX markup, and other unwanted markup that shouldn't be displayed to users.
    """
    if not text:
        return text
    
    # ALWAYS show first part of response for debugging
    print(f"🔍 DEBUG: Raw response (first 300 chars): {text[:300]}")
    
    # Check if text contains w3.org or katex before cleaning (for debugging)
    has_w3org_before = 'w3.org' in text.lower()
    has_katex_before = 'katex' in text.lower()
    has_spanclass_before = 'spanclass' in text.lower()
    has_angle_brackets = '<' in text and '>' in text
    
    if has_katex_before or has_spanclass_before or has_w3org_before or has_angle_brackets:
        print(f"⚠️ Found problematic content - katex: {has_katex_before}, spanclass: {has_spanclass_before}, w3.org: {has_w3org_before}, brackets: {has_angle_brackets}")
    
    # ===== KATEX CLEANUP =====
    # Remove KaTeX span elements (both properly formatted and severely malformed)
    # Claude 3 Opus sometimes outputs malformed HTML like: < spanclass="katex" >
    
    # AGGRESSIVE: Remove any pattern that looks like malformed katex markup
    # This catches: < spanclass="katex" >, <spanclass="katex">, <span class="katex">, etc.
    # Step 1: Remove patterns with "katex" in them (malformed tags)
    text = re.sub(r'<\s*spanclass\s*=\s*["\']katex[^"\']*["\'][^>]*>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'<\s*span\s*class\s*=\s*["\']katex[^"\']*["\'][^>]*>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'<\s*span[^>]*class\s*=\s*["\']katex[^"\']*["\'][^>]*>', '', text, flags=re.IGNORECASE)
    
    # Step 2: Remove malformed math tags (mathxmlns, mathxml, etc.)
    text = re.sub(r'<\s*mathxmlns\s*=\s*[^>]*>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'<\s*mathxml[^>]*>', '', text, flags=re.IGNORECASE)
    
    # Step 3: Remove any remaining span tags (opening and closing)
    text = re.sub(r'<\s*/?span[^>]*>', '', text, flags=re.IGNORECASE)
    
    # Step 4: Remove semantics and annotation tags
    text = re.sub(r'<\s*/?semantics[^>]*>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'<\s*/?annotation[^>]*>', '', text, flags=re.IGNORECASE)
    
    # Step 5: Remove any quoted text containing "katex" or "mathml"
    text = re.sub(r'["\'][^"\']*(?:katex|mathml)[^"\']*["\']', '', text, flags=re.IGNORECASE)
    
    # Step 6: Targeted removal of malformed HTML-like content
    # Be surgical to avoid breaking legitimate mathematical content
    
    # Remove opening HTML/XML tags that contain common markup words
    # This catches: <span...>, <math...>, <annotation...>, <semantics...>, etc.
    # But preserves mathematical comparisons like "x < y" or "a > b"
    text = re.sub(r'<\s*(span|math|annotation|semantics|mrow|mi|mn|mo|msup|msub|mfrac|mtext|mspace|msubsup|msqrt|mroot|mstyle|mtable|mtr|mtd|mover|munder|munderover)[^>]*>', '', text, flags=re.IGNORECASE)
    
    # Remove closing tags for the above
    text = re.sub(r'</\s*(span|math|annotation|semantics|mrow|mi|mn|mo|msup|msub|mfrac|mtext|mspace|msubsup|msqrt|mroot|mstyle|mtable|mtr|mtd|mover|munder|munderover)\s*>', '', text, flags=re.IGNORECASE)
    
    # Remove incomplete opening tags (at start or after space): < span, < math, < annotation
    text = re.sub(r'(^|\s)<\s+(span|math|annotation|semantics|mrow|mi|mn|mo)', r'\1', text, flags=re.IGNORECASE)
    
    # Step 7: Remove concatenated tag/attribute words that shouldn't exist
    text = re.sub(r'\b(spanclass|mathxmlns|mathxml|annotationencoding)\w*', '', text, flags=re.IGNORECASE)
    
    # Step 8: Remove any remaining standalone markup words when they appear with special chars
    text = re.sub(r'(?:katex|mathml)(?:[_-]\w+)?["\s]', ' ', text, flags=re.IGNORECASE)
    
    # Step 9: Remove attribute patterns that look like: ="text" or ="url"
    # Only when they contain markup-related words
    text = re.sub(r'=\s*["\'][^"\']*(?:katex|mathml|w3\.org|xmlns)[^"\']*["\']', '', text, flags=re.IGNORECASE)
    
    # ===== MATHML CLEANUP =====
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
    
    # Remove the URL with any attributes and the closing > (AGGRESSIVE)
    # Match patterns like: //www.w3.org/1998/Math/MathML">
    text = re.sub(r'//www\.w3\.org/\d+/Math/MathML[^>]*"?\s*>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'https?://www\.w3\.org/\d+/Math/MathML[^>]*"?\s*>', '', text, flags=re.IGNORECASE)
    
    # Remove any remaining URL fragments with quotes and attributes
    text = re.sub(r'//www\.w3\.org/\d+/Math/MathML["\'][^>]*>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'https?://www\.w3\.org/\d+/Math/MathML["\'][^>]*>', '', text, flags=re.IGNORECASE)
    
    # Remove just the URL itself with any trailing characters up to and including >
    text = re.sub(r'//www\.w3\.org/\d+/Math/MathML[^>\s]*>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'https?://www\.w3\.org/\d+/Math/MathML[^>\s]*>', '', text, flags=re.IGNORECASE)
    
    # Remove just the URL itself if it appears standalone
    text = re.sub(r'//www\.w3\.org/\d+/Math/MathML', '', text, flags=re.IGNORECASE)
    text = re.sub(r'https?://www\.w3\.org/\d+/Math/MathML', '', text, flags=re.IGNORECASE)
    
    # Remove www.w3.org references without protocol
    text = re.sub(r'www\.w3\.org/\d+/Math/MathML[^>]*>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'www\.w3\.org/\d+/Math/MathML', '', text, flags=re.IGNORECASE)
    
    # Remove any xmlns attributes
    text = re.sub(r'xmlns\s*=\s*["\']https?://www\.w3\.org/\d+/Math/MathML["\']', '', text, flags=re.IGNORECASE)
    
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
    
    # Preserve indentation in code blocks - only clean up whitespace outside code blocks
    # Split text into code blocks and non-code content
    parts = []
    current_pos = 0
    
    # Find all code blocks (```...```)
    for match in re.finditer(r'```([a-zA-Z]*)\n(.*?)\n```', text, re.DOTALL):
        # Add non-code content before this code block
        if match.start() > current_pos:
            non_code = text[current_pos:match.start()]
            # Clean up whitespace in non-code content
            non_code = re.sub(r' {2,}', ' ', non_code)
            parts.append(non_code)
        
        # Add the code block unchanged (preserve indentation)
        parts.append(match.group(0))
        current_pos = match.end()
    
    # Add remaining non-code content
    if current_pos < len(text):
        non_code = text[current_pos:]
        non_code = re.sub(r' {2,}', ' ', non_code)
        parts.append(non_code)
    
    # Reconstruct text
    text = ''.join(parts)
    
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
    
    # ALWAYS show result for debugging
    print(f"✅ DEBUG: After cleanup (first 300 chars): {text[:300]}")
    
    # Check if cleaning worked
    has_w3org_after = 'w3.org' in text.lower()
    has_katex_after = 'katex' in text.lower()
    has_spanclass_after = 'spanclass' in text.lower()
    has_angle_brackets_after = '<' in text and '>' in text
    
    if has_w3org_after or has_katex_after or has_spanclass_after:
        print(f"⚠️ WARNING: Cleanup incomplete - katex: {has_katex_after}, spanclass: {has_spanclass_after}, w3.org: {has_w3org_after}, brackets: {has_angle_brackets_after}")
    elif has_w3org_before or has_katex_before or has_spanclass_before or has_angle_brackets:
        print(f"✅ Successfully cleaned all problematic markup")
    
    return text.strip()


def get_model_max_tokens(model_id: str) -> int:
    """
    Get the appropriate max_tokens limit for each model based on their capabilities.
    This prevents setting max_tokens higher than the model's maximum output capacity.
    
    All current models support 8192 tokens. If a model needs a different limit in the future,
    you can add it to the model_limits dictionary below.
    """
    # Model-specific token limits for exceptions
    # Currently all models use 8192, but this dict allows for future customization
    model_limits = {
        # Add any models with non-standard limits here
        # Example: "some-provider/model-id": 4096,
    }
    
    # Return model-specific limit or default to 8192 for all models
    return model_limits.get(model_id, 8192)


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

        # Get model-specific max_tokens limit to prevent truncation issues
        max_tokens = get_model_max_tokens(model_id)
        
        response = client.chat.completions.create(
            model=model_id, 
            messages=messages, 
            timeout=INDIVIDUAL_MODEL_TIMEOUT,
            max_tokens=max_tokens  # Use model-specific limit
        )
        content = response.choices[0].message.content
        finish_reason = response.choices[0].finish_reason
        
        # Log finish reason for debugging
        model_name = model_id.split('/')[-1]
        print(f"Model {model_name}: finish_reason='{finish_reason}', length={len(content) if content else 0} chars, max_tokens={max_tokens}")
        
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
