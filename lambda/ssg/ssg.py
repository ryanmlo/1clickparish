#!/usr/bin/env python3
import datetime as _dt
import html
import json
import re
import shutil
import datetime
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Match
DEFAULT_PRIMARY_COLOR = "#222222"  # i add a random color

# === Input/Output paths (config) ============================================

# Get the directory where this script is located
SCRIPT_DIR: Path = Path(__file__).resolve().parent

PARISH_JSON_PATH: Path = SCRIPT_DIR / "assets/parish.json" # fallback only in prod, should ordinarily receive json object from form
PARISH_TEMPLATE_PATH: Path = SCRIPT_DIR / "assets/templates/default_template/template.html"
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
    use_liturgical_colors: bool = False

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

def render_template_with_context(template_html: str, template_context: Dict[str, str]) -> str:
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
        raise ValueError(f"{PARISH_JSON_PATH} missing required fields: {', '.join(missing)}")
    return ParishRecord(
        parish_name=raw["parish_name"].strip(),
        parish_city=raw["parish_city"].strip(),
        mass_times=raw["mass_times"].strip(),
        parish_address=raw["parish_address"].strip(),
        announcements=raw["announcements"].strip(),
        contact_phone=raw["contact_phone"].strip(),
        contact_email=raw["contact_email"].strip(),
        use_liturgical_colors=bool(raw.get("use_liturgical_colors", False)),
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
        "announcements_html": escape_text_to_paragraphs_html(parish_record.announcements),

        # Helpers/meta
        "contact_email_display": obfuscate_email_for_display(parish_record.contact_email),
        "built_at": build_timestamp_utc,
    }

    rendered_html: str = render_template_with_context(parish_template_html, template_context)

    # --- CSS generation with optional liturgical colors ---
    # Read the CSS template
    css_template: str = SOURCE_CSS_PATH.read_text(encoding="utf-8")

    # Decide which primary color to use
    if parish_record.use_liturgical_colors:
        # Use a color based on the current liturgical season
        primary_color = get_liturgical_color(datetime.date.today())
    else:
        # Fallback to a standard, plain color
        primary_color = DEFAULT_PRIMARY_COLOR

    # Replace the placeholder in the CSS template
    css_rendered: str = css_template.replace("{{PRIMARY_COLOR}}", primary_color)

    # --- Write outputs ---
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_HTML_PATH.write_text(rendered_html, encoding="utf-8")
    OUTPUT_CSS_PATH.write_text(css_rendered, encoding="utf-8")

    print(f"Wrote {OUTPUT_HTML_PATH} and {OUTPUT_CSS_PATH}")

def _compute_easter(year: int) -> _dt.date:
    """
    Computus: calculate Easter Sunday for the given year (Gregorian calendar).
    This is the Meeus/Jones/Butcher algorithm.
    """
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return _dt.date(year, month, day)


def get_liturgical_color(today: _dt.date) -> str:
    """
    Return the Catholic liturgical color for the given date,
    following USCCB seasonal rules in a simplified but accurate way.
    """

    year = today.year
    easter = _compute_easter(year)

    # --- Key liturgical dates ---
    ash_wednesday = easter - _dt.timedelta(days=46)
    palm_sunday = easter - _dt.timedelta(days=7)
    holy_thursday = easter - _dt.timedelta(days=3)
    good_friday = easter - _dt.timedelta(days=2)
    holy_saturday = easter - _dt.timedelta(days=1)
    pentecost = easter + _dt.timedelta(days=49)

    christmas = _dt.date(year, 12, 25)
    epiphany = _dt.date(year + 1 if today.month == 12 else year, 1, 6)

    # Advent begins 4 Sundays before Christmas
    advent_start = christmas - _dt.timedelta(days=(christmas.weekday() + 22))  # 4 Sundays before

    # --- Assign colors based on the seasons ---

    # CHRISTMAS SEASON: from Dec 25 → Epiphany (Jan 6)
    if (today >= christmas) or (today <= epiphany):
        return "#ffffff"  # white

    # ADVENT: from Advent start → Dec 24
    if advent_start <= today < christmas:
        # Gaudete Sunday (3rd Sunday of Advent) = rose
        gaudete = advent_start + _dt.timedelta(days=14)
        if today == gaudete:
            return "#e879f9"  # rose
        return "#6b21a8"  # violet

    # LENT: Ash Wednesday → Holy Thursday
    if ash_wednesday <= today < holy_thursday:
        # Laetare Sunday (4th Sunday of Lent): rose
        laetare = ash_wednesday + _dt.timedelta(days=21)
        if today == laetare:
            return "#e879f9"  # rose
        return "#6b21a8"  # violet

    # TRIDUUM (special red days)
    if today == palm_sunday or today == good_friday:
        return "#b91c1c"  # red

    # EASTER SEASON: Easter → Pentecost
    if easter <= today <= pentecost:
        return "#ffffff"  # white

    # ORDINARY TIME (everything else)
    return "#166534"  # green

if __name__ == "__main__":
    main()
