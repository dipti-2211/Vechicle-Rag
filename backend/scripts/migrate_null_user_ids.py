"""
migrate_null_user_ids.py
────────────────────────
One-time cleanup script: removes all documents with user_id = NULL
from Supabase and their associated ChromaDB vector chunks.

These rows are orphaned test data uploaded before the auth fix was applied.
Because no real user owns them they would be visible to every logged-in user,
breaking per-user isolation.

WHAT IT DOES:
  1. Fetches all documents with user_id IS NULL from Supabase
  2. Deletes their ChromaDB vector chunks (via VectorStore)
  3. Deletes the document_chunks rows from Supabase
  4. Deletes the documents rows from Supabase

SAFETY:
  - Idempotent — safe to run multiple times
  - DRY RUN mode by default (set DRY_RUN=false env var to actually delete)
  - Prints a full summary before deleting

USAGE:
  cd backend
  source venv/bin/activate
  python scripts/migrate_null_user_ids.py                    # dry run (safe)
  DRY_RUN=false python scripts/migrate_null_user_ids.py      # real delete
"""

import os
import sys
from pathlib import Path

# Allow importing app modules from backend/
sys.path.insert(0, str(Path(__file__).parent.parent))

DRY_RUN = os.environ.get("DRY_RUN", "true").lower() != "false"


def main():
    from app.config import get_settings
    import httpx

    s = get_settings()
    base = s.supabase_url
    headers = {
        "apikey": s.supabase_service_role_key,
        "Authorization": f"Bearer {s.supabase_service_role_key}",
        "Content-Type": "application/json",
    }

    print("=" * 60)
    print("USER ISOLATION MIGRATION SCRIPT")
    print(f"Mode: {'DRY RUN (no data will be deleted)' if DRY_RUN else '*** LIVE — data WILL be deleted ***'}")
    print("=" * 60)

    # ── Step 1: Find orphaned documents ──────────────────────────────
    print("\nStep 1: Finding documents with user_id = NULL...")
    r = httpx.get(
        f"{base}/rest/v1/documents",
        headers=headers,
        params={"user_id": "is.null", "select": "id,original_filename,status,created_at"},
    )
    r.raise_for_status()
    orphans = r.json()

    if not orphans:
        print("  No orphaned documents found. Database is already clean.")
        return

    print(f"  Found {len(orphans)} orphaned document(s):\n")
    for doc in orphans:
        print(f"    [{doc['status']:10}] {doc['original_filename']:<40} created: {doc['created_at'][:19]}")

    if DRY_RUN:
        print(f"\nDRY RUN: would delete {len(orphans)} documents and all their chunks.")
        print("Run with DRY_RUN=false to actually delete them.")
        return

    # ── Step 2: Delete ChromaDB chunks ────────────────────────────────
    print(f"\nStep 2: Deleting ChromaDB vector chunks for {len(orphans)} documents...")
    try:
        from app.services.vector_store import VectorStore
        vs = VectorStore()
        total_chroma_deleted = 0
        for doc in orphans:
            n = vs.delete_chunks(doc["id"])
            total_chroma_deleted += n
            print(f"  ChromaDB: deleted {n} chunks for doc {doc['id'][:8]}...")
        print(f"  ChromaDB total deleted: {total_chroma_deleted} chunks")
    except Exception as e:
        print(f"  WARNING: ChromaDB cleanup failed: {e}")
        print("  Continuing with Supabase cleanup...")

    # ── Step 3: Delete document_chunks rows (FK cascade also handles it)
    print(f"\nStep 3: Deleting Supabase document_chunks rows...")
    for doc_id in [doc["id"] for doc in orphans]:
        r = httpx.delete(
            f"{base}/rest/v1/document_chunks",
            headers=headers,
            params={"document_id": f"eq.{doc_id}"},
        )
        if r.status_code not in (200, 204):
            print(f"  WARNING: chunk delete for {doc_id[:8]} returned {r.status_code}")
    print(f"  Supabase document_chunks cleaned for {len(orphans)} documents")

    # ── Step 4: Delete documents rows ─────────────────────────────────
    print(f"\nStep 4: Deleting {len(orphans)} orphaned document rows from Supabase...")
    r = httpx.delete(
        f"{base}/rest/v1/documents",
        headers=headers,
        params={"user_id": "is.null"},
    )
    if r.status_code not in (200, 204):
        print(f"  ERROR: documents delete returned {r.status_code}: {r.text[:200]}")
        sys.exit(1)
    print(f"  Deleted {len(orphans)} orphaned document rows")

    # ── Step 5: Verify ────────────────────────────────────────────────
    print("\nStep 5: Verifying cleanup...")
    r = httpx.get(
        f"{base}/rest/v1/documents",
        headers=headers,
        params={"user_id": "is.null", "select": "id"},
    )
    remaining = r.json()
    if remaining:
        print(f"  WARNING: {len(remaining)} documents with user_id=NULL still remain!")
    else:
        print("  Verification passed — 0 orphaned documents remain")

    print("\n" + "=" * 60)
    print(f"MIGRATION COMPLETE: {len(orphans)} orphaned documents deleted")
    print("=" * 60)


if __name__ == "__main__":
    main()
