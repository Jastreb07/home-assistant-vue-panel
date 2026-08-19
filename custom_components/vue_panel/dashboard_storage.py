"""Validated, revision-safe storage for Vue Panel dashboard documents."""

from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime
import json
import os
from pathlib import Path
import re
import tempfile
from typing import Any

DASHBOARD_FORMAT = "vue-panel-dashboard"
DASHBOARD_FORMAT_VERSION = 1
BACKUP_LIMIT = 5

_IDENTIFIER_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_CARD_TYPE_PATTERN = re.compile(
    r"^[a-z0-9]+(?:-[a-z0-9]+)*/[a-z0-9]+(?:-[a-z0-9]+)*$"
)
_VIEW_PATH_PATTERN = re.compile(
    r"^[a-z0-9]+(?:-[a-z0-9]+)*(?:/[a-z0-9]+(?:-[a-z0-9]+)*)*$"
)
_LAYOUTS = {"sections", "flex", "panel", "sidebar", "grid"}
_BAR_POSITIONS = {"sidebar", "header", "bottom"}
_BAR_SLOTS = {"start", "center", "end"}
_BAR_FIELDS = {"id", "size", "placement", "centerAlign", "css", "slots"}
_BAR_ALIGNMENTS = {"start", "center", "end", "stretch"}
_BAR_PLACEMENTS = {"view", "full"}
_BAR_SIZE_LIMITS = {"sidebar": (160, 560), "header": (40, 240), "bottom": (40, 240)}


class DashboardFileError(Exception):
    """Raised when a dashboard file is unsafe, unreadable, or invalid."""


class DashboardRevisionConflict(DashboardFileError):
    """Raised when a dashboard was modified after the client loaded it."""

    def __init__(self, current_revision: int) -> None:
        super().__init__("Dashboard revision conflict")
        self.current_revision = current_revision


def default_dashboard() -> dict[str, Any]:
    """Return the minimal dashboard created for a new panel."""

    return {
        "format": DASHBOARD_FORMAT,
        "formatVersion": DASHBOARD_FORMAT_VERSION,
        "revision": 1,
        "settings": {
            "theme": "dark",
            "uiTheme": "default",
            "screensaverMinutes": 0,
            "autoReturnSeconds": 0,
        },
        "bars": {
            "sidebar": {
                "id": "bar-sidebar",
                "size": 280,
                "centerAlign": {"vertical": "start", "horizontal": "stretch"},
                "slots": {
                    "start": [],
                    "center": [
                        {
                            "id": "bar-sidebar-nav",
                            "type": "vue-panel/sidebar-bar",
                            "config": {},
                        }
                    ],
                    "end": [],
                },
            },
            "header": {
                "id": "bar-header",
                "size": 64,
                "placement": "view",
                "centerAlign": {"vertical": "center", "horizontal": "center"},
                "slots": {"start": [], "center": [], "end": []},
            },
            "bottom": {
                "id": "bar-bottom",
                "size": 64,
                "placement": "view",
                "centerAlign": {"vertical": "center", "horizontal": "center"},
                "slots": {"start": [], "center": [], "end": []},
            },
        },
        "views": [
            {
                "id": "overview",
                "title": "Übersicht",
                "icon": "mdi:home",
                "path": "overview",
                "layout": "sections",
                "showSidebar": True,
                "showHeader": True,
                "showBottom": True,
                "sections": [],
            }
        ],
    }


def _validate_card(card: Any, identifiers: set[str]) -> None:
    if not isinstance(card, dict):
        raise DashboardFileError("Card entries must be objects")
    card_id = card.get("id")
    if not isinstance(card_id, str) or not _IDENTIFIER_PATTERN.fullmatch(card_id):
        raise DashboardFileError("Card IDs must be URL-safe identifiers")
    if card_id in identifiers:
        raise DashboardFileError("Dashboard IDs must be unique")
    identifiers.add(card_id)
    card_type = card.get("type")
    if not isinstance(card_type, str) or not _CARD_TYPE_PATTERN.fullmatch(card_type):
        raise DashboardFileError("Card types must use manufacturer/card-name")
    if not isinstance(card.get("config"), dict):
        raise DashboardFileError("Card config must be an object")
    if "css" in card and not isinstance(card["css"], str):
        raise DashboardFileError("Card CSS must be a string")
    if "size" in card and not isinstance(card["size"], dict):
        raise DashboardFileError("Card size must be an object")


