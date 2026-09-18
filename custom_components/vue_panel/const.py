"""Constants for the Vue Panel integration."""

from typing import Final

DOMAIN: Final = "vue_panel"

CONFIG_ENTRY_TITLE: Final = "Vue Panel"
SUBENTRY_TYPE_DASHBOARD: Final = "dashboard"

CONF_DASHBOARD_NAME: Final = "name"
CONF_DASHBOARD_TITLE: Final = "title"
CONF_DASHBOARD_ICON: Final = "icon"
CONF_DASHBOARD_FILE: Final = "dashboard_file"
CONF_REQUIRE_ADMIN: Final = "require_admin"
CONF_REVISION: Final = "revision"

DEFAULT_DASHBOARD_ICON: Final = "mdi:view-dashboard"
DEFAULT_REQUIRE_ADMIN: Final = False

INTEGRATION_VERSION: Final = "2.2.74"
STATIC_URL_BASE: Final = "/vue-panel-static"
LOVELACE_MODULE_URL: Final = (f"{STATIC_URL_BASE}/lovelace.js?v={INTEGRATION_VERSION}")
# The Lovelace resource intentionally uses a distinct URL: browsers pin failed
# module fetches per exact URL, so one broken early import (e.g. during HA
# boot) must not poison the second load channel.
LOVELACE_RESOURCE_URL: Final = (
    f"{STATIC_URL_BASE}/lovelace.js?v={INTEGRATION_VERSION}&channel=resource"
)
ENGINE_VERSION: Final = "2.2.97"
API_VERSION: Final = 1

"""Fired after a dashboard was written, so other open panels can catch up."""
EVENT_DASHBOARD_UPDATED: Final = "vue_panel_dashboard_updated"

PRIVATE_DIRECTORY: Final = "vue-panel"
DATA_REPOSITORY: Final = "repository"
DATA_CARD_REPOSITORY: Final = "card_repository"
