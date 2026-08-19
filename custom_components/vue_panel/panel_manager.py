"""Register and remove Vue Panel dashboards in the Home Assistant frontend."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from homeassistant.components import frontend, panel_custom
from homeassistant.config_entries import ConfigEntry, ConfigSubentry
from homeassistant.core import HomeAssistant

from .const import (
    API_VERSION,
    CONF_DASHBOARD_ICON,
    CONF_DASHBOARD_NAME,
    CONF_DASHBOARD_TITLE,
    CONF_REQUIRE_ADMIN,
    DEFAULT_DASHBOARD_ICON,
    DEFAULT_REQUIRE_ADMIN,
    ENGINE_VERSION,
    PANEL_MODULE_URL,
    PANEL_WEBCOMPONENT_NAME,
    SUBENTRY_TYPE_DASHBOARD,
)


class PanelRegistrationError(Exception):
    """Raised when a configured dashboard cannot be registered as a panel."""


@dataclass(slots=True)
class PanelManager:
    """Own the frontend panels registered for one Vue Panel config entry."""

    hass: HomeAssistant
    registered_paths: set[str] = field(default_factory=set)

    async def async_register_entry(self, entry: ConfigEntry) -> None:
        """Register every dashboard subentry."""

        for subentry in entry.subentries.values():
            if subentry.subentry_type == SUBENTRY_TYPE_DASHBOARD:
                await self._async_register_dashboard(subentry)

    async def _async_register_dashboard(self, subentry: ConfigSubentry) -> None:
        data: dict[str, Any] = dict(subentry.data)
        dashboard_name = str(data[CONF_DASHBOARD_NAME])
        if frontend.async_panel_exists(self.hass, dashboard_name):
            raise PanelRegistrationError(
                f"Home Assistant panel path is already in use: {dashboard_name}"
            )

        await panel_custom.async_register_panel(
            self.hass,
            frontend_url_path=dashboard_name,
            webcomponent_name=PANEL_WEBCOMPONENT_NAME,
            sidebar_title=str(data[CONF_DASHBOARD_TITLE]),
            sidebar_icon=str(data.get(CONF_DASHBOARD_ICON, DEFAULT_DASHBOARD_ICON)),
            module_url=PANEL_MODULE_URL,
            embed_iframe=False,
            config={
                "dashboardName": dashboard_name,
                "engineVersion": ENGINE_VERSION,
                "apiVersion": API_VERSION,
            },
            require_admin=bool(data.get(CONF_REQUIRE_ADMIN, DEFAULT_REQUIRE_ADMIN)),
            handle_safe_area=True,
        )
        self.registered_paths.add(dashboard_name)

    async def async_unload(self) -> None:
        """Remove every panel owned by this manager."""

        for dashboard_name in self.registered_paths:
            frontend.async_remove_panel(
                self.hass,
                dashboard_name,
                warn_if_unknown=False,
            )
        self.registered_paths.clear()