def _validate_bar(
    position: str,
    bar: Any,
    identifiers: set[str],
) -> None:
    """Validate one global bar container and the cards in its three slots."""

    if not isinstance(bar, dict) or set(bar) - _BAR_FIELDS:
        raise DashboardFileError("Bar entries contain unsupported fields")
    bar_id = bar.get("id")
    if not isinstance(bar_id, str) or not _IDENTIFIER_PATTERN.fullmatch(bar_id):
        raise DashboardFileError("Bar IDs must be URL-safe identifiers")
    if bar_id in identifiers:
        raise DashboardFileError("Dashboard IDs must be unique")
    identifiers.add(bar_id)

    minimum, maximum = _BAR_SIZE_LIMITS[position]
    size = bar.get("size")
    if isinstance(size, bool) or not isinstance(size, int):
        raise DashboardFileError("Bar size must be an integer")
    if not minimum <= size <= maximum:
        raise DashboardFileError("Bar size is out of range")

    placement = bar.get("placement")
    if position == "sidebar":
        if placement is not None:
            raise DashboardFileError("The sidebar has no placement")
    elif placement not in _BAR_PLACEMENTS:
        raise DashboardFileError("Unsupported bar placement")

    align = bar.get("centerAlign")
    if not isinstance(align, dict) or set(align) != {"vertical", "horizontal"}:
        raise DashboardFileError("Bar centerAlign must define both axes")
    if not _BAR_ALIGNMENTS.issuperset(align.values()):
        raise DashboardFileError("Unsupported bar alignment")

    if "css" in bar and not isinstance(bar["css"], str):
        raise DashboardFileError("Bar CSS must be a string")

    slots = bar.get("slots")
    if not isinstance(slots, dict) or set(slots) != _BAR_SLOTS:
        raise DashboardFileError("Bars require exactly three card slots")
    for cards in slots.values():
        if not isinstance(cards, list):
            raise DashboardFileError("Bar slots must be arrays")
        for card in cards:
            _validate_card(card, identifiers)


def validate_dashboard(document: Any) -> dict[str, Any]:
    """Validate and return a dashboard document."""

    if not isinstance(document, dict):
        raise DashboardFileError("Dashboard document must be an object")
    if document.get("format") != DASHBOARD_FORMAT:
        raise DashboardFileError("Unsupported dashboard format")
    if document.get("formatVersion") != DASHBOARD_FORMAT_VERSION:
        raise DashboardFileError("Unsupported dashboard format version")
    revision = document.get("revision")
    if isinstance(revision, bool) or not isinstance(revision, int) or revision < 1:
        raise DashboardFileError("Dashboard revision must be a positive integer")
    if not isinstance(document.get("settings"), dict):
        raise DashboardFileError("Dashboard settings must be an object")
    bars = document.get("bars")
    if not isinstance(bars, dict) or not set(bars).issubset(_BAR_POSITIONS):
        raise DashboardFileError("Dashboard bars contain an unsupported position")
    views = document.get("views")
    if not isinstance(views, list) or not views:
        raise DashboardFileError("Dashboard requires at least one view")

    identifiers: set[str] = set()
    view_paths: set[str] = set()
    for view in views:
        if not isinstance(view, dict):
            raise DashboardFileError("View entries must be objects")
        view_id = view.get("id")
        if not isinstance(view_id, str) or not _IDENTIFIER_PATTERN.fullmatch(view_id):
            raise DashboardFileError("View IDs must be URL-safe identifiers")
        if view_id in identifiers:
            raise DashboardFileError("Dashboard IDs must be unique")
        identifiers.add(view_id)
        if not isinstance(view.get("title"), str) or not view["title"].strip():
            raise DashboardFileError("Views require a title")
        if view.get("layout") not in _LAYOUTS:
            raise DashboardFileError("Unsupported view layout")
        view_path = view.get("path", view_id)
        if not isinstance(view_path, str) or not _VIEW_PATH_PATTERN.fullmatch(
            view_path
        ):
            raise DashboardFileError("View paths must be URL-safe")
        if view_path in view_paths:
            raise DashboardFileError("View paths must be unique")
        view_paths.add(view_path)
        sections = view.get("sections")
        if not isinstance(sections, list):
            raise DashboardFileError("View sections must be an array")
        for section in sections:
            if not isinstance(section, dict):
                raise DashboardFileError("Section entries must be objects")
            section_id = section.get("id")
            if not isinstance(section_id, str) or not _IDENTIFIER_PATTERN.fullmatch(
                section_id
            ):
                raise DashboardFileError("Section IDs must be URL-safe identifiers")
            if section_id in identifiers:
                raise DashboardFileError("Dashboard IDs must be unique")
            identifiers.add(section_id)
            cards = section.get("cards")
            if not isinstance(cards, list):
                raise DashboardFileError("Section cards must be an array")
            for card in cards:
                _validate_card(card, identifiers)

    for position, bar in bars.items():
        _validate_bar(position, bar, identifiers)
    return document


