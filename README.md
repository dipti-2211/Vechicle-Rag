# Vehicle Intelligence Assistant

An AI-powered Vehicle Maintenance Assistant built using Retrieval-Augmented Generation (RAG). 
This application allows users to upload vehicle manuals, logs, and maintenance documents, and then ask questions that are answered based *only* on those uploaded documents.

## Tech Stack

**Frontend:**
- React 19 (Vite 8)
- Tailwind CSS v4 (Custom design system with dark mode)
- React Router v7
- Axios
- React-Dropzone
- React-Markdown + remark-gfm

**Backend:**
- FastAPI (Python)
- SQLite (aiosqlite) — conversations, messages, document metadata
- ChromaDB (local vector database)
- pypdf, pandas, openpyxl, python-docx (Document Parsing)
- sentence-transformers `all-MiniLM-L6-v2` (local embeddings)
- Google Gemini `gemini-2.0-flash` (answer generation via `google-genai`)

## Current Progress

✅ **Milestone 1:** Project Setup (Frontend/Backend folders, Vite, FastAPI)  
✅ **Milestone 2:** Backend Architecture (SQLite Database, models, structured logging)  
✅ **Milestone 3:** Frontend Architecture (App Layout, Sidebar, Dark Mode, React Router)  
✅ **Milestone 4:** Document Upload & Storage (Drag and Drop UI, `POST /api/documents`)  
✅ **Milestone 5:** Document Processing Pipeline (PDF, CSV, Excel, TXT, DOCX parsers)  
✅ **Milestone 6:** Text Chunking Strategy (`langchain-text-splitters` RecursiveCharacterTextSplitter)  
✅ **Milestone 7:** Vector Embeddings & Database (ChromaDB + sentence-transformers)  
✅ **Milestone 8:** Full RAG Pipeline Integration  
  - Upload → Parse → Chunk → Embed runs as background task  
  - `POST /api/chat/ask` with Gemini 2.0 Flash answer generation  
  - Full Chat UI with conversation management, message history, source citations  
  - Live Dashboard with real statistics  
  - Settings with live backend health check  
✅ **Milestone 9:** Production Polish & UX Enhancements  
  - Real-time document status polling (`useDocumentPolling` hook — auto-stops when all settle)  
  - Documents page: search bar, status filter tabs, chunk count column, inline delete confirm  
  - Chat: document scope selector — filter RAG queries to specific documents  
  - Dashboard: efficient `GET /api/documents/stats` aggregate query  
  - Code splitting: `React.lazy` + `Suspense` — 507 KB bundle split into per-page chunks  
  - New reusable hooks: `useApi`, `useDocumentPolling`  
  - Vite proxy extended to cover `/health` endpoint  

## How to Run Locally

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and set your GEMINI_API_KEY
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` to view the application.

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

```
GEMINI_API_KEY=your-gemini-api-key    # Required for chat/RAG
```

Everything else (file upload, document management, vector storage) works without an API key.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check with stats |
| POST | `/api/documents` | Upload document (triggers background pipeline) |
| GET | `/api/documents` | List all documents |
| GET | `/api/documents/stats` | Aggregate document statistics (total, ready, processing, error) |
| GET | `/api/documents/{id}` | Get document by ID |
| GET | `/api/documents/{id}/status` | Lightweight status poll (processing → ready) |
| DELETE | `/api/documents/{id}` | Delete document + vectors |
| POST | `/api/chat/ask` | **RAG Q&A — ask a question (supports document_ids scoping)** |
| GET | `/api/chat/conversations` | List conversations |
| POST | `/api/chat/conversations` | Create conversation |
| GET | `/api/chat/conversations/{id}/messages` | Get messages |
| DELETE | `/api/chat/conversations/{id}` | Delete conversation |

Full interactive docs at `http://localhost:8000/docs`
