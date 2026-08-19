# AGENTS.md — Projektgedächtnis für KI-Agenten

> Diese Datei ist das Übergabe-Dokument für neue KI-Sessions. Sie beschreibt Zweck,
> Architektur, Konventionen und Fallstricke des Projekts. Details zur ursprünglichen
> Planung stehen in `PLAN.md`. **Bei Architekturänderungen beide Dateien aktualisieren!**

## 0. Aktiver Greenfield-Umbau

Auf Branch `feature/integration` wird das Projekt nach
`INTEGRATION_RESTRUCTURE_PLAN.md` zu einer Home-Assistant-Custom-Integration umgebaut. Dieser Plan
ist für neue Arbeit maßgeblich; die nachfolgenden Abschnitte dokumentieren den noch vorhandenen
Frontend-Altstand nur als Portierungsreferenz.

Aktueller Stand:

- Phase 0 abgeschlossen: `docs/architecture/card-format-v2.md`,
  `docs/architecture/sandbox-api-v1.md` und zwei portable Beispiel-Cards;
- Phase 1 weit fortgeschritten: `custom_components/vue_panel` mit
  Config-/Dashboard-Subentry-Flow, Panel-Manager, loader-erzeugtem Engine-iframe, eigenem
  Integrations-Build und statischer Auslieferung direkt aus dem Integrationspaket;
- die Ersteinrichtung öffnet sofort „Dashboard hinzufügen“ und erzeugt eine minimale leere
  Ansicht „Übersicht“ ohne Cards;
- Phase 2 ist lokal implementiert und wartet auf den echten HA-Abnahmetest: mehrere
  Dashboard-Subentries, private Dashboard-Dateien, atomare Schreibvorgänge, Revisionsschutz,
  fünf Backups sowie authentifizierte WebSocket-Befehle für Laden, Speichern, Export und Import;
- der erste echte HA-Test zeigte einen noch browserseitig gecachten 1.x-Loader; deshalb enthält
  die registrierte Loader-`module_url` ab `2.0.0-alpha.2` stets die Integrationsversion als
  Cache-Busting-Query;
- ab `2.0.0-alpha.3` übernimmt das Custom Element auch `hass`, `panel`, `narrow` und `route`,
  wenn HA sie bereits vor dem asynchronen Web-Component-Upgrade als eigene Properties gesetzt
  hat; Engine `2.0.1` leert beim Build den gesamten generierten Engine-Ordner;
- ab `2.0.0-alpha.4`/Engine `2.0.2` erfolgt dieses Aufräumen in einem Prebuild-Schritt und Vite
  schreibt wieder direkt in den Versionsordner; so enthalten Modul-Preloads den Engine-Pfad nicht
  doppelt;
- ab `2.0.0-alpha.5` liegt die Engine ohne Versionsordner fest unter
  `/local/vue-panel/engine/`; der Loader importiert `panel.js?ver=<engineVersion>`. Beim HA-Start
  vergleicht die Integration die installierte Engine-Version und ersetzt bei einer Änderung den
  gesamten öffentlichen Engine-Ordner, bevor sie den aktuellen Build kopiert;
- ab `2.0.0-alpha.6`/Engine `2.0.3` liest die Menu-Card den aktiven Pfad über die reaktive
  `router.currentRoute`; dadurch ist der erste Render während des Dashboard-Ladens abgesichert;
- ab `2.0.0-alpha.7`/Engine `2.0.4` erhält auch `version.json` den Cache-Key des Loaders. Der
  Loader protokolliert die angeforderte und erfolgreich geladene Engine-Version in der Konsole;
  AppShell und Menu-Card verwenden beide ausschließlich `router.currentRoute`;
- ab `2.0.0-alpha.8`/Engine `2.0.5` werden Loader, Version und Engine direkt aus
  `custom_components/vue_panel/frontend` unter `/vue-panel-static/` ausgeliefert. Die frühere
  Kopie nach `www/vue-panel`, das Hashmanifest und der öffentliche Asset-Zustand sind entfernt;
- ab `2.0.0-alpha.9`/Engine `2.0.6` verwenden Shell, Menu-Card und Room-Tile eine gemeinsame
  reaktive Hash-Navigation ohne Vue-Router-Injection. Dadurch funktionieren auch lazy geladene
  Cards im HA-Custom-Element, ohne auf einen fehlenden Router-Kontext zuzugreifen;
