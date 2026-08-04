from app.services.chunker import DocumentChunker

def test_chunker():
    print("Testing DocumentChunker...")
    
    # Create a long piece of text
    sentence = "This is a sentence about vehicle maintenance."
    long_text = " ".join([sentence] * 50)  # 50 sentences, should be ~2250 characters.
    
    print(f"Original Text Length: {len(long_text)} characters.")
    
    # Initialize chunker (e.g. 1000 characters chunk, 200 overlap)
    chunker = DocumentChunker(chunk_size=1000, chunk_overlap=200)
    
    chunks = chunker.chunk_text(long_text)
    
    print(f"Total Chunks Generated: {len(chunks)}")
    for i, chunk in enumerate(chunks):
        print(f"--- Chunk {i+1} ---")
        print(f"Length: {len(chunk)}")
        print(f"Snippet: {chunk[:50]} ... {chunk[-50:]}")
        
    print("Test completed successfully!")

if __name__ == "__main__":
    test_chunker()
