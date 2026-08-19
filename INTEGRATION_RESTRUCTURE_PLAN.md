# Vue Panel: Umbau zur Home-Assistant-Integration

Status: Freigegeben, Umsetzung gestartet  
Branch: `feature/integration`  
Datum: 18. August 2026

### Aktueller Umsetzungsstand

- Phase 0 ist abgeschlossen: Card Format v2, Card API v1 (`docs/architecture/sandbox-api-v1.md`)
  und portable Beispiele sind dokumentiert.
- Phase 1 ist technisch weit fortgeschritten: Config-/Dashboard-Subentry-Flow,
  Panel-Registrierung, direkte statische Auslieferung aus dem Integrationspaket und der echte
  query-versionierte Integrations-Build sind vorhanden.
- Die Ersteinrichtung öffnet nach dem Anlegen des einzigen Config Entry unmittelbar den Dialog
  „Dashboard hinzufügen“. Das erste Dashboard erhält eine minimale leere Ansicht „Übersicht“.
- Phase 2 ist lokal implementiert und wartet auf den Abnahmetest in einer echten HA-Instanz:
  mehrere Dashboard-Subentries, private Dashboard-Dateien, Schema-Prüfung, atomare
  Schreibvorgänge, fünf Backups sowie authentifizierte WebSocket-Befehle für Laden, Speichern,
  Export und Import.
- Phase 3 ist lokal implementiert: strikter Card-Format-v2-Parser, privater Katalog und
  revisionsgeschütztes Admin-CRUD, Runtime-Registry, lokaler Dateiimport, Browser-Editor sowie
  capability-basierte Card API v1. Offen ist der echte HA-Abnahmetest mit einer importierten
  Drittanbieter-Card.
- Dashboard-Dateien werden beim Löschen ihres Subentries zunächst gesichert und anschließend
  entfernt. Revisionskonflikte überschreiben nichts, sondern bieten im Frontend „Neu laden“
  oder den Download der lokalen Änderungen als JSON-Kopie an.
- Jede Panel-Instanz besitzt einen eigenen Dashboard-Namen und eine eigene Speicherwarteschlange;
  dadurch können unterschiedliche Panel-URLs keine verzögerten Schreibvorgänge miteinander
  vermischen.
- Das Produktionspanel läuft in einem vom Loader erzeugten iframe und verwendet die dateibasierte
  Integrations-API. Der Loader überträgt das aktuelle HA-Token und die Panel-Metadaten über eine
  schmale `postMessage`-Brücke; die Dashboard-Kopie im `localStorage` bleibt entfernt.
- Die Bars sind seit Engine `2.1.0` feste Engine-Komponenten: vier Positionen (`sidebar-left`,
  `sidebar-right`, `header`, `bottom`) mit frei konfigurierbaren Spalten je Bar. Die früheren
  Bar-Cards sind entfallen; die Navigation liefert die Katalog-Card `vue-panel/menu`.
- Seit Engine `2.1.15` rendert die Engine portable Cards eingebettet statt im Sandbox-iframe,
  damit das Theme-Stylesheet in der Card gilt. Die Card-Grenze ist damit eine Style- und
  DOM-Grenze und keine Sicherheitsgrenze mehr (siehe Abschnitt 4.3).

## 1. Zielbild

Vue Panel wird von einem manuell installierten Frontend-Build zu einer eigenständigen
Home-Assistant-Custom-Integration. Die Integration installiert und verwaltet die Engine,
registriert mehrere Dashboard-Panels und stellt eine dateibasierte Card-Plattform bereit.

Das Ziel besteht aus vier getrennten Bereichen:

1. **Engine** – Vue Panel enthält Layout, Editor, Themes, Card-Host und die HA-Brücke,
   aber keine fachlichen Core-Cards mehr im Engine-Bundle.
2. **Integration** – ein Python-Backend registriert Panels, provisioniert Web-Dateien,
   verwaltet Dashboards und Cards und stellt eine abgesicherte WebSocket-API bereit.
3. **Card-Pakete** – Core-, Custom- und Drittanbieter-Cards verwenden dasselbe portable
   HTML-Format mit Konfiguration/Variablen, HTML, CSS und JavaScript.
4. **Dashboard-Dateien** – jedes Dashboard besitzt eine eigene versionierte JSON-Datei;
   `frontend/get_user_data`, `frontend/set_user_data` und eine Dashboard-Kopie im
   `localStorage` gehören nicht zur neuen Architektur.

Nach dem Umbau ist kein manueller Upload von `dist/` und kein eigener `panel_custom`-Block
in `configuration.yaml` mehr nötig. Die Integration wird einmal über Home Assistants UI
eingerichtet und kann danach mehrere Vue-Panel-Dashboards registrieren.

### 1.1 Greenfield-Grundsatz

Die neue Integration wird wie ein neues Projekt umgesetzt. Der aktuelle Stand dient nur als
fachliche und visuelle Referenz. Es gibt ausdrücklich:

