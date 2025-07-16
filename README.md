# CompareAI

> **⚠️ Project Status: Under Construction**
>
> This project is in the planning and early development stage. Features, architecture, and implementation details are subject to change.

## Overview

**CompareAI** is a modular web application that allows users to compare the performance and outputs of multiple AI/ML models side by side. Users can submit input data, select from a variety of state-of-the-art models, and review comparison results through a modern, user-friendly interface.

## Features

- **Compare Multiple Models:** Input data once and evaluate outputs from different AI models simultaneously.
- **User-Friendly Interface:** Clean, intuitive UI for selecting models and viewing results.
- **Clear Results Presentation:** Results and metrics are displayed in tables and cards, highlighting the best-performing model.
- **Separation of Concerns:** React frontend and FastAPI backend for scalability and maintainability.
- **Modern Tech Stack:** React (Vite, TypeScript) frontend, FastAPI (Python) backend, with support for ML libraries and external APIs.
- **RESTful API:** Robust endpoints for submitting data and retrieving results.
- **Scalable & Modular:** Designed for easy extension (e.g., authentication, charts, batch uploads).

## Tech Stack

- **Frontend:** React, Vite, TypeScript
- **Backend:** FastAPI (Python), OpenAI SDK, python-dotenv
- **Containerization:** Docker, Docker Compose
- **Deployment Targets:** Vercel (frontend), Render (backend)

## Project Structure

```
/backend       # FastAPI app, ML logic, Dockerfile
/frontend      # React app, Vite config, Dockerfile
/docker-compose.yml  # Multi-service management
```

---

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/get-started) and [Docker Compose](https://docs.docker.com/compose/) installed
- (Optional) [git](https://git-scm.com/) for cloning the repository

### 1. Clone the Repository

```bash
git clone https://github.com/jaydeelew/CompareAI.git
cd CompareAI
```

### 2. Set Up Environment Variables

Create a `.env` file in the `backend/` directory with your API keys (e.g., for OpenRouter):

```env
# backend/.env
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

> **Note:** Never commit your API keys to version control.

### 3. Build and Run with Docker Compose

From the project root, run:

```bash
docker-compose up --build
```

- The **backend** will be available at [http://localhost:8000](http://localhost:8000)
- The **frontend** will be available at [http://localhost:5173](http://localhost:5173)

### 4. Using the App

1. Open [http://localhost:5173](http://localhost:5173) in your browser.
2. Enter your input text.
3. Select one or more models to compare.
4. Click "Compare Models" to see side-by-side results.

---

## Deployment

- **Frontend:** Deploy to Vercel (see `/frontend` for Dockerfile and Vercel config)
- **Backend:** Deploy to Render or any cloud provider supporting Docker/FastAPI
- **Containerization:** Both services are ready for deployment via Docker

---

## Contributing

Contributions are welcome! Please open issues or pull requests for suggestions and improvements.

---

_Stay tuned for more updates as development progresses!_
