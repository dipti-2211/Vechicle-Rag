"""
Vehicle Intelligence Assistant — Backend Auth Dependency

Verifies Supabase JWT tokens on incoming requests and extracts the
authenticated user's UUID (the `sub` claim).

Security model:
  - The frontend sends `Authorization: Bearer <supabase_access_token>` on every request.
  - This module verifies the JWT signature using Supabase's public JWKS endpoint:
      {SUPABASE_URL}/auth/v1/.well-known/jwks.json
  - The JWKS client is cached (module-level lru_cache) so the public keys are
    fetched at most once per process lifetime, not on every request.
  - Supported algorithms: ES256, RS256, HS256 — works regardless of which
    signing algorithm the Supabase project is configured with.
  - The `sub` claim of a verified token is the user's UUID in auth.users.
  - All routes use `user_id = Depends(get_current_user)` to get the current user.
  - `require_user` raises HTTP 401 if no valid JWT was provided.

The service role key is NOT used here — it stays in config for DB operations.

Why JWKS instead of a static secret?
  Supabase projects can be configured with either:
    * HS256 — symmetric, signed with the raw JWT secret string.
    * ES256 / RS256 — asymmetric, signed with a private key Supabase controls;
      the public verification key is published at the JWKS endpoint.
  Verifying against a static HS256 secret fails with "The specified alg value
  is not allowed" for asymmetric tokens. Fetching keys from JWKS works for all
  three algorithms transparently.
"""

import logging
from functools import lru_cache
from typing import Optional

import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, Request, status

from app.config import get_settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_jwks_client(jwks_url: str) -> PyJWKClient:
    """
    Return a cached PyJWKClient for the given JWKS URL.

    The client is instantiated once per process (lru_cache with maxsize=1)
    and internally caches the fetched public keys, so network round-trips are
    minimised. The jwks_url is part of the cache key so that if settings
    change between restarts a fresh client is created.

    Args:
        jwks_url: Full URL to the JWKS endpoint, e.g.
                  "https://<project>.supabase.co/auth/v1/.well-known/jwks.json"

    Returns:
        A configured PyJWKClient instance.
    """
    logger.info("Initialising PyJWKClient for JWKS URL: %s", jwks_url)
    return PyJWKClient(jwks_url, cache_keys=True)


def get_current_user(request: Request) -> Optional[str]:
    """
    Extract and verify the Supabase JWT from the Authorization header.

    Verification is performed against Supabase's public JWKS endpoint so that
    both symmetric (HS256) and asymmetric (ES256, RS256) projects work without
    any additional configuration.

    Returns the user UUID string (auth.users.id / JWT `sub` claim),
    or None if:
      - No Authorization header is present.
      - The token is malformed, expired, or fails signature verification.
      - SUPABASE_URL is not configured (local dev without auth).

    Args:
        request: The incoming FastAPI request.

    Returns:
        User UUID string, or None.
    """
    settings = get_settings()

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header[7:]  # strip "Bearer "

    if not settings.supabase_url:
        logger.warning(
            "SUPABASE_URL is not set — JWT verification skipped. "
            "All requests will be treated as unauthenticated."
        )
        return None

    jwks_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"

    try:
        jwks_client = _get_jwks_client(jwks_url)

        # Fetch the matching public key for this specific token's `kid` header.
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        payload = jwt.decode(
            token,
            signing_key,
            algorithms=["ES256", "RS256", "HS256"],
            options={"verify_aud": False},  # Supabase tokens use 'authenticated' audience
        )

        user_id: Optional[str] = payload.get("sub")
        if not user_id:
            logger.debug("JWT verified but 'sub' claim is missing")
            return None

        return user_id

    except jwt.ExpiredSignatureError:
        logger.debug("JWT token expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.debug("Invalid JWT token: %s", e)
        return None
    except Exception as e:
        logger.warning("JWT verification error: %s", e)
        return None


def require_user(
    user_id: Optional[str] = Depends(get_current_user),
) -> str:
    """
    Dependency that REQUIRES a valid authenticated user.

    Raises HTTP 401 if no valid JWT was provided.

    Returns:
        The verified user UUID string.
    """
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user_id

