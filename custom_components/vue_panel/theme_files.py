"""Runtime theme catalog for Vue Panel.

A theme is a plain directory holding a single ``main.css`` (all styles plus a
metadata comment header) and optional flat ``<Component>.js`` runtime modules.
Bundled themes ship read-only inside the integration package; user themes live
under ``<config>/vue-panel/themes/<name>/`` and override bundled themes with
the same directory name.
"""

from __future__ import annotations

import asyncio
import re
from pathlib import Path
from typing import Any

from homeassistant.core import HomeAssistant

from .const import INTEGRATION_VERSION, PRIVATE_DIRECTORY

__all__ = [
    "ThemeFileError",
    "ThemeNotFound",
    "ThemeRepository",
]

THEMES_DIRECTORY = "themes"
MAIN_STYLESHEET = "main.css"
MAX_THEME_FILE_BYTES = 512 * 1024
ALLOWED_SUFFIXES = {".css", ".js"}
THEME_NAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]*$")

# Metadata fields recognized in the main.css header comment.
_HEADER_FIELDS = {
    "theme name": "themeName",
    "description": "description",
    "version": "version",
    "author": "author",
    "requires vue panel": "requiresVuePanel",
}


class ThemeFileError(Exception):
    """Theme storage failed."""


class ThemeNotFound(ThemeFileError):
    """The requested theme does not exist."""


def _parse_header(stylesheet: str) -> dict[str, str]:
    """Read the metadata comment header at the top of main.css."""

    meta = {field: "" for field in _HEADER_FIELDS.values()}
    match = re.match(r"\s*/\*(.*?)\*/", stylesheet, re.DOTALL)
    if not match:
        return meta
    for line in match.group(1).splitlines():
        key, _, value = line.partition(":")
        field = _HEADER_FIELDS.get(key.strip().lower())
        if field:
            meta[field] = value.strip()
    return meta


def _version_tuple(version: str) -> tuple[int, ...]:
    """Leading dotted numbers of a version string — pre-release tags ignored."""

    match = re.match(r"(\d+(?:\.\d+)*)", version.strip())
    if not match:
        return ()
    return tuple(int(part) for part in match.group(1).split("."))


def _is_compatible(required: str) -> bool:
    if not required:
        return True
    required_tuple = _version_tuple(required)
    if not required_tuple:
        return True
    return _version_tuple(INTEGRATION_VERSION) >= required_tuple


def _theme_directories(private_root: Path, bundled_root: Path) -> dict[str, tuple[Path, str]]:
    """All installed themes by name — local themes override bundled ones."""

    directories: dict[str, tuple[Path, str]] = {}
    for root, source in ((bundled_root, "bundled"), (private_root, "local")):
        if not root.is_dir():
            continue
        for path in sorted(root.iterdir()):
            if not path.is_dir() or not THEME_NAME_PATTERN.match(path.name):
                continue
            if not (path / MAIN_STYLESHEET).is_file():
                continue
            directories[path.name] = (path, source)
    return directories


def _theme_files(path: Path) -> dict[str, str]:
    files: dict[str, str] = {}
    for file in sorted(path.iterdir()):
        if not file.is_file() or file.suffix not in ALLOWED_SUFFIXES:
            continue
        if file.stat().st_size > MAX_THEME_FILE_BYTES:
            raise ThemeFileError(f"Theme file too large: {file.name}")
        # utf-8-sig tolerates a BOM, which would otherwise corrupt the first CSS selector
        files[file.name] = file.read_text(encoding="utf-8-sig")
    return files


def _entry(name: str, path: Path, source: str, stylesheet: str) -> dict[str, Any]:
    meta = _parse_header(stylesheet)
    components = sorted(file.stem for file in path.iterdir() if file.is_file() and file.suffix == ".js")
    return {
        "name": name,
        "themeName": meta["themeName"] or name,
        "description": meta["description"],
        "version": meta["version"],
        "author": meta["author"],
        "requiresVuePanel": meta["requiresVuePanel"],
        "components": components,
        "source": source,
        "compatible": _is_compatible(meta["requiresVuePanel"]),
    }


def list_themes(private_root: Path, bundled_root: Path) -> list[dict[str, Any]]:
    """The catalog of installed themes with their metadata."""

    catalog = []
    for name, (path, source) in _theme_directories(private_root, bundled_root).items():
        stylesheet = (path / MAIN_STYLESHEET).read_text(encoding="utf-8-sig")
        catalog.append(_entry(name, path, source, stylesheet))
    catalog.sort(key=lambda entry: (entry["name"] != "default", entry["name"]))
    return catalog


def read_theme(private_root: Path, bundled_root: Path, name: str) -> dict[str, Any]:
    """One full theme package: metadata plus every file."""

    if not THEME_NAME_PATTERN.match(name):
        raise ThemeNotFound(f"Unknown theme: {name}")
    located = _theme_directories(private_root, bundled_root).get(name)
    if located is None:
        raise ThemeNotFound(f"Unknown theme: {name}")
    path, source = located
    files = _theme_files(path)
    document = _entry(name, path, source, files[MAIN_STYLESHEET])
    document["files"] = files
    return document


class ThemeRepository:
    """Serialize theme access and run blocking file operations off-loop."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass
        self._private_root = (
            Path(hass.config.path(PRIVATE_DIRECTORY)) / THEMES_DIRECTORY
        )
        self._bundled_root = Path(__file__).parent / "bundled_themes"
        self._lock = asyncio.Lock()

    async def _async_storage(self, operation: Any, *args: Any) -> Any:
        try:
            return await self._hass.async_add_executor_job(operation, *args)
        except OSError as error:
            raise ThemeFileError("Theme storage operation failed") from error

    async def async_list(self) -> list[dict[str, Any]]:
        """Return the installed theme catalog."""

        async with self._lock:
            return await self._async_storage(
                list_themes, self._private_root, self._bundled_root
            )

    async def async_get(self, name: str) -> dict[str, Any]:
        """Return one full theme package."""

        async with self._lock:
            return await self._async_storage(
                read_theme, self._private_root, self._bundled_root, name
            )