- ab `2.0.0-alpha.14`/Engine `2.0.11` erzeugt die Custom-Card-Sandbox ihre Nachrichtenkanäle
  über einen HTTP-kompatiblen Runtime-ID-Helfer. Dieser verwendet `crypto.getRandomValues()` mit
  einem lokalen Fallback und setzt nicht mehr das nur in sicheren Kontexten verfügbare
  `crypto.randomUUID()` voraus;
- ab `2.0.0-alpha.16`/Engine `2.0.13` erzeugt der HA-Custom-Element-Loader wieder ein eigenes
  iframe nach dem bewährten 1.x-Prinzip. Die Engine wird als normale SPA aus `engine/index.html`
  geladen und erhält Auth-Token, Sprache sowie Dashboard-Metadaten über `vue-panel:auth`; das
  Shadow-Root-Mount und sein UI-Portal sind vollständig entfernt;
- ab `2.0.0-alpha.17`/Engine `2.0.14` sind die inzwischen überflüssigen Dialog- und Bar-Workarounds
  des direkten Custom-Element-Mounts entfernt. Dialoge teleportieren wieder in den iframe-Body,
  alle Bar-Cards sind regulär lazy und das Card-Menü verwendet wieder seine ursprüngliche
  viewport-feste Ebene;
- ab `2.0.0-alpha.18`/Engine `2.0.15` übergibt der Loader den Administratorstatus des aktuellen
  HA-Benutzers an die isolierte Engine. Die Dev-Sidebar ist im Vite-Dev-Modus immer und in Home
  Assistant ausschließlich für Administratoren verfügbar;
- ab `2.0.0-alpha.19`/Engine `2.0.16` ist Phase 3 implementiert: Die Integration verwaltet den
  validierten Card-Format-v2-Katalog unter `<config>/vue-panel/cards/`, die Engine lädt ihn zur
  Laufzeit und der Browser-Editor erstellt, importiert, aktualisiert, dupliziert und löscht diese
  Dateien über eine revisionsgeschützte Admin-WebSocket-API;
- ab `2.0.0-alpha.20`/Engine `2.0.17` ist Phase 4 implementiert: Alle 13 mitgelieferten Cards
  einschließlich Sidebar, Header und Bottom-Bar liegen als validierte Card-Format-v2-Dateien
  unter `custom_components/vue_panel/bundled_cards/vue-panel/`. SFC-Core-Registry,
  Build-Time-Card-Discovery und verschachtelte Legacy-Bar-Slots sind entfernt;
- ab Engine `2.1.0` sind die Bars feste Engine-Komponenten mit beliebig vielen Spalten
  (`fit`/`full`/`fixed`, Abstände und Ausrichtung je Spalte). Es gibt vier Positionen
  `sidebar-left`, `sidebar-right`, `header` und `bottom`; die rechte Seitenleiste ist bei
  neuen Views aus. Die drei früheren Bar-Cards sind entfallen, die Navigation kommt aus der
  Katalog-Card `vue-panel/menu`;
- ab Engine `2.1.15` laufen portable Cards eingebettet im Engine-Dokument statt in einem
  Sandbox-iframe. Das Card-CSS wird per nativem CSS-Nesting auf die Card begrenzt, das
  Theme-Stylesheet gilt damit auch innerhalb der Card. Das ist eine Style- und DOM-Grenze,
  keine Sicherheitsgrenze mehr;
- gelöschte Dashboard-Subentries werden gesichert und ihre aktive JSON-Datei wird entfernt;
  Revisionskonflikte bieten „Neu laden“ oder eine lokale JSON-Kopie an;
- jede Panel-Instanz führt ihren unveränderlichen Dashboard-Namen und ihre debouncte
  Speicherwarteschlange getrennt; alle Core-Card-Typen sind als
  `vue-panel/<card-name>` qualifiziert;
- der Produktionspfad erhält über den Loader ausschließlich serialisierbare Auth- und
  Panel-Metadaten und öffnet im iframe eine eigene HA-WebSocket-Verbindung; Dashboard-`localStorage`
  und `frontend/*_user_data` bleiben entfernt;
- die bestehende Engine unter `src/` bleibt nur so lange erhalten, bis ihr jeweiliger neuer
  Gegenpart funktioniert; es werden keine Legacy-Datenformate oder Migrationen gebaut;
