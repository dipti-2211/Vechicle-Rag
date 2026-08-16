"""
Vehicle Intelligence Assistant — Backend Auth Dependency

Verifies Supabase JWT tokens on incoming requests and extracts the
authenticated user's UUID (the `sub` claim).

Security model:
  - The frontend sends `Authorization: Bearer <supabase_access_token>` on every request.
  - This module verifies the JWT signature using SUPABASE_JWT_SECRET.
  - The `sub` claim of a verified token is the user's UUID in auth.users.
  - All routes use `user_id = Depends(get_current_user)` to get the current user.
  - `require_user` raises HTTP 401 if no valid JWT was provided.

The service role key is NOT used here — it stays in config for DB operations.

JWT Secret encoding note:
  Supabase/GoTrue signs tokens with []byte(rawSecret) — i.e., the UTF-8 bytes
  of the JWT secret string as-is. PyJWT accepts the raw string directly and
  treats it the same way. Do NOT base64-decode the secret before passing it here.
"""

import logging
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Request, status

from app.config import get_settings

logger = logging.getLogger(__name__)


def get_current_user(request: Request) -> Optional[str]:
    """
    Extract and verify the Supabase JWT from the Authorization header.

    Returns the user UUID string (auth.users.id / JWT `sub` claim),
    or None if no token is present / the token is invalid.

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

    jwt_secret = settings.supabase_jwt_secret
    if not jwt_secret:
        # JWT secret not configured — log warning and skip verification.
        # This allows local dev without auth to keep working.
        logger.warning(
            "SUPABASE_JWT_SECRET is not set — JWT verification skipped. "
            "All requests will be treated as unauthenticated."
        )
        return None

    try:
        payload = jwt.decode(
            token,
            jwt_secret,                 # raw string — matches GoTrue []byte(secret)
            algorithms=["HS256"],
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