- keine Migration vorhandener Dashboard-Daten;
- keinen Import aus `user_data` oder dem bisherigen `localStorage`;
- keine Legacy-Dateiformate oder alten Custom-Card-Exporte;
- keine parallele alte und neue Card Registry;
- keine Kompatibilitätsadapter für gespeicherte Altstände;
- keine verwaisten Funktionen, Typen, Übersetzungen oder Dokumentationsreste.

Sobald ein neuer Baustein seinen alten Gegenpart ersetzt, wird der alte Code im selben
Arbeitspaket entfernt. Ein Feature gilt erst als abgeschlossen, wenn seine Altpfade gelöscht,
Imports bereinigt und Tests sowie Dokumentation auf die neue Architektur umgestellt sind.

## 2. Technische Fakten und Grenzen

### 2.1 Mehrere Panels sind möglich

Home Assistants `panel_custom.async_register_panel()` kann beliebig oft mit jeweils
eindeutigem `frontend_url_path` aufgerufen werden. Alle Vue-Panel-Dashboards können dasselbe
Web Component und dasselbe `module_url` verwenden. Jedes Dashboard erhält beim Anlegen einen
dauerhaft festgelegten, eindeutigen Namen. Dieser Name ist zugleich sein HA-URL-Pfad und wird
intern über die Panel-Konfiguration an den Loader übergeben; eine technische `dashboard_id`
erscheint nicht in der URL.

Ein URL-Pfad darf nicht mit einem bereits registrierten HA-Panel kollidieren. Beim Umbenennen
oder Löschen muss das alte Panel mit `frontend.async_remove_panel()` entfernt und anschließend
neu registriert werden.

### 2.2 Integrationseigene statische HTTP-Route

Home Assistants `/local`-Route gehört dem Dateisystemverzeichnis `<config>/www`. Vue Panel
verwendet sie nicht mehr. Die Integration registriert ihren eigenen Paketordner mit
`hass.http.async_register_static_paths()` unter `/vue-panel-static`. Loader, Versionsmanifest,
Engine und später die ausgelieferten Core-Card-Releases werden dadurch direkt aus
`custom_components/vue_panel` gelesen. Es gibt weder einen manuellen `dist/`-Upload noch eine
zweite Kopie der Integrationsdateien unter `www`.

Festgelegte Konsequenz:

- Das Integrationspaket enthält den gebauten Engine-Release und die Core-Card-Releases.
- Integrationsupdates ersetzen diese Dateien direkt im Paketordner.
- Query-Versionen und gehashte Chunks steuern den Browser-Cache.
- Hashmanifest, Kopierlogik und öffentlicher Installationszustand sind nicht erforderlich.

### 2.3 Statische Frontend-Inhalte sind öffentlich lesbar

Dateien unter der registrierten `/vue-panel-static`-Route sind nicht durch die
WebSocket-Benutzerrechte geschützt. Integrationscode und Core-Card-Quellcode sind ohnehin für den
Browser bestimmt; Dashboard- und benutzerdefinierte Card-Dateien können jedoch Entity-IDs,
Raumstruktur und weitere private Konfiguration enthalten.

Daher gilt:

- Engine und ausgelieferte Core-Card-Dateien im Integrationspaket;
- Dashboard-JSON unter `<config>/vue-panel/dashboards/`, also außerhalb von `.storage` und
  außerhalb statischer HTTP-Routen;
- lokale und importierte Card-Dateien unter `<config>/vue-panel/cards/`; ihr Inhalt wird nur über
  authentifizierte WebSocket-Befehle geladen und von der Card-Runtime eingebettet gerendert;
- Panel-Metadaten als normale HA-Config-Subentries der Integration;
- Zugriff auf Dashboard-Daten ausschließlich über authentifizierte WebSocket-Befehle.

### 2.4 Gemeinsames Dashboard-Modell

Jede Dashboard-Datei ist eine gemeinsame Serverkonfiguration. Der Zielzustand ist:

- Dashboards sind global und geräteübergreifend;
- alle berechtigten HA-Benutzer dürfen sie lesen;
- nur Administratoren dürfen Dashboards, Panels und Card-Dateien verändern;
- eine spätere rollen- oder benutzerspezifische Sichtbarkeit kann separat ergänzt werden.

## 3. Vorgeschlagene Zielarchitektur

