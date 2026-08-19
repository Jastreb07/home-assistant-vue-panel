"""Vue Panel Home Assistant integration."""

from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

from .card_files import CardRepository
from .const import (
    CONF_DASHBOARD_NAME,
    DATA_CARD_REPOSITORY,
    DATA_REPOSITORY,
    DOMAIN,
    SUBENTRY_TYPE_DASHBOARD,
)
from .dashboard_files import (
    DashboardFileError,
    DashboardRepository,
    async_ensure_dashboards,
)
from .frontend import async_register_frontend
from .panel_manager import PanelManager, PanelRegistrationError
from .websocket import async_register_websocket_commands

_LOGGER = logging.getLogger(__name__)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the shared Vue Panel backend API."""

    domain_data = hass.data.setdefault(DOMAIN, {})
    domain_data[DATA_REPOSITORY] = DashboardRepository(hass)
    domain_data[DATA_CARD_REPOSITORY] = CardRepository(hass)
    await async_register_frontend(hass)
    async_register_websocket_commands(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Vue Panel from a config entry."""

    try:
        await async_ensure_dashboards(hass, entry)
        manager = PanelManager(hass)
        await manager.async_register_entry(entry)
    except (DashboardFileError, PanelRegistrationError):
        _LOGGER.exception("Unable to set up Vue Panel")
        return False

    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = manager
    entry.async_on_unload(entry.add_update_listener(_async_reload_entry))
    return True


async def _async_reload_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload panels after dashboard subentries change."""

    domain_data = hass.data.get(DOMAIN, {})
    manager: PanelManager | None = domain_data.get(entry.entry_id)
    repository: DashboardRepository | None = domain_data.get(DATA_REPOSITORY)
    if manager is not None and repository is not None:
        configured_names = {
            str(subentry.data[CONF_DASHBOARD_NAME])
            for subentry in entry.subentries.values()
            if subentry.subentry_type == SUBENTRY_TYPE_DASHBOARD
        }
        removed_names = manager.registered_paths - configured_names
        if removed_names:
            try:
                await repository.async_archive_names(removed_names)
            except DashboardFileError:
                _LOGGER.exception("Unable to archive removed Vue Panel dashboards")
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a Vue Panel config entry."""

    manager: PanelManager | None = hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
    if manager is not None:
        await manager.async_unload()
    return True


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Archive dashboard files when the integration is removed."""

    repository: DashboardRepository | None = hass.data.get(DOMAIN, {}).get(
        DATA_REPOSITORY
    )
    if repository is None:
        repository = DashboardRepository(hass)
    dashboard_names = {
        str(subentry.data[CONF_DASHBOARD_NAME])
        for subentry in entry.subentries.values()
        if subentry.subentry_type == SUBENTRY_TYPE_DASHBOARD
    }
    try:
        await repository.async_archive_names(dashboard_names)
    except DashboardFileError:
        _LOGGER.exception("Unable to archive Vue Panel dashboards during removal")
