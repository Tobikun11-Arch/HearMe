<div align="center">

# HearMe

### AI-Powered Sign Language Education Platform

*Empowering deaf individuals through accessible, interactive sign language learning*

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.11x-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://www.python.org/)

</div>

---

## Overview

**HearMe** is a free, web-based sign language education platform designed to empower deaf individuals who have never had access to formal instruction. At its core, HearMe uses an **AI-powered avatar** to teach basic signs — greetings, needs, emotions, and safety phrases — through expressive gestures, spoken explanations, and interactive lessons.

> Built for Gemini Live Agent Challenge — our mission is to make sign language education accessible to everyone, everywhere.

---

## Features

- **AI-Powered Avatar** — Demonstrates signs through expressive, real-time gestures
- **Structured Lessons** — Learn greetings, needs, emotions, and essential safety phrases
- **Spoken Explanations** — Audio descriptions accompany every sign for inclusive learning
- **Interactive Practice** — Hands-on exercises to reinforce retention
- **Fully Web-Based** — No downloads required; accessible on any device

---

## Project Structure

This is a **monorepo** containing two main packages:

```
HearMe/
├── frontend/          # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── assets/
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── backend/           # Python FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── routes/
│   │   ├── models/
│   │   └── services/
│   ├── requirements.txt
│   └── .env.example
│
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS |
| **Backend** | FastAPI (Python) |
| **API** | RESTful, JSON |

---

## Getting Started

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/) v18+
- [Python](https://www.python.org/) 3.11+
- [Git](https://git-scm.com/)

---

### 1. Clone the Repository

```bash
git clone https://github.com/Tobikun11-Arch/HearMe.git
cd HearMe
```

---

### 2. Frontend Setup

```bash
cd frontend
pnpm install
pnpm run dev
```

The frontend will be available at **http://localhost:5173**

---

### 3. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # macOS/Linux
# or
source venv/Scripts/activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Copy environment variables
cp .env.example .env

# Start the server
uvicorn app.main:app --reload
```

The API will be available at **http://localhost:8000**

API docs (Swagger UI): **http://localhost:8000/docs**

---

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check |
| `GET` | `/lessons` | Fetch all available lessons |
| `GET` | `/lessons/{id}` | Fetch a specific lesson |
| `POST` | `/practice` | Submit a practice session result |

> Full interactive API documentation is available at `/docs` when the backend is running.

---

## Team

| Name | Role |
|------|------|
| *Joenel Sevellejo* | Full-Stack / AI Integration |
| *Kate Caraballo* | Quality Assurance |

---

## License

This project is open source and available under the [MIT License](LICENSE).

---

<div align="center">

Made with care at <strong>Gemini Live Agent Challenge</strong> &mdash; Sign language for everyone.

</div>