```text
Repository
├─ apps/
│  └─ engine/                         # Vue/Vite-Engine, keine fachlichen Cards
├─ custom_components/
│  └─ vue_panel/
│     ├─ __init__.py                  # Setup/Unload
│     ├─ manifest.json
│     ├─ config_flow.py               # einmalige UI-Einrichtung
│     ├─ const.py
│     ├─ panel_manager.py             # Panels registrieren/entfernen
│     ├─ file_manager.py              # sichere, atomare Dateizugriffe
│     ├─ websocket.py                 # Dashboard-/Card-Kommandos
│     ├─ services.yaml                # optional: reload
│     ├─ strings.json
│     ├─ translations/{de,en}.json
│     ├─ frontend/                    # gebauter Engine-Release
│     └─ bundled_cards/vue-panel/     # ausgelieferte offizielle Card-Dateien
├─ packages/
│  ├─ card-sdk/                       # Format, Typen, Beispiele, Validierung
│  └─ core-cards/                     # Quellen der offiziellen Core-Cards
├─ scripts/
│  └─ build-integration.mjs           # Engine + Cards in Release integrieren
├─ tests/
│  ├─ frontend/
│  └─ integration/
├─ AGENTS.md
└─ PLAN.md
```

Vorgeschlagene Laufzeitstruktur:

```text
<config>/custom_components/vue_panel/
├─ frontend/                           -> URL /vue-panel-static/
│  ├─ loader.js                         # stabiler Panel-Einstieg
│  ├─ version.json                      # Engine-/API-/Card-Format-Version
│  ├─ engine/                           # fester Pfad, Versionierung per Query
│  │  ├─ index.html                      # isoliertes Engine-Dokument
│  │  ├─ panel.css
│  │  └─ assets/...                      # inhaltsbasierte Dateinamen
├─ bundled_cards/vue-panel/             # ausgelieferte, schreibgeschützte Core-Cards
└─ ...                                 # Python-Backend der Integration

<config>/vue-panel/                    # nicht öffentlich, keine HA-.storage-Datei
├─ dashboards/<unique-name>.json       # eigentliche Dashboard-Konfiguration
├─ cards/
│  ├─ local/<card-name>.html            # im Browser erstellte Cards
│  └─ <manufacturer>/<card-name>.html   # importierte Hersteller-Cards
└─ backups/                            # begrenzte automatische Sicherungen
```

## 4. Integrationsmodell

### 4.1 Eine Integration, mehrere Dashboards

Es gibt genau einen HA-Config-Entry für Vue Panel. Jedes Dashboard wird als Config-Subentry
dieser Integration verwaltet. Dadurch erscheinen Anlegen, Bearbeiten und Löschen dort, wo der
Nutzer es erwartet:

```text
Einstellungen → Geräte & Dienste → Vue Panel → Konfigurieren
```

Der Config Flow richtet die Integration einmalig ein. Der Subentry-/Options-Flow zeigt danach
die vorhandenen Panels und bietet „Dashboard hinzufügen“, „Dashboard bearbeiten“ und
„Dashboard löschen“. Der Vue-Panel-Dashboard-Editor selbst verwaltet keine HA-Panels.

Jeder Dashboard-Subentry enthält mindestens:

```json
{
  "name": "wohnung",
  "title": "Wohnung",
  "icon": "mdi:view-dashboard",
  "require_admin": false,
  "dashboard_file": "dashboards/wohnung.json",
  "revision": 1
}
```

`name` ist ein unveränderlicher, URL-sicherer Schlüssel, beispielsweise `wohnung`,
`wandtablet` oder `familie-erdgeschoss`. Er wird serverseitig normalisiert und gegen reservierte
sowie bereits registrierte HA-Pfade validiert. Das Panel ist direkt unter `/<name>` erreichbar;
der Anzeigename `title` kann unabhängig davon jederzeit geändert werden. Weil der eindeutige
Name nach dem Anlegen feststeht, bleiben URL und Dashboard-Datei dauerhaft stabil.

Die Subentry-Daten enthalten nur Registrierungsmetadaten. Die eigentliche Dashboard-Struktur mit
Views, Sections, Bars und Card-Instanzen bleibt ausschließlich in der JSON-Datei. Dass HA seine
Config Entries intern verwaltet, ist Teil jeder UI-konfigurierten Integration und ersetzt nicht
die neue dateibasierte Dashboard-Persistenz.

### 4.2 Panel-Registrierung

Beim Start der Integration:

1. die integrationseigene statische Frontend-Route bereitstellen;
2. Dashboard-Subentries validieren;
3. WebSocket-Kommandos registrieren;
4. für jeden gültigen Datensatz `panel_custom.async_register_panel()` aufrufen;
5. den eindeutigen Dashboard-Namen, Engine-Version und API-Version als Panel-Konfiguration
   übergeben.

Beim Ändern einer Panel-Konfiguration wird das betroffene Panel entfernt und neu registriert.
Beim Unload der Integration werden alle von ihr registrierten Panels entfernt.

### 4.3 Iframe-Einbettung und Authentifizierung

Der Loader bleibt ein stabiles ES-Modul unter `/vue-panel-static/loader.js` und wird direkt aus
dem Integrationspaket ausgeliefert. Die registrierte `module_url` erhält immer die
Integrationsversion als Query-Parameter, beispielsweise
`/vue-panel-static/loader.js?v=2.0.0-alpha.19`. Dadurch kann kein
früher manuell ausgelieferter oder zwischengespeicherter Loader ein neues Custom Element
blockieren. Der Loader erzeugt für jedes Panel ein eigenes iframe auf dieselbe query-versionierte
Engine-SPA:

