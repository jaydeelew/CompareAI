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

interface Model {
  id: string;
  name: string;
  description: string;
  category: string;
}

const availableModels: Model[] = [
  { id: 'gpt-4', name: 'GPT-4', description: 'OpenAI\'s most advanced language model', category: 'Language' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and efficient language model', category: 'Language' },
  { id: 'claude-3', name: 'Claude 3', description: 'Anthropic\'s latest AI assistant', category: 'Language' },
  { id: 'bert-base', name: 'BERT Base', description: 'Google\'s bidirectional transformer', category: 'Language' },
  { id: 't5-base', name: 'T5 Base', description: 'Text-to-Text Transfer Transformer', category: 'Language' },
];

function App() {
  const [response, setResponse] = useState<CompareResponse | null>(null);
  const [input, setInput] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>(['gpt-4', 'claude-3']);
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
        console.error('Failed to fetch models:', err);
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
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
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
      if (err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else if (err.message.includes('Failed to fetch')) {
        setError('Unable to connect to the server. Please check if the backend is running.');
      } else {
        setError(err.message || 'An unexpected error occurred');
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
              {availableModelsList.map((model) => (
                <div
                  key={model.id}
                  className={`model-card ${selectedModels.includes(model.id) ? 'selected' : ''}`}
                  onClick={() => handleModelToggle(model.id)}
                >
                  <div className="model-header">
                    <input
                      type="checkbox"
                      checked={selectedModels.includes(model.id)}
                      onChange={() => handleModelToggle(model.id)}
                      className="model-checkbox"
                    />
                    <h3>{model.name}</h3>
                  </div>
                  <p>{model.description}</p>
                  <span className="model-category">{model.category}</span>
                </div>
              ))}
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
              {Object.entries(response.results).map(([model, output]) => (
                <div key={model} className="result-card">
                  <div className="result-header">
                    <h3>{availableModelsList.find(m => m.id === model)?.name || model}</h3>
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
