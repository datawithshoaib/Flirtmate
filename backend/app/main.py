import json
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from langchain_core.messages import HumanMessage
from sse_starlette.sse import EventSourceResponse

from app.config import settings
from app.graph import graph
from app.prompts import PERSONAS
from app.schemas import ChatRequest

app = FastAPI(title="Flirtmate API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

# A small per-process guard for the MVP. Use a shared limiter such as Redis
# before running multiple API workers or replicas.
_request_times: dict[str, deque[float]] = defaultdict(deque)
_rate_limit_lock = Lock()
_RATE_LIMIT = 20
_RATE_WINDOW_SECONDS = 60


@app.middleware("http")
async def limit_chat_requests(request: Request, call_next):
    if request.method == "POST" and request.url.path == "/api/chat":
        client = request.client.host if request.client else "unknown"
        now = time.monotonic()
        with _rate_limit_lock:
            recent = _request_times[client]
            while recent and now - recent[0] >= _RATE_WINDOW_SECONDS:
                recent.popleft()
            if len(recent) >= _RATE_LIMIT:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many messages. Please wait a minute and try again."},
                    headers={"Retry-After": str(_RATE_WINDOW_SECONDS)},
                )
            recent.append(now)
    return await call_next(request)


@app.get("/health")
def health():
    return {"status": "ok", "model_configured": bool(settings.groq_api_key)}


@app.get("/api/personas")
def personas():
    return [{"id": key, "description": value} for key, value in PERSONAS.items()]


@app.post("/api/chat")
async def chat(req: ChatRequest):
    if not settings.groq_api_key:
        return JSONResponse(
            status_code=503,
            content={"detail": "Chat is not configured yet. Add GROQ_API_KEY to backend/.env."},
        )
    inputs = {
        "messages": [HumanMessage(content=req.message)],
        "persona": req.persona,
        "spice": req.spice,
        "context": "",
        "blocked": False,
        "boundary": False,
    }
    config = {"configurable": {"thread_id": req.session_id}}

    async def events():
        try:
            async for chunk, metadata in graph.astream(
                inputs, config, stream_mode="messages"
            ):
                if metadata.get("langgraph_node") not in {"generate", "deflect", "boundary"}:
                    continue
                content = chunk.content
                if isinstance(content, str) and content:
                    yield {"data": json.dumps({"token": content})}
                elif isinstance(content, list):
                    for part in content:
                        if isinstance(part, dict) and part.get("type") == "text":
                            yield {"data": json.dumps({"token": part.get("text", "")})}
            yield {"data": json.dumps({"done": True})}
        except Exception:
            yield {"data": json.dumps({"error": "The reply could not be generated. Please try again."})}

    return EventSourceResponse(events(), headers={"X-Accel-Buffering": "no"})


@app.delete("/api/session/{session_id}")
def reset(session_id: str):
    checkpointer = graph.checkpointer
    delete_thread = getattr(checkpointer, "delete_thread", None)
    if delete_thread:
        delete_thread(session_id)
    return {"reset": True}
