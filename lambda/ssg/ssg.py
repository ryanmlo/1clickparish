#!/usr/bin/env python3
import datetime
import html
import json
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Match

# === Input/Output paths (config) ============================================

# Get the directory where this script is located
SCRIPT_DIR: Path = Path(__file__).resolve().parent

PARISH_JSON_PATH: Path = (
    SCRIPT_DIR / "assets/parish.json"
)  # fallback only in prod, should ordinarily receive json object from form
PARISH_TEMPLATE_PATH: Path = (
    SCRIPT_DIR / "assets/templates/default_template/template.html"
)
SOURCE_CSS_PATH: Path = SCRIPT_DIR / "assets/templates/default_template/style.css"

OUTPUT_DIR: Path = SCRIPT_DIR / "generated_website"
OUTPUT_HTML_PATH: Path = OUTPUT_DIR / "index.html"
OUTPUT_CSS_PATH: Path = OUTPUT_DIR / "style.css"

# === Schema ===================================================================

REQUIRED_FIELDS = [
    "parish_name",
    "parish_city",
    "mass_times",
    "parish_address",
    "announcements",
    "contact_phone",
    "contact_email",
]


@dataclass
class ParishRecord:
    parish_name: str
    parish_city: str
    mass_times: str
    parish_address: str
    announcements: str
    contact_phone: str
    contact_email: str


# === Helpers ==================================================================

PLACEHOLDER_PATTERN = re.compile(r"{{\s*([a-zA-Z0-9_]+)\s*}}")


def obfuscate_email_for_display(email_address: str) -> str:
    """
    Replace '@' and '.' with numeric HTML entities to slightly deter bots,
    while remaining clickable for users (we still use the real address in mailto:).
    """

    def ent(ch: str) -> str:
        return f"&#{ord(ch)};"

    return "".join(ent(c) if c in {"@", "."} else c for c in email_address)


def escape_text_to_paragraphs_html(plain_text: str) -> str:
    """
    Convert untrusted plaintext into safe HTML paragraphs:
      - HTML-escape the text
      - Split on blank lines into <p> blocks
      - Convert single newlines to <br>
    """
    escaped = html.escape(plain_text.strip())
    paragraphs = [p.replace("\n", "<br>") for p in re.split(r"\n\s*\n", escaped)]
    return "<p>" + "</p><p>".join(paragraphs) + "</p>"


def render_template_with_context(
    template_html: str, template_context: Dict[str, str]
) -> str:
    """
    Replace {{placeholders}} using values from template_context.
    Raises KeyError if the template uses a variable not present in the context.
    """

    def _replace(match: Match[str]) -> str:
        key = match.group(1)
        if key not in template_context:
            raise KeyError(f"Missing template variable: {key}")
        return str(template_context[key])

    return PLACEHOLDER_PATTERN.sub(_replace, template_html)


def load_parish_record() -> ParishRecord:
    """Read and validate the single parish JSON file, returning a ParishRecord."""
    raw: Dict[str, str] = json.loads(PARISH_JSON_PATH.read_text(encoding="utf-8"))
    missing = [k for k in REQUIRED_FIELDS if k not in raw or str(raw[k]).strip() == ""]
    if missing:
        raise ValueError(
            f"{PARISH_JSON_PATH} missing required fields: {', '.join(missing)}"
        )
    return ParishRecord(
        parish_name=raw["parish_name"].strip(),
        parish_city=raw["parish_city"].strip(),
        mass_times=raw["mass_times"].strip(),
        parish_address=raw["parish_address"].strip(),
        announcements=raw["announcements"].strip(),
        contact_phone=raw["contact_phone"].strip(),
        contact_email=raw["contact_email"].strip(),
    )


# === Build ====================================================================


def main() -> None:
    # Hard fail if inputs are not present
    for required_path in (PARISH_JSON_PATH, PARISH_TEMPLATE_PATH, SOURCE_CSS_PATH):
        if not required_path.exists():
            raise FileNotFoundError(f"Expected {required_path}")

    parish_record: ParishRecord = load_parish_record()
    parish_template_html: str = PARISH_TEMPLATE_PATH.read_text(encoding="utf-8")
    build_timestamp_utc: str = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")  # type: ignore

    template_context: Dict[str, str] = {
        # Escaped scalars
        "parish_name": html.escape(parish_record.parish_name),
        "parish_city": html.escape(parish_record.parish_city),
        "parish_address": html.escape(parish_record.parish_address),
        "contact_phone": html.escape(parish_record.contact_phone),
        "contact_email": html.escape(parish_record.contact_email),
        # Formatted blocks
        "mass_html": escape_text_to_paragraphs_html(parish_record.mass_times),
        "announcements_html": escape_text_to_paragraphs_html(
            parish_record.announcements
        ),
        # Helpers/meta
        "contact_email_display": obfuscate_email_for_display(
            parish_record.contact_email
        ),
        "built_at": build_timestamp_utc,
    }

    rendered_html: str = render_template_with_context(
        parish_template_html, template_context
    )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_HTML_PATH.write_text(rendered_html, encoding="utf-8")
    shutil.copyfile(SOURCE_CSS_PATH, OUTPUT_CSS_PATH)

    print(f"Wrote {OUTPUT_HTML_PATH} and {OUTPUT_CSS_PATH}")


if __name__ == "__main__":
    main()
