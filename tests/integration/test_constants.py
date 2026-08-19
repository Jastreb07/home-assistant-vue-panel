"""Tests for integration release and frontend cache constants."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import unittest

MODULE_PATH = (
    Path(__file__).parents[2]
    / "custom_components"
    / "vue_panel"
    / "const.py"
)
SPEC = importlib.util.spec_from_file_location("vue_panel_const", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Unable to load Vue Panel constants")
constants = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(constants)


class IntegrationConstantTests(unittest.TestCase):
    """Keep the loader cache key aligned with the integration release."""

    def test_panel_module_url_contains_integration_version(self) -> None:
        self.assertEqual(
            constants.PANEL_MODULE_URL,
            f"{constants.STATIC_URL_BASE}/loader.js?v={constants.INTEGRATION_VERSION}",
        )

    def test_manifest_matches_integration_version(self) -> None:
        manifest_path = MODULE_PATH.parent / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(manifest["version"], constants.INTEGRATION_VERSION)

    def test_version_manifest_matches_engine_version(self) -> None:
        version_path = MODULE_PATH.parent / "frontend" / "version.json"
        version = json.loads(version_path.read_text(encoding="utf-8"))
        self.assertEqual(version["engineVersion"], constants.ENGINE_VERSION)
        self.assertNotIn("module", version)

        loader_path = MODULE_PATH.parent / "frontend" / "loader.js"
        loader = loader_path.read_text(encoding="utf-8")
        self.assertIn("new URL('version.json', loaderUrl)", loader)
        self.assertIn("versionUrl.searchParams.set('ver', loaderVersion)", loader)
        self.assertIn("new URL('engine/index.html', loaderUrl)", loader)
        self.assertIn("document.createElement('iframe')", loader)
        self.assertIn("type: 'vue-panel:auth'", loader)
        self.assertIn("dashboardName: config.dashboardName", loader)
        self.assertIn("isAdmin: this._hass?.user?.is_admin === true", loader)
        self.assertIn("Engine ${loadedVersion} loaded in isolated iframe", loader)

        engine_path = MODULE_PATH.parent / "frontend" / "engine"
        self.assertTrue((engine_path / "index.html").is_file())
        self.assertFalse((engine_path / "panel.js").exists())

    def test_frontend_is_served_from_the_integration_directory(self) -> None:
        frontend_path = MODULE_PATH.parent / "frontend.py"
        frontend_source = frontend_path.read_text(encoding="utf-8")
        self.assertIn("hass.http.async_register_static_paths", frontend_source)
        self.assertIn('Path(__file__).parent / "frontend"', frontend_source)
        self.assertNotIn('hass.config.path("www"', frontend_source)


if __name__ == "__main__":
    unittest.main()
