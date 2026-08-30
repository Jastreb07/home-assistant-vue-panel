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
_BAR_POSITIONS = {"sidebar-left", "sidebar-right", "header", "bottom"}
_BAR_FIELDS = {"id", "size", "placement", "css", "visibility", "columns", "scope", "enabled"}
_BAR_SCOPES = {"global", "perView"}
_RESPONSIVE_VISIBILITY_FIELDS = {
    "mobile",
    "tablet",
    "desktop",
    "mobileMax",
    "tabletMax",
}
_BAR_COLUMN_FIELDS = {
    "id",
    "sizeMode",
    "size",
    "padding",
    "margin",
    "align",
    "crossAlign",
    "cards",
}
_BAR_SIZE_MODES = {"fit", "full", "fixed"}
_BOX_SIDES = {"top", "right", "bottom", "left"}
_BAR_ALIGNMENTS = {"start", "center", "end", "stretch"}
_BAR_PLACEMENTS = {"view", "full"}
_POPUP_FIELDS = {
    "id",
    "title",
    "icon",
    "size",
    "width",
    "height",
    "css",
    "align",
    "padding",
    "sections",
}
_POPUP_SIZES = {"sm", "md", "lg", "full"}
_ALIGNMENTS = {"left", "center", "right"}
_BAR_SIZE_LIMITS = {
    "sidebar-left": (160, 560),
    "sidebar-right": (160, 560),
    "header": (40, 240),
    "bottom": (40, 240),
}


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
            "sidebar-left": {
                "id": "bar-sidebar-left",
                "size": 280,
                "columns": [
                    {
                        "id": "bar-sidebar-left-col",
                        "align": "start",
                        "crossAlign": "stretch",
                        "cards": [
                            {
                                "id": "bar-sidebar-left-clock",
                                "type": "vue-panel/clock",
                                "config": {},
                            },
                            {
                                "id": "bar-sidebar-left-menu",
                                "type": "vue-panel/menu",
                                "config": {},
                            },
                        ],
                    }
                ],
            },
            "sidebar-right": {
                "id": "bar-sidebar-right",
                "size": 280,
                "columns": [
                    {
                        "id": "bar-sidebar-right-col",
                        "align": "start",
                        "crossAlign": "stretch",
                        "cards": [],
                    }
                ],
            },
            "header": {
                "id": "bar-header",
                "size": 64,
                "placement": "view",
                "columns": [
                    {
                        "id": "bar-header-col",
                        "align": "center",
                        "crossAlign": "center",
                        "cards": [],
                    }
                ],
            },
            "bottom": {
                "id": "bar-bottom",
                "size": 64,
                "placement": "view",
                "columns": [
                    {
                        "id": "bar-bottom-col",
                        "align": "center",
                        "crossAlign": "center",
                        "cards": [],
                    }
                ],
            },
        },
        "views": [
            {
                "id": "overview",
                "title": "Übersicht",
                "icon": "mdi:home",
                "path": "overview",
                "layout": "sections",
                "showSidebarLeft": True,
                "showSidebarRight": False,
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
    if "visibility" in card:
        _validate_responsive_visibility(card["visibility"], "Card visibility")
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
    if position.startswith("sidebar"):
        if placement is not None:
            raise DashboardFileError("Sidebars have no placement")
    elif placement not in _BAR_PLACEMENTS:
        raise DashboardFileError("Unsupported bar placement")

    if "css" in bar and not isinstance(bar["css"], str):
        raise DashboardFileError("Bar CSS must be a string")
    if "visibility" in bar:
        _validate_responsive_visibility(bar["visibility"], "Bar visibility")
    if "scope" in bar and bar["scope"] not in _BAR_SCOPES:
        raise DashboardFileError("Unsupported bar scope")
    if "enabled" in bar and not isinstance(bar["enabled"], bool):
        raise DashboardFileError("Bar enabled must be a boolean")

    columns = bar.get("columns")
    if not isinstance(columns, list) or not columns:
        raise DashboardFileError("Bars require at least one column")
    for column in columns:
        _validate_bar_column(column, identifiers)


def _validate_responsive_visibility(value: Any, label: str) -> None:
    if not isinstance(value, dict) or set(value) != _RESPONSIVE_VISIBILITY_FIELDS:
        raise DashboardFileError(f"{label} must be a responsive visibility object")
    for field in ("mobile", "tablet", "desktop"):
        if not isinstance(value[field], bool):
            raise DashboardFileError(f"{label} {field} must be boolean")
    mobile_max = value["mobileMax"]
    tablet_max = value["tabletMax"]
    if (
        isinstance(mobile_max, bool)
        or not isinstance(mobile_max, int)
        or not 320 <= mobile_max <= 2000
        or isinstance(tablet_max, bool)
        or not isinstance(tablet_max, int)
        or not mobile_max < tablet_max <= 4000
    ):
        raise DashboardFileError(f"{label} breakpoints are invalid")


def _validate_box(value: Any, label: str) -> None:
    if not isinstance(value, dict) or set(value) - _BOX_SIDES:
        raise DashboardFileError(f"{label} must be a box object")
    for side in value.values():
        if isinstance(side, bool) or not isinstance(side, (int, float)):
            raise DashboardFileError(f"{label} sides must be numbers")


def _validate_bar_column(column: Any, identifiers: set[str]) -> None:
    """Validate one bar column: geometry, spacing, alignment, and its cards."""

    if not isinstance(column, dict) or set(column) - _BAR_COLUMN_FIELDS:
        raise DashboardFileError("Bar columns contain unsupported fields")
    column_id = column.get("id")
    if not isinstance(column_id, str) or not _IDENTIFIER_PATTERN.fullmatch(column_id):
        raise DashboardFileError("Bar column IDs must be URL-safe identifiers")
    if column_id in identifiers:
        raise DashboardFileError("Dashboard IDs must be unique")
    identifiers.add(column_id)

    size_mode = column.get("sizeMode")
    if size_mode is not None and size_mode not in _BAR_SIZE_MODES:
        raise DashboardFileError("Unsupported bar column size mode")
    effective_mode = size_mode or ("fixed" if "size" in column else "fit")
    if "size" in column:
        size = column["size"]
        if isinstance(size, bool) or not isinstance(size, int) or not 1 <= size <= 1200:
            raise DashboardFileError("Bar column size is out of range")
    if effective_mode == "fixed" and "size" not in column:
        raise DashboardFileError("A fixed-size bar column requires a size")
    for field in ("padding", "margin"):
        if field in column:
            _validate_box(column[field], f"Bar column {field}")
    for field in ("align", "crossAlign"):
        if field in column and column[field] not in _BAR_ALIGNMENTS:
            raise DashboardFileError("Unsupported bar column alignment")

    cards = column.get("cards")
    if not isinstance(cards, list):
        raise DashboardFileError("Bar column cards must be an array")
    for card in cards:
        _validate_card(card, identifiers)


def _validate_view_bar_columns(value: Any, identifiers: set[str]) -> None:
    """Validate one view's per-bar column override (only used for `scope: perView` bars)."""

    if not isinstance(value, dict) or not set(value).issubset(_BAR_POSITIONS):
        raise DashboardFileError("View bar columns contain an unsupported position")
    for columns in value.values():
        if not isinstance(columns, list) or not columns:
            raise DashboardFileError("View bar columns require at least one column")
        for column in columns:
            _validate_bar_column(column, identifiers)


def _validate_sections(sections: Any, identifiers: set[str]) -> None:
    """Validate the section/card tree shared by views and popups."""

    if not isinstance(sections, list):
        raise DashboardFileError("Sections must be an array")
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


def _validate_popup(popup: Any, identifiers: set[str]) -> None:
    """Validate one custom popup: a dialog that hosts its own card sections."""

    if not isinstance(popup, dict) or set(popup) - _POPUP_FIELDS:
        raise DashboardFileError("Popup entries contain unsupported fields")
    popup_id = popup.get("id")
    if not isinstance(popup_id, str) or not _IDENTIFIER_PATTERN.fullmatch(popup_id):
        raise DashboardFileError("Popup IDs must be URL-safe identifiers")
    if popup_id in identifiers:
        raise DashboardFileError("Dashboard IDs must be unique")
    identifiers.add(popup_id)
    if not isinstance(popup.get("title"), str) or not popup["title"].strip():
        raise DashboardFileError("Popups require a title")
    if "icon" in popup and not isinstance(popup["icon"], str):
        raise DashboardFileError("Popup icon must be a string")
    if "size" in popup and popup["size"] not in _POPUP_SIZES:
        raise DashboardFileError("Unsupported popup size")
    for field in ("width", "height"):
        if field in popup:
            value = popup[field]
            if isinstance(value, bool) or not isinstance(value, int) or not 100 <= value <= 4000:
                raise DashboardFileError(f"Popup {field} is out of range")
    if "css" in popup and not isinstance(popup["css"], str):
        raise DashboardFileError("Popup CSS must be a string")
    if "align" in popup and popup["align"] not in _ALIGNMENTS:
        raise DashboardFileError("Unsupported popup alignment")
    if "padding" in popup:
        _validate_box(popup["padding"], "Popup padding")
    _validate_sections(popup.get("sections"), identifiers)


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
        _validate_sections(view.get("sections"), identifiers)
        if "barColumns" in view:
            _validate_view_bar_columns(view["barColumns"], identifiers)

    popups = document.get("popups", [])
    if not isinstance(popups, list):
        raise DashboardFileError("Dashboard popups must be an array")
    for popup in popups:
        _validate_popup(popup, identifiers)

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
