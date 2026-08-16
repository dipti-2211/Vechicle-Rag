"""
Vehicle Intelligence Assistant — Application Configuration

Uses pydantic-settings to load environment variables with validation,
defaults, and type coercion. All settings are centralized here.
"""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ──────────────────────────────────────────────────────────
    app_name: str = "Vehicle Intelligence Assistant"
    app_version: str = "1.0.0"
    app_env: str = "development"
    debug: bool = True

    # ── Server ───────────────────────────────────────────────────────
    host: str = "0.0.0.0"
    port: int = 8000
    allowed_origins: str = (
        "http://localhost:5173,"
        "http://localhost:3000,"
        "https://auron-vehicle-ai.onrender.com,"
        "https://auron-vechicle-ai.onrender.com"
    )

    @property
    def cors_origins(self) -> List[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.allowed_origins.split(",")]

    # ── Database (SQLite — kept for local dev fallback) ───────────────
    database_path: str = "./data/vehicle_intelligence.db"

    # ── Supabase ─────────────────────────────────────────────────────
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    # JWT secret for verifying Supabase-issued access tokens on the backend.
    # Find it in: Supabase Dashboard → Auth → Signing Keys → JWT Secret
    supabase_jwt_secret: str = ""
    supabase_storage_bucket: str = "documents"

    # ── File Upload ──────────────────────────────────────────────────
    upload_dir: str = "./uploads"
    max_file_size_mb: int = 50
    allowed_file_types: str = ".pdf,.csv,.xlsx,.docx,.txt"

    @property
    def max_file_size_bytes(self) -> int:
        """Convert MB limit to bytes."""
        return self.max_file_size_mb * 1024 * 1024

    @property
    def allowed_extensions(self) -> List[str]:
        """Parse comma-separated file extensions into a list."""
        return [ext.strip().lower() for ext in self.allowed_file_types.split(",")]

    # ── Google Gemini ────────────────────────────────────────────────
    gemini_api_key: str = ""
    gemini_llm_model: str = "gemini-3.1-flash-lite"
    gemini_embedding_model: str = "gemini-embedding-2"
    gemini_embedding_dimensions: int = 3072

    # ── ChromaDB ─────────────────────────────────────────────────────
    chroma_persist_dir: str = "./data/chroma"
    chroma_collection_name: str = "vehicle_docs"

    # ── RAG Settings ──────────────────────────────────────────────────
    # chunk_size 1500 chars ≈ 375 tokens; 200 overlap keeps cross-chunk context.
    # Larger chunks mean fewer total chunks per document → fewer embedding API calls.
    chunk_size: int = 1500
    chunk_overlap: int = 200
    top_k_results: int = 5
    # Hard cap: maximum chunks embedded per document.
    # Prevents a single large file from exhausting the 1,000 RPD free-tier quota.
    max_chunks_per_doc: int = 200

    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.app_env.lower() == "production"

    @property
    def supabase_configured(self) -> bool:
        """Return True only when Supabase URL and service role key are present."""
        return bool(self.supabase_url and self.supabase_service_role_key)


@lru_cache()
def get_settings() -> Settings:
    """
    Create and cache a Settings instance.

    Using lru_cache ensures we only read the .env file once
    and reuse the same Settings object throughout the app.
    """
    return Settings()
