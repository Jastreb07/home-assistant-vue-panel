# vue-panel — bisheriger Frontend-Stand

> **Umbau aktiv:** Die verbindliche Greenfield-Zielarchitektur und der aktuelle Umsetzungsplan
> stehen in [`INTEGRATION_RESTRUCTURE_PLAN.md`](INTEGRATION_RESTRUCTURE_PLAN.md). Dieses Dokument
> beschreibt ausschließlich den bisherigen Frontend-Stand und dient während der Portierung als
> fachliche Referenz. Neue Architekturentscheidungen werden nicht mehr hier ergänzt. Nach dem
> Cutover wird dieser Altplan entfernt.

Stand des Umbaus: Die Phasen 0 bis 4 sind abgeschlossen. Phase 1 brachte das HA-Integrations-Skelett,
Config-/Subentry-Flow, loader-erzeugtem Engine-iframe, Engine-Build mit Query-Versionierung und
direkter statischer Auslieferung aus dem Integrationspaket weit fortgeschritten. Phase 2 ist lokal implementiert:
mehrere Panel-Subentries, private Dashboard-Dateien, Revisionskonflikte, Backups,
Export/Import und getrennte Speicherwarteschlangen pro Panel. Der echte HA-Laufzeittest steht
noch aus; ein beim ersten Test erkannter gecachter 1.x-Loader wird ab Integration
`2.0.0-alpha.2` durch eine versionierte `module_url` sicher umgangen. Ab `2.0.0-alpha.3` werden
außerdem vor dem Web-Component-Upgrade gesetzte HA-Properties korrekt übernommen. Ab
`2.0.0-alpha.4` bleiben Preload- und Chunk-URLs trotz automatischer Bereinigung des Engine-Ordners
korrekt relativ. Ab `2.0.0-alpha.5` liegt die Engine unter einem festen `engine/`-Pfad; ihr
Cache-Key ist `panel.js?ver=<engineVersion>`, und die Integration ersetzt den Engine-Ordner bei
einer Versionsänderung vollständig. Ab `2.0.0-alpha.6` verwendet die Menu-Card die abgesicherte
reaktive Router-Route, sodass sie auch während des ersten Dashboard-Ladens rendern kann. Ab
`2.0.0-alpha.7` wird zusätzlich das Versionsmanifest über den Loader-Cache-Key geladen und die
tatsächlich importierte Engine-Version in der Browser-Konsole protokolliert. Ab
`2.0.0-alpha.8` werden die Frontend-Dateien direkt aus `custom_components/vue_panel/frontend`
unter `/vue-panel-static/` ausgeliefert; eine Kopie nach `www` entfällt. Der alte Frontend-Stand
unterhalb dieses Hinweises bleibt nur Portierungsreferenz. Ab `2.0.0-alpha.9` nutzt die Engine
eine eigene reaktive Hash-Navigation, sodass lazy geladene Cards keinen injizierten Vue Router
mehr benötigen. Ab
`2.0.0-alpha.14` verwendet die Sandbox einen auch über unverschlüsseltes lokales HTTP verfügbaren
Runtime-ID-Generator, damit Card- und Dashboard-Dialoge nicht an `crypto.randomUUID()` scheitern.
Ab `2.0.0-alpha.16` lädt das HA-Custom-Element die Engine wieder als eigenständige SPA in einem
eigenen iframe. Authentifizierung, Sprache und Dashboard-Name werden wie im bewährten Master-Loader
per `vue-panel:auth` übertragen; das Shadow-Root-Mount und dessen Portal entfallen wieder.
Ab `2.0.0-alpha.17` sind die dafür nicht mehr benötigten Dialog- und Bar-Workarounds entfernt;
Dialoge, Card-Menüs und lazy Bar-Komponenten verwenden wieder ihre ursprüngliche iframe-Logik.

Ab `2.2.9`/Engine `2.2.30` kann eine Card-Tipp-Aktion neben der Vue-Panel-Detailansicht auch
Home Assistants nativen Mehr-Info-Dialog öffnen. Die Engine sendet dafür ausschließlich die
validierte Entity-ID an den Loader; erst das HA-seitige Custom Element löst `hass-more-info` aus.

