# Flirtmate

Flirtmate is a playful, consent-aware AI chat companion for adults. It includes a streaming chat UI, selectable conversation personas, a three-level PG-13 tone control, session memory, a safety-first LangGraph workflow, and a local RAG knowledge base.

## Requirements

- Python 3.11+
- Node.js 20+
- A Groq API key for generated chat replies

## Run locally

1. Copy `backend/.env.example` to `backend/.env` and add your Groq API key.
2. In `backend`, create/activate a Python virtual environment and install `requirements.txt`.
3. Optional: ingest the local style knowledge base with `python -m app.rag.ingest` from `backend`. The app can use the source markdown files before an index has been created.
4. Start the API from `backend` with `uvicorn app.main:app --reload --port 8001`.
5. Copy `frontend/.env.example` to `frontend/.env.local`, then run `npm install` and `npm run dev` from `frontend`.
6. Open [http://localhost:3000](http://localhost:3000). API documentation is at [http://localhost:8001/docs](http://localhost:8001/docs).

After installing both sets of dependencies and configuring the backend key, you can start both servers from the repository root with `python run.py`. Press Ctrl+C to stop them.

Without `GROQ_API_KEY`, the API health route still works and `/api/chat` returns a setup message.

## API

- `GET /health` — liveness and model configuration state (port 8001 locally).
- `GET /api/personas` — available personas.
- `POST /api/chat` — accepts `{ "message", "session_id", "persona", "spice" }` and streams SSE JSON events containing `token` and a final `done` event.
- `DELETE /api/session/{session_id}` — clear conversation memory.

## Safety and privacy

The interface has an 18+ confirmation gate. The backend applies an age/minor and boundary check before retrieval or generation, plus an LLM moderation node and system-level content constraints. Replies stay PG-13, stop signals end the flirtation, and the model identifies itself as AI when asked. Chats are held in in-memory graph state and are not written to an application database. A per-process limit caps chat requests at 20 per minute; use a shared limiter such as Redis when running multiple workers or replicas, and add appropriate operational controls before public deployment.

## Docker

Create `backend/.env` with `GROQ_API_KEY`, then run `docker compose up --build` from the repository root. The API is available on host port 8001, and the backend image ingests the bundled RAG documents during its build.
