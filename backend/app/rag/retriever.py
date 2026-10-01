from functools import lru_cache
from pathlib import Path

from app.config import settings

KB_DIR = Path(__file__).resolve().parents[2] / "data" / "kb"


@lru_cache
def get_store():
    from langchain_chroma import Chroma
    from langchain_huggingface import HuggingFaceEmbeddings

    return Chroma(
        persist_directory=settings.chroma_dir,
        embedding_function=HuggingFaceEmbeddings(model_name=settings.embedding_model),
        collection_name="flirtmate_kb",
    )


def retrieve(query: str, k: int = 4) -> str:
    """Search Chroma when ingested; use bundled KB text before first ingestion."""
    try:
        store = get_store()
        if store._collection.count():
            docs = store.similarity_search(query, k=k)
            return "\n\n".join(doc.page_content for doc in docs)
    except (ImportError, OSError, RuntimeError, ValueError):
        # A fresh checkout remains usable before the embedding model or index is installed.
        pass

    terms = {term.lower() for term in query.split() if len(term) > 3}
    ranked: list[tuple[int, str]] = []
    for path in sorted(KB_DIR.glob("*.md")):
        content = path.read_text(encoding="utf-8")
        score = sum(content.lower().count(term) for term in terms)
        ranked.append((score, content))
    ranked.sort(key=lambda item: item[0], reverse=True)
    return "\n\n".join(text for _, text in ranked[:k])