- Dashboard-Dateien liegen privat unter `<config>/vue-panel/dashboards/`; lokale und importierte
  Cards liegen unter `<config>/vue-panel/cards/` und werden authentifiziert geladen;
- Runtime und ausgelieferte Core-Cards liegen im Integrationspaket. Nur der gezielt registrierte
  Frontend-Ordner ist unter `/vue-panel-static/` erreichbar;
- der Loader läuft als HA-Custom-Element und hält die Engine in einem eigenen iframe-Dokument;
  portable Cards laufen innerhalb dieses Dokuments eingebettet — mit auf die Card begrenztem CSS,
  aber ohne eigene Sicherheitsgrenze.

## 1. Was ist dieses Projekt?

**vue-panel** ist eine Dashboard-Engine für Home Assistant (HA), die Lovelace **komplett ersetzt**:
- Kein YAML — die Dashboard-Konfiguration wird **im Browser visuell bearbeitet** und über die
  Integration in einer eigenen privaten JSON-Datei gespeichert.
- Vue 3.5 (Composition API, `<script setup>`) + TypeScript + Vite + Pinia + vue-router (Hash) + vue-i18n v11.
- Zielgeräte: Wand-Tablets und Desktops (SideNav links) sowie Smartphones (SideNav standardmäßig ausgeblendet). Die Gerätebereiche folgen der CSS-basierten Card-Sichtbarkeit.
- Oberstes Designziel: **Neue Cards und Themes müssen extrem einfach zu erstellen sein** (1 Ordner, Auto-Discovery, keine zentrale Registrierung).

**Alle 4 Phasen aus PLAN.md §9 sind abgeschlossen** (Fundament, Editor, Layouts & Cards, Polish) plus Theme-System und Dialog-Service.

## 2. Umgebung & Befehle

- **Windows**, PowerShell ohne `&&`. npm immer als **`npm.cmd`** aufrufen (Execution Policy blockt `npm.ps1`).
- Projektpfad: `C:\Users\vdell\PhpstormProjects\Nuxt\vue-panel`
- `npm.cmd run dev` → http://localhost:5173/local/vue-panel/ (Dev-Auth via `.env.local`: `VITE_HASS_URL` + `VITE_HASS_TOKEN`, Vorlage `.env.example`)
- `npm.cmd run build` → `vue-tsc -b && vite build` → `dist/`
- Der Nutzer ist deutschsprachig (Antworten auf Deutsch), **Code/Kommentare sind ausschließlich Englisch**.
- Nachbarprojekt `..\ha-vue-kiosk` (Git-Repo exSnake/ha-vue-kiosk) ist das ALTE Kiosk-Panel — nur als Referenz, nicht anfassen.

## 3. Deployment (HA-Integration)

- Das installierbare Paket ist vollständig `custom_components/vue_panel/`; es gibt keinen
  manuellen Upload nach `config/www` und keine YAML-Panel-Registrierung.
- `frontend.py` registriert `custom_components/vue_panel/frontend` über
  `hass.http.async_register_static_paths()` unter `/vue-panel-static/`.
- Der Config-/Subentry-Flow registriert die Dashboards programmgesteuert über `panel_custom`.
- `loader.js?v=<integrationVersion>` lädt `version.json` mit demselben Cache-Key und erzeugt danach
  ein iframe auf `engine/index.html?ver=<engineVersion>`; Chunks, Styles und Fonts tragen Inhalts-Hashes.
- Nach einem Integrationsupdate ist ein HA-Neustart erforderlich, damit Python-Code, statische
  Route und Panel-Registrierungen sicher aus der neuen Version stammen.

## 4. Verzeichnisstruktur & Kernkonzepte

