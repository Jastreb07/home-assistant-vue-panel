"""Register Vue Panel dashboards as Home Assistant Lovelace dashboards."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from homeassistant.components import frontend
from homeassistant.components.lovelace.const import LOVELACE_DATA, MODE_YAML
from homeassistant.components.lovelace.dashboard import LovelaceConfig
from homeassistant.config_entries import ConfigEntry, ConfigSubentry
from homeassistant.core import HomeAssistant, callback

from .const import (
    API_VERSION,
    CONF_DASHBOARD_ICON,
    CONF_DASHBOARD_NAME,
    CONF_DASHBOARD_TITLE,
    CONF_REQUIRE_ADMIN,
    DEFAULT_DASHBOARD_ICON,
    DEFAULT_REQUIRE_ADMIN,
    ENGINE_VERSION,
    SUBENTRY_TYPE_DASHBOARD,
)
from .dashboard_files import DashboardRepository


class PanelRegistrationError(Exception):
    """Raised when a configured dashboard cannot be registered with Lovelace."""


def _view_path(view: dict[str, Any]) -> str:
    """Return the same normalized path that the Vue engine uses."""

    return str(view.get("path") or view["id"]).strip("/")


class VuePanelLovelaceConfig(LovelaceConfig):
    """Read-only Lovelace facade backed by one Vue Panel dashboard file.

    Home Assistant owns the outer dashboard and its route. The generated
    Lovelace config contains one panel view per Vue Panel view, each hosting
    the existing isolated iframe engine through ``custom:vue-panel-host``.
    """

    def __init__(
        self,
        hass: HomeAssistant,
        subentry: ConfigSubentry,
        repository: DashboardRepository,
    ) -> None:
        data = dict(subentry.data)
        self.subentry = subentry
        self.repository = repository
        self.dashboard_name = str(data[CONF_DASHBOARD_NAME])
        self.title = str(data[CONF_DASHBOARD_TITLE])
        self.icon = str(data.get(CONF_DASHBOARD_ICON, DEFAULT_DASHBOARD_ICON))
        self.require_admin = bool(
            data.get(CONF_REQUIRE_ADMIN, DEFAULT_REQUIRE_ADMIN)
        )
        metadata = {
            "id": f"vue-panel-{subentry.subentry_id}",
            "url_path": self.dashboard_name,
            "mode": MODE_YAML,
            "title": self.title,
            "icon": self.icon,
            "show_in_sidebar": True,
            "require_admin": self.require_admin,
            # Marks the entry as integration-managed in HA's dashboard list.
            "filename": f"vue-panel/dashboards/{self.dashboard_name}.json",
        }
        super().__init__(hass, self.dashboard_name, metadata)

    @property
    def mode(self) -> str:
        """Return the read-only dashboard mode."""

        return MODE_YAML

    async def async_get_info(self) -> dict[str, Any]:
        """Return dashboard information for Home Assistant."""

        config = await self.async_load(False)
        return {"mode": self.mode, "views": len(config["views"])}

    async def async_load(self, force: bool) -> dict[str, Any]:
        """Generate a Lovelace wrapper from the current Vue Panel views."""

        document = await self.repository.async_load(self.subentry)
        views = []
        for view in document["views"]:
            lovelace_view: dict[str, Any] = {
                "title": str(view["title"]),
                "path": _view_path(view),
                "panel": True,
                "cards": [
                    {
                        "type": "custom:vue-panel-host",
                        "dashboardName": self.dashboard_name,
                        "title": self.title,
                        "engineVersion": ENGINE_VERSION,
                        "apiVersion": API_VERSION,
                    }
                ],
            }
            if icon := view.get("icon"):
                lovelace_view["icon"] = str(icon)
            if view.get("subview") is True:
                lovelace_view["subview"] = True
            views.append(lovelace_view)

        return {"title": self.title, "views": views}

    async def async_json(self, force: bool) -> dict[str, Any]:
        """Return the generated JSON-compatible Lovelace wrapper."""

        return await self.async_load(force)

    @callback
    def notify_updated(self) -> None:
        """Ask open Lovelace panels to fetch a changed view list."""

        self._config_updated()


@dataclass(slots=True)
class PanelManager:
    """Own the Lovelace dashboards registered for one config entry."""

    hass: HomeAssistant
    repository: DashboardRepository
    registered_paths: set[str] = field(default_factory=set)
    dashboards: dict[str, VuePanelLovelaceConfig] = field(default_factory=dict)

    async def async_register_entry(self, entry: ConfigEntry) -> None:
        """Register every dashboard subentry as a Lovelace dashboard."""

        for subentry in entry.subentries.values():
            if subentry.subentry_type == SUBENTRY_TYPE_DASHBOARD:
                self._register_dashboard(subentry)

    @callback
    def _register_dashboard(self, subentry: ConfigSubentry) -> None:
        data: dict[str, Any] = dict(subentry.data)
        dashboard_name = str(data[CONF_DASHBOARD_NAME])
        lovelace_data = self.hass.data[LOVELACE_DATA]

        if dashboard_name in lovelace_data.dashboards or frontend.async_panel_exists(
            self.hass, dashboard_name
        ):
            raise PanelRegistrationError(
                f"Home Assistant dashboard path is already in use: {dashboard_name}"
            )

        dashboard = VuePanelLovelaceConfig(
            self.hass,
            subentry,
            self.repository,
        )
        lovelace_data.dashboards[dashboard_name] = dashboard
        try:
            frontend.async_register_built_in_panel(
                self.hass,
                "lovelace",
                frontend_url_path=dashboard_name,
                sidebar_title=dashboard.title,
                sidebar_icon=dashboard.icon,
                config={"mode": MODE_YAML},
                require_admin=dashboard.require_admin,
                show_in_sidebar=True,
            )
        except ValueError as error:
            lovelace_data.dashboards.pop(dashboard_name, None)
            raise PanelRegistrationError(
                f"Unable to register Home Assistant dashboard: {dashboard_name}"
            ) from error

        self.dashboards[dashboard_name] = dashboard
        self.registered_paths.add(dashboard_name)

    @callback
    def notify_view_list_changed(self, dashboard_name: str) -> None:
        """Refresh the Lovelace wrapper after Vue Panel views change."""

        if dashboard := self.dashboards.get(dashboard_name):
            dashboard.notify_updated()

    async def async_unload(self) -> None:
        """Remove every Lovelace dashboard owned by this manager."""

        lovelace_data = self.hass.data.get(LOVELACE_DATA)
        for dashboard_name, dashboard in self.dashboards.items():
            frontend.async_remove_panel(
                self.hass,
                dashboard_name,
                warn_if_unknown=False,
            )
            if lovelace_data is not None:
                registered = lovelace_data.dashboards.get(dashboard_name)
                if registered is dashboard:
                    lovelace_data.dashboards.pop(dashboard_name, None)
        self.dashboards.clear()
        self.registered_paths.clear()
