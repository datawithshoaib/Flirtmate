from pathlib import Path

from app.config import settings

KB_DIR = Path(__file__).resolve().parents[2] / "data" / "kb"


def main() -> None:
    from langchain_chroma import Chroma
    from langchain_community.document_loaders import DirectoryLoader, TextLoader
    from langchain_huggingface import HuggingFaceEmbeddings
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    docs = DirectoryLoader(
        str(KB_DIR), glob="**/*.md", loader_cls=TextLoader,
        loader_kwargs={"encoding": "utf-8"},
    ).load()
    for doc in docs:
        doc.metadata["type"] = Path(doc.metadata["source"]).stem.split("_")[0]
    chunks = RecursiveCharacterTextSplitter(
        chunk_size=600, chunk_overlap=80
    ).split_documents(docs)
    Chroma.from_documents(
        chunks,
        HuggingFaceEmbeddings(model_name=settings.embedding_model),
        persist_directory=settings.chroma_dir,
        collection_name="flirtmate_kb",
    )
    print(f"Ingested {len(chunks)} chunks from {len(docs)} documents")


if __name__ == "__main__":
    main()
