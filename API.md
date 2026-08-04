# Vehicle Intelligence Assistant — API Documentation

Base URL: `http://localhost:8000`

## Endpoints

### 1. Health Check
Checks if the backend API is running.

**Request:**
`GET /`

**Response (200 OK):**
```json
{
  "status": "online",
  "app": "Vehicle Intelligence Assistant",
  "version": "1.0.0"
}
```

---

### 2. Upload Document
Uploads a document to the server for processing. 
Supported types: `.pdf`, `.csv`, `.xlsx`, `.docx`, `.txt`

**Request:**
`POST /api/documents`

**Headers:**
`Content-Type: multipart/form-data`

**Form Data:**
- `file`: The file to upload (Max 50MB)

**Response (200 OK):**
```json
{
  "id": "448afc9d-832a-481c-905e-d80822d19941",
  "filename": "448afc9d-832a-481c-905e-d80822d19941.pdf",
  "original_filename": "manual.pdf",
  "file_type": "pdf",
  "file_size": 1024000,
  "file_path": "uploads/448afc9d-832a-481c-905e-d80822d19941.pdf",
  "status": "processing",
  "page_count": null,
  "chunk_count": 0,
  "vehicle_name": null,
  "manufacturer": null,
  "error_message": null,
  "created_at": "2026-08-04 12:35:43",
  "updated_at": "2026-08-04 12:35:43"
}
```

**Error Responses:**
- `400 Bad Request`: File type not allowed.
- `413 Request Entity Too Large`: File exceeds 50MB.

---

*(More endpoints for Chat and Document retrieval will be added in upcoming milestones).*
