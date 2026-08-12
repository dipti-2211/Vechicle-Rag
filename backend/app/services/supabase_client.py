"""
Vehicle Intelligence Assistant — Supabase Client

Provides a singleton Supabase client initialized from environment variables.
Exposes storage helpers for uploading/deleting document files.

If Supabase credentials are not configured (local dev without Supabase),
operations degrade gracefully — documents still work via local filesystem.
"""

import logging
from pathlib import Path
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)

# ── Singleton ────────────────────────────────────────────────────────────────
_supabase_client = None


def get_supabase_client():
    """
    Get the shared Supabase client.

    Returns None if Supabase is not configured (missing env vars).
    All callers must handle the None case gracefully.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    settings = get_settings()
    if not settings.supabase_configured:
        logger.warning(
            "Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing). "
            "Storage and persistent DB features will be disabled."
        )
        return None

    try:
        from supabase import create_client
        _supabase_client = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
        logger.info("Supabase client initialized: %s", settings.supabase_url)
        return _supabase_client
    except Exception as e:
        logger.error("Failed to initialize Supabase client: %s", e)
        return None


def reset_supabase_client() -> None:
    """Reset the singleton (used in tests)."""
    global _supabase_client
    _supabase_client = None


# ── Storage helpers ──────────────────────────────────────────────────────────

def upload_file_to_storage(
    file_path: str,
    document_id: str,
    original_filename: str,
) -> Optional[str]:
    """
    Upload a file to Supabase Storage.

    Returns:
        The storage path string or None if upload failed.
    """
    client = get_supabase_client()
    if client is None:
        return None

    settings = get_settings()
    bucket = settings.supabase_storage_bucket
    storage_path = f"{document_id}/{original_filename}"

    try:
        with open(file_path, "rb") as f:
            file_bytes = f.read()

        ext = Path(original_filename).suffix.lower()
        content_types = {
            ".pdf": "application/pdf",
            ".txt": "text/plain",
            ".csv": "text/csv",
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }
        content_type = content_types.get(ext, "application/octet-stream")

        client.storage.from_(bucket).upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": content_type},
        )
        logger.info(
            "Uploaded %s to Supabase Storage at %s/%s",
            original_filename, bucket, storage_path,
        )
        return storage_path

    except Exception as e:
        logger.error(
            "Failed to upload %s to Supabase Storage: %s", original_filename, e
        )
        return None


def delete_file_from_storage(storage_path: str) -> bool:
    """
    Delete a file from Supabase Storage.

    Returns:
        True if deletion succeeded, False otherwise.
    """
    client = get_supabase_client()
    if client is None:
        return False

    settings = get_settings()
    bucket = settings.supabase_storage_bucket

    try:
        client.storage.from_(bucket).remove([storage_path])
        logger.info(
            "Deleted %s from Supabase Storage bucket %s", storage_path, bucket
        )
        return True
    except Exception as e:
        logger.error(
            "Failed to delete %s from Supabase Storage: %s", storage_path, e
        )
        return False
