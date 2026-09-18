"""Expose integration-owned frontend files through Home Assistant HTTP."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from homeassistant.components import frontend
from homeassistant.components.http import StaticPathConfig
from homeassistant.components.lovelace.const import (
    CONF_RESOURCE_TYPE_WS,
    LOVELACE_DATA,
    MODE_STORAGE,
)
from homeassistant.const import CONF_ID, CONF_TYPE, CONF_URL
from homeassistant.core import HomeAssistant

from .card_storage import CARD_ASSET_URL_BASE
from .const import (
    LOVELACE_MODULE_URL,
    LOVELACE_RESOURCE_URL,
    PRIVATE_DIRECTORY,
    STATIC_URL_BASE,
)


def _is_own_lovelace_resource(item: dict[str, Any]) -> bool:
    """Return whether a Lovelace resource belongs to Vue Panel."""

    url = str(item.get(CONF_URL, ""))
    return url.partition("?")[0] == f"{STATIC_URL_BASE}/lovelace.js"


async def _async_register_lovelace_resource(hass: HomeAssistant) -> None:
    """Register the host bridge in Lovelace's awaited resource pipeline.

    ``extra_module_url`` remains useful for the earliest possible bootstrap,
    but Companion WebViews do not reliably finish those global imports before
    rendering a directly opened dashboard. Lovelace resources are preloaded as
    part of Lovelace startup and therefore close that cold-cache race.
    """

    lovelace_data = hass.data[LOVELACE_DATA]
    resources = lovelace_data.resources
    await resources.async_get_info()
    items = list(resources.async_items() or [])
    owned = [item for item in items if _is_own_lovelace_resource(item)]

    if lovelace_data.resource_mode == MODE_STORAGE:
        if owned:
            primary = owned[0]
            if (
                primary.get(CONF_URL) != LOVELACE_RESOURCE_URL
                or primary.get(CONF_TYPE) != "module"
            ):
                await resources.async_update_item(
                    primary[CONF_ID],
                    {
                        CONF_RESOURCE_TYPE_WS: "module",
                        CONF_URL: LOVELACE_RESOURCE_URL,
                    },
                )
            for duplicate in owned[1:]:
                await resources.async_delete_item(duplicate[CONF_ID])
            return

        await resources.async_create_item(
            {
                CONF_RESOURCE_TYPE_WS: "module",
                CONF_URL: LOVELACE_RESOURCE_URL,
            }
        )
        return

    # YAML resources are immutable through their public API. Their in-memory
    # list is recreated on every HA start, so adding our integration-owned
    # module here neither edits configuration.yaml nor survives uninstalling.
    yaml_items = resources.async_items()
    yaml_items[:] = [item for item in yaml_items if not _is_own_lovelace_resource(item)]
    yaml_items.append({CONF_TYPE: "module", CONF_URL: LOVELACE_RESOURCE_URL})


async def async_unregister_lovelace_resource(hass: HomeAssistant) -> None:
    """Remove the persistent Vue Panel resource when the integration is removed."""

    lovelace_data = hass.data.get(LOVELACE_DATA)
    if lovelace_data is None:
        return
    resources = lovelace_data.resources
    await resources.async_get_info()
    owned = [
        item
        for item in list(resources.async_items() or [])
        if _is_own_lovelace_resource(item)
    ]
    if lovelace_data.resource_mode == MODE_STORAGE:
        for item in owned:
            await resources.async_delete_item(item[CONF_ID])
        return
    yaml_items = resources.async_items()
    yaml_items[:] = [item for item in yaml_items if not _is_own_lovelace_resource(item)]


async def async_register_frontend(hass: HomeAssistant) -> None:
    """Register the query-versioned frontend bundled with the integration."""

    frontend_root = Path(__file__).parent / "frontend"
    """
    Cards may live in a folder of their own (`<name>/index.html`) and ship
    assets next to that document. Those folders are served read-only so a
    card can reference its own images and fonts by URL; the private root is
    created up front because a static path cannot be registered later.
    """
    bundled_cards = Path(__file__).parent / "bundled_cards"
    local_cards = Path(hass.config.path(PRIVATE_DIRECTORY)) / "cards"
    await hass.async_add_executor_job(lambda: local_cards.mkdir(parents=True, exist_ok=True))

    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                STATIC_URL_BASE,
                str(frontend_root),
                True,
            ),
            StaticPathConfig(
                f"{CARD_ASSET_URL_BASE}/bundled",
                str(bundled_cards),
                True,
            ),
            StaticPathConfig(
                f"{CARD_ASSET_URL_BASE}/local",
                str(local_cards),
                True,
            ),
        ]
    )
    frontend.add_extra_js_url(hass, LOVELACE_MODULE_URL)
    await _async_register_lovelace_resource(hass)
