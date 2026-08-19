"""Authenticated WebSocket API for Vue Panel dashboards."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigSubentry
from homeassistant.core import HomeAssistant

from .card_files import (
    CardAlreadyExists,
    CardFileError,
    CardNotFound,
    CardReadOnly,
    CardRepository,
    CardRevisionConflict,
)
from .const import (
    CONF_DASHBOARD_NAME,
    CONF_REQUIRE_ADMIN,
    DATA_CARD_REPOSITORY,
    DATA_REPOSITORY,
    DEFAULT_REQUIRE_ADMIN,
    DOMAIN,
    SUBENTRY_TYPE_DASHBOARD,
)
from .dashboard_files import (
    DashboardFileError,
    DashboardRepository,
    DashboardRevisionConflict,
)

WS_TYPE_DASHBOARD_GET = "vue_panel/dashboard/get"
WS_TYPE_DASHBOARD_SAVE = "vue_panel/dashboard/save"
WS_TYPE_DASHBOARD_EXPORT = "vue_panel/dashboard/export"
WS_TYPE_DASHBOARD_IMPORT = "vue_panel/dashboard/import"
WS_TYPE_CARDS_LIST = "vue_panel/cards/list"
WS_TYPE_CARDS_GET = "vue_panel/cards/get"
WS_TYPE_CARDS_CREATE = "vue_panel/cards/create"
WS_TYPE_CARDS_UPDATE = "vue_panel/cards/update"
WS_TYPE_CARDS_DELETE = "vue_panel/cards/delete"
WS_TYPE_CARDS_IMPORT = "vue_panel/cards/import"
WS_TYPE_CARDS_DUPLICATE = "vue_panel/cards/duplicate"


def _positive_integer(value: Any) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise vol.Invalid("Expected a positive integer")
    return value


def _dashboard_subentry(
    hass: HomeAssistant, dashboard_name: str
) -> ConfigSubentry | None:
    for entry in hass.config_entries.async_entries(DOMAIN):
        for subentry in entry.subentries.values():
            if (
                subentry.subentry_type == SUBENTRY_TYPE_DASHBOARD
                and subentry.data.get(CONF_DASHBOARD_NAME) == dashboard_name
            ):
                return subentry
    return None


def _repository(hass: HomeAssistant) -> DashboardRepository:
    return hass.data[DOMAIN][DATA_REPOSITORY]


def _card_repository(hass: HomeAssistant) -> CardRepository:
    return hass.data[DOMAIN][DATA_CARD_REPOSITORY]


def _send_card_error(
    connection: websocket_api.ActiveConnection,
    message_id: int,
    error: CardFileError,
) -> None:
    """Return stable public error codes without leaking filesystem details."""

    if isinstance(error, CardRevisionConflict):
        connection.send_error(
            message_id,
            "revision_conflict",
            f"Card changed; current content hash is {error.current_hash}",
        )
    elif isinstance(error, CardAlreadyExists):
        connection.send_error(message_id, "already_exists", "Card already exists")
    elif isinstance(error, CardNotFound):
        connection.send_error(message_id, "not_found", "Card not found")
    elif isinstance(error, CardReadOnly):
        connection.send_error(message_id, "read_only", "Card is read-only")
    else:
        connection.send_error(message_id, "invalid_card", "Card validation failed")


def _can_read_dashboard(
    connection: websocket_api.ActiveConnection,
    subentry: ConfigSubentry,
) -> bool:
    return not subentry.data.get(
        CONF_REQUIRE_ADMIN,
        DEFAULT_REQUIRE_ADMIN,
    ) or connection.user.is_admin


@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_TYPE_DASHBOARD_GET,
        vol.Required("dashboard_name"): str,
    }
)
@websocket_api.async_response
async def websocket_dashboard_get(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return one dashboard to an authenticated user."""

    subentry = _dashboard_subentry(hass, msg["dashboard_name"])
    if subentry is None:
        connection.send_error(msg["id"], "not_found", "Dashboard not found")
        return
    if not _can_read_dashboard(connection, subentry):
        connection.send_error(
            msg["id"], "unauthorized", "Administrator access required"
        )
        return
    try:
        document = await _repository(hass).async_load(subentry)
    except DashboardFileError:
        connection.send_error(msg["id"], "load_failed", "Dashboard could not be loaded")
        return
    connection.send_result(msg["id"], document)


