"""
Vehicle Intelligence Assistant — Document Parser Service

Responsible for extracting raw text from uploaded files (PDF, CSV, XLSX, TXT, DOCX).
"""

import logging
from pathlib import Path

import pandas as pd
from pypdf import PdfReader

logger = logging.getLogger(__name__)


class DocumentParser:
    """Service to parse and extract text from various document formats."""

    @staticmethod
    def parse(file_path: str, file_type: str) -> str:
        """
        Route to the correct parser based on file_type.

        Args:
            file_path: Absolute or relative path to the file.
            file_type: Extension (pdf, csv, xlsx, txt).

        Returns:
            Extracted text as a single string.
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        file_type = file_type.lower()
        
        try:
            if file_type == 'pdf':
                return DocumentParser._parse_pdf(path)
            elif file_type == 'csv':
                return DocumentParser._parse_csv(path)
            elif file_type == 'xlsx':
                return DocumentParser._parse_excel(path)
            elif file_type == 'txt':
                return DocumentParser._parse_txt(path)
            elif file_type == 'docx':
                return DocumentParser._parse_docx(path)
            else:
                raise ValueError(f"Unsupported file type for parsing: {file_type}")
        except Exception as e:
            logger.error("Error parsing %s: %s", file_path, e)
            raise RuntimeError(f"Failed to parse document: {e}")

    @staticmethod
    def _parse_pdf(path: Path) -> str:
        """Extract text from a PDF file."""
        text = []
        with open(path, 'rb') as f:
            reader = PdfReader(f)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text.append(page_text)
        return "\n\n".join(text)

    @staticmethod
    def _parse_csv(path: Path) -> str:
        """Extract text from a CSV by converting rows to readable text."""
        for encoding in ('utf-8', 'utf-8-sig', 'latin-1', 'cp1252'):
            try:
                df = pd.read_csv(path, encoding=encoding)
                return df.to_string(index=False)
            except (UnicodeDecodeError, Exception):
                continue
        raise RuntimeError(f"Could not read CSV file with any supported encoding: {path}")

    @staticmethod
    def _parse_excel(path: Path) -> str:
        """Extract text from an Excel file (all sheets concatenated)."""
        try:
            all_sheets = pd.read_excel(path, sheet_name=None)  # dict of {sheet_name: df}
            parts = []
            for sheet_name, df in all_sheets.items():
                parts.append(f"=== Sheet: {sheet_name} ===")
                parts.append(df.to_string(index=False))
            return "\n\n".join(parts)
        except Exception:
            # Fallback: try reading just the first sheet
            df = pd.read_excel(path)
            return df.to_string(index=False)

    @staticmethod
    def _parse_txt(path: Path) -> str:
        """Read plain text, trying common encodings."""
        for encoding in ('utf-8', 'utf-8-sig', 'latin-1', 'cp1252'):
            try:
                with open(path, 'r', encoding=encoding) as f:
                    return f.read()
            except (UnicodeDecodeError, LookupError):
                continue
        # Last resort: read as bytes and decode with errors='replace'
        with open(path, 'rb') as f:
            return f.read().decode('utf-8', errors='replace')

    @staticmethod
    def _parse_docx(path: Path) -> str:
        """
        Read DOCX files.
        Requires 'python-docx' which we will install if needed, 
        or we can just fall back to a simple implementation.
        """
        try:
            import docx
            doc = docx.Document(path)
            return "\n".join([para.text for para in doc.paragraphs])
        except ImportError:
            logger.warning("python-docx not installed. DOCX parsing will fail.")
            raise RuntimeError("python-docx is required to parse .docx files")