```text
/vue-panel-static/engine/index.html?ver=2.0.16
```

Home Assistant übergibt `hass`, `narrow`, `route` und `panel` weiterhin als Properties an das
Loader-Custom-Element. Der Loader extrahiert ausschließlich serialisierbare Auth-, Sprach- und
Panel-Metadaten und sendet sie als `vue-panel:auth` an das gleich-originige iframe. Der eindeutige
`dashboardName` stammt aus `panel.config` und erscheint nicht als technischer Parameter in der
sichtbaren Panel-URL. Im iframe stellt die Engine mit dem aktuellen Token eine eigene
HA-WebSocket-Verbindung her und verwendet darüber die authentifizierten Integrationskommandos.

Ab `2.0.0-alpha.22`/Engine `2.1.19` spiegelt der Loader zusätzlich die Route: Der Panel-Unterpfad
aus `route` geht als `routePath` im Kontext und danach als `vue-panel:route` an die Engine, und
jede Engine-Navigation meldet sich als `vue-panel:navigate` zurück. Der Loader schreibt sie über
`history.pushState`/`replaceState` plus `location-changed` in die HA-Adresszeile, sodass
`/<panel>/<view-pfad>` im Browser sichtbar, teilbar und per Zurück-Taste bedienbar bleibt.

Das Vue-DOM, Theme-CSS, Dialoge und schwebende Menüs liegen vollständig im eigenen iframe-Dokument.
`Teleport to="body"` bezieht sich damit ausschließlich auf den iframe-Body und kann weder HA-DOM
noch HA-Styles berühren. Das Engine-iframe ist eine Dokument- und Style-Grenze, aber wegen seiner
gleichen Herkunft keine Sicherheitsgrenze gegenüber Home Assistant.

Das Custom Element übernimmt außerdem Properties, die Home Assistant bereits vor Abschluss des
asynchronen Loader-Imports auf das noch unbekannte Element geschrieben hat. Beim Upgrade werden
diese eigenen Properties entfernt und erneut über die Setter eingespielt. Jeder Engine-Build
leert den generierten `frontend/engine/`-Ordner vor Vite vollständig und schreibt anschließend
direkt in diesen festen Ordner. Der Loader hängt die Engine-Version als Query an `index.html`;
JavaScript-Chunks, Styles und Fonts sind über Inhalts-Hashes versioniert. Die Dateien werden direkt aus dem aktualisierten
Integrationsordner gelesen; eine Provisionierung nach `www` und ein Installationszustand für
verwaltete Assets entfallen.

Bei Token-Aktualisierungen sendet der Loader den neuen Auth-Kontext erneut. Das von
`home-assistant-js-websocket` verwendete Auth-Objekt wartet beim Refresh auf eine solche Nachricht.

Dateibasierte Cards liefen ursprünglich in einem eigenen Sandbox-iframe. Seit Engine `2.1.15`
werden sie eingebettet in das Engine-Dokument gerendert, damit das Theme-Stylesheet auch in der
Card gilt. Ihr CSS wird per nativem CSS-Nesting auf das Card-Element begrenzt und ihr Skript
erhält ein auf die Card begrenztes `document` sowie nachverfolgte Timer und Listener — das ist
eine Style- und DOM-Grenze, keine Sicherheitsgrenze. Eine eingebettete Card teilt den
Engine-Origin und kann das umgebende Dokument erreichen; es dürfen deshalb nur vertrauenswürdige
Cards installiert werden. Die Engine übergibt HA-Daten weiterhin ausschließlich als frische
JSON-Snapshots und prüft Entity-IDs, Icon-Namen, Servicenamen, View-IDs, Payload-Form und die
deklarierte Fähigkeit vor jeder Aktion.

## 5. Dateibasierte Dashboard-Persistenz

Die Engine schreibt niemals direkt in das HA-Dateisystem. Sie verwendet neue, von der
Integration registrierte WebSocket-Kommandos:

```text
vue_panel/dashboard/get
vue_panel/dashboard/save
vue_panel/dashboard/export
vue_panel/dashboard/import
```

Anforderungen an das Backend:

- Lesezugriffe erfordern einen authentifizierten HA-Benutzer.
- Schreib-, Import- und Löschaktionen erfordern standardmäßig Administratorrechte.
- Panel-Aktionen laufen ausschließlich über die administrativen HA-Integrations-Einstellungen,
  nicht über diese WebSocket-API.
