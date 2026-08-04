from app.services.vector_store import VectorStore

def test_vector_store():
    print("Initializing VectorStore (this may download the embedding model on first run)...")
    store = VectorStore()
    
    doc_id = "test-doc-123"
    chunks = [
        "The Toyota Corolla 2020 has a 1.8-liter four-cylinder engine.",
        "Change the engine oil every 5,000 miles to keep the engine healthy.",
        "The brake pads should be inspected every 10,000 miles."
    ]
    
    print("\nAdding chunks to ChromaDB...")
    store.add_chunks(document_id=doc_id, chunks=chunks, metadata={"source": "test_manual.txt"})
    
    print("\nSearching for 'How often should I change oil?'...")
    results = store.search("How often should I change oil?", top_k=2)
    
    for idx, res in enumerate(results):
        print(f"\nResult {idx+1}:")
        print(f"Text: {res['text']}")
        print(f"Distance: {res['distance']:.4f}")
        print(f"Metadata: {res['metadata']}")
        
    print("\nTest completed successfully!")

if __name__ == "__main__":
    test_vector_store()
