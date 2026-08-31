"""Expose integration-owned frontend files through Home Assistant HTTP."""

from __future__ import annotations

from pathlib import Path

from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

from .card_storage import CARD_ASSET_URL_BASE
from .const import PRIVATE_DIRECTORY, STATIC_URL_BASE


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