- Dashboard-JSON wird gegen ein versioniertes Schema validiert.
- Dashboard-Dateinamen entstehen ausschließlich serverseitig aus geprüften eindeutigen Namen.
- Kein benutzergesteuerter relativer Pfad; Schutz vor Path Traversal und Symlinks.
- Schreiben erfolgt außerhalb des Event-Loops und atomar über temporäre Datei + `os.replace()`.
- Pro Datei verhindert ein `asyncio.Lock` parallele Schreibvorgänge.
- Jeder Ladevorgang liefert `revision` beziehungsweise einen Content-Hash.
- Speichern mit veralteter Revision wird als Konflikt abgelehnt, statt Änderungen still zu
  überschreiben.
- Vor destruktiven Änderungen wird eine begrenzte Sicherung angelegt.
- Dashboard-Daten werden nicht im `localStorage` gespeichert. Nach einem Reload lädt die Engine
  immer die aktuelle Datei über die Integration.

## 6. Einheitliches Card-Dateiformat

Core-, Custom- und Drittanbieter-Cards verwenden dasselbe neu definierte Format:

```html
<script data-vue-panel-config>
const vuePanelCard = {
  "format": "vue-panel-card",
  "formatVersion": 2,
  "apiVersion": 1,
  "manufacturer": "example-manufacturer",
  "cardName": "card-name",
  "name": "Card name",
  "description": "...",
  "icon": "mdi:shape",
  "areas": ["dashboard"],
  "defaultSize": { "cols": 1, "rows": 1, "width": 140, "height": 120 },
  "variables": []
};
</script>

<template data-vue-panel-html>
  <!-- Card markup -->
</template>

<style data-vue-panel-css>
  /* Isolated styles */
</style>

<script data-vue-panel-javascript>
  // Card runtime code
</script>
```

`manufacturer` und `cardName` sind verpflichtend, URL-sicher und nach der Installation
unveränderlich. Daraus entsteht ausschließlich serverseitig der Pfad:

```text
<config>/vue-panel/cards/<manufacturer>/<cardName>.html
```

Beispiel: Eine Card mit `manufacturer: "example-manufacturer"` und
`cardName: "alarm-panel"` wird als
`<config>/vue-panel/cards/example-manufacturer/alarm-panel.html` installiert. Der frei
übersetzbare Anzeigename `name` hat keinen Einfluss auf den Pfad. Die Integration akzeptiert
keinen vom Importdokument vorgegebenen Dateipfad.

Die Metadaten müssen zusätzlich die heutigen Manifest-Fähigkeiten abbilden:

- eindeutige, unveränderliche Kombination aus `manufacturer` und `cardName`;
- Anzeigename, Beschreibung, Icon und Gruppe;
- unterstützte Bereiche: Dashboard, Sidebar-Bar, Header-Bar, Bottom-Bar;
- `fullRow`, Standardgröße und Standard-Sichtbarkeit;
- Variablenschema einschließlich Entity, Icon, View, Select, Text, Zahl und Boolean;
- benötigte Engine-API-Version und optionale Fähigkeiten.

### 6.1 Card-Katalog

Die Integration scannt ausschließlich die definierten Card-Verzeichnisse, validiert jede Datei
und liefert der Engine einen Katalog:

```text
vue_panel/cards/list
vue_panel/cards/get
vue_panel/cards/create
vue_panel/cards/update
vue_panel/cards/delete
vue_panel/cards/import
vue_panel/cards/duplicate
```

Der Katalog enthält Metadaten, URL, Content-Hash, Hersteller, Quelle und Schreibschutzstatus.
Der Herstellername ist zugleich die erste Verzeichnisebene. Die offiziellen Cards verwenden
den reservierten Hersteller `vue-panel` und sind schreibgeschützt. Im Browser erstellte Cards
verwenden standardmäßig `local`; beim Erstellen kann ein anderer noch freier Herstellername
festgelegt werden. Der Editor kann eine verwaltete Hersteller-Card als neue lokale Card
duplizieren, aber niemals die verwaltete Originaldatei überschreiben.

### 6.2 Card-Ausführung und Card SDK

Alle dateibasierten Cards laufen eingebettet im Engine-Dokument mit auf die Card begrenztem CSS.
Die API `vuePanel` wird versioniert und zunächst mindestens um folgende Fähigkeiten ergänzt:

- `config`, `getEntity`, `subscribeEntity`, `callService`, `getIcon`;
- `navigate`, `currentView`, `listViews`;
- `getDashboardContext` für Theme, Sprache und Edit-Modus;
- Event-/Action-Helfer für Bar- und Menü-Cards;
- später Forecast-, History- oder Kamera-Helfer über ausdrücklich erlaubte Bridges.

Die Engine gewährt nur deklarierte Fähigkeiten. Service-Aufrufe bleiben in der Vorschau
deaktiviert. Die API reicht weder HA-Token noch Dateisystemzugriff durch; eine eingebettete Card
kann das umgebende DOM jedoch technisch erreichen, weshalb nur vertrauenswürdige Cards installiert
werden dürfen.

### 6.3 Auslagerung der heutigen Core-Cards

