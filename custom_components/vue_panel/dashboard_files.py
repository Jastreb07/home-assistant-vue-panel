"""Home Assistant adapter for private Vue Panel dashboard storage."""

from __future__ import annotations

import asyncio
from copy import deepcopy
from pathlib import Path
from typing import Any

from homeassistant.config_entries import ConfigEntry, ConfigSubentry
from homeassistant.core import HomeAssistant

from .const import (
    CONF_DASHBOARD_FILE,
    CONF_DASHBOARD_NAME,
    PRIVATE_DIRECTORY,
    SUBENTRY_TYPE_DASHBOARD,
)
from .dashboard_storage import (
    DashboardFileError,
    DashboardRevisionConflict,
    archive_dashboard,
    default_dashboard,
    ensure_dashboard,
    read_dashboard,
    save_dashboard,
    validate_dashboard,
)

__all__ = [
    "DashboardFileError",
    "DashboardRepository",
    "DashboardRevisionConflict",
    "async_ensure_dashboards",
    "default_dashboard",
    "validate_dashboard",
]


def _dashboard_name(subentry: ConfigSubentry) -> str:
    dashboard_name = str(subentry.data[CONF_DASHBOARD_NAME])
    expected_relative_path = f"dashboards/{dashboard_name}.json"
    if subentry.data.get(CONF_DASHBOARD_FILE) != expected_relative_path:
        raise DashboardFileError(
            "Dashboard file metadata does not match its immutable name"
        )
    return dashboard_name


class DashboardRepository:
    """Serialize dashboard access and run blocking file operations off-loop."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass
        self._private_root = Path(hass.config.path(PRIVATE_DIRECTORY))
        self._locks: dict[str, asyncio.Lock] = {}

    def _lock(self, dashboard_name: str) -> asyncio.Lock:
        return self._locks.setdefault(dashboard_name, asyncio.Lock())

    async def async_load(self, subentry: ConfigSubentry) -> dict[str, Any]:
        """Load a validated snapshot of one dashboard."""

        dashboard_name = _dashboard_name(subentry)
        async with self._lock(dashboard_name):
            try:
                document = await self._hass.async_add_executor_job(
                    read_dashboard,
                    self._private_root,
                    dashboard_name,
                )
            except OSError as error:
                raise DashboardFileError("Unable to load dashboard file") from error
            return deepcopy(document)

    async def async_save(
        self,
        subentry: ConfigSubentry,
        document: dict[str, Any],
        expected_revision: int,
    ) -> dict[str, Any]:
        """Save a dashboard when the expected revision is still current."""

        dashboard_name = _dashboard_name(subentry)
        async with self._lock(dashboard_name):
            try:
                return await self._hass.async_add_executor_job(
                    save_dashboard,
                    self._private_root,
                    dashboard_name,
                    document,
                    expected_revision,
                )
            except OSError as error:
                raise DashboardFileError("Unable to save dashboard file") from error

    async def async_import(
        self,
        subentry: ConfigSubentry,
        document: dict[str, Any],
        expected_revision: int,
    ) -> dict[str, Any]:
        """Replace dashboard content while preserving optimistic concurrency."""

        imported = deepcopy(document)
        imported["revision"] = expected_revision
        return await self.async_save(subentry, imported, expected_revision)

    async def async_archive_names(self, dashboard_names: set[str]) -> None:
        """Archive dashboard files after their panels are removed."""

        for dashboard_name in sorted(dashboard_names):
            async with self._lock(dashboard_name):
                try:
                    await self._hass.async_add_executor_job(
                        archive_dashboard,
                        self._private_root,
                        dashboard_name,
                    )
                except OSError as error:
                    raise DashboardFileError(
                        "Unable to archive dashboard file"
                    ) from error


async def async_ensure_dashboards(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Create missing dashboard files and validate existing files."""

    private_root = Path(hass.config.path(PRIVATE_DIRECTORY))
    for subentry in entry.subentries.values():
        if subentry.subentry_type == SUBENTRY_TYPE_DASHBOARD:
            dashboard_name = _dashboard_name(subentry)
            try:
                await hass.async_add_executor_job(
                    ensure_dashboard,
                    private_root,
                    dashboard_name,
                )
            except OSError as error:
                raise DashboardFileError(
                    "Unable to initialize dashboard file"
                ) from error
