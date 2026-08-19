# Vue Panel

Vue Panel ist eine visuell konfigurierbare Dashboard-Engine und Home-Assistant-Custom-Integration.
Die Integration registriert mehrere unabhängige Panels über die Home-Assistant-Oberfläche, liefert
die Engine selbst aus und speichert Dashboards sowie eigene Cards in privaten JSON-/HTML-Dateien.

## Architektur

- `custom_components/vue_panel/` enthält die installierbare HA-Integration, den iframe-Loader,
  den Engine-Build und die schreibgeschützten Core-Cards.
- `<config>/vue-panel/dashboards/<name>.json` enthält je Panel eine Dashboard-Konfiguration.
- `<config>/vue-panel/cards/<manufacturer>/<cardName>.html` enthält lokale oder importierte Cards.
- `custom_components/vue_panel/bundled_cards/vue-panel/*.html` enthält die 13 mitgelieferten Cards.
- Jede Card läuft in einem eigenen `sandbox="allow-scripts"`-iframe und erhält nur deklarierte
  Funktionen der versionierten `vuePanel`-API.

Das normative Dateiformat steht in
[`docs/architecture/card-format-v2.md`](docs/architecture/card-format-v2.md), die Sandbox-API in
[`docs/architecture/sandbox-api-v1.md`](docs/architecture/sandbox-api-v1.md). Der laufende Umbau
und seine Phasen sind in
[`INTEGRATION_RESTRUCTURE_PLAN.md`](INTEGRATION_RESTRUCTURE_PLAN.md) dokumentiert.

## Entwicklung

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run build
npm.cmd run build:integration
npm.cmd run test:python
```

Der Dev-Server verwendet `VITE_HASS_URL` und `VITE_HASS_TOKEN` aus `.env.local`. Der
Integrationsbuild wird direkt nach `custom_components/vue_panel/frontend/engine/` geschrieben;
ein manueller Upload nach `config/www` ist nicht vorgesehen.

## Installation in Home Assistant

Den Ordner `custom_components/vue_panel` nach `<config>/custom_components/vue_panel` kopieren,
Home Assistant neu starten und Vue Panel unter **Einstellungen → Geräte & Dienste** hinzufügen.
Dashboards werden anschließend als Subentries der Integration angelegt; YAML-`panel_custom` ist
nicht erforderlich.
