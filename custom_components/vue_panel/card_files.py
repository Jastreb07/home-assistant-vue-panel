"""Home Assistant adapter for the private Vue Panel card catalog."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from pathlib import Path
from typing import Any

from homeassistant.core import HomeAssistant

from .card_storage import (
    CardAlreadyExists,
    CardFileError,
    CardNotFound,
    CardReadOnly,
    CardRevisionConflict,
    create_card,
    delete_card,
    duplicate_card,
    list_cards,
    read_card,
    update_card,
)
from .const import PRIVATE_DIRECTORY

__all__ = [
    "CardAlreadyExists",
    "CardFileError",
    "CardNotFound",
    "CardReadOnly",
    "CardRepository",
    "CardRevisionConflict",
]


class CardRepository:
    """Serialize card access and run blocking file operations off-loop."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass
        self._private_root = Path(hass.config.path(PRIVATE_DIRECTORY))
        self._bundled_root = Path(__file__).parent / "bundled_cards"
        self._catalog_lock = asyncio.Lock()

    async def _async_storage(
        self,
        operation: Callable[..., Any],
        *args: Any,
    ) -> Any:
        try:
            return await self._hass.async_add_executor_job(operation, *args)
        except OSError as error:
            raise CardFileError("Card storage operation failed") from error

    async def async_list(self) -> list[dict[str, Any]]:
        """Return the complete validated card catalog."""

        async with self._catalog_lock:
            return await self._async_storage(
                list_cards,
                self._private_root,
                self._bundled_root,
            )

    async def async_get(self, manufacturer: str, card_name: str) -> dict[str, Any]:
        """Return one full card document."""

        async with self._catalog_lock:
            return await self._async_storage(
                read_card,
                self._private_root,
                self._bundled_root,
                manufacturer,
                card_name,
            )

    async def async_create(self, document: str) -> dict[str, Any]:
        """Create one editable card."""

        async with self._catalog_lock:
            return await self._async_storage(
                create_card,
                self._private_root,
                document,
            )

    async def async_update(
        self,
        manufacturer: str,
        card_name: str,
        document: str,
        expected_hash: str,
    ) -> dict[str, Any]:
        """Update one editable card."""

        async with self._catalog_lock:
            return await self._async_storage(
                update_card,
                self._private_root,
                manufacturer,
                card_name,
                document,
                expected_hash,
            )

    async def async_delete(
        self,
        manufacturer: str,
        card_name: str,
        expected_hash: str,
    ) -> bool:
        """Delete one editable card."""

        async with self._catalog_lock:
            return await self._async_storage(
                delete_card,
                self._private_root,
                manufacturer,
                card_name,
                expected_hash,
            )

    async def async_duplicate(
        self,
        source_manufacturer: str,
        source_card_name: str,
        manufacturer: str,
        card_name: str,
        display_name: str | None,
    ) -> dict[str, Any]:
        """Duplicate a managed or editable card to a new identity."""

        async with self._catalog_lock:
            return await self._async_storage(
                duplicate_card,
                self._private_root,
                self._bundled_root,
                source_manufacturer,
                source_card_name,
                manufacturer,
                card_name,
                display_name,
            )
