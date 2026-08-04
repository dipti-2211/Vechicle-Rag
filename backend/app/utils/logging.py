"""
Vehicle Maintenance RAG — Structured Logging

Configures Python's built-in logging with structured JSON output
for production and human-readable output for development.
"""

import logging
import sys
from datetime import datetime, timezone


class JSONFormatter(logging.Formatter):
    """Structured JSON log formatter for production environments."""

    def format(self, record: logging.LogRecord) -> str:
        import json

        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        if record.exc_info and record.exc_info[0] is not None:
            log_entry["exception"] = self.formatException(record.exc_info)

        if hasattr(record, "extra_data"):
            log_entry["data"] = record.extra_data

        return json.dumps(log_entry)


class DevFormatter(logging.Formatter):
    """Colorized, human-readable formatter for development."""

    COLORS = {
        "DEBUG": "\033[36m",     # Cyan
        "INFO": "\033[32m",      # Green
        "WARNING": "\033[33m",   # Yellow
        "ERROR": "\033[31m",     # Red
        "CRITICAL": "\033[1;31m",  # Bold Red
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, self.RESET)
        timestamp = datetime.now().strftime("%H:%M:%S")
        return (
            f"{color}[{timestamp}] {record.levelname:<8}{self.RESET} "
            f"\033[90m{record.name}\033[0m — {record.getMessage()}"
        )


def setup_logging(debug: bool = True) -> None:
    """
    Configure the root logger for the application.

    Args:
        debug: If True, uses colorized dev output at DEBUG level.
               If False, uses JSON output at INFO level (production).
    """
    root_logger = logging.getLogger()

    # Clear any existing handlers
    root_logger.handlers.clear()

    # Set level based on environment
    level = logging.DEBUG if debug else logging.INFO
    root_logger.setLevel(level)

    # Configure stdout handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)

    if debug:
        handler.setFormatter(DevFormatter())
    else:
        handler.setFormatter(JSONFormatter())

    root_logger.addHandler(handler)

    # Suppress noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("chromadb").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """
    Get a named logger instance.

    Args:
        name: Logger name, typically __name__ of the calling module.

    Returns:
        Configured logger instance.
    """
    return logging.getLogger(name)