Die heutigen Vue-SFCs dienen nur als Referenz für Verhalten und Darstellung. Jede Core-Card wird
als eigenständige portable HTML-Card neu umgesetzt. Reihenfolge:

1. einfache Anzeige-/Entity-Cards: Clock, Light, Sensor;
2. Service-Cards: Cover, Thermostat, Media;
3. komplexe Cards: Weather, Room Tile, Menu;
4. strukturelle Cards: Section Title;
5. globale Bars: Sidebar, Header, Bottom;
6. interne `custom-html`-Sonderbehandlung entfernen, sobald jede Card denselben Loader nutzt.

Die neue Runtime-Registry besitzt keinen Fallback auf Vue-SFCs. Sobald das minimale externe
Card-System verfügbar ist, werden `src/cards/core-cards/`, der `import.meta.glob`-Registry-Pfad
und die fest eingebauten Core-Manifeste vollständig entfernt. Während der Entwicklung darf ein
noch nicht neu umgesetzter Card-Typ fehlen; er wird nicht über einen Legacy-Adapter simuliert.

## 7. Import von Drittanbieter-Cards

Version 1 des neuen Systems unterstützt ausschließlich den lokalen Dateiimport:

1. Nutzer wählt eine `.vue-panel-card.html`-Datei aus.
2. Die Engine liest sie zur Vorschau, führt sie aber noch nicht aus.
3. Die Integration validiert Größe, Format, ID, API-Version und Zielpfad.
4. Vor dem Installieren werden Quelle und angeforderte Fähigkeiten angezeigt.
5. Die Datei wird nach erfolgreicher Prüfung unter
   `cards/<manufacturer>/<cardName>.html` gespeichert. Bereits vorhandene Kombinationen werden
   nicht still überschrieben, sondern als Update oder Namenskonflikt behandelt.

Direkter Import von beliebigen URLs oder GitHub-Repositories ist zunächst nicht vorgesehen.
Er benötigt später Signaturen/Hashes, Update-Quellen, Timeout- und Redirect-Regeln sowie eine
klare Vertrauensanzeige.

## 8. Build-, Release- und Installationsablauf

Der Build wird zu einer reproduzierbaren Release-Pipeline:

1. TypeScript-/Vue-Prüfung und Frontend-Tests;
2. Vite-Build der Engine mit festem Asset-Basispfad und Versions-Query am Einstieg;
3. Validierung aller Core-Card-Dateien gegen das Card-Schema;
4. Schreiben von Engine und Core-Cards direkt in das Integrationspaket;
5. Erzeugen von `version.json`;
6. Python-Linting und Integrationstests;
7. Erzeugen eines installierbaren ZIP/HACS-Releases.

Beim HA-Setup registriert die Integration ihren statischen Paketordner; es werden keine
Frontend-Dateien nach `www` kopiert. Eigene Hersteller-Card-Dateien und Dashboard-Dateien liegen
außerhalb des Integrationspakets und werden weder beim Update noch beim Unload gelöscht.

Für Entwicklung bleibt Vite-HMR erhalten. Die eigenständige Vite-Seite verwendet weiterhin den
Long-Lived Access Token aus `.env.local`; ein späterer Integrationsschalter kann das Loader-iframe
alternativ auf diese lokale URL verweisen.

## 9. Greenfield-Cutover und Codebereinigung

Es werden keine alten Dashboard- oder Card-Daten übernommen. Die Integration erzeugt beim
Einrichten ein neues leeres Dashboard beziehungsweise eine neue bewusst definierte
Beispielkonfiguration.

Im Zuge des Umbaus werden mindestens folgende Altpfade entfernt:

- `src/core/config/persistence.ts` mit `frontend/get_user_data` und
  `frontend/set_user_data`;
- Dashboard-Persistenz und Dashboard-Synchronisierung über `localStorage`;
- `customCards` innerhalb von `DashboardConfig` sowie die zugehörigen Store-Actions;
- der Sondertyp `custom-html`, sobald alle dateibasierten Cards denselben Runtime-Loader nutzen;
- `src/cards/core-cards/` und die Build-Time-Discovery über `import.meta.glob`;
- alte Card-Manifeste, Gruppenregistrierungen und fest importierte Card-Komponenten;
- frühere Datenmigrationen, Default-Fallbacks und Layout-Aliase für gespeicherte Altstände;
- Kompatibilitätsfelder, welche Größen oder Bar-Einstellungen aus alten Strukturen ableiten;
- der manuelle `dist/`-Uploadworkflow und die alte `panel_custom`-YAML-Dokumentation;
- der direkte Shadow-Root-Mount der Engine und dessen spezielles UI-Portal;
- nicht mehr verwendete i18n-Keys, Typen, Styles, Assets und Abhängigkeiten.

Bereinigung ist Teil jeder Phase und kein nachgelagerter Wunsch. Dafür gelten folgende Gates:

