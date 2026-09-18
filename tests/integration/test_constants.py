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

    def test_lovelace_module_url_contains_integration_version(self) -> None:
        self.assertEqual(
            constants.LOVELACE_MODULE_URL,
            f"{constants.STATIC_URL_BASE}/lovelace.js"
            f"?v={constants.INTEGRATION_VERSION}",
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

        lovelace_path = MODULE_PATH.parent / "frontend" / "lovelace.js"
        lovelace = lovelace_path.read_text(encoding="utf-8")
        self.assertIn("customElements.define(CARD_TAG, VuePanelHost)", lovelace)
        self.assertIn("document.createElement('vue-panel-panel')", lovelace)
        self.assertIn("panel.embedded = true", lovelace)
        self.assertIn("closestAcrossShadowRoots(this, 'hui-root')", lovelace)
        self.assertIn("style.dataset.vuePanelNativeChrome = 'hidden'", lovelace)
        self.assertIn("padding-top: var(--view-container-padding-top, 0px)", lovelace)
        self.assertIn("'height:100dvh'", lovelace)
        self.assertIn("const mountedPanels = new WeakMap()", lovelace)
        self.assertIn("panelMountFor(lovelaceRoot, this._config.dashboardName)", lovelace)
        self.assertIn("viewContainer.insertBefore(container, viewContainer.firstChild)", lovelace)
        self.assertNotIn("this.appendChild(panel)", lovelace)

        engine_path = MODULE_PATH.parent / "frontend" / "engine"
        self.assertTrue((engine_path / "index.html").is_file())
        self.assertFalse((engine_path / "panel.js").exists())

    def test_frontend_is_served_from_the_integration_directory(self) -> None:
        frontend_path = MODULE_PATH.parent / "frontend.py"
        frontend_source = frontend_path.read_text(encoding="utf-8")
        self.assertIn("hass.http.async_register_static_paths", frontend_source)
        self.assertIn('Path(__file__).parent / "frontend"', frontend_source)
        self.assertIn("frontend.add_extra_js_url", frontend_source)
        self.assertIn("LOVELACE_MODULE_URL", frontend_source)
        self.assertNotIn('hass.config.path("www"', frontend_source)

    def test_dashboard_is_registered_through_lovelace(self) -> None:
        manager_path = MODULE_PATH.parent / "panel_manager.py"
        manager = manager_path.read_text(encoding="utf-8")
        self.assertIn('frontend.async_register_built_in_panel(', manager)
        self.assertIn('"lovelace",', manager)
        self.assertIn('"type": "custom:vue-panel-host"', manager)
        self.assertNotIn("panel_custom.async_register_panel", manager)
        self.assertNotIn("homeassistant.helpers.json", manager)
        self.assertNotIn("cached_json_fragment", manager)

        manifest_path = MODULE_PATH.parent / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertIn("lovelace", manifest["dependencies"])
        self.assertNotIn("panel_custom", manifest["dependencies"])


if __name__ == "__main__":
    unittest.main()