Ab `2.0.0-alpha.18` reicht der Loader den Administratorstatus des angemeldeten HA-Benutzers an
die Engine weiter. Dadurch steht die Dev-Sidebar im Entwicklungsserver immer und im produktiven
HA-Panel nur Administratoren zur Verfügung.

Ab `2.0.0-alpha.19`/Engine `2.0.16` ist Phase 3 des Greenfield-Plans umgesetzt. Portable
Card-Format-v2-Dateien liegen privat unter
`<config>/vue-panel/cards/<manufacturer>/<cardName>.html`, werden serverseitig validiert und über
authentifizierte WebSocket-Befehle verwaltet. Der Runtime-Katalog speist Picker, Instanzdialog und
Card-Runtime ohne Engine-Neubuild. Der Browser-Editor arbeitet direkt mit diesen Dateien;
Content-Hashes, atomare Writes, fünf Backups und Admin-Rechte schützen Änderungen. Card API v1
erzwingt die pro Card deklarierten Capabilities. Der frühere Dashboard-`customCards`-/`custom-html`-Pfad ist entfernt.
Seit `2.0.0-alpha.20`/Engine `2.0.17` werden alle mitgelieferten Core- und Bar-Cards
ausschließlich als portable, schreibgeschützte HTML-Dateien aus dem Integrationspaket geladen.
`src/cards/core-cards`, die SFC-Fallback-Registry und die verschachtelten Legacy-Bar-Slots sind
entfernt. Ab Engine `2.1.0` sind die vier Bars (`sidebar-left`, `sidebar-right`, `header`,
`bottom`) feste Engine-Komponenten mit frei konfigurierbaren Spalten; die drei früheren Bar-Cards
sind entfallen, die Navigation liefert die Katalog-Card `vue-panel/menu`. Ab Engine `2.1.15`
laufen portable Cards eingebettet im Engine-Dokument statt in einem Sandbox-iframe: das Card-CSS
wird per nativem CSS-Nesting auf die Card begrenzt, wodurch das Theme-Stylesheet auch in der Card
gilt. Damit ist die Card-Grenze eine Style- und DOM-Grenze und keine Sicherheitsgrenze mehr.
Als Nächstes folgt Phase 5 mit Release-, Installations- und Recovery-Dokumentation.

Ein vollständiger Lovelace-Ersatz als Vue 3 (Composition API + TypeScript) SPA.
Kein YAML, alles visuell im Browser editierbar, Cards als einfache Vue-Komponenten.

---

## 1. Ziele

- **Lovelace-Ersatz**: Views/Unterseiten, Cards, Layouts, visueller Edit-Modus — alles ohne YAML.
- **Responsive**: Ein Design für Wand-Tablets (Landscape, mit Sidebar) und Smartphones (Sidebar ausgeblendet, Inhalte gestapelt).
- **Cards extrem einfach erstellbar**: Ein eigener Anbieterordner unter `src/cards/`, darin ein Card-Ordner mit `.vue`-Datei + Manifest — fertig. Keine Registrierung an zentraler Stelle nötig (rekursive Auto-Discovery). Eingebaute Cards liegen getrennt unter `src/cards/core-cards/`.
- **Deployment**: `npm run build` → Inhalt von `dist/` nach `config/www/vue-panel/` hochladen → als `panel_custom` in HA einbinden.

## 2. Tech-Stack

| Bereich | Wahl |
|---|---|
| Framework | Vue 3.5+ (Composition API, `<script setup>`) |
| Sprache | TypeScript |
| Build | Vite |
| State | Pinia |
| Routing | vue-router (Hash-Mode → kein Server-Rewrite in HA nötig) |
| i18n | vue-i18n v11 (Composition API), Sprachen: en, de |
| HA-Anbindung | `home-assistant-js-websocket` (offizielle Lib) |
| Styling | CSS Custom Properties (Theme-Variablen) + Scoped CSS |

## 3. Verzeichnisstruktur