```
src/
├─ main.ts                    # Pinia, Catch-all-Hash-Router (hierarchische View-Pfade), i18n, connect()
├─ App.vue                    # Verbindungsstatus-Overlay + RouterView + DialogHost
├─ theme/default/main.css    # Globale Styles des Default-Themes: Farb-Variablen (dark default, [data-theme='light']), Scrollbars, Form-Basics
├─ i18n/                      # vue-i18n v11 (legacy:false), locales/en.ts + de.ts
├─ core/
│  ├─ ha/                     # connection.ts (WebSocket, Dual-Auth), useEntity, useService
│  ├─ registry/               # Ausschließlich WebSocket-basierter Runtime-Card-Katalog
│  ├─ config/                 # types.ts, dashboardStore.ts, Integration-Persistenz
│  ├─ editor/                 # EditFab, CardPicker, CardConfigDialog, SchemaForm, EntityPicker,
│  │                          # ViewSettingsDialog, DashboardSettingsDialog
│  ├─ ui/                     # DÜNNE WRAPPER: BaseCard/BaseDialog/BaseButton → themed('…'),
│  │                          # MdiIcon, OverflowMarquee, DialogHost.vue + dialogService.ts
│  ├─ composables/            # useClock, useMediaQuery, useTheme
│  ├─ custom-cards/           # Browser-Editor + eingebettete HTML/CSS/JS-Card-Runtime
│  ├─ kiosk/                  # useIdleSeconds, Screensaver.vue
│  └─ dev/DevSidebar.vue      # Dev-only Tools (Sprache, Export/Import, Reset) — nicht i18n'd
├─ shell/                     # AppShell, ShellBarHost (globale Bar-Cards), ViewRenderer;
│                             # Sidebar-Sichtbarkeit folgt ausschließlich den Card-Regeln
├─ layouts/                   # SectionsLayout, FlexLayout, GridLayout, SidebarLayout, PanelLayout
│                             # + useSectionEditing.ts (geteilte Edit-Logik) + LayoutSection.vue
└─ theme/                     # Theme-System (siehe §6)
```

### Datenmodell (`core/config/types.ts`)
`DashboardConfig { format, formatVersion, revision, settings?, bars?, views[] }` → `BarConfig` je Position (`sidebar-left|sidebar-right|header|bottom`) → `BarEntry { id, size, placement?, css?, columns[] }` → `BarColumn { id, sizeMode?, size?, padding?, margin?, align?, crossAlign?, cards[] }`; `ViewConfig { id, title, icon, path?, layout, layoutOptions?, subview?, background?, showSidebarLeft?, showSidebarRight?, showHeader?, showBottom?, padding?, margin?, width?, sections[] }` → `SectionConfig { id, columnSpan?, cardOrientation?, cardsPerRow?, padding?, margin?, cards[] }` (Abschnitte haben **kein** `title`/`icon` — Überschriften sind Cards vom Typ `vue-panel/section-title`) → `CardConfig { id, type, config, css?, size? }`.
Portable Card-Definitionen sind kein Teil des Dashboard-JSON. Eine Instanz referenziert direkt den
unveränderlichen Runtime-Typ `<manufacturer>/<cardName>` und speichert nur Variablenwerte, CSS und
Größe. Das Card-Dokument liegt separat als private HTML-Datei.
`bars` enthält global genau eine `CardConfig` je Position `sidebar|header|bottom`. Breite, Höhe,
Platzierung und Inhalte liegen vollständig im `config`-Objekt der jeweiligen portablen Bar-Card.
Views steuern nur die Sichtbarkeit.
`padding`/`margin` sind `BoxValue { top?, right?, bottom?, left?, unit?, linked? }` aus `core/ui/boxInput.ts` (`boxToCss()` → CSS-Shorthand, `normalizeBox()` verwirft leere Werte).
`DashboardSettings { theme: 'dark'|'light'|'auto', uiTheme: string, screensaverMinutes, autoReturnSeconds }` (0 = aus).

### Persistenz (kein YAML!)
- Dashboards liegen unter `<config>/vue-panel/dashboards/<dashboard-name>.json`; Cards unter
  `<config>/vue-panel/cards/<manufacturer>/<cardName>.html`.
- Laden, Speichern, Import und Export laufen ausschließlich über authentifizierte
  `vue_panel/*`-WebSocket-Befehle. Schreibzugriffe verwenden Revision beziehungsweise Content-Hash,
  atomare Writes und maximal fünf Backups.
- Es gibt weder Dashboard-`localStorage` noch `frontend/*_user_data`, `.storage` oder Legacy-Migrationen.
- **Undo/Redo**: JSON-Snapshot-Stacks im Store (max 50). `save()` = mit History, `persist()` = ohne (für undo/redo/sync). Strg+Z/Y + Toolbar-Buttons im Edit-Modus.

### Auth (core/ha/connection.ts)
- Dev: Long-lived Token aus `.env.local`. Produktion: postMessage vom loader.js (inkl. `language`).
- Auth-Objekt ist ein Cast `as unknown as Auth` mit Gettern; `refreshAccessToken()` wartet auf nächste postMessage.

