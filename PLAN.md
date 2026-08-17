# vue-panel — Dashboard-Engine für Home Assistant

Ein vollständiger Lovelace-Ersatz als Vue 3 (Composition API + TypeScript) SPA.
Kein YAML, alles visuell im Browser editierbar, Cards als einfache Vue-Komponenten.

---

## 1. Ziele

- **Lovelace-Ersatz**: Views/Unterseiten, Cards, Layouts, visueller Edit-Modus — alles ohne YAML.
- **Responsive**: Ein Design für Wand-Tablets (Landscape, mit Sidebar) und Smartphones (Bottom-Nav, gestapelt).
- **Cards extrem einfach erstellbar**: Ein neuer Ordner unter `src/cards/`, eine `.vue`-Datei + Manifest — fertig. Keine Registrierung an zentraler Stelle nötig (Auto-Discovery).
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
│   │   ├── SideNav.vue          # Sidebar (Tablet landscape) — wie Screenshot
│   │   ├── BottomNav.vue        # Bottom-Tabs (Smartphone)
│   │   └── ViewRenderer.vue     # Rendert aktive View mit gewähltem Layout
│   └── cards/              # ⭐ Hier entstehen Cards — 1 Ordner = 1 Card
│       ├── clock/
│       │   ├── manifest.ts      # Name, Icon, Config-Schema, Defaults
│       │   └── ClockCard.vue
│       ├── weather/
│       ├── light/
│       ├── thermostat/
│       ├── room-tile/           # Raum-Kachel wie im Screenshot
│       ├── sensor/
│       └── ...
└── dist/                   # Build → nach config/www/vue-panel/ hochladen
```

## 4. Card-System (Kernstück)

### Regeln
1. Jede Card lebt in **einem eigenen Ordner** unter `src/cards/<name>/`.
2. Eine Card importiert **nur aus dem eigenen Ordner** und aus `@/core/ha/*` (Composables). Keine Abhängigkeiten zwischen Cards.
3. Auto-Discovery: `cardRegistry.ts` lädt alle Cards per `import.meta.glob('../cards/*/manifest.ts')`. **Keine zentrale Registrierungsdatei anfassen.**

### Manifest-Beispiel (`src/cards/light/manifest.ts`)
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
  defaultSize: { cols: 1, rows: 1 },
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
  theme?: ThemeConfig
}
interface ViewConfig {
  id: string; title: string; icon: string
  path?: string                              // URL-Segment, Fallback = id
  layout: 'sections' | 'flex' | 'panel' | 'sidebar' | 'grid'  // 'tiles' = Legacy-Alias für flex
  layoutOptions?: Record<string, unknown>   // z.B. maxColumns
  subview?: boolean                          // kein Nav-Eintrag, mit Zurück-Button
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

## 6. Visueller Editor

- ✏️-Button in der Titelleiste aktiviert den Edit-Modus (wie Lovelace).
- Im Edit-Modus: Cards per Drag & Drop verschieben, ＋ Card hinzufügen (CardPicker mit Vorschau), ⚙ Card konfigurieren (Formular auto-generiert aus Manifest-Schema mit Live-Preview), 🗑 löschen.
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
- Theme-Auswahl: Dashboard-Einstellungen → „Komponenten-Theme" (`settings.uiTheme`, synced via HA `.storage`). Neues Theme = neuen Ordner `src/theme/mein-theme/` anlegen, nur die Komponenten/CSS ablegen, die abweichen sollen.

## 7. Responsive Verhalten

| Breakpoint | Shell | Verhalten |
|---|---|---|
| ≥ 1024 px landscape (Wand-Tablet) | `SideNav` links (Uhr, Datum, Wetter, View-Liste — wie Screenshot) | Grid mit `layoutOptions.maxColumns` |
| < 1024 px (Smartphone) | `BottomNav` mit View-Icons | Cards einspaltig gestapelt, Sections untereinander |

Umsetzung: CSS Grid + Container Queries; Cards deklarieren nur `defaultSize`, die Layouts kümmern sich um den Rest.

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

- **Phase 1 — Fundament** ✅: HA-Verbindung (`connection.ts`, `useEntity`, `useService`), AppShell mit SideNav/BottomNav, ViewRenderer, `SectionsLayout`, Config-Store + localStorage-Persistenz, 2 Basis-Cards (clock, light). *→ Erstes lauffähiges Dashboard.*
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