```
vue-panel/
├── PLAN.md
├── vite.config.ts          # base: /local/vue-panel/
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── core/               # Die "Engine" — Cards fassen das nie an
│   │   ├── ha/             # HA-Verbindung
│   │   │   ├── connection.ts    # WebSocket-Auth & Verbindung
│   │   │   ├── useEntity.ts     # composable: reaktiver Entity-State
│   │   │   ├── useService.ts    # composable: Services aufrufen
│   │   │   └── useHistory.ts    # composable: Verlaufsdaten
│   │   ├── registry/
│   │   │   └── cardRegistry.ts  # Auto-Discovery via import.meta.glob
│   │   ├── config/
│   │   │   ├── dashboardStore.ts   # Pinia: Dashboard-Konfiguration
│   │   │   └── persistence.ts      # Speichern/Laden der Config
│   │   └── editor/
│   │       ├── EditorOverlay.vue   # Edit-Modus (Cards verschieben, +, ⚙, 🗑)
│   │       ├── CardPicker.vue      # Dialog: neue Card auswählen
│   │       └── CardConfigDialog.vue # Auto-generiertes Formular aus Manifest
│   ├── layouts/            # View-Layouts (analog Lovelace)
│   │   ├── SectionsLayout.vue   # Abschnitte (Standard)
│   │   ├── FlexLayout.vue       # Feste Card-Größen (resizable)
│   │   ├── PanelLayout.vue      # Eine Card fullscreen
│   │   ├── SidebarLayout.vue    # Hauptbereich + rechte Spalte
│   │   └── GridLayout.vue       # Freies Grid (Spalten/Zeilen definierbar)
│   ├── shell/              # App-Rahmen
│   │   ├── AppShell.vue         # Responsive Wrapper
│   │   ├── ShellBarHost.vue     # Rendert globale Sidebar-/Header-/Bottom-Bar-Card
│   │   └── ViewRenderer.vue     # Rendert aktive View mit gewähltem Layout
│   └── cards/              # ⭐ Anbieterordner, rekursiv entdeckt
│       ├── core-cards/          # Mitgelieferte Cards
│       │   ├── clock/
│       │   │   ├── manifest.ts
│       │   │   └── ClockCard.vue
│       │   ├── weather/
│       │   ├── light/
│       │   └── ...
│       └── my-cards/            # Eigene/externe Cards
│           └── example/
└── dist/                   # Build → nach config/www/vue-panel/ hochladen
```

## 4. Card-System (Kernstück)

### Regeln
1. Jede Card lebt in **einem eigenen Ordner** unter `src/cards/<provider>/<name>/`. Core-Cards verwenden den Anbieterordner `core-cards`; weitere Entwickler legen eigene Ordner daneben an.
2. Eine Card importiert **nur aus dem eigenen Ordner** und aus `@/core/ha/*` (Composables). Keine Abhängigkeiten zwischen Cards.
3. Auto-Discovery: `cardRegistry.ts` lädt alle Cards rekursiv per `import.meta.glob('../../cards/**/manifest.ts')`. **Keine zentrale Registrierungsdatei anfassen.** Der Manifest-`type` muss über alle Anbieter hinweg eindeutig sein.

### Manifest-Beispiel (`src/cards/core-cards/light/manifest.ts`)
```ts
import { defineCard } from '@/core/registry/cardRegistry'

export default defineCard({
  type: 'light',
  name: 'Licht',
  icon: 'mdi:lightbulb',
  component: () => import('./LightCard.vue'),
  // Aus diesem Schema generiert der Editor automatisch das Config-Formular:
  schema: {
    entity: { type: 'entity', domain: 'light', label: 'Licht-Entity' },
    name:   { type: 'string', label: 'Anzeigename', optional: true },
    showBrightness: { type: 'boolean', label: 'Helligkeit anzeigen', default: true },
  },
  defaultSize: { cols: 1, rows: 1, width: 140, height: 120 },
})
```

