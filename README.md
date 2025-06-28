# CompareAI

> **⚠️ Project Status: Under Construction**
>
> This project is in the planning and early development stage. Features, architecture, and implementation details are subject to change.

## Overview

**CompareAI** is a modular web application designed to compare the performance and outputs of multiple AI/ML models. Users will be able to submit data, select models, and review comparison results through a modern, user-friendly interface.

## Project Goals

- **Compare Multiple Models**: Enable users to input data and simultaneously evaluate the outputs and performance of different AI models.
- **User-Friendly Presentation**: Display results and metrics in clear, intuitive tables that highlight the best-performing model.
- **Separation of Concerns**: Maintain a clean distinction between the frontend (React) and backend (FastAPI) to boost scalability and maintainability.
- **Modern Tech Stack**: Utilize React (Vite, TypeScript) for the frontend and FastAPI (Python) for the backend, with support for ML libraries like PyTorch, Hugging Face, and scikit-learn.
- **RESTful API Design**: Implement robust endpoints for submitting input data and retrieving comparison results.
- **Scalability & Modularity**: Lay the foundation for future features such as user authentication, chart-based result visualization, and batch file uploads.

## Planned Structure

```
/backend       # FastAPI app, ML logic, Dockerfile
/frontend      # React app, Vite config, Dockerfile
/docker-compose.yml  # Multi-service management
```

## Deployment Targets

- **Frontend**: Vercel
- **Backend**: Render
- **Containerization**: Docker & Docker Compose

---

*Stay tuned for more updates as development progresses!*

---
