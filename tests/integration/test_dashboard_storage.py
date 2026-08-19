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

    def test_bars_are_containers_with_three_card_slots(self) -> None:
        document = deepcopy(dashboard_storage.default_dashboard())
        sidebar = document["bars"]["sidebar"]

        self.assertEqual(set(sidebar["slots"]), {"start", "center", "end"})
        self.assertEqual(
            sidebar["slots"]["center"][0]["type"], "vue-panel/sidebar-bar"
        )

        sidebar["slots"]["end"] = [
            {"id": "sidebar-clock", "type": "vue-panel/clock", "config": {}}
        ]
        dashboard_storage.validate_dashboard(document)

        del sidebar["slots"]["end"]
        with self.assertRaises(dashboard_storage.DashboardFileError):
            dashboard_storage.validate_dashboard(document)

    def test_bar_containers_reject_invalid_geometry(self) -> None:
        document = deepcopy(dashboard_storage.default_dashboard())

        document["bars"]["sidebar"]["size"] = 40
        with self.assertRaises(dashboard_storage.DashboardFileError):
            dashboard_storage.validate_dashboard(document)

        document["bars"]["sidebar"]["size"] = 280
        document["bars"]["sidebar"]["placement"] = "full"
        with self.assertRaises(dashboard_storage.DashboardFileError):
            dashboard_storage.validate_dashboard(document)

        del document["bars"]["sidebar"]["placement"]
        document["bars"]["header"]["centerAlign"] = {"vertical": "middle"}
        with self.assertRaises(dashboard_storage.DashboardFileError):
            dashboard_storage.validate_dashboard(document)

    def test_bar_card_ids_share_the_dashboard_id_namespace(self) -> None:
        document = deepcopy(dashboard_storage.default_dashboard())
        document["bars"]["header"]["slots"]["start"] = [
            {"id": "bar-sidebar-nav", "type": "vue-panel/clock", "config": {}}
        ]

        with self.assertRaises(dashboard_storage.DashboardFileError):
            dashboard_storage.validate_dashboard(document)

    def test_unsafe_dashboard_names_are_rejected(self) -> None:
        with self.assertRaises(dashboard_storage.DashboardFileError):
            dashboard_storage.ensure_dashboard(self.private_root, "../outside")


if __name__ == "__main__":
    unittest.main()