### Card-Komponente (`LightCard.vue`)
```vue
<script setup lang="ts">
import { useEntity, useService } from '@/core/ha'
const props = defineProps<{ config: { entity: string; name?: string } }>()
const light = useEntity(() => props.config.entity)   // reaktiv, live via WebSocket
const { toggle } = useService('light')
</script>

<template>
  <BaseCard @click="toggle(config.entity)">
    {{ config.name ?? light.attributes.friendly_name }} — {{ light.state }}
  </BaseCard>
</template>
```
→ **Eine neue Card = 2 Dateien kopieren und anpassen. Mehr nicht.**

## 5. Dashboard-Konfiguration & Persistenz (kein YAML)

Die gesamte Dashboard-Definition ist **ein JSON-Objekt**:

```ts
interface DashboardConfig {
  views: ViewConfig[]
  customCards?: CustomCardDefinition[]              // reusable HTML/CSS/JS definitions
  bars?: Record<'sidebar' | 'header' | 'bottom', CardConfig> // globale Shell-Cards
  theme?: ThemeConfig
}
interface ViewConfig {
  id: string; title: string; icon: string
  path?: string                              // hierarchischer URL-Pfad, z. B. uebersicht/wohnzimmer; Fallback = id
  layout: 'sections' | 'flex' | 'panel' | 'sidebar' | 'grid'  // 'tiles' = Legacy-Alias für flex
  layoutOptions?: Record<string, unknown>   // z.B. maxColumns
  subview?: boolean                          // kein Nav-Eintrag, mit Zurück-Button
  showSidebar?: boolean; showHeader?: boolean; showBottom?: boolean // nur Sichtbarkeit
  padding?: BoxValue; margin?: BoxValue      // Tab "Erweitert"
  width?: 'default' | 'full'                 // 'full' hebt die max-width des Layouts auf
  align?: 'left' | 'center' | 'right'        // waagerechte Position im View-Bereich
  sections: {                                // Überschrift = Card 'section-title'
    columnSpan?: number                      // Breite in Spalten (sections-Layout)
    cardOrientation?: 'auto' | 'vertical' | 'horizontal'
    contentAlign?: 'left' | 'center' | 'right'   // justify-content der Card-Zeile
    width?: number                               // feste Breite in px (flex), sonst 100%
    padding?: BoxValue; margin?: BoxValue
    cards: CardConfig[]
  }[]
}
interface CardConfig {
  id: string; type: string                   // = manifest.type
  config: Record<string, unknown>            // card-spezifisch (Schema)
  size?: { cols: number; rows: number }
}
```

**Speicherung** (mehrstufig, ohne YAML):
1. **Primär**: HA WebSocket `frontend/set_user_data` / `get_user_data` — persistiert JSON serverseitig in `.storage`, auf allen Geräten desselben Users verfügbar. Keine Custom-Integration nötig.
2. **Cache/Fallback**: `localStorage` (offline-fähig, sofortiges Laden).
3. **Export/Import**: JSON-Download/-Upload im Editor (Backup, Geräte-Transfer).

Browser-erstellte Custom Cards liegen ohne zusätzliche HA-Integration ebenfalls im Dashboard-JSON. Eine Definition enthält Name, Beschreibung, Icon, Standardgröße, ein Variablen-Schema sowie HTML/CSS/JavaScript; platzierte Cards speichern `type: 'custom-html'`, `config.definitionId` und ihre eigenen Variablenwerte. Variablen unterstützen Entity, Text, Zahl, Boolean und Icon; der normale Card-Dialog wird beim Einfügen dynamisch aus diesem Schema erzeugt. Im JavaScript sind die Werte über `vuePanel.config.<key>` verfügbar. Der Editor begrenzt eine Definition auf 256 KB und die Sammlung auf 4 MB, damit der lokale Browser-Cache praktikabel bleibt. Der iframe-Sandbox-Renderer besitzt kein Same-Origin-Recht, verwendet eine restriktive CSP und stellt nur `vuePanel.getEntity`, `getIcon`, `subscribeEntity`, `callService` und `config` bereit. Host-Nachrichten werden vor `postMessage` als reine Daten-Snapshots serialisiert, damit reaktive HA-Entity-Proxies die Sandbox-Grenze sicher passieren. `getIcon` rendert frei gewählte `mdi:`-Variablen außerhalb der Sandbox als sichere PNG-Data-URL. In der Live-Vorschau sind Service-Aufrufe deaktiviert.