### i18n
- Priorität: **HA-Sprache (Produktion, gewinnt immer)** > localStorage `vue-panel:locale` (Dev-Wahl) > Browser > 'en'.
- Nur en + de. Card-Manifeste referenzieren i18n-Keys (`'cards.light.name'`), übersetzt beim Rendern.
- Standalone `t()` aus `@/i18n` für Nicht-Component-Code (Store, Composables).

## 5. Cards erstellen (Kern-Feature!)

Alle Cards sind portable Card-Format-v2-HTML-Dateien. Die Integration leitet aus
`manufacturer` und `cardName` den Typ und Pfad ab, validiert die Datei ohne Ausführung und liefert
sie über den Runtime-Katalog aus. Core-Cards liegen schreibgeschützt im Integrationspaket, eigene
Cards privat unter `<config>/vue-panel/cards/<manufacturer>/`.

Das normative Dateiformat und zwei vollständige Vorlagen stehen unter
`docs/architecture/card-format-v2.md` und `examples/cards/vue-panel/`. Variablen unterstützen
`entity`, `icon`, `view`, `select`, `string`, `number` und `boolean`; daraus erzeugt die Engine das
Instanzformular automatisch. Portable Cards importieren nichts aus der Engine, sondern verwenden
ausschließlich die versionierte `vuePanel`-Card-API.
- Mitgelieferte portable Core-Cards: clock, light, sensor, thermostat, cover, weather, media,
  room-tile, menu und section-title. Die Bars sind Engine-Komponenten und keine Cards mehr.
- **Portable Cards und Browser-Editor**: Der Code-Button öffnet `CustomCardDialog.vue`. Das
  Card-Format besitzt `format: 'vue-panel-card'`, `formatVersion: 2`, `apiVersion: 1`, die
  unveränderliche Identität `manufacturer/cardName`, Metadaten, Bereiche, deklarierte
  Capabilities, Standardgröße/-Sichtbarkeit, Variablenschema sowie HTML/CSS/JavaScript. Der Editor
  speichert direkt über `vue_panel/cards/create|update|import|delete`; verwaltete Cards können als
  neue lokale Identität dupliziert werden. Änderungen werden nach einem Katalog-Rescan ohne
  Engine-Neubuild im Picker sichtbar. Maximalgröße: 512 KB pro Datei.
- `CardRuntime.vue` rendert jede portable Card eingebettet im Engine-Dokument: Markup landet in
  einem Scope-Element, das Card-CSS wird per nativem CSS-Nesting darauf begrenzt (das
  Theme-Stylesheet greift dadurch in der Card), und das Card-Skript erhält ein auf die Card
  begrenztes `document` sowie nachverfolgte Timer und Listener. Card API v1 gewährt ausschließlich
  deklarierte Fähigkeiten für Entities, Icons, Services, Navigation, Dashboard-Kontext und
  Shell-Events; Service-, Navigations- und Shell-Aktionen sind in der Vorschau gesperrt.
  Instanzwerte stehen schreibgeschützt in `vuePanel.config`. Eingebettete Cards teilen den
  Engine-Origin — es gibt keine Sicherheitsgrenze mehr, nur vertrauenswürdige Cards installieren.
  Details: `docs/architecture/card-format-v2.md` und `docs/architecture/sandbox-api-v1.md`.
- **Cards in Bars**: `areas` enthält `sidebar`, `header` und/oder `bottom`; beide Seitenleisten
  teilen sich den Bereich `sidebar` (`barCardArea()`). `ShellBarHost.vue` rendert die Spalten, pro
  View schalten `showSidebarLeft/showSidebarRight/showHeader/showBottom` die Bars.
- `fullRow: true` belegt eine ganze Abschnittszeile und ist im Flex-Layout nicht resizebar.
- **Per-Card-CSS**: `cardDefaultCss()` lädt bei portablen Cards das Stylesheet aus dem privaten
  Card-Dokument. Abweichungen liegen als `CardConfig.css` an der Instanz. Responsive-Regeln wirken
  am äußeren Slot; das übrige Override wird über `CardCss` an die Card-Runtime gereicht und ersetzt
  dort das Card-Stylesheet.
