"""
Vehicle Metadata Extractor

Extracts vehicle name (make + model + year) and manufacturer from raw document text
using regex patterns and a curated manufacturer list. No external API calls required.
"""

import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ── Curated manufacturer list ──────────────────────────────────────────────────
MANUFACTURERS = [
    # Japanese
    "Toyota", "Honda", "Nissan", "Mazda", "Subaru", "Mitsubishi", "Suzuki",
    "Lexus", "Infiniti", "Acura", "Isuzu", "Daihatsu",
    # American
    "Ford", "Chevrolet", "Chevy", "Dodge", "Jeep", "Ram", "Chrysler",
    "Cadillac", "Buick", "GMC", "Lincoln", "Tesla",
    # German
    "BMW", "Mercedes", "Mercedes-Benz", "Audi", "Volkswagen", "VW",
    "Porsche", "Opel", "Mini",
    # Korean
    "Hyundai", "Kia", "Genesis",
    # European / Other
    "Volvo", "Peugeot", "Renault", "Fiat", "Alfa Romeo", "Ferrari",
    "Lamborghini", "Maserati", "Land Rover", "Jaguar", "Range Rover",
    "Bentley", "Rolls-Royce", "Aston Martin", "McLaren",
    # Indian / Other
    "Tata", "Mahindra", "Maruti", "Bajaj", "Hero",
]

# Sorted longest-first so multi-word names (e.g. "Rolls-Royce") match before shorter ones
_MANUFACTURERS_SORTED = sorted(MANUFACTURERS, key=len, reverse=True)

# ── Year pattern (1900–2099) ───────────────────────────────────────────────────
_YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")

# ── Vehicle detection patterns ─────────────────────────────────────────────────
# Matches: "Toyota Camry 2020", "2019 Honda Civic", "BMW 3 Series", etc.
_VEHICLE_PATTERNS = [
    # YEAR MAKE MODEL  e.g. "2020 Toyota Camry"
    re.compile(
        r"\b((?:19|20)\d{2})\s+("
        + "|".join(re.escape(m) for m in _MANUFACTURERS_SORTED)
        + r")\s+([A-Z][A-Za-z0-9][A-Za-z0-9\-]*(?:\s+(?:[A-Z][A-Za-z0-9\-]+|\d[A-Za-z0-9]*)){0,1})",
        re.IGNORECASE,
    ),
    # MAKE MODEL YEAR  e.g. "Toyota Camry 2020"
    re.compile(
        r"\b("
        + "|".join(re.escape(m) for m in _MANUFACTURERS_SORTED)
        + r")\s+([A-Z][A-Za-z0-9][A-Za-z0-9\-]*(?:\s+(?:[A-Z][A-Za-z0-9\-]+|\d[A-Za-z0-9]*)){0,1})\s+((?:19|20)\d{2})\b",
        re.IGNORECASE,
    ),
    # MAKE MODEL (no year)  e.g. "Honda Civic", "BMW 3 Series"
    re.compile(
        r"\b("
        + "|".join(re.escape(m) for m in _MANUFACTURERS_SORTED)
        + r")\s+([A-Z][A-Za-z0-9][A-Za-z0-9\-]*(?:\s+(?:[A-Z][A-Za-z0-9\-]+|\d[A-Za-z0-9]*)){0,1})\b",
        re.IGNORECASE,
    ),
]

# Words that look like model names but aren't (avoids false positives)
_STOPWORDS = {
    "manual", "owner", "owners", "service", "repair", "guide", "handbook",
    "maintenance", "technical", "document", "the", "this", "that", "page",
    "model", "series", "edition", "version", "type", "class",
}


class MetadataExtractor:
    """
    Extracts vehicle metadata from raw document text.

    Usage:
        result = MetadataExtractor.extract(text)
        # {"vehicle_name": "Toyota Camry 2020", "manufacturer": "Toyota"}
    """

    @staticmethod
    def extract(text: str) -> dict:
        """
        Scan the first 4000 characters of text for vehicle information.

        Args:
            text: Raw document text.

        Returns:
            dict with keys ``vehicle_name`` and ``manufacturer``, both may be None.
        """
        vehicle_name: Optional[str] = None
        manufacturer: Optional[str] = None

        # Only scan beginning of document (title area is most reliable)
        sample = text[:4000]

        # ── Try structured vehicle patterns ────────────────────────────────────
        for pattern in _VEHICLE_PATTERNS:
            match = pattern.search(sample)
            if not match:
                continue

            groups = match.groups()

            if len(groups) == 3:
                g0, g1, g2 = groups
                # Determine order: year-first (year, make, model) or make-first (make, model, year)
                if re.match(r'^(?:19|20)\d{2}$', g0):   # year-first
                    year_str, make, model = g0, g1, g2
                elif re.match(r'^(?:19|20)\d{2}$', g2): # make-first year-last
                    make, model, year_str = g0, g1, g2
                else:
                    make, model, year_str = g0, g1, None  # fallback

                model_words = model.strip().split()
                # Only reject if the FIRST word of the model is a stopword
                if model_words and model_words[0].lower() in _STOPWORDS:
                    continue

                manufacturer = _normalize_manufacturer(make)
                if year_str:
                    vehicle_name = f"{make.title()} {model.title()} {year_str}".strip()
                else:
                    vehicle_name = f"{make.title()} {model.title()}".strip()
                break

            elif len(groups) == 2:
                # Make + Model (no year)
                make, model = groups
                model_words = model.strip().split()
                # Only reject if the FIRST word of the model is a stopword
                if model_words and model_words[0].lower() in _STOPWORDS:
                    continue

                manufacturer = _normalize_manufacturer(make)
                vehicle_name = f"{make.title()} {model.title()}".strip()
                break

        # ── Fallback: just detect manufacturer ────────────────────────────────
        if not manufacturer:
            for mfr in _MANUFACTURERS_SORTED:
                pattern = re.compile(r"\b" + re.escape(mfr) + r"\b", re.IGNORECASE)
                if pattern.search(sample):
                    manufacturer = _normalize_manufacturer(mfr)
                    break

        if vehicle_name or manufacturer:
            logger.info(
                "Metadata extracted — vehicle: %s | manufacturer: %s",
                vehicle_name,
                manufacturer,
            )
        else:
            logger.debug("No vehicle metadata found in document.")

        return {"vehicle_name": vehicle_name, "manufacturer": manufacturer}


def _normalize_manufacturer(name: str) -> str:
    """Normalize manufacturer name to canonical form."""
    aliases = {
        "chevy": "Chevrolet",
        "vw": "Volkswagen",
        "mercedes": "Mercedes-Benz",
        "benz": "Mercedes-Benz",
        "range rover": "Land Rover",
        "bmw": "BMW",
        "gmc": "GMC",
    }
    return aliases.get(name.lower(), name.title())
