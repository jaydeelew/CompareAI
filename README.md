# CompareIntel

A production-ready AI model comparison platform that enables side-by-side comparison of responses from 50+ AI models simultaneously. Built with modern web technologies and deployed with SSL/HTTPS support.

## Live Demo

**Production URL:** [https://compareintel.com](https://compareintel.com)

## Overview

CompareIntel is a comprehensive web application that enables comparison of multiple AI language models from leading providers including OpenAI, Anthropic, Google, Cohere, DeepSeek, and many others. Users can submit text input and instantly see how different models respond, with detailed performance metrics and success/failure tracking.

## Key Features

- **50+ AI Models:** Compare responses from models across multiple providers:

  - **Anthropic:** Claude 3 Haiku, Claude 3.5 Sonnet, Claude 3 Opus
  - **OpenAI:** GPT-4, GPT-4 Turbo, GPT-3.5 Turbo variations
  - **Google:** Gemini Pro, Gemini Flash, Gemini Exp models
  - **Cohere:** Command R, Command R+, Command R7B
  - **DeepSeek:** DeepSeek Chat, DeepSeek Coder
  - **Meta:** Llama 3.1 and 3.2 variants
  - **Many more providers and models**

- **High-Speed Processing:** Optimized backend with 12-60x faster response processing (200-600ms improvement)
- **Real-Time Processing:** Concurrent API calls with intelligent batch processing for optimal performance
- **Performance Analytics:** Track success rates, response times, and model reliability
- **Smart Selection Tools:** Quick select options (Top 5, Popular, by Provider) to streamline testing
- **Intelligent Timeout Prevention:** Optimized request handling with user-friendly timeout management
- **Responsive Design:** Modern, mobile-friendly interface with smooth animations
- **Production Security:** SSL/HTTPS support with Let's Encrypt certificates
- **Containerized Deployment:** Full Docker support for development and production environments

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Modern CSS with CSS Variables
- **Backend:** FastAPI (Python), OpenAI SDK, OpenRouter Integration
- **Infrastructure:** Docker, Docker Compose, Nginx reverse proxy
- **Security:** SSL/HTTPS with Let's Encrypt, CORS configuration
- **Deployment:** AWS EC2 with automated SSL setup scripts
- **Monitoring:** Built-in model performance tracking and analytics

## Project Structure

```
CompareIntel/
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── main.py         # API endpoints and CORS setup
│   │   └── model_runner.py # Model integration and batch processing
│   ├── Dockerfile          # Backend container configuration
│   └── requirements.txt    # Python dependencies
├── frontend/               # React application
│   ├── src/
│   │   ├── App.tsx        # Main application component
│   │   └── App.css        # Modern styling with animations
│   ├── Dockerfile         # Frontend container configuration
│   └── package.json       # Node.js dependencies
├── nginx/                 # Reverse proxy configurations
│   ├── nginx.conf         # Development configuration
│   ├── nginx.prod.conf    # Production configuration
│   └── nginx.ssl.conf     # SSL/HTTPS configuration
├── docker-compose.yml     # Development environment
├── docker-compose.prod.yml # Production environment
├── docker-compose.ssl.yml  # SSL-enabled production
├── setup-ssl.sh           # Automated SSL certificate setup
└── deploy.sh              # Production deployment script
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
- Select 15 or fewer models for optimal performance
- Check the model statistics endpoint for reliability data

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
# Deploy production environment
./deploy.sh
```

The deployment script automatically:

- Detects and uses SSL certificates if available
- Falls back to HTTP if SSL is not configured
- Builds optimized production containers
- Configures Nginx reverse proxy
- Sets up proper CORS and security headers

### Environment Options

1. **Local Development (HTTP):** `docker compose up`
2. **Local Development (HTTPS):** `docker compose -f docker-compose.dev-ssl.yml up`
3. **Production (HTTP):** `docker compose -f docker-compose.prod.yml up`
4. **Production (HTTPS):** `docker compose -f docker-compose.ssl.yml up`

**For detailed deployment workflows:** See [DEV_WORKFLOW.md](DEV_WORKFLOW.md)

## API Endpoints

- `GET /` - Health check
- `GET /models` - List all available models by provider
- `POST /compare` - Compare models with input text
- `GET /model-stats` - Performance statistics for all models

## Advanced Configuration

### Performance Tuning

- **Concurrent Requests:** Adjust `MAX_CONCURRENT_REQUESTS` in `model_runner.py`
- **Timeout Settings:** Modify `INDIVIDUAL_MODEL_TIMEOUT` for slower connections
- **Batch Size:** Configure `BATCH_SIZE` for optimal throughput

### Model Management

- Models are organized by provider for easy selection
- Support for 100+ models across major AI providers
- Real-time model availability checking
- Performance tracking and success rate monitoring

## Documentation

- **[DEV_WORKFLOW.md](DEV_WORKFLOW.md)** - Comprehensive development environment setup
- **[SECURITY_SETUP.md](SECURITY_SETUP.md)** - SSL/HTTPS configuration and security best practices
- **[CACHE_BUSTING_SETUP.md](CACHE_BUSTING_SETUP.md)** - Cache busting and performance optimizations
- **[PERFORMANCE_SUMMARY.md](PERFORMANCE_SUMMARY.md)** - Response speed optimizations (12-60x faster processing)
- **[PERFORMANCE_QUICK_START.md](PERFORMANCE_QUICK_START.md)** - Quick guide to performance improvements

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

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **OpenRouter** for providing access to multiple AI model APIs
- **All AI providers** for their powerful language models
- **Open source community** for the amazing tools and frameworks