- **Responsive Sichtbarkeit jeder Card**: `CardConfigDialog` besitzt immer den Tab „Sichtbarkeit“ → Collapsible „Responsive Design“. Smartphone, Tablet und Desktop lassen sich einzeln aktivieren; `mobileMax` (Default 767px) und `tabletMax` (Default 1023px) sind frei einstellbar. `core/ui/responsiveCss.ts` schreibt die Auswahl unmittelbar als markierten Block `vue-panel:responsive:start/end` mit verschachtelten Media Queries in `CardConfig.css`. Der Block ist im CSS-Tab sichtbar; beim erneuten Öffnen wird die UI aus seinen JSON-Metadaten rekonstruiert. Manifeste können über `defaultResponsive` abweichende Card-Defaults vorgeben; die Sidebar-Bar ist dadurch auf Smartphones standardmäßig aus. Keine separaten Visibility-Felder im Datenmodell anlegen.

## 6. Theme-System (`src/theme/`)

- `src/theme/<themeName>/<Komponente>/` mit `index.vue` + `style.css`. Vorhanden: `default/{AddTile,BoxInput,Button,Card,Checkbox,CodeEditor,Collapsible,Dialog,Input,SelectMenu,Tabs,VariableCard}`. Der CodeEditor unterstützt CSS, HTML, JavaScript und JSON; nur CSS aktiviert den CSS-Linter. Der Theme-Dialog unterstützt zusätzlich `size="full"` für randlose Vollbild-Werkzeuge; Tab-Einträge können mit `align: 'end'` rechts ausgerichtet werden.
- **Collapsible** = aufklappbare Box zum Gruppieren von Einstellungen (`title`, `icon?`, `defaultOpen?` — **Default zu**, Default-Slot); Wrapper `@/core/ui/BaseCollapsible.vue`. Konvention: In jedem „Erweitert"-Tab liegen die Gruppen in Collapsibles, die **erste sichtbare** Box bekommt `default-open`.
- **BoxInput** = wiederverwendbares Vierseiten-Feld (Oben/Rechts/Unten/Links + Einheit + Ketten-Button) für Padding/Margin; Wrapper `@/core/ui/BaseBoxInput.vue`, Wert-Typ + Helfer in `@/core/ui/boxInput.ts`.
- **VariableCard** = wiederverwendbare, aufklappbare Hülle für einen Variablen-Schemaeintrag (`title`, `marker?`, `defaultOpen?`, `removeLabel`, `remove`-Event, Default-Slot); Wrapper `@/core/ui/BaseVariableCard.vue`. Die Löschaktion ist vom Toggle getrennt.
- **Globales CSS pro Theme**: `src/theme/<themeName>/main.css` (Variablen, Scrollbars, Form-Basics). `loadGlobalStyles()` (registry) lädt IMMER zuerst `default/main.css` (Fallback), dann das `main.css` des aktiven Themes obendrauf. Aufruf in `main.ts`: einmal sofort, einmal nach `syncFromRemote()` (wenn `settings.uiTheme` bekannt ist). Es gibt keine `src/style.css` mehr.
- **CSS ist NICHT scoped**, sondern namespaced (`vp-card`, `vp-dialog`, `vp-btn`) — absichtlich, damit CSS-only-Themes überschreiben können. Komponenten importieren ihr CSS NICHT selbst; die Registry lädt es.
- Auflösung (`theme/registry.ts`, `themed('Card')`): Default-CSS immer zuerst → Theme-CSS obendrauf (falls vorhanden) → Theme-`index.vue` ersetzt Default-`index.vue`, sonst Fallback auf default.
- Verbraucher nutzen **immer die Wrapper** `@/core/ui/BaseCard|BaseDialog|BaseButton` (stabile Imports). Neue UI-Basiskomponente = Ordner in `theme/default/` + Wrapper in `core/ui/`. **Ausnahme: Cards** — sie stylen ihre Kachel selbst (siehe §5) und verwenden BaseCard nicht.
- Theme-Wahl: Dashboard-Einstellungen → `settings.uiTheme`; Wechsel macht `location.reload()` (Komponenten-Cache).
- Farbschema (dark/light/auto) ist davon getrennt: `settings.theme` → `useTheme()` setzt `<html data-theme>`.

## 7. Dialog-Service (keine nativen Popups!)

**Niemals `alert()`/`confirm()`/`prompt()` verwenden.** Stattdessen aus `@/core/ui/dialogService`:
```ts
await alertDialog(msg)
if (await confirmDialog(msg)) { … }
const v = await promptDialog(msg, defaultValue)  // null bei Abbruch
```
Gerendert von `DialogHost.vue` (einmal in App.vue) über den Theme-Dialog. Warteschlange für parallele Aufrufe.