1. `rg` findet keine Referenz auf ersetzte Persistenz- oder Registry-APIs.
2. TypeScript `noUnusedLocals` und `noUnusedParameters` bleiben aktiv.
3. Nicht mehr benötigte npm-Pakete werden aus `package.json` und Lockfile entfernt.
4. Python-Dateien bestehen Linting, Typprüfung und Tests ohne tote Kompatibilitätszweige.
5. `AGENTS.md`, `PLAN.md`, README und Beispiele beschreiben nur die neue Architektur.
6. Der Produktionsbuild enthält keine eingebauten fachlichen Core-Card-Komponenten.

## 10. Umsetzungsphasen und Abnahmekriterien

### Phase 0 – Entscheidungen und Verträge

- die festgelegten Entscheidungen aus Abschnitt 11 als Architekturverträge dokumentieren;
- Dateipfade, Rechte- und Mehrbenutzermodell festlegen;
- Card Format v2 und Sandbox API v1 schriftlich spezifizieren;
- Beispieldateien für eine normale Card und eine Bar-Card festlegen.

Abnahme: Datenmodell und Sicherheitsgrenzen sind freigegeben; es existiert kein Legacy-Vertrag.

### Phase 1 – Integrations-Skelett und Frontend-Auslieferung

- `custom_components/vue_panel` mit Config Flow anlegen;
- Engine/Core-Assets direkt über eine integrationseigene statische Route ausliefern;
- ein Testpanel programmgesteuert registrieren und beim Unload entfernen;
- Query-Versionierung für Loader und Engine einführen.

Abnahme: Installation über HA UI; kein YAML und kein manueller `dist/`-Upload.

### Phase 2 – Mehrere Panels und Datei-Persistenz

- Config-Subentry-/Options-Flows für Dashboard-Panels und dateibasiertes Dashboard-WebSocket-CRUD
  implementieren;
- Revisionskonflikte, atomare Writes, Backups und Rechteprüfungen testen;
- eindeutigen Dashboard-Namen aus `panel.config` durch Router und Store führen;
- Dashboard-Store ausschließlich aus der Integrations-API laden und speichern lassen.

Abnahme: Zwei unabhängige Vue-Panel-Dashboards laufen gleichzeitig unter verschiedenen
HA-URL-Pfaden und bleiben nach Neustart erhalten.

Umsetzungsstand: Code und lokale Datei-/Build-Tests sind abgeschlossen. Offen ist ausschließlich
der Laufzeit-Abnahmetest mit zwei Panels in einer echten Home-Assistant-Instanz.

### Phase 3 – Externe Card Registry und SDK

- Card Parser/Validator und Katalog-WebSocket implementieren;
- Engine-Registry von Build-Time-Discovery auf Runtime-Katalog umstellen;
- Custom-Card-Editor direkt gegen Card-Dateien speichern lassen;
- lokalen Drittanbieter-Dateiimport umsetzen;
- Sandbox API versionieren und Capability-Prüfung ergänzen.

Abnahme: Eine neu importierte Card erscheint ohne Engine-Neubuild im Picker und kann verwendet,
bearbeitet, dupliziert und aktualisiert werden.

Umsetzungsstand: Implementiert. Parser und Katalog validieren Card Format v2 strikt, lokale
Dateien werden atomar und revisionsgeschützt mit fünf Backups verwaltet, und alle Schreibbefehle
erfordern Administratorrechte. Runtime-Registry, Dateiimport, Browser-Editor, CSS-Weitergabe an die
Card-Runtime sowie die capability-basierte Card API v1 sind angeschlossen. Der Admin-Devbereich kann
extern geänderte Card-Dateien ohne Engine-Neubuild neu einlesen. Der echte HA-Laufzeittest mit einer
importierten Drittanbieter-Card bleibt Teil der Abnahme vor Phase 4.

### Phase 4 – Core-Cards portieren

- Core-Cards schrittweise in portable HTML-Dateien umwandeln;
- visuelle und funktionale Regressionstests pro Card;
- Bar-/Navigation-API fertigstellen;
- alte Vue-Core-Card-Registry, Kompatibilitätstypen und ungenutzte Abhängigkeiten entfernen.

Abnahme: Die Engine startet ohne `src/cards/core-cards/`; die vorgesehenen Standardfunktionen
laufen ausschließlich mit Dateien aus `custom_components/vue_panel/bundled_cards/vue-panel/`.

Umsetzungsstand: Abgeschlossen. Die Core-Cards werden vom Integrationskatalog als
schreibgeschützte Card-Format-v2-Dateien geladen. Die Navigations-API unterstützt reaktive
Routen-Abonnements für aktive Menüeinträge und Pfad-Eltern. SFC-Core-Registry, Build-Time-
Discovery, verschachtelte Legacy-Bar-Slots und ihre Kompatibilitätstypen sind entfernt. Die
ursprünglich mitportierten Bar-Cards sind mit Engine `2.1.0` wieder entfallen, weil die Bars
seither Engine-Komponenten mit eigenen Spalten sind; es verbleiben zehn mitgelieferte Cards.

