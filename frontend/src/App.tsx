import { useState, useEffect, useRef } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface CompareResponse {
  results: { [key: string]: string };
  metadata: {
    input_length: number;
    models_requested: number;
    models_processed: number;
    timestamp: string;
  };
}

interface Model {
  id: string;
  name: string;
  description: string;
  category: string;
}

const availableModels: Model[] = [
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', description: "Anthropic's top-ranked model with exceptional performance and capability", category: 'Language' },
  { id: 'anthropic/claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', description: "Anthropic's highly capable model with excellent reasoning and writing abilities", category: 'Language' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', description: "OpenAI's latest multimodal model with enhanced reasoning and code capabilities", category: 'Language' },
  { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', description: "OpenAI's fast and efficient GPT-4 variant for complex reasoning tasks", category: 'Language' },
  { id: 'google/gemini-flash-1.5', name: 'Gemini 1.5 Flash', description: "Google's fast and efficient model for quick responses and reasoning", category: 'Language' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini 1.5 Pro', description: "Google's advanced model with superior performance on complex tasks", category: 'Language' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', description: "DeepSeek's conversational model with strong reasoning capabilities", category: 'Language/Reasoning' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', description: "DeepSeek's reasoning-focused model with enhanced analytical abilities", category: 'Language/Reasoning' },
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B Instruct', description: "Meta's large language model optimized for text and code generation", category: 'Code/Language' },
  { id: 'mistralai/mixtral-8x7b-instruct', name: 'Mixtral 8x7B Instruct', description: "Mistral's mixture of experts model optimized for instruction following", category: 'Language/Reasoning' },
  { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet', description: "Anthropic's earlier Sonnet model with reliable performance", category: 'Language' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', description: "OpenAI's efficient model balancing performance and speed", category: 'Language' },
  { id: 'x-ai/grok-3', name: 'Grok 3', description: "xAI's advanced Grok model with enhanced reasoning and text capabilities", category: 'Language' },
  { id: 'x-ai/grok-4', name: 'Grok 4', description: "xAI's most intelligent model with native tool use and real-time search", category: 'Language' },
  { id: 'x-ai/grok-code-fast-1', name: 'Grok Code Fast 1', description: "xAI's speedy model optimized for agentic coding and low cost", category: 'Code/Language' },
];

// Function to extract company name from model description
const getCompanyName = (description: string): string => {
  if (description.toLowerCase().includes('openai')) return 'OpenAI';
  if (description.toLowerCase().includes('anthropic')) return 'Anthropic';
  if (description.toLowerCase().includes('deepseek')) return 'DeepSeek';
  if (description.toLowerCase().includes('google')) return 'Google';
  if (description.toLowerCase().includes('xai')) return 'xAI';
  if (description.toLowerCase().includes('qwen')) return 'Qwen';
  // Fallback: try to extract company name before "'s"
  const match = description.match(/^([^']+)'s/);
  if (match) return match[1];
  // If no pattern matches, return the first word
  return description.split(' ')[0];
};

function App() {
  const [response, setResponse] = useState<CompareResponse | null>(null);
  const [input, setInput] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableModelsList, setAvailableModelsList] = useState<Model[]>(availableModels);
  const [isLoadingModels, setIsLoadingModels] = useState(true);

  const selectAllRef = useRef<HTMLInputElement>(null);

  // Fetch available models on component mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await fetch(`${API_URL}/models`);
        if (res.ok) {
          const data = await res.json();
          setAvailableModelsList(data.models);
        }
      } catch (err) {
        console.error('Failed to fetch models:', err instanceof Error ? err.message : String(err));
        // Fallback to default models
        setAvailableModelsList(availableModels);
      } finally {
        setIsLoadingModels(false);
      }
    };

    fetchModels();
  }, []);

  useEffect(() => {
    if (selectAllRef.current) {
      if (selectedModels.length === 0) {
        selectAllRef.current.indeterminate = false;
        selectAllRef.current.checked = false;
      } else if (selectedModels.length === availableModelsList.length) {
        selectAllRef.current.indeterminate = false;
        selectAllRef.current.checked = true;
      } else {
        selectAllRef.current.indeterminate = true;
      }
    }
  }, [selectedModels, availableModelsList.length]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedModels(availableModelsList.map((model) => model.id));
    } else {
      setSelectedModels([]);
    }
  };

  const handleModelToggle = (modelId: string) => {
    setSelectedModels(prev =>
      prev.includes(modelId)
        ? prev.filter(id => id !== modelId)
        : [...prev, modelId]
    );
  };

  const handleSubmit = async () => {
    if (!input.trim()) {
      setError('Please enter some text to compare');
      return;
    }

    if (selectedModels.length === 0) {
      setError('Please select at least one model');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      const res = await fetch(`${API_URL}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_data: input,
          models: selectedModels
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      setResponse(data);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else if (err instanceof Error && err.message.includes('Failed to fetch')) {
        setError('Unable to connect to the server. Please check if the backend is running.');
      } else if (err instanceof Error) {
        setError(err.message || 'An unexpected error occurred');
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-container">
            <div className="static-logo">
              <h1>CompareIntel</h1>
            </div>
          </div>
          <p>Compare multiple AI models side by side</p>

          <div className="purpose-section">
            <div className="purpose-content">
              <div className="capability-tags">
                <span
                  className="capability-tag"
                  data-tooltip="Analyze and process text content across multiple AI models to compare writing quality, comprehension, and language understanding capabilities"
                >
                  <svg className="tag-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 2H6C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z" stroke="currentColor" strokeWidth="2" fill="rgba(255,255,255,0.1)" />
                    <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path d="M8 12h8M8 16h6" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  Text Processing
                  <div className="tooltip-text">Analyze and process text content across multiple AI models to compare writing quality, comprehension, and language understanding capabilities</div>
                </span>
                <span
                  className="capability-tag"
                  data-tooltip="Generate and evaluate code solutions from different AI models to compare programming accuracy, efficiency, and best practices"
                >
                  <svg className="tag-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" fill="rgba(255,255,255,0.1)" />
                    <path d="M8 21h8" stroke="currentColor" strokeWidth="2" />
                    <path d="M12 17v4" stroke="currentColor" strokeWidth="2" />
                    <path d="M7 7h.01M7 10h.01M7 13h.01" stroke="currentColor" strokeWidth="2" />
                    <path d="M11 7h6M11 10h6M11 13h4" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  Code Generation
                  <div className="tooltip-text">Generate and evaluate code solutions from different AI models to compare programming accuracy, efficiency, and best practices</div>
                </span>
                <span
                  className="capability-tag"
                  data-tooltip="Instantly compare responses from multiple AI models side-by-side to evaluate performance, accuracy, and approach differences"
                >
                  <svg className="tag-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" fill="rgba(255,255,255,0.1)" />
                  </svg>
                  Real-time Comparison
                  <div className="tooltip-text">Instantly compare responses from multiple AI models side-by-side to evaluate performance, accuracy, and approach differences</div>
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">
        <section className="input-section">
          <h2>Input Text</h2>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter your text here to compare how different AI models respond..."
            className="input-textarea"
            rows={6}
          />
        </section>

        <section className="models-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0 }}>Select Models to Compare</h2>
            <div className="select-all-container">
              <input
                type="checkbox"
                id="select-all-models"
                checked={selectedModels.length === availableModelsList.length}
                ref={selectAllRef}
                onChange={handleSelectAll}
                className="select-all-checkbox"
              />
              <label htmlFor="select-all-models" className="select-all-label">
                Select All
              </label>
            </div>
          </div>
          {isLoadingModels ? (
            <div className="loading-message">Loading available models...</div>
          ) : (
            <div className="models-grid">
              {availableModelsList.map((model) => {
                const isSelected = selectedModels.includes(model.id);
                return (
                  <label
                    key={model.id}
                    className={`model-card${isSelected ? ' selected' : ''}`}
                    tabIndex={0}
                    aria-pressed={isSelected}
                    htmlFor={`model-checkbox-${model.id}`}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    <input
                      id={`model-checkbox-${model.id}`}
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleModelToggle(model.id)}
                      className="model-checkbox"
                      tabIndex={-1}
                    />
                    <div className="model-header">
                      <h3>{model.name}</h3>
                    </div>
                    <p>{getCompanyName(model.description)}</p>
                  </label>
                );
              })}
            </div>
          )}
        </section>        <section className="action-section">
          <button
            onClick={handleSubmit}
            disabled={isLoading || selectedModels.length === 0}
            className="compare-button"
          >
            {isLoading ? 'Comparing...' : 'Compare Models'}
          </button>
        </section>

        {error && (
          <div className="error-message">
            <span>⚠️ {error}</span>
          </div>
        )}

        {isLoading && (
          <div className="loading-section">
            <div className="loading-animation">
              <div className="comparison-visual">
                <div className="ai-model ai-model-1">
                  <div className="model-core"></div>
                  <div className="data-ring"></div>
                </div>
                <div className="ai-model ai-model-2">
                  <div className="model-core"></div>
                  <div className="data-ring"></div>
                </div>
                <div className="ai-model ai-model-3">
                  <div className="model-core"></div>
                  <div className="data-ring"></div>
                </div>
                <div className="comparison-beam"></div>
                <div className="analysis-center">
                  <div className="comparison-dot"></div>
                  <div className="comparison-dot"></div>
                  <div className="comparison-dot"></div>
                </div>
              </div>
            </div>
            <p>Running models...</p>
          </div>
        )}

        {response && (
          <section className="results-section">
            <h2>Comparison Results</h2>

            {/* Metadata */}
            <div className="results-metadata">
              <div className="metadata-item">
                <span className="metadata-label">Input Length:</span>
                <span className="metadata-value">{response.metadata.input_length} characters</span>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">Models Processed:</span>
                <span className="metadata-value">{response.metadata.models_processed}/{response.metadata.models_requested}</span>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">Timestamp:</span>
                <span className="metadata-value">{new Date(response.metadata.timestamp).toLocaleString()}</span>
              </div>
            </div>

            <div className="results-grid">
              {Object.entries(response.results).map(([modelId, output]) => (
                <div key={modelId} className="result-card">
                  <div className="result-header">
                    <h3>{availableModelsList.find(m => m.id === modelId)?.name || modelId}</h3>
                    <div className="result-stats">
                      <span className="output-length">{output.length} chars</span>
                      <span className={`status ${output.startsWith('Error') ? 'error' : 'success'}`}>
                        {output.startsWith('Error') ? 'Failed' : 'Success'}
                      </span>
                    </div>
                  </div>
                  <div className="result-content">
                    <pre>{String(output)}</pre>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
