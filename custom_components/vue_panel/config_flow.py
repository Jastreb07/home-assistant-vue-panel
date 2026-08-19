"""Config and dashboard subentry flows for Vue Panel."""

from __future__ import annotations

from collections.abc import Mapping
import re
import unicodedata
from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.components import frontend
from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlowResult,
    ConfigSubentryFlow,
    FlowType,
    SOURCE_USER,
    SubentryFlowContext,
    SubentryFlowResult,
)
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    CONFIG_ENTRY_TITLE,
    CONF_DASHBOARD_FILE,
    CONF_DASHBOARD_ICON,
    CONF_DASHBOARD_NAME,
    CONF_DASHBOARD_TITLE,
    CONF_REQUIRE_ADMIN,
    CONF_REVISION,
    DEFAULT_DASHBOARD_ICON,
    DEFAULT_REQUIRE_ADMIN,
    DOMAIN,
    SUBENTRY_TYPE_DASHBOARD,
)

_DASHBOARD_NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def normalize_dashboard_name(value: str) -> str:
    """Return a stable URL-safe dashboard name."""

    normalized = value.strip().lower().translate(
        str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"})
    )
    normalized = unicodedata.normalize("NFKD", normalized)
    ascii_name = normalized.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", ascii_name).strip("-")


def _dashboard_schema(defaults: Mapping[str, Any] | None = None) -> vol.Schema:
    values = defaults or {}
    return vol.Schema(
        {
            vol.Required(
                CONF_DASHBOARD_NAME,
                default=values.get(CONF_DASHBOARD_NAME, ""),
            ): selector.TextSelector(),
            vol.Required(
                CONF_DASHBOARD_TITLE,
                default=values.get(CONF_DASHBOARD_TITLE, ""),
            ): selector.TextSelector(),
            vol.Required(
                CONF_DASHBOARD_ICON,
                default=values.get(CONF_DASHBOARD_ICON, DEFAULT_DASHBOARD_ICON),
            ): selector.IconSelector(),
            vol.Required(
                CONF_REQUIRE_ADMIN,
                default=values.get(CONF_REQUIRE_ADMIN, DEFAULT_REQUIRE_ADMIN),
            ): selector.BooleanSelector(),
        }
    )


class DashboardSubentryFlowHandler(ConfigSubentryFlow):
    """Add and reconfigure dashboard panels."""

    async def async_step_user(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> SubentryFlowResult:
        """Create a dashboard subentry."""

        errors: dict[str, str] = {}
        if user_input is not None:
            dashboard_name = normalize_dashboard_name(
                str(user_input[CONF_DASHBOARD_NAME])
            )
            dashboard_title = str(user_input[CONF_DASHBOARD_TITLE]).strip()
            if not dashboard_title:
                errors[CONF_DASHBOARD_TITLE] = "invalid_dashboard_title"
            elif not dashboard_name or not _DASHBOARD_NAME_PATTERN.fullmatch(
                dashboard_name
            ):
                errors[CONF_DASHBOARD_NAME] = "invalid_dashboard_name"
            elif self._dashboard_name_exists(dashboard_name):
                errors[CONF_DASHBOARD_NAME] = "dashboard_name_exists"
            elif frontend.async_panel_exists(self.hass, dashboard_name):
                errors[CONF_DASHBOARD_NAME] = "panel_path_exists"
            else:
                data = self._entry_data(user_input, dashboard_name)
                return self.async_create_entry(
                    title=data[CONF_DASHBOARD_TITLE],
                    data=data,
                    unique_id=dashboard_name,
                )

        return self.async_show_form(
            step_id="user",
            data_schema=_dashboard_schema(user_input),
            errors=errors,
        )

    async def async_step_reconfigure(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> SubentryFlowResult:
        """Update mutable dashboard panel metadata."""

        entry = self._get_entry()
        subentry = self._get_reconfigure_subentry()
        current_data = dict(subentry.data)
        dashboard_name = str(current_data[CONF_DASHBOARD_NAME])

        if user_input is not None:
            if str(user_input[CONF_DASHBOARD_TITLE]).strip():
                data = self._entry_data(user_input, dashboard_name)
                return self.async_update_reload_and_abort(
                    entry,
                    subentry,
                    title=data[CONF_DASHBOARD_TITLE],
                    data=data,
                )
            return self.async_show_form(
                step_id="reconfigure",
                data_schema=self._reconfigure_schema(user_input),
                errors={CONF_DASHBOARD_TITLE: "invalid_dashboard_title"},
            )

        return self.async_show_form(
            step_id="reconfigure",
            data_schema=self._reconfigure_schema(current_data),
        )

    def _dashboard_name_exists(self, dashboard_name: str) -> bool:
        entry = self._get_entry()
        return any(
            subentry.subentry_type == SUBENTRY_TYPE_DASHBOARD
            and subentry.data.get(CONF_DASHBOARD_NAME) == dashboard_name
            for subentry in entry.subentries.values()
        )

    @staticmethod
    def _entry_data(
        user_input: Mapping[str, Any], dashboard_name: str
    ) -> dict[str, Any]:
        return {
            CONF_DASHBOARD_NAME: dashboard_name,
            CONF_DASHBOARD_TITLE: str(user_input[CONF_DASHBOARD_TITLE]).strip(),
            CONF_DASHBOARD_ICON: str(user_input[CONF_DASHBOARD_ICON]),
            CONF_REQUIRE_ADMIN: bool(user_input[CONF_REQUIRE_ADMIN]),
            CONF_DASHBOARD_FILE: f"dashboards/{dashboard_name}.json",
            CONF_REVISION: 1,
        }

    @staticmethod
    def _reconfigure_schema(defaults: Mapping[str, Any]) -> vol.Schema:
        return vol.Schema(
            {
                vol.Required(
                    CONF_DASHBOARD_TITLE,
                    default=defaults[CONF_DASHBOARD_TITLE],
                ): selector.TextSelector(),
                vol.Required(
                    CONF_DASHBOARD_ICON,
                    default=defaults.get(CONF_DASHBOARD_ICON, DEFAULT_DASHBOARD_ICON),
                ): selector.IconSelector(),
                vol.Required(
                    CONF_REQUIRE_ADMIN,
                    default=defaults.get(CONF_REQUIRE_ADMIN, DEFAULT_REQUIRE_ADMIN),
                ): selector.BooleanSelector(),
            }
        )


class VuePanelConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Set up the single Vue Panel integration entry."""

    VERSION = 1

    async def async_on_create_entry(self, result: ConfigFlowResult) -> ConfigFlowResult:
        """Continue initial setup with the first dashboard flow."""

        subentry_result = await self.hass.config_entries.subentries.async_init(
            (result["result"].entry_id, SUBENTRY_TYPE_DASHBOARD),
            context=SubentryFlowContext(source=SOURCE_USER),
        )
        result["next_flow"] = (
            FlowType.CONFIG_SUBENTRIES_FLOW,
            subentry_result["flow_id"],
        )
        return result

    @classmethod
    @callback
    def async_get_supported_subentry_types(
        cls,
        config_entry: ConfigEntry,
    ) -> dict[str, type[ConfigSubentryFlow]]:
        """Return supported subentry flow handlers."""

        return {SUBENTRY_TYPE_DASHBOARD: DashboardSubentryFlowHandler}

    async def async_step_user(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> ConfigFlowResult:
        """Create the single integration entry."""

        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        if user_input is not None:
            return self.async_create_entry(title=CONFIG_ENTRY_TITLE, data={})
        return self.async_show_form(step_id="user", data_schema=vol.Schema({}))
