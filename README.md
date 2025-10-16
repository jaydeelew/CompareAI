# CompareAI

A production-ready AI model comparison platform that enables side-by-side comparison of responses from 50+ AI models simultaneously. Built with modern web technologies and deployed with SSL/HTTPS support.

## Live Demo

**Production URL:** [https://compareintel.com](https://compareintel.com)

## Overview

CompareAI is a comprehensive web application that enables comparison of multiple AI language models from leading providers including OpenAI, Anthropic, Google, Cohere, DeepSeek, and many others. Users can submit text input and instantly see how different models respond, with detailed performance metrics and success/failure tracking.

## Key Features

- **50+ AI Models:** Compare responses from models across multiple providers:

  - **Anthropic:** Claude Sonnet 4.5, Claude 4 Sonnet, Claude 3.7 Sonnet, Claude 3.5 Sonnet
  - **OpenAI:** GPT-5 Pro, GPT-5 Nano, GPT-5 Mini, GPT-5 Codex, GPT-5 Chat, GPT-5, GPT-4o
  - **Google:** Gemini 2.5 Pro, Gemini 2.5 Flash variants, Gemini 2.0 Flash
  - **Cohere:** Command R7B, Command R+, Command A
  - **DeepSeek:** DeepSeek V3.2 Exp, DeepSeek R1, DeepSeek Chat V3.1
  - **Meta:** Llama 4 Scout, Llama 4 Maverick, Llama 3.3 70B Instruct, Llama Guard models
  - **Microsoft:** WizardLM-2 8x22B, Phi 4 Reasoning Plus, Phi 4, MAI-DS-R1
  - **Mistral:** Mistral Small 3.2, Mistral Medium 3.1, Mistral Large, Devstral models, Codestral
  - **Qwen:** Qwen3 VL, Qwen3 Next, Qwen3 Max, Qwen3 Coder variants
  - **xAI:** Grok 4 Fast, Grok 4, Grok 3 Mini, Grok 3

- **High-Speed Processing:** Optimized backend with concurrent API calls and intelligent batch processing
- **Real-Time Processing:** Concurrent API calls with intelligent batch processing for optimal performance
- **Performance Analytics:** Track success rates, response times, and model reliability
- **Smart Selection Tools:** Quick select options (Top 5, Popular, by Provider) to streamline testing
- **Tiered Access:** 
  - **Unregistered Users:** 5 free comparisons/day
  - **Free (Registered):** 10 free comparisons/day
  - **Starter:** 25 comparisons/day + overages ($14.99/mo)
  - **Pro:** 50 comparisons/day + overages ($29.99/mo)
- **Advanced LaTeX Rendering:** Comprehensive LaTeX/Markdown renderer with KaTeX support
- **Conversation History:** Support for multi-turn conversations with context preservation
- **Responsive Design:** Modern, mobile-friendly interface with smooth animations
- **Production Security:** SSL/HTTPS support with Let's Encrypt certificates
- **Containerized Deployment:** Full Docker support for development and production environments

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Modern CSS with CSS Variables, KaTeX for LaTeX rendering
- **Backend:** FastAPI (Python), OpenAI SDK, OpenRouter Integration, Rate limiting with SlowAPI
- **Infrastructure:** Docker, Docker Compose, Nginx reverse proxy
- **Security:** SSL/HTTPS with Let's Encrypt, CORS configuration, Rate limiting
- **Deployment:** AWS EC2 with automated SSL setup scripts
- **Monitoring:** Built-in model performance tracking and analytics

## Project Structure

```
CompareAI/
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── main.py         # API endpoints, CORS setup, and rate limiting
│   │   └── model_runner.py # Model integration and batch processing
│   ├── Dockerfile          # Backend container configuration
│   └── requirements.txt    # Python dependencies
├── frontend/               # React application
│   ├── src/
│   │   ├── App.tsx        # Main application component
│   │   ├── App.css        # Modern styling with animations
│   │   └── components/
│   │       └── LatexRenderer.tsx # Advanced LaTeX/Markdown renderer
│   ├── Dockerfile         # Frontend container configuration
│   └── package.json       # Node.js dependencies
├── nginx/                 # Reverse proxy configurations
│   ├── nginx.conf         # Development configuration
│   ├── nginx.prod.conf    # Production configuration
│   └── nginx.ssl.conf     # SSL/HTTPS configuration
├── docker-compose.yml     # Development environment
├── docker-compose.prod.yml # Production environment
├── docker-compose.ssl.yml  # SSL-enabled production
├── docker-compose.dev-ssl.yml # Development with SSL
├── setup-ssl.sh           # Automated SSL certificate setup
├── setup-compareintel-ssl.sh # Pre-configured SSL setup for compareintel.com
└── create-dev-ssl.sh      # Self-signed certificates for development
```

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/get-started) and [Docker Compose](https://docs.docker.com/compose/)
- [OpenRouter API Key](https://openrouter.ai/) for AI model access
- (Optional) Domain name for SSL deployment

### 1. Clone the Repository

```bash
git clone https://github.com/jaydeelew/CompareAI.git
cd CompareAI
```

### 2. Set Up Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# backend/.env
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

**API Key:** Get your free OpenRouter API key at [openrouter.ai](https://openrouter.ai/)

### 3. Development Setup

Choose your development environment:

#### Option A: Standard Development (Recommended)

```bash
# Start with hot reload and development features
docker compose up --build
```

- **Frontend:** [http://localhost:8080](http://localhost:8080)
- **Backend API:** [http://localhost:8000](http://localhost:8000)

#### Option B: HTTPS Development

```bash
# For testing SSL-dependent features
./create-dev-ssl.sh
docker compose -f docker-compose.dev-ssl.yml up --build
```

- **Frontend:** [https://localhost:8443](https://localhost:8443)

### 4. Using the Application

1. **Open the web interface** at your chosen URL
2. **Enter your text prompt** in the input field
3. **Select AI models** from the organized provider dropdowns
4. **Click "Compare Models"** to see side-by-side results
5. **Review responses** with performance metrics and success indicators

**Pro Tips:**

- Use "Top 5" button for quick comparisons
- Select 12 or fewer models for optimal performance (rate limited)
- Check the model statistics endpoint for reliability data
- **Unregistered users:** 5 comparisons per day per IP address
- **Free registered users:** 10 comparisons per day (2x unregistered!)
- **Register for free** to double your daily limit

## Production Deployment

### AWS EC2 Deployment with SSL

**Automated Setup:**

```bash
# For compareintel.com (preconfigured)
./setup-compareintel-ssl.sh

# For custom domains
./setup-ssl.sh yourdomain.com your@email.com
```

**Manual Deployment:**

```bash
# Deploy production environment (HTTP)
docker compose -f docker-compose.prod.yml up -d

# Deploy production environment (HTTPS)
docker compose -f docker-compose.ssl.yml up -d
```

The deployment automatically:

- Builds optimized production containers
- Configures Nginx reverse proxy
- Sets up proper CORS and security headers
- Enables rate limiting and performance monitoring

### Environment Options

1. **Local Development (HTTP):** `docker compose up`
2. **Local Development (HTTPS):** `docker compose -f docker-compose.dev-ssl.yml up`
3. **Production (HTTP):** `docker compose -f docker-compose.prod.yml up`
4. **Production (HTTPS):** `docker compose -f docker-compose.ssl.yml up`

**For detailed deployment workflows:** See [DEV_WORKFLOW.md](DEV_WORKFLOW.md)

## API Endpoints

- `GET /` - Health check
- `GET /health` - Detailed health status
- `GET /models` - List all available models by provider
- `POST /compare` - Compare models with input text (rate limited to 10/day)
- `GET /model-stats` - Performance statistics for all models
- `GET /rate-limit-status` - Check current rate limit status
- `POST /dev/reset-rate-limit` - Reset rate limits (development only)

## Advanced Configuration

### Performance Tuning

- **Concurrent Requests:** Adjust `MAX_CONCURRENT_REQUESTS` in `model_runner.py` (default: 12)
- **Timeout Settings:** Modify `INDIVIDUAL_MODEL_TIMEOUT` for slower connections (default: 120s)
- **Batch Size:** Configure `BATCH_SIZE` for optimal throughput (default: 12)
- **Rate Limiting:** Adjust `MAX_DAILY_COMPARISONS` in `main.py` (default: 10)

### Model Management

- Models are organized by provider for easy selection
- Support for 50+ models across major AI providers
- Real-time model availability checking
- Performance tracking and success rate monitoring
- Maximum 12 models per comparison request

## Documentation

- **[DEV_WORKFLOW.md](DEV_WORKFLOW.md)** - Comprehensive development environment setup
- **[LATEX_RENDERER_IMPROVEMENTS.md](LATEX_RENDERER_IMPROVEMENTS.md)** - Advanced LaTeX rendering capabilities
- **[RATE_LIMITING_IMPLEMENTATION.md](RATE_LIMITING_IMPLEMENTATION.md)** - Rate limiting and freemium model details
- **[CACHE_BUSTING_SETUP.md](CACHE_BUSTING_SETUP.md)** - Cache busting and performance optimizations

## Contributing

We welcome contributions! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch:** `git checkout -b feature/amazing-feature`
3. **Commit your changes:** `git commit -m 'Add amazing feature'`
4. **Push to the branch:** `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Guidelines

- Follow TypeScript best practices for frontend code
- Use FastAPI conventions for backend development
- Test your changes across multiple AI models
- Update documentation for new features
- Respect rate limiting constraints in development
- Test LaTeX rendering with mathematical content

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **OpenRouter** for providing access to multiple AI model APIs
- **All AI providers** for their powerful language models
- **Open source community** for the amazing tools and frameworks