## 6. Visueller Editor

- Ein Code-Button in der Edit-Leiste öffnet den Custom-Card-Editor mit Einstellungen-, Variablen-, HTML-, CSS-, JS- und einem rechts ausgerichteten „Full Code“-Tab (CodeMirror) sowie permanenter Sandbox-Vorschau. Ein vertikaler, per Pointer/Touch/Tastatur bedienbarer Splitter passt die Breite von Editor und Vorschau an; auf Smartphones bleibt die gestapelte Ansicht. Das Variablen-Schema lässt sich synchron visuell oder direkt als validiertes JSON-Array bearbeiten. „Full Code“ fasst die portable Gesamtdefinition als HTML-Dokument zusammen: Konfiguration und Variablen stehen im JavaScript-Objekt `vuePanelCard` eines ersten `script`-Tags, das Markup in `template`, die Styles in `style` und die Laufzeitlogik in einem zweiten `script`. Die `.vue-panel-card.html`-Datei kann importiert/exportiert werden; ältere JSON-Formate bleiben importierbar. Der Vollbildschalter vergrößert denselben Custom-Card-Dialog randlos auf die gesamte Viewport-Größe, ohne einen zweiten Dialog zu öffnen. Gespeicherte Definitionen erscheinen als eigene Gruppe im normalen CardPicker und lassen sich dort über einen Stift global bearbeiten.

- Der ✏️-FAB im View-Bereich aktiviert den Edit-Modus (wie Lovelace); er bleibt mit je 24px Abstand rechts unten im `.view-area`, während `.view-scroll` den Inhalt scrollt.
- Im Edit-Modus: Cards per Drag & Drop verschieben, ＋ Card hinzufügen (CardPicker mit Vorschau), ⚙ Card konfigurieren (Formular auto-generiert aus Manifest-Schema mit Live-Preview), 🗑 löschen.
- Jeder Card-Dialog enthält den Tab „Sichtbarkeit“ mit einem aufklappbaren Bereich „Responsive Design“. Die Anzeige auf Smartphone, Tablet und Desktop sowie die beiden Breakpoints sind pro Card einstellbar. Die Engine schreibt daraus direkt einen markierten Media-Query-Block in das instanzbezogene Card-CSS; der CSS-Tab zeigt denselben Block und bleibt damit die maßgebliche Laufzeitquelle.
- Views verwalten: hinzufügen/umbenennen/sortieren, Layout pro View umschaltbar (Abschnitte / Kacheln / Panel / Seitenleiste / Grid — vgl. Lovelace "Ansicht anpassen").
- Undo/Redo über Snapshot-Stack im Pinia-Store; Speichern schreibt die Config via WebSocket.

## 6b. Theme-System (UI-Komponenten)

- Alle Basis-UI-Komponenten (Card, Dialog, Button, …) liegen unter `src/theme/<themeName>/<Komponente>/` mit je **`index.vue`** und **`style.css`** — kein globales Button/Card-CSS.
- Jedes Theme kann zusätzlich eine **globale `main.css`** haben (`src/theme/<themeName>/main.css`: Variablen, Scrollbars, Form-Basics); `default/main.css` wird immer zuerst als Rückfall geladen, das `main.css` des aktiven Themes obendrauf.
- Styles nutzen namespaced Klassen (`vp-card`, `vp-dialog`, `vp-btn`) statt Vue scoped CSS, damit CSS-only-Themes sie überschreiben können.
- **Auflösung** (`src/theme/registry.ts`, Auto-Discovery via `import.meta.glob`):
  1. `style.css` des Default-Themes wird immer zuerst geladen.
  2. Hat das aktive Theme eine `style.css` für die Komponente, wird sie zusätzlich geladen (überschreibt) — Themes ohne `.vue`-Dateien restylen so nur das Default-Markup.
  3. Hat das aktive Theme eine `index.vue`, ersetzt sie die Default-Komponente — sonst Fallback auf `default/`.
