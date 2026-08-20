"""Tests for the Home Assistant-independent portable card file engine."""

from __future__ import annotations

from copy import deepcopy
import importlib.util
from pathlib import Path
import tempfile
import unittest

MODULE_PATH = (
    Path(__file__).parents[2]
    / "custom_components"
    / "vue_panel"
    / "card_storage.py"
)
SPEC = importlib.util.spec_from_file_location("vue_panel_card_storage", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Unable to load card storage module")
card_storage = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(card_storage)


def card_metadata(
    manufacturer: str = "local",
    card_name: str = "example-card",
) -> dict:
    """Return valid Card Format v2 metadata."""

    return {
        "format": "vue-panel-card",
        "formatVersion": 2,
        "apiVersion": 1,
        "manufacturer": manufacturer,
        "cardName": card_name,
        "name": "Example card",
        "description": "Portable test card",
        "icon": "mdi:test-tube",
        "group": manufacturer,
        "areas": ["dashboard"],
        "capabilities": ["entity:read", "icon:render"],
        "defaultSize": {"cols": 1, "rows": 1, "width": 140, "height": 120},
        "defaultResponsive": {
            "mobile": True,
            "tablet": True,
            "desktop": True,
            "mobileMax": 767,
            "tabletMax": 1023,
        },
        "fullRow": False,
        "variables": [
            {
                "key": "entity",
                "label": "Entity",
                "type": "entity",
                "required": False,
                "domain": "sensor",
                "default": "",
            }
        ],
    }


def card_document(metadata: dict | None = None, html: str = "<article>Card</article>") -> str:
    """Serialize a valid portable test card."""

    return card_storage.serialize_card_document(
        {
            "metadata": metadata or card_metadata(),
            "html": html,
            "css": "article { color: red; }",
            "javascript": "const config = vuePanel.config;",
        }
    )


class CardStorageTests(unittest.TestCase):
    """Exercise parsing, safe paths, revisions, backups, and catalog scans."""

    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        root = Path(self.temporary_directory.name)
        self.private_root = root / "private"
        self.bundled_root = root / "bundled"

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def test_parser_rejects_executable_configuration(self) -> None:
        document = card_document().replace(
            "const vuePanelCard = {",
            "alert('no'); const vuePanelCard = {",
            1,
        )
        with self.assertRaises(card_storage.CardFileError):
            card_storage.parse_card_document(document)

    def test_create_list_and_read_card(self) -> None:
        created = card_storage.create_card(self.private_root, card_document())
        catalog = card_storage.list_cards(self.private_root, self.bundled_root)
        loaded = card_storage.read_card(
            self.private_root,
            self.bundled_root,
            "local",
            "example-card",
        )

        self.assertEqual(created["type"], "local/example-card")
        self.assertEqual(catalog[0]["contentHash"], created["contentHash"])
        self.assertNotIn("document", catalog[0])
        self.assertEqual(loaded["html"], "<article>Card</article>")
        self.assertTrue(loaded["writable"])

    def test_update_uses_hash_revisions_and_keeps_five_backups(self) -> None:
        current = card_storage.create_card(self.private_root, card_document())
        stale_hash = current["contentHash"]
        for index in range(7):
            updated_document = card_document(html=f"<article>{index}</article>")
            current = card_storage.update_card(
                self.private_root,
                "local",
                "example-card",
                updated_document,
                current["contentHash"],
            )

        with self.assertRaises(card_storage.CardRevisionConflict):
            card_storage.update_card(
                self.private_root,
                "local",
                "example-card",
                card_document(),
                stale_hash,
            )
        backups = self.private_root / "backups" / "cards" / "local" / "example-card"
        self.assertEqual(len(list(backups.glob("*.html"))), 5)

    def test_delete_is_revision_safe_and_backed_up(self) -> None:
        created = card_storage.create_card(self.private_root, card_document())
        self.assertTrue(
            card_storage.delete_card(
                self.private_root,
                "local",
                "example-card",
                created["contentHash"],
            )
        )
        self.assertFalse((self.private_root / "cards" / "local").exists())
        backups = self.private_root / "backups" / "cards" / "local" / "example-card"
        self.assertEqual(len(list(backups.glob("*.html"))), 1)

    def test_managed_card_is_read_only_but_can_be_duplicated(self) -> None:
        managed_root = self.bundled_root / "vue-panel"
        managed_root.mkdir(parents=True)
        managed = card_document(card_metadata("vue-panel", "light"))
        (managed_root / "light.html").write_text(managed, encoding="utf-8")

        duplicate = card_storage.duplicate_card(
            self.private_root,
            self.bundled_root,
            "vue-panel",
            "light",
            "local",
            "my-light",
            "My light",
        )

        self.assertEqual(duplicate["type"], "local/my-light")
        self.assertEqual(duplicate["name"], "My light")
        with self.assertRaises(card_storage.CardReadOnly):
            card_storage.delete_card(
                self.private_root,
                "vue-panel",
                "light",
                duplicate["contentHash"],
            )

    def test_identity_and_variable_validation_fail_closed(self) -> None:
        unsafe = deepcopy(card_metadata())
        unsafe["manufacturer"] = "../outside"
        with self.assertRaises(card_storage.CardFileError):
            card_document(unsafe)

        duplicate_variables = deepcopy(card_metadata())
        duplicate_variables["variables"].append(
            deepcopy(duplicate_variables["variables"][0])
        )
        with self.assertRaises(card_storage.CardFileError):
            card_document(duplicate_variables)

    def test_reserved_manufacturer_cannot_be_created_locally(self) -> None:
        with self.assertRaises(card_storage.CardReadOnly):
            card_storage.create_card(
                self.private_root,
                card_document(card_metadata("vue-panel", "custom")),
            )

    def test_metadata_rejects_unknown_fields_and_non_finite_numbers(self) -> None:
        unknown = card_metadata()
        unknown["futureField"] = True
        with self.assertRaises(card_storage.CardFileError):
            card_document(unknown)

        non_finite = card_document().replace('"width": 140', '"width": NaN')
        with self.assertRaises(card_storage.CardFileError):
            card_storage.parse_card_document(non_finite)

    def test_select_defaults_must_match_declared_options(self) -> None:
        metadata = card_metadata()
        metadata["variables"] = [
            {
                "key": "mode",
                "label": "Mode",
                "type": "select",
                "required": True,
                "options": ["auto", "manual"],
                "default": "missing",
            }
        ]
        with self.assertRaises(card_storage.CardFileError):
            card_document(metadata)

    def test_list_variables_require_valid_item_fields(self) -> None:
        metadata = card_metadata()
        metadata["variables"] = [
            {
                "key": "items",
                "label": "Entries",
                "type": "list",
                "required": False,
                "nestable": True,
                "itemFields": [
                    {"key": "label", "label": "Label", "type": "string", "required": False},
                    {"key": "view", "label": "Target", "type": "view", "required": False},
                ],
            }
        ]
        parsed = card_storage.parse_card_document(card_document(metadata))
        self.assertEqual(parsed["metadata"]["variables"][0]["type"], "list")

        without_fields = card_metadata()
        without_fields["variables"] = [
            {"key": "items", "label": "Entries", "type": "list", "required": False}
        ]
        with self.assertRaises(card_storage.CardFileError):
            card_document(without_fields)

        nested = card_metadata()
        nested["variables"] = [
            {
                "key": "items",
                "label": "Entries",
                "type": "list",
                "required": False,
                "itemFields": [
                    {
                        "key": "inner",
                        "label": "Inner",
                        "type": "list",
                        "required": False,
                        "itemFields": [
                            {"key": "x", "label": "X", "type": "string", "required": False}
                        ],
                    }
                ],
            }
        ]
        with self.assertRaises(card_storage.CardFileError):
            card_document(nested)

        scalar_with_item_fields = card_metadata()
        scalar_with_item_fields["variables"] = [
            {
                "key": "title",
                "label": "Title",
                "type": "string",
                "required": False,
                "nestable": True,
            }
        ]
        with self.assertRaises(card_storage.CardFileError):
            card_document(scalar_with_item_fields)

    def test_reference_card_documents_follow_format_v2(self) -> None:
        examples = Path(__file__).parents[2] / "examples" / "cards" / "vue-panel"
        documents = sorted(examples.glob("*.html"))
        self.assertGreaterEqual(len(documents), 2)
        for path in documents:
            parsed = card_storage.parse_card_document(path.read_text(encoding="utf-8"))
            self.assertEqual(parsed["metadata"]["formatVersion"], 2)

    def test_all_bundled_core_cards_are_valid_and_read_only(self) -> None:
        bundled_root = MODULE_PATH.parent / "bundled_cards"
        catalog = card_storage.list_cards(self.private_root, bundled_root)
        expected = {
            "vue-panel/clock",
            "vue-panel/cover",
            "vue-panel/entities",
            "vue-panel/entity",
            "vue-panel/light",
            "vue-panel/media",
            "vue-panel/menu",
            "vue-panel/room-tile",
            "vue-panel/section-title",
            "vue-panel/sensor",
            "vue-panel/thermostat",
            "vue-panel/weather",
        }

        self.assertEqual({card["type"] for card in catalog}, expected)
        self.assertTrue(all(card["source"] == "bundled" for card in catalog))
        self.assertTrue(all(card["writable"] is False for card in catalog))


if __name__ == "__main__":
    unittest.main()
