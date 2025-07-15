import { useState, useEffect } from 'react';
import './App.css';

interface CompareResponse {
  results: { [key: string]: string };
  metadata: {
    input_length: number;
    models_requested: number;
    models_processed: number;
    timestamp: string;
  };
}

// Restore the original Model interface and availableModels array
interface Model {
  id: string;
  name: string;
  description: string;
  category: string;
}

const availableModels: Model[] = [
  { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', description: "OpenAI's GPT-4 Turbo", category: 'Language' },
  { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', description: "Anthropic's Claude 3 Opus", category: 'Language' },
  { id: 'deepseek/deepseek-chat-v3-0324:free', name: 'DeepSeek Chat V3 (Free)', description: 'DeepSeek Chat V3 (Free Tier)', category: 'Vision/Language' },
  { id: 'anthropic/claude-3-sonnet-20240229', name: 'Claude 3.5 Sonnet', description: "Anthropic's Claude 3.5 Sonnet (2024-02-29)", category: 'Language' },
  { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet', description: "Anthropic's Claude 3.7 Sonnet", category: 'Language' },
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', description: "Anthropic's Claude Sonnet 4", category: 'Language' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', description: "OpenAI's GPT-4o (4.1)", category: 'Language' },
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free)', description: 'DeepSeek R1 (Free Tier)', category: 'Language/Reasoning' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: "Google's Gemini 2.5 Pro", category: 'Language' },
  { id: 'google/gemini-2.0-flash-lite-001', name: 'Gemini 2.0 Flash Lite', description: "Google's Gemini 2.0 Flash Lite (001)", category: 'Language' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', description: "Google's Gemini 2.0 Flash (001)", category: 'Language' },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash Exp (Free)', description: "Google's Gemini 2.0 Flash Exp (Free Tier)", category: 'Language' },
];

function App() {
  const [response, setResponse] = useState<CompareResponse | null>(null);
  const [input, setInput] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableModelsList, setAvailableModelsList] = useState<Model[]>(availableModels);
  const [isLoadingModels, setIsLoadingModels] = useState(true);

  // Fetch available models on component mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await fetch('http://localhost:8000/models');
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
      
      const res = await fetch('http://localhost:8000/compare', {
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
        <h1>🤖 CompareAI</h1>
        <p>Compare multiple AI models side by side</p>
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
          <h2>Select Models to Compare</h2>
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
                    <p>{model.description}</p>
                    <span className="model-category">{model.category}</span>
                  </label>
                );
              })}
            </div>
          )}
        </section>

        <section className="action-section">
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
            <div className="loading-spinner"></div>
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