## 8. Layouts & Editor

- 5 Layouts (`ViewRenderer.vue`-Map): sections (Default, wie HA "Sections": Abschnitte als Spalten nebeneinander; `layoutOptions.maxColumns` 1–6, `dense` = Masonry via CSS-Multi-Columns, `topMargin` = 80px Platz oben; Einstellungen im ViewSettingsDialog nur bei layout=sections sichtbar), flex (jede Card mit eigener fester Pixelgröße, im Edit-Mode per Resize-Griff an der rechten unteren Ecke; ersetzt das alte `tiles`-Layout — gespeicherte `layout: 'tiles'`-Werte werden als Alias auf FlexLayout gemappt. Der Container ist `flex-wrap: wrap`: Abschnitte ohne `width` füllen per `flex: 1 1 100%` eine eigene Zeile, Abschnitte mit fester `width` stehen per inline `flex: 0 0 auto` nebeneinander), grid (feste Spalten via `layoutOptions.columns`), sidebar (letzter Abschnitt = rechte Spalte), panel (erste Card der ersten Section füllt alles). Card-Größe liegt in `card.size.width/height` (px), gesetzt via `store.updateCardSize()` — entweder per Resize-Griff oder im Card-Dialog über den Tab „Größe" (`CardConfigDialog` mit `sizable`/`initialSize`, gibt die Größe als 3. Argument von `save` zurück; nur FlexLayout setzt das Prop). `CardManifest.defaultSize` kann neben `cols/rows` auch `width/height` als Flex-Fallback angeben; normale Tile-Cards verwenden standardmäßig 140 × 120 px. Manuell gespeicherte Instanzgrößen haben Vorrang.
- Geteilte Edit-Logik in `layouts/useSectionEditing.ts` (Dialoge, Drag&Drop für Cards UND ganze Sections, Section-Ops) + `LayoutSection.vue` (props/emits-basiert, `gridStyle`/`hideHeader`/`columnSpan` für Varianten). Im Edit-Modus wird jede Section eine sichtbare Box (gestrichelter Rahmen) mit schwebender Toolbar oben rechts: ≡ Drag-Handle (Section umsortieren via `store.moveSection`), ✏ Einstellungen, Löschen. **Neue Layouts diese Bausteine wiederverwenden.**
- **Section-Dialog** (`core/editor/SectionSettingsDialog.vue`): Tab „Allgemein" (Ausrichtung der Cards `auto|vertical|horizontal`; im Sections-Layout zusätzlich `cardsPerRow` = Auto oder 1–6, unabhängig von der Ausrichtung; dazu `contentAlign` = `left|center|right` als `justify-content` der Card-Zeile — nur sichtbar bei layout=flex oder horizontaler Ausrichtung, schlägt die View-Ausrichtung) + Tab „Erweitert" mit Collapsibles „Größe" (bei layout=sections: Breite in Spalten; bei layout=flex: Volle Breite (Default) oder eigene Breite in px → `SectionConfig.width`) und „Abstände" (Margin/Padding via `BaseBoxInput`). Wird von allen 4 Section-Layouts gerendert; `addSection` legt den Abschnitt sofort an und öffnet den Dialog. Ausrichtung/Spacing wertet `LayoutSection.vue` aus, `columnSpan` setzt `grid-column: span N` (in `dense`-Modus ignoriert). Eine feste `cardsPerRow`-Zahl erzeugt ein exaktes Abschnittsraster und ignoriert normale Card-Spans; `fullRow` bleibt davon unberührt.
- **View-Tab „Erweitert"** (`ViewSettingsDialog`): zwei `BaseCollapsible`-Boxen — „Spezifische Einstellungen für die Abschnittsansicht" (nur bei layout=sections: maxColumns, dense, topMargin) und „Abstände & Ausrichtung" mit Margin, Padding, Breite (`default|full`), Ausrichtung (`left|center|right`). `ViewRenderer.vue` legt einen `.view-box`-Wrapper darum, setzt Padding/Margin inline, bei `full` die Variable `--view-max-width: none` und für die Ausrichtung `--view-align` (die Auto-Margins). Alle Layouts nutzen `max-width: var(--view-max-width, …)` und `margin: var(--view-align, 0 auto)` statt fester Werte. Damit die Ausrichtung überhaupt sichtbar wird, rechnet `SectionsLayout` seine `max-width` aus den **tatsächlich belegten** Spalten (`usedColumns`, inkl. Add-Tile im Edit-Modus), nicht aus `maxColumns`. Im Flex-Layout wirkt die Ausrichtung als `justify-content` auf die **Abschnitts-Reihe** (Default links); wie die Cards innerhalb eines Abschnitts stehen, regelt dessen eigenes `contentAlign`.
- Edit-Modus: `store.editMode` (EditFab absolut im `.view-area`, rechts/unten je 24px; der Inhalt scrollt separat in `.view-scroll`). Toolbar: Undo/Redo, View-Einstellungen, Dashboard-Einstellungen. Im Edit-Modus erscheinen Subviews in der Nav.
- **Globale Bars**: vier Engine-Container — `sidebar-left`, `sidebar-right`, `header`, `bottom`.
  Dashboard-Einstellungen → Tab „Bars“ setzt Größe und (bei Header/Bottom) die Platzierung
  `view|full`. Jede Bar besteht aus beliebig vielen Spalten; im Bearbeitungsmodus legt „+ Spalte“
  neue an, die Spalten-Toolbar verschiebt, konfiguriert und löscht sie, und jede Spalte nimmt
  eigene Cards auf. Pro Spalte einstellbar: Größe (`fit` = an Inhalt anpassen als Default, `full`,
  `fixed`), Abstände und die Ausrichtung entlang sowie quer zur Leiste. Die Navigation liefert die
  Card `vue-panel/menu` über die reaktive Navigations-API. Alle Bars lassen sich pro View
  schalten; nur die rechte Seitenleiste ist bei neuen Views aus.