def _safe_directory(path: Path, label: str) -> None:
    if path.is_symlink():
        raise DashboardFileError(f"{label} must not be a symbolic link")
    path.mkdir(parents=True, exist_ok=True)
    if not path.is_dir():
        raise DashboardFileError(f"{label} is not a directory")


def dashboard_path(private_root: Path, dashboard_name: str) -> Path:
    """Resolve a dashboard path from a validated immutable name."""

    if not _IDENTIFIER_PATTERN.fullmatch(dashboard_name):
        raise DashboardFileError("Dashboard name must be a URL-safe identifier")
    _safe_directory(private_root, "Vue Panel private directory")
    dashboards_root = private_root / "dashboards"
    _safe_directory(dashboards_root, "Dashboard directory")
    path = dashboards_root / f"{dashboard_name}.json"
    if path.is_symlink() or path.parent != dashboards_root:
        raise DashboardFileError("Dashboard path is unsafe")
    return path


def _atomic_write_json(path: Path, document: dict[str, Any]) -> None:
    descriptor, temporary_name = tempfile.mkstemp(
        dir=path.parent,
        prefix=f".{path.name}.",
        suffix=".tmp",
    )
    temporary_path = Path(temporary_name)
    try:
        with os.fdopen(
            descriptor, "w", encoding="utf-8", newline="\n"
        ) as temporary_file:
            json.dump(
                document,
                temporary_file,
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            )
            temporary_file.write("\n")
            temporary_file.flush()
            os.fsync(temporary_file.fileno())
        os.replace(temporary_path, path)
    finally:
        if temporary_path.exists():
            temporary_path.unlink()


def read_dashboard(private_root: Path, dashboard_name: str) -> dict[str, Any]:
    """Read and validate one dashboard."""

    path = dashboard_path(private_root, dashboard_name)
    if not path.is_file():
        raise DashboardFileError("Dashboard path is not a regular file")
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise DashboardFileError("Unable to load dashboard file") from error
    return validate_dashboard(document)


def ensure_dashboard(private_root: Path, dashboard_name: str) -> None:
    """Create one minimal dashboard when it does not exist."""

    path = dashboard_path(private_root, dashboard_name)
    if path.exists():
        read_dashboard(private_root, dashboard_name)
        return
    _atomic_write_json(path, default_dashboard())


def _backup_dashboard(
    private_root: Path,
    dashboard_name: str,
    document: dict[str, Any],
) -> None:
    backups_root = private_root / "backups"
    _safe_directory(backups_root, "Dashboard backup directory")
    backup_root = backups_root / dashboard_name
    _safe_directory(backup_root, "Dashboard-specific backup directory")
    revision = int(document["revision"])
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S%fZ")
    _atomic_write_json(backup_root / f"{revision:010d}-{timestamp}.json", document)
    backups = sorted(
        backup_root.glob("*.json"),
        key=lambda path: path.name,
        reverse=True,
    )
    for expired_backup in backups[BACKUP_LIMIT:]:
        if expired_backup.is_symlink() or not expired_backup.is_file():
            raise DashboardFileError("Unsafe dashboard backup entry")
        expired_backup.unlink()


def save_dashboard(
    private_root: Path,
    dashboard_name: str,
    document: dict[str, Any],
    expected_revision: int,
) -> dict[str, Any]:
    """Atomically save one dashboard after an optimistic revision check."""

    path = dashboard_path(private_root, dashboard_name)
    current = read_dashboard(private_root, dashboard_name)
    current_revision = int(current["revision"])
    if expected_revision != current_revision:
        raise DashboardRevisionConflict(current_revision)

    updated = deepcopy(document)
    if updated.get("revision") != expected_revision:
        raise DashboardFileError("Document revision does not match expected revision")
    updated["revision"] = current_revision + 1
    validate_dashboard(updated)
    _backup_dashboard(private_root, dashboard_name, current)
    _atomic_write_json(path, updated)
    return deepcopy(updated)


def archive_dashboard(private_root: Path, dashboard_name: str) -> bool:
    """Back up and remove a dashboard whose panel was deleted."""

    path = dashboard_path(private_root, dashboard_name)
    if not path.exists():
        return False
    document = read_dashboard(private_root, dashboard_name)
    _backup_dashboard(private_root, dashboard_name, document)
    path.unlink()
    return True
