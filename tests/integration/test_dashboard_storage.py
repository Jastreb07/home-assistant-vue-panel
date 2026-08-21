"""Tests for the Home Assistant-independent dashboard file engine."""

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
    / "dashboard_storage.py"
)
SPEC = importlib.util.spec_from_file_location(
    "vue_panel_dashboard_storage", MODULE_PATH
)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Unable to load dashboard storage module")
dashboard_storage = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(dashboard_storage)


class DashboardStorageTests(unittest.TestCase):
    """Exercise validation, revisions, backups, and archival."""

    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.private_root = Path(self.temporary_directory.name) / "vue-panel"
        dashboard_storage.ensure_dashboard(self.private_root, "wohnung")

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def test_new_dashboard_is_minimal_and_valid(self) -> None:
        document = dashboard_storage.read_dashboard(self.private_root, "wohnung")

        self.assertEqual(document["revision"], 1)
        self.assertEqual(document["views"][0]["title"], "Übersicht")
        self.assertEqual(document["views"][0]["sections"], [])

    def test_save_increments_revision_and_rejects_stale_writes(self) -> None:
        document = dashboard_storage.read_dashboard(self.private_root, "wohnung")
        document["views"][0]["title"] = "Wohnung"

        saved = dashboard_storage.save_dashboard(
            self.private_root,
            "wohnung",
            document,
            1,
        )

        self.assertEqual(saved["revision"], 2)
        with self.assertRaises(dashboard_storage.DashboardRevisionConflict) as context:
            dashboard_storage.save_dashboard(
                self.private_root,
                "wohnung",
                document,
                1,
            )
        self.assertEqual(context.exception.current_revision, 2)

    def test_only_five_backups_are_retained(self) -> None:
        document = dashboard_storage.read_dashboard(self.private_root, "wohnung")
        for revision in range(1, 8):
            document["revision"] = revision
            document = dashboard_storage.save_dashboard(
                self.private_root,
                "wohnung",
                document,
                revision,
            )

        backup_root = self.private_root / "backups" / "wohnung"
        self.assertEqual(len(list(backup_root.glob("*.json"))), 5)

    def test_archive_creates_backup_and_removes_dashboard(self) -> None:
        self.assertTrue(
            dashboard_storage.archive_dashboard(self.private_root, "wohnung")
        )

        self.assertFalse(
            (self.private_root / "dashboards" / "wohnung.json").exists()
        )
        self.assertEqual(
            len(list((self.private_root / "backups" / "wohnung").glob("*.json"))),
            1,
        )

    def test_dashboards_with_different_names_remain_independent(self) -> None:
        dashboard_storage.ensure_dashboard(self.private_root, "wandtablet")
        wohnung = dashboard_storage.read_dashboard(self.private_root, "wohnung")
        wohnung["views"][0]["title"] = "Wohnung"

        dashboard_storage.save_dashboard(
            self.private_root,
            "wohnung",
            wohnung,
            1,
        )

        wandtablet = dashboard_storage.read_dashboard(
            self.private_root,
            "wandtablet",
        )
        self.assertEqual(wandtablet["revision"], 1)
        self.assertEqual(wandtablet["views"][0]["title"], "Übersicht")

    def test_cards_require_manufacturer_qualified_type(self) -> None:
        document = deepcopy(dashboard_storage.default_dashboard())
        document["views"][0]["sections"] = [
            {
                "id": "main",
                "cards": [{"id": "light-one", "type": "light", "config": {}}],
            }
        ]

        with self.assertRaises(dashboard_storage.DashboardFileError):
            dashboard_storage.validate_dashboard(document)

        document["views"][0]["sections"][0]["cards"][0]["type"] = "vue-panel/light"
        dashboard_storage.validate_dashboard(document)

    def test_bars_are_containers_with_card_columns(self) -> None:
        document = deepcopy(dashboard_storage.default_dashboard())

        self.assertEqual(
            set(document["bars"]),
            {"sidebar-left", "sidebar-right", "header", "bottom"},
        )
        sidebar = document["bars"]["sidebar-left"]
        self.assertEqual(
            [card["type"] for card in sidebar["columns"][0]["cards"]],
            ["vue-panel/clock", "vue-panel/menu"],
        )

        sidebar["columns"].append(
            {
                "id": "sidebar-left-second",
                "size": 120,
                "padding": {"top": 8, "bottom": 8},
                "align": "end",
                "crossAlign": "center",
                "cards": [],
            }
        )
        dashboard_storage.validate_dashboard(document)

        sidebar["columns"] = []
        with self.assertRaises(dashboard_storage.DashboardFileError):
            dashboard_storage.validate_dashboard(document)

    def test_bar_containers_reject_invalid_geometry(self) -> None:
        document = deepcopy(dashboard_storage.default_dashboard())

        document["bars"]["sidebar-left"]["size"] = 40
        with self.assertRaises(dashboard_storage.DashboardFileError):
            dashboard_storage.validate_dashboard(document)

        document["bars"]["sidebar-left"]["size"] = 280
        document["bars"]["sidebar-left"]["placement"] = "full"
        with self.assertRaises(dashboard_storage.DashboardFileError):
            dashboard_storage.validate_dashboard(document)

        del document["bars"]["sidebar-left"]["placement"]
        document["bars"]["header"]["columns"][0]["align"] = "middle"
        with self.assertRaises(dashboard_storage.DashboardFileError):
            dashboard_storage.validate_dashboard(document)

        document["bars"]["header"]["columns"][0]["align"] = "center"
        document["bars"]["header"]["columns"][0]["padding"] = {"middle": 4}
        with self.assertRaises(dashboard_storage.DashboardFileError):
            dashboard_storage.validate_dashboard(document)

    def test_bar_column_size_modes(self) -> None:
        document = deepcopy(dashboard_storage.default_dashboard())
        column = document["bars"]["sidebar-left"]["columns"][0]

        column["sizeMode"] = "fit"
        dashboard_storage.validate_dashboard(document)

        column["sizeMode"] = "full"
        dashboard_storage.validate_dashboard(document)

        column["sizeMode"] = "fixed"
        with self.assertRaises(dashboard_storage.DashboardFileError):
            dashboard_storage.validate_dashboard(document)

        column["size"] = 200
        dashboard_storage.validate_dashboard(document)

        column["sizeMode"] = "huge"
        with self.assertRaises(dashboard_storage.DashboardFileError):
            dashboard_storage.validate_dashboard(document)

        # Legacy documents without sizeMode: a bare size still means fixed.
        del column["sizeMode"]
        dashboard_storage.validate_dashboard(document)

    def test_bar_card_ids_share_the_dashboard_id_namespace(self) -> None:
        document = deepcopy(dashboard_storage.default_dashboard())
        document["bars"]["header"]["columns"][0]["cards"] = [
            {"id": "bar-sidebar-left-clock", "type": "vue-panel/clock", "config": {}}
        ]

        with self.assertRaises(dashboard_storage.DashboardFileError):
            dashboard_storage.validate_dashboard(document)

    def test_unsafe_dashboard_names_are_rejected(self) -> None:
        with self.assertRaises(dashboard_storage.DashboardFileError):
            dashboard_storage.ensure_dashboard(self.private_root, "../outside")


    def test_popups_are_stored_and_validated(self) -> None:
        document = dashboard_storage.read_dashboard(self.private_root, "wohnung")
        document["popups"] = [
            {
                "id": "popup-1",
                "title": "Licht",
                "icon": "mdi:lightbulb",
                "size": "lg",
                "width": 640,
                "height": 480,
                "align": "center",
                "css": ".x { color: red; }",
                "sections": [
                    {
                        "id": "sec-1",
                        "cards": [
                            {
                                "id": "card-1",
                                "type": "vue-panel/light-detail",
                                "config": {"entity": "light.kitchen"},
                            }
                        ],
                    }
                ],
            }
        ]

        saved = dashboard_storage.save_dashboard(
            self.private_root,
            "wohnung",
            document,
            1,
        )

        self.assertEqual(saved["popups"][0]["id"], "popup-1")
        self.assertEqual(
            saved["popups"][0]["sections"][0]["cards"][0]["type"],
            "vue-panel/light-detail",
        )

    def test_invalid_popups_are_rejected(self) -> None:
        document = dashboard_storage.read_dashboard(self.private_root, "wohnung")
        for popup in (
            "popup-1",
            {"title": "Ohne ID", "sections": []},
            {"id": "popup 1", "title": "Leerzeichen", "sections": []},
            {"id": "popup-1", "title": "Zu klein", "width": 10, "sections": []},
            {"id": "popup-1", "title": "Falsche Größe", "size": "xxl", "sections": []},
            {"id": "popup-1", "title": "Unbekannt", "sections": [], "bogus": True},
            {"id": "popup-1", "title": "Ohne Abschnitte"},
        ):
            candidate = deepcopy(document)
            candidate["popups"] = [popup]
            with self.subTest(popup=popup):
                with self.assertRaises(dashboard_storage.DashboardFileError):
                    dashboard_storage.validate_dashboard(candidate)

    def test_duplicate_popup_ids_are_rejected(self) -> None:
        document = dashboard_storage.read_dashboard(self.private_root, "wohnung")
        document["popups"] = [
            {"id": "popup-1", "title": "A", "sections": []},
            {"id": "popup-1", "title": "B", "sections": []},
        ]

        with self.assertRaises(dashboard_storage.DashboardFileError):
            dashboard_storage.validate_dashboard(document)


if __name__ == "__main__":
    unittest.main()
