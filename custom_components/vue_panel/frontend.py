"""Expose integration-owned frontend files through Home Assistant HTTP."""

from __future__ import annotations

from pathlib import Path

from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

from .const import STATIC_URL_BASE


async def async_register_frontend(hass: HomeAssistant) -> None:
    """Register the query-versioned frontend bundled with the integration."""

    frontend_root = Path(__file__).parent / "frontend"
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                STATIC_URL_BASE,
                str(frontend_root),
                True,
            ),
        ]
    )
