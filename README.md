# Vehicle Intelligence Assistant

An AI-powered Vehicle Maintenance Assistant built using Retrieval-Augmented Generation (RAG). 
This application allows users to upload vehicle manuals, logs, and maintenance documents, and then ask questions that are answered based *only* on those uploaded documents.

## Tech Stack

**Frontend:**
- React (Vite)
- Tailwind CSS v4 (Custom UI with glassmorphism & dark mode)
- React Router
- Axios
- React-Dropzone

**Backend:**
- FastAPI (Python)
- SQLite (aiosqlite)
- ChromaDB (Local Vector Database)
- pypdf, pandas, openpyxl (Document Parsing)
- sentence-transformers (Embeddings via `all-MiniLM-L6-v2`)

## Current Progress (Up to Milestone 7)

✅ **Milestone 1:** Project Setup (Frontend/Backend folders, Vite, FastAPI)
✅ **Milestone 2:** Backend Architecture (SQLite Database, SQLAlchemy models, logging)
✅ **Milestone 3:** Frontend Architecture (App Layout, Sidebar, Dark Mode, React Router)
✅ **Milestone 4:** Document Upload & Storage (Drag and Drop UI, backend `POST /api/documents`)
✅ **Milestone 5:** Document Processing Pipeline (Extracting text from PDF, CSV, Excel, TXT)
✅ **Milestone 6:** Text Chunking Strategy (`langchain-text-splitters`)
✅ **Milestone 7:** Vector Embeddings & Database (`ChromaDB` + `sentence-transformers`)

## How to Run Locally

### 1. Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` to view the application.
