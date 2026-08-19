"""
Vehicle Intelligence Assistant — Shared Application Constants

DEMO_USER_ID is a fixed UUID used to own the two shared demo documents
that every non-anonymous user can read (but not modify or delete).

This ID does NOT correspond to a real sign-up — it is a system-level
owner used only by seed_demo.py (run once manually at deploy time).

If documents.user_id has a FK → auth.users(id) in your Supabase schema,
you must create a matching row in auth.users before running seed_demo.py.
See seed_demo.py's docstring for the exact SQL.
"""

# System account UUID — must never be a real user's ID.
# Zero-prefixed NIL-adjacent UUID makes it visually distinct in DB logs.
DEMO_USER_ID: str = "65dfde00-04e5-4610-a81c-4e70d790de98"
# ^ This is the Supabase-assigned UUID for demo@internal.local (created 2026-08-19).
# The account has: no password (cannot log in), app_metadata.cannot_login=true.
# Verify in Supabase dashboard: Authentication → Users → demo@internal.local
