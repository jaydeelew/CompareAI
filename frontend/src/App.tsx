import { useState, useEffect, useRef } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface CompareResponse {
  results: { [key: string]: string };
  metadata: {
    input_length: number;
    models_requested: number;
    models_successful: number;
    models_failed: number;
    timestamp: string;
  };
}

interface Model {
  id: string;
  name: string;
  description: string;
  category: string;
  provider: string;
}

interface ModelsByProvider {
  [provider: string]: Model[];
}

function App() {
  const [response, setResponse] = useState<CompareResponse | null>(null);
  const [input, setInput] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelsByProvider, setModelsByProvider] = useState<ModelsByProvider>({});
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());

  const selectAllRef = useRef<HTMLInputElement>(null);

  // Get all models in a flat array for compatibility
  const allModels = Object.values(modelsByProvider).flat();

  // Fetch available models on component mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        console.log('Fetching models from:', `${API_URL}/models`);
        const res = await fetch(`${API_URL}/models`);
        console.log('Response status:', res.status);

        if (res.ok) {
          const data = await res.json();
          console.log('Received data:', data);

          if (data.models_by_provider && Object.keys(data.models_by_provider).length > 0) {
            setModelsByProvider(data.models_by_provider);
            console.log('Set modelsByProvider:', data.models_by_provider);
          } else {
            console.error('No models_by_provider data received');
            setError('No model data received from server');
          }
        } else {
          console.error('Failed to fetch models, status:', res.status);
          setError(`Failed to fetch models: ${res.status}`);
        }
      } catch (err) {
        console.error('Failed to fetch models:', err instanceof Error ? err.message : String(err));
        setError(`Failed to fetch models: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsLoadingModels(false);
        console.log('Finished loading models');
      }
    };

    fetchModels();
  }, []);

  useEffect(() => {
    if (selectAllRef.current) {
      if (selectedModels.length === 0) {
        selectAllRef.current.indeterminate = false;
        selectAllRef.current.checked = false;
      } else if (selectedModels.length === allModels.length) {
        selectAllRef.current.indeterminate = false;
        selectAllRef.current.checked = true;
      } else {
        selectAllRef.current.indeterminate = true;
      }
    }
  }, [selectedModels, allModels.length]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedModels(allModels.map((model) => model.id));
    } else {
      setSelectedModels([]);
    }
  };

  const toggleDropdown = (provider: string) => {
    setOpenDropdowns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(provider)) {
        newSet.delete(provider);
      } else {
        newSet.add(provider);
      }
      return newSet;
    });
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
                checked={selectedModels.length === allModels.length}
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
          ) : Object.keys(modelsByProvider).length === 0 ? (
            <div className="error-message">
              <p>No models available. Please check the server connection.</p>
              <p>Debug info: modelsByProvider keys: {JSON.stringify(Object.keys(modelsByProvider))}</p>
            </div>
          ) : (
            <div className="provider-dropdowns">
              {Object.entries(modelsByProvider).map(([provider, models]) => (
                <div key={provider} className="provider-dropdown">
                  <button
                    className="provider-header"
                    onClick={() => toggleDropdown(provider)}
                    aria-expanded={openDropdowns.has(provider)}
                  >
                    <div className="provider-left">
                      <span className="provider-name">{provider}</span>
                      <span className="provider-count">({models.length} models)</span>
                    </div>
                    <span className={`dropdown-arrow ${openDropdowns.has(provider) ? 'open' : ''}`}>
                      ▼
                    </span>
                  </button>

                  {openDropdowns.has(provider) && (
                    <div className="provider-models">
                      {models.map((model) => {
                        const isSelected = selectedModels.includes(model.id);
                        return (
                          <label
                            key={model.id}
                            className={`model-option ${isSelected ? 'selected' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleModelToggle(model.id)}
                              className="model-checkbox"
                            />
                            <div className="model-info">
                              <h4>{model.name}</h4>
                              <p>{model.description}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Selected Models Cards */}
          {selectedModels.length > 0 && (
            <div className="selected-models-section">
              <h3>Selected Models ({selectedModels.length})</h3>
              <div className="selected-models-grid">
                {selectedModels.map((modelId) => {
                  const model = allModels.find(m => m.id === modelId);
                  if (!model) return null;

                  return (
                    <div key={modelId} className="selected-model-card">
                      <div className="selected-model-header">
                        <h4>{model.name}</h4>
                        <button
                          className="remove-model-btn"
                          onClick={() => handleModelToggle(modelId)}
                          aria-label={`Remove ${model.name}`}
                        >
                          ✕
                        </button>
                      </div>
                      <p className="selected-model-provider">{model.provider}</p>
                      <p className="selected-model-description">{model.description}</p>
                    </div>
                  );
                })}
              </div>
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
                <span className="metadata-label">Models Successful:</span>
                <span className={`metadata-value ${response.metadata.models_successful > 0 ? 'successful' : ''}`}>
                  {response.metadata.models_successful}/{response.metadata.models_requested}
                </span>
              </div>
              {response.metadata.models_failed > 0 && (
                <div className="metadata-item">
                  <span className="metadata-label">Models Failed:</span>
                  <span className="metadata-value failed">{response.metadata.models_failed}</span>
                </div>
              )}
              <div className="metadata-item">
                <span className="metadata-label">Timestamp:</span>
                <span className="metadata-value">{new Date(response.metadata.timestamp).toLocaleString()}</span>
              </div>
            </div>

            <div className="results-grid">
              {Object.entries(response.results).map(([modelId, output]) => (
                <div key={modelId} className="result-card">
                  <div className="result-header">
                    <h3>{allModels.find(m => m.id === modelId)?.name || modelId}</h3>
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
