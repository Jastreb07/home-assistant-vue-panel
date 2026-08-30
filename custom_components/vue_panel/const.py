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

INTEGRATION_VERSION: Final = "2.2.6"
PANEL_WEBCOMPONENT_NAME: Final = "vue-panel-panel"
STATIC_URL_BASE: Final = "/vue-panel-static"
PANEL_MODULE_URL: Final = (f"{STATIC_URL_BASE}/loader.js?v={INTEGRATION_VERSION}")
ENGINE_VERSION: Final = "2.2.27"
API_VERSION: Final = 1

"""Fired after a dashboard was written, so other open panels can catch up."""
EVENT_DASHBOARD_UPDATED: Final = "vue_panel_dashboard_updated"

PRIVATE_DIRECTORY: Final = "vue-panel"
DATA_REPOSITORY: Final = "repository"
DATA_CARD_REPOSITORY: Final = "card_repository"