@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_TYPE_DASHBOARD_EXPORT,
        vol.Required("dashboard_name"): str,
    }
)
@websocket_api.async_response
async def websocket_dashboard_export(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return a portable export of one dashboard."""

    subentry = _dashboard_subentry(hass, msg["dashboard_name"])
    if subentry is None:
        connection.send_error(msg["id"], "not_found", "Dashboard not found")
        return
    if not _can_read_dashboard(connection, subentry):
        connection.send_error(
            msg["id"], "unauthorized", "Administrator access required"
        )
        return
    try:
        document = await _repository(hass).async_load(subentry)
    except DashboardFileError:
        connection.send_error(msg["id"], "load_failed", "Dashboard could not be loaded")
        return
    connection.send_result(
        msg["id"],
        {
            "filename": f"{msg['dashboard_name']}.vue-panel-dashboard.json",
            "document": document,
        },
    )


@websocket_api.require_admin
@websocket_api.async_response
@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_TYPE_DASHBOARD_SAVE,
        vol.Required("dashboard_name"): str,
        vol.Required("expected_revision"): _positive_integer,
        vol.Required("document"): dict,
    }
)
async def websocket_dashboard_save(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Persist one dashboard for an administrator."""

    subentry = _dashboard_subentry(hass, msg["dashboard_name"])
    if subentry is None:
        connection.send_error(msg["id"], "not_found", "Dashboard not found")
        return
    try:
        document = await _repository(hass).async_save(
            subentry,
            msg["document"],
            msg["expected_revision"],
        )
    except DashboardRevisionConflict as error:
        connection.send_error(
            msg["id"],
            "revision_conflict",
            f"Dashboard changed; current revision is {error.current_revision}",
        )
        return
    except DashboardFileError:
        connection.send_error(
            msg["id"], "invalid_dashboard", "Dashboard validation failed"
        )
        return
    connection.send_result(msg["id"], document)


@websocket_api.require_admin
@websocket_api.async_response
@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_TYPE_DASHBOARD_IMPORT,
        vol.Required("dashboard_name"): str,
        vol.Required("expected_revision"): _positive_integer,
        vol.Required("document"): dict,
    }
)
async def websocket_dashboard_import(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Import dashboard content without trusting its stored revision."""

    subentry = _dashboard_subentry(hass, msg["dashboard_name"])
    if subentry is None:
        connection.send_error(msg["id"], "not_found", "Dashboard not found")
        return
    try:
        document = await _repository(hass).async_import(
            subentry,
            msg["document"],
            msg["expected_revision"],
        )
    except DashboardRevisionConflict as error:
        connection.send_error(
            msg["id"],
            "revision_conflict",
            f"Dashboard changed; current revision is {error.current_revision}",
        )
        return
    except DashboardFileError:
        connection.send_error(
            msg["id"], "invalid_dashboard", "Dashboard validation failed"
        )
        return
    connection.send_result(msg["id"], document)


@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_TYPE_CARDS_LIST,
    }
)
@websocket_api.async_response
async def websocket_cards_list(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the validated runtime card catalog."""

    try:
        cards = await _card_repository(hass).async_list()
    except CardFileError as error:
        _send_card_error(connection, msg["id"], error)
        return
    connection.send_result(msg["id"], cards)


@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_TYPE_CARDS_GET,
        vol.Required("manufacturer"): str,
        vol.Required("card_name"): str,
    }
)
@websocket_api.async_response
async def websocket_cards_get(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return one full portable card document."""

    try:
        card = await _card_repository(hass).async_get(
            msg["manufacturer"],
            msg["card_name"],
        )
    except CardFileError as error:
        _send_card_error(connection, msg["id"], error)
        return
    connection.send_result(msg["id"], card)


async def _async_create_card(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    try:
        card = await _card_repository(hass).async_create(msg["document"])
    except CardFileError as error:
        _send_card_error(connection, msg["id"], error)
        return
    connection.send_result(msg["id"], card)


@websocket_api.require_admin
@websocket_api.async_response
@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_TYPE_CARDS_CREATE,
        vol.Required("document"): str,
    }
)
async def websocket_cards_create(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Create a browser-authored card for an administrator."""

    await _async_create_card(hass, connection, msg)


@websocket_api.require_admin
@websocket_api.async_response
@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_TYPE_CARDS_IMPORT,
        vol.Required("document"): str,
    }
)
async def websocket_cards_import(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Install one locally selected card file for an administrator."""

    await _async_create_card(hass, connection, msg)


@websocket_api.require_admin
@websocket_api.async_response
@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_TYPE_CARDS_UPDATE,
        vol.Required("manufacturer"): str,
        vol.Required("card_name"): str,
        vol.Required("expected_hash"): str,
        vol.Required("document"): str,
    }
)
async def websocket_cards_update(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Update an editable card for an administrator."""

    try:
        card = await _card_repository(hass).async_update(
            msg["manufacturer"],
            msg["card_name"],
            msg["document"],
            msg["expected_hash"],
        )
    except CardFileError as error:
        _send_card_error(connection, msg["id"], error)
        return
    connection.send_result(msg["id"], card)


@websocket_api.require_admin
@websocket_api.async_response
@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_TYPE_CARDS_DELETE,
        vol.Required("manufacturer"): str,
        vol.Required("card_name"): str,
        vol.Required("expected_hash"): str,
    }
)
async def websocket_cards_delete(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Delete an editable card for an administrator."""

    try:
        deleted = await _card_repository(hass).async_delete(
            msg["manufacturer"],
            msg["card_name"],
            msg["expected_hash"],
        )
    except CardFileError as error:
        _send_card_error(connection, msg["id"], error)
        return
    connection.send_result(msg["id"], {"deleted": deleted})


@websocket_api.require_admin
@websocket_api.async_response
@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_TYPE_CARDS_DUPLICATE,
        vol.Required("source_manufacturer"): str,
        vol.Required("source_card_name"): str,
        vol.Required("manufacturer"): str,
        vol.Required("card_name"): str,
        vol.Optional("name"): str,
    }
)
async def websocket_cards_duplicate(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Duplicate any card into a new editable identity."""

    try:
        card = await _card_repository(hass).async_duplicate(
            msg["source_manufacturer"],
            msg["source_card_name"],
            msg["manufacturer"],
            msg["card_name"],
            msg.get("name"),
        )
    except CardFileError as error:
        _send_card_error(connection, msg["id"], error)
        return
    connection.send_result(msg["id"], card)


def async_register_websocket_commands(hass: HomeAssistant) -> None:
    """Register Vue Panel WebSocket commands once."""

    websocket_api.async_register_command(hass, websocket_dashboard_get)
    websocket_api.async_register_command(hass, websocket_dashboard_export)
    websocket_api.async_register_command(hass, websocket_dashboard_save)
    websocket_api.async_register_command(hass, websocket_dashboard_import)
    websocket_api.async_register_command(hass, websocket_cards_list)
    websocket_api.async_register_command(hass, websocket_cards_get)
    websocket_api.async_register_command(hass, websocket_cards_create)
    websocket_api.async_register_command(hass, websocket_cards_update)
    websocket_api.async_register_command(hass, websocket_cards_delete)
    websocket_api.async_register_command(hass, websocket_cards_import)
    websocket_api.async_register_command(hass, websocket_cards_duplicate)