- Aufrufer nutzen die Wrapper in `src/core/ui/` (`BaseCard`, `BaseDialog`, `BaseButton`, `BaseBoxInput`, …) — Import-Pfade bleiben stabil, der Wrapper rendert die Komponente des aktiven Themes.
- `BoxInput` ist das wiederverwendbare Padding-/Margin-Feld (vier Seiten + Einheit + Ketten-Button), genutzt vom View- und vom Abschnitts-Dialog.
- `VariableCard` ist die wiederverwendbare Theme-Hülle für Variablen-Schemaeinträge. Sie kann unabhängig ein- und ausgeklappt werden und trennt die Löschaktion vom Toggle; Verbraucher nutzen `BaseVariableCard`.
- Theme-Auswahl: Dashboard-Einstellungen → „Komponenten-Theme" (`settings.uiTheme`, synced via HA `.storage`). Neues Theme = neuen Ordner `src/theme/mein-theme/` anlegen, nur die Komponenten/CSS ablegen, die abweichen sollen.

## 7. Responsive Verhalten

| Breakpoint | Shell | Verhalten |
|---|---|---|
| Tablet/Desktop | Globale Sidebar-Bar links; Header-/Bottom-Bar gemäß View-Einstellung | Grid mit `layoutOptions.maxColumns` |
| Smartphone (standardmäßig bis 767 px) | Globale Sidebar-Bar über ihre Card-Sichtbarkeit ausgeblendet; Header-/Bottom-Bar bleiben gemäß View-Einstellung | Cards einspaltig gestapelt, Sections untereinander |

Umsetzung: CSS Grid + Container Queries; Cards deklarieren ihre Grid-Spans sowie optionale Flex-Fallbacks in `defaultSize`, die Layouts kümmern sich um den Rest. Normale Tile-Cards starten im Flex-Layout mit 140 × 120 px; gespeicherte Instanzgrößen überschreiben diesen Manifest-Standard.

Abschnitte im Sections-Layout können über `SectionConfig.cardsPerRow` Auto oder exakt 1–6 Cards pro Reihe festlegen. Die feste Zahl gilt bei automatischer, vertikaler und horizontaler Card-Ausrichtung; normale Card-Spans werden dann ignoriert, Full-Row-Cards bleiben volle Zeilen.

Thermostat- und Wetter-Cards verwenden wie Light-Cards einen Grid-Span von einer Spalte. Beim Laden migriert der Store ihren früher gespeicherten Standard `size.cols: 2` einmalig auf `1`; Flex-Pixelgrößen bleiben erhalten.

Namen normaler Tile-Cards bleiben über die gemeinsame `OverflowMarquee`-Komponente einzeilig. Nur tatsächlich überlaufender Text wird als kontinuierlicher Lauftext animiert; bei reduzierter Bewegung erscheint stattdessen eine Ellipsis.

Sidebar, Header und Bottom sind keine statischen Shell-Komponenten, sondern global ausgewählte, automatisch entdeckte Cards. Ein Manifest kennzeichnet unterstützte Positionen über `barPositions`; dadurch lassen sich eigene Bar-Typen ohne zentrale Registrierung ergänzen. Im Edit-Modus öffnet jede Bar über ihren Stift denselben CardConfigDialog wie normale Cards. Breite/Höhe und Slot-Ausrichtung werden aus dem Schema des jeweiligen Bar-Manifests erzeugt; der CSS-Tab bleibt daneben verfügbar. Header und Bottom bieten außerdem `placement: full|view` (Standard: `view`): über die gesamte App-Breite außerhalb der Shell-Zeile oder nur innerhalb der View-Spalte neben der Sidebar. Separate Navigation-/Header-/Bottom-Einstellungsdialoge gibt es nicht. Die Default-Bar-Cards stellen editierbare Slots bereit; die Sidebar hat rechts eine Trennlinie. Es gibt keinen festen Shell-Breakpoint für die Sidebar: Ihre responsive Darstellung folgt ausschließlich dem CSS-basierten Sichtbarkeitsblock der Card. Das Default-Manifest blendet sie auf Smartphones aus und lässt sie auf Tablets sowie Desktops sichtbar. Pro View wird nur die Sichtbarkeit über `showSidebar`, `showHeader` und `showBottom` gesteuert, wobei die Bottom-Bar standardmäßig sichtbar ist.