### Phase 5 – Bereinigung und Release

- vollständigen Dead-Code-, Abhängigkeits- und Dokumentationsaudit durchführen;
- Dokumentation für Neuinstallation, Card-Entwicklung und Recovery;
- HACS-/ZIP-Paket und Updatepfad;
- Tests für Neuinstallation, Integration-Updates und Wiederherstellung aus den neuen Backups.

Abnahme: Eine frische Installation funktioniert ohne YAML oder manuelles Kopieren; Quellbaum und
Build enthalten keine alten Persistenz-, Registry- oder Core-Card-Implementierungen.

## 11. Festgelegte Architekturentscheidungen

Die folgenden Punkte sind für die erste Umsetzung verbindlich und keine offenen Fragen mehr:

1. **Dashboard-Speicherort:** Dashboard-JSON-Dateien liegen unter
   `<config>/vue-panel/dashboards/`. Sie befinden sich weder im öffentlich erreichbaren
   `www`-Verzeichnis noch in `.storage`.

2. **Dashboard-Gültigkeit:** Ein Dashboard ist global pro Panel und geräteübergreifend. Alle
   berechtigten HA-Benutzer dürfen es lesen; ausschließlich HA-Administratoren dürfen es
   verändern.

3. **Core-Card-Quellen:** Die offiziellen Cards werden im separaten Monorepo-Paket
   `packages/core-cards` entwickelt. Der Engine-Quellbaum enthält keine fachlichen Core-Cards.

4. **Core-Card-Anpassungen:** Von der Integration verwaltete Core-Card-Dateien sind
   schreibgeschützt. Eigene Anpassungen erfolgen über „Als Custom Card duplizieren“ und erzeugen
   eine unabhängige lokale Hersteller-Card.

5. **Schreibberechtigungen:** Nur HA-Administratoren dürfen Panels, Dashboards oder Card-Dateien
   anlegen, bearbeiten, importieren, duplizieren und löschen. Leserechte werden über die
   authentifizierte Integrations-API geprüft.

6. **Drittanbieter-Import:** Version 1 unterstützt ausschließlich den lokalen Dateiimport. URL-,
   GitHub- und Repository-Import gehören nicht zur ersten Umsetzung.

7. **Gleichzeitiges Bearbeiten:** Dashboard- und Card-Schreibvorgänge verwenden optimistische
   Revisionen. Bei einem Konflikt bietet der Dialog „Neu laden“ oder „Als Kopie speichern“ an;
   Änderungen werden niemals stillschweigend überschrieben.

8. **Versionshistorie:** Pro Dashboard und bearbeitbarer Card werden fünf automatische Backups
   aufbewahrt. Das Undo/Redo der aktuellen Browsersitzung bleibt zusätzlich bestehen.

9. **Manuelle Card-Dateien:** Bearbeitbare Hersteller-Dateien liegen ausschließlich unter
   `<config>/vue-panel/cards/` und dürfen extern bearbeitet werden. Der Admin-Devbereich liest den
   Katalog über `vue_panel/cards/list` neu ein; das Backend hält keinen separaten Dateicache.
   Runtime- und Core-Dateien liegen schreibgeschützt im Integrationspaket und werden bei einem
   Integrationsupdate ersetzt.

10. **Ersteinrichtung:** Direkt nach dem Anlegen der Integration startet der Subentry-Dialog
    „Dashboard hinzufügen“. Das neu erzeugte Dashboard enthält genau eine leere Ansicht
    „Übersicht“ und keine Cards.

## 12. Nicht Teil der ersten Umsetzung

- öffentlicher Card-Marktplatz;
- automatische Installation direkt von beliebigen URLs;
- kryptografisch signierte Card-Pakete;
- kollaboratives Echtzeit-Editing;
- direkte Ausführung beliebiger Drittanbieter-Module ohne Card-Format und Capability-Prüfung;
- Import oder Zusammenführung von Dashboards aus der bisherigen Vue-Panel-Version.

## 13. Referenzen

- [Home Assistant `panel_custom.async_register_panel`](https://github.com/home-assistant/core/blob/dev/homeassistant/components/panel_custom/__init__.py)
- [Home Assistant Frontend: Panel- und `/local`-Registrierung](https://github.com/home-assistant/core/blob/dev/homeassistant/components/frontend/__init__.py)
- [Home Assistant: WebSocket API erweitern](https://developers.home-assistant.io/docs/frontend/extending/websocket-api)
- [Home Assistant: Berechtigungen für WebSocket- und REST-Befehle](https://developers.home-assistant.io/docs/auth_permissions/)
- [Home Assistant: Config Flow](https://developers.home-assistant.io/docs/core/integration/config_flow/)
- [Home Assistant: asynchrone statische Pfade](https://developers.home-assistant.io/blog/2024/06/18/async_register_static_paths/)
