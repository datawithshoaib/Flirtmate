import re
from typing import Annotated, TypedDict

from langchain_core.messages import AIMessage, SystemMessage
from langchain_groq import ChatGroq
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages

from app.config import settings
from app.prompts import BOUNDARY_REPLY, DEFLECT, PERSONAS, SPICE, SYSTEM
from app.rag.retriever import retrieve


class State(TypedDict):
    messages: Annotated[list, add_messages]
    persona: str
    spice: int
    context: str
    blocked: bool
    boundary: bool


llm = ChatGroq(
    model=settings.groq_model,
    api_key=settings.groq_api_key or "missing-groq-api-key",
    temperature=0.8,
    streaming=True,
)
guard = ChatGroq(
    model=settings.groq_guard_model,
    api_key=settings.groq_api_key or "missing-groq-api-key",
    temperature=0,
)

BOUNDARY_PHRASES = (
    "stop", "don't flirt", "do not flirt", "not comfortable", "uncomfortable",
    "leave me alone", "change the subject", "stop flirting", "no thanks",
)
MINOR_PHRASES = ("i am under 18", "i'm under 18", "im under 18", "i am a minor", "i'm a minor", "im a minor", "underage")


def safety(state: State):
    message = str(state["messages"][-1].content)
    lowered = message.lower()
    boundary = any(phrase in lowered for phrase in BOUNDARY_PHRASES)
    age_match = re.search(r"\b(?:i am|i'm|im)\s+(\d{1,2})(?:\s*(?:years? old|yo))?\b", lowered)
    minor = (
        any(phrase in lowered for phrase in MINOR_PHRASES)
        or bool(age_match and int(age_match.group(1)) < 18)
    )
    if boundary:
        return {"blocked": False, "boundary": True}
    if minor:
        return {"blocked": True, "boundary": False}

    verdict = guard.invoke(
        "Classify the user message as SAFE or BLOCK. BLOCK if it requests explicit "
        "sexual content, sexual content involving minors, coercion, or harassment. "
        "If ambiguous, choose BLOCK. Reply with one word only.\n\nMessage: " + message
    ).content.strip().upper()
    return {"blocked": verdict.startswith("BLOCK"), "boundary": False}


def route(state: State):
    if state["boundary"]:
        return "boundary"
    return "deflect" if state["blocked"] else "retrieve"


def retrieve_node(state: State):
    return {"context": retrieve(str(state["messages"][-1].content), k=4)}


def deflect(state: State):
    return {"messages": [AIMessage(content=DEFLECT)]}


def boundary_reply(state: State):
    return {"messages": [AIMessage(content=BOUNDARY_REPLY)]}


def generate(state: State):
    system = SystemMessage(content=SYSTEM.format(
        persona_desc=PERSONAS[state["persona"]],
        spice_desc=SPICE[state["spice"]],
        context=state["context"],
    ))
    return {"messages": [llm.invoke([system, *state["messages"][-12:]])]}


builder = StateGraph(State)
builder.add_node("safety", safety)
builder.add_node("retrieve", retrieve_node)
builder.add_node("deflect", deflect)
builder.add_node("boundary", boundary_reply)
builder.add_node("generate", generate)
builder.add_edge(START, "safety")
builder.add_conditional_edges("safety", route, ["retrieve", "deflect", "boundary"])
builder.add_edge("retrieve", "generate")
builder.add_edge("generate", END)
builder.add_edge("deflect", END)
builder.add_edge("boundary", END)
graph = builder.compile(checkpointer=MemorySaver())