## 8. HA-Integration & Auth

- **Variante A (empfohlen)** — `panel_custom` in `configuration.yaml` (einmalig):
  ```yaml
  panel_custom:
    - name: vue-panel
      sidebar_title: Vue Panel
      sidebar_icon: mdi:view-dashboard
      url_path: vue-panel        # nicht "home" o.ä. reservierte Pfade!
      module_url: /local/vue-panel/loader.js   # stabiler Einstieg, Cache-Busting via version.txt
      embed_iframe: false        # loader.js erstellt selbst ein iframe und reicht das Auth-Token per postMessage durch
  ```
  Wichtig: `module_url` muss ein **JS-Modul** sein (HA lädt es per `import()`) — `index.html` funktioniert hier nicht.
  Deshalb `loader.js` (in `public/`, landet unverändert im Build): registriert das Custom Element `<vue-panel>`,
  liest `version.txt` ungecacht (→ Updates ohne YAML-Änderung/HA-Neustart, nur version.txt hochzählen),
  lädt `index.html?ver=…` im iframe und reicht das HA-Auth-Token per `postMessage` an die App durch —
  kein eigener Login-Flow nötig.
- **Variante B (ohne YAML)** — "Webseite"-Dashboard über die UI: Einstellungen → Dashboards →
  Hinzufügen → Webseite → URL `/local/vue-panel/index.html?ver=1.0.0`. Kein loader.js und kein
  configuration.yaml-Eintrag nötig. Nachteil: App muss sich selbst per OAuth-Flow authentifizieren
  (`getAuth()` mit Redirect + Token in localStorage).
- Auth: im iframe-/Panel-Kontext liefert HA das Auth-Token über die Parent-Verbindung; Fallback: `getAuth()` mit `hassUrl` (Long-lived Token nur für lokale Dev-Umgebung via `.env.local`).
- **Dev-Modus**: `npm run dev` läuft lokal gegen HA (CORS/Token via `.env.local`) → Hot-Reload beim Card-Entwickeln, ohne Upload.

## 9. Umsetzungs-Phasen

- **Phase 1 — Fundament** ✅: HA-Verbindung (`connection.ts`, `useEntity`, `useService`), AppShell mit responsiver SideNav (auf Smartphones ausgeblendet), ViewRenderer, `SectionsLayout`, Config-Store + localStorage-Persistenz, 2 Basis-Cards (clock, light). *→ Erstes lauffähiges Dashboard.*
- **Phase 2 — Editor** ✅: Edit-Modus, CardPicker, Schema-Formulare, Drag & Drop, View-Verwaltung, Persistenz via `frontend/set_user_data`.
- **Phase 3 — Layouts & Cards** ✅: Flex- (ex Tiles), Panel-, Sidebar-, Grid-Layout (gemeinsame Basis: `useSectionEditing` + `LayoutSection`); Cards: weather, thermostat, room-tile, sensor, cover, media; Subviews mit Zurück-Button (room-tile navigiert per `targetView`).
- **Phase 4 — Polish** ✅: Themes (dunkel/hell/auto, umschaltbar in den Dashboard-Einstellungen; Hintergrund pro View als CSS), Undo/Redo (50 Schritte, Strg+Z/Strg+Y + Toolbar-Buttons), Kiosk-Optionen (Bildschirmschoner mit Uhr nach N Minuten, Auto-Return zur Start-View nach N Sekunden). Export/Import über die Dev-Sidebar.

## 10. Deployment-Workflow

```
npm run build          # erzeugt dist/
# dist/-Inhalt nach <ha-config>/www/vue-panel/ hochladen (SSH/Samba)
# → http://home.local/local/vue-panel/ bzw. Sidebar-Eintrag "Vue Panel"
```
Optional später: `npm run deploy`-Script, das per scp/smb direkt hochlädt.