- **View-URLs**: Intern referenzieren Menü, room-tile & Co. immer die **View-`id`**; die URL nutzt `view.path` (Fallback: `id`) und darf hierarchisch sein, z. B. `uebersicht/wohnzimmer`. Helfer in `dashboardStore.ts`: `viewPath(view)`, `normalizeRoutePath(path)`, `slugify(title)`, `slugifyPath(path)`, Getter `viewByRoute(path)`. Der Catch-all-Hash-Router akzeptiert beliebig viele Segmente. Der View-Dialog slugifiziert jedes Segment einzeln, erhält `/` und macht den vollständigen Pfad beim Speichern eindeutig; danach emittiert er `navigate`, damit die Route dem neuen Pfad folgt. Die Menu-Card markiert neben dem exakten Ziel auch Pfad-Eltern aktiv (`uebersicht` bei `uebersicht/wohnzimmer`).
- Subviews: `view.subview = true` → kein Nav-Eintrag, Header mit Zurück-Button in AppShell; room-tile-Card navigiert dorthin.
- Kiosk: `useIdleSeconds` → Screensaver (Vollbild-Uhr) und Auto-Return zur ersten View; beides im Edit-Modus pausiert.

## 9. Bekannte Fallstricke (TS/Build)

- tsconfig hat `erasableSyntaxOnly`, `noUnusedLocals/Parameters`; **kein `baseUrl`** (deprecated, TS5101) — Alias nur über relative `paths: {"@/*": ["./src/*"]}`.
- Eine Funktion namens `withDefaults` kollidiert mit dem Vue-Compiler-Macro → deshalb `applyDefaults` in CardConfigDialog.
- Node 22: EBADENGINE-Warnungen von @babel-Paketen sind harmlos.
- @mdi/font macht den Build ~400KB (woff2) schwerer — bewusst akzeptiert. `MdiIcon` wandelt `mdi:name` → `mdi mdi-name`.
- Vor jedem Abschluss: `npm.cmd run build` muss grün sein (vue-tsc + vite).

## 10. Offene / mögliche nächste Schritte

- [x] Phase 3: privaten Card-Katalog, Card-Datei-CRUD, Runtime-Registry und Sandbox API v1 implementieren.
- [x] Phase 4: alle Core-Cards in portable HTML-Dateien portieren und den SFC-Fallback entfernen.
- [ ] Git-Repo für vue-panel initialisieren (bisher keins!).
- [ ] Weitere Cards (z.B. Kamera, Verlaufs-Graph, Szenen/Buttons, Alarm).
- [ ] Beispiel-Custom-Theme als Vorlage.
- [ ] `size.rows` wird noch nicht ausgewertet (nur `cols` als grid-column span).
- [ ] Wetter-Forecast (benötigt `weather/subscribe_forecast` Subscription).
