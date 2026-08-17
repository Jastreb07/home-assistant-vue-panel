# AGENTS.md — Projektgedächtnis für KI-Agenten

> Diese Datei ist das Übergabe-Dokument für neue KI-Sessions. Sie beschreibt Zweck,
> Architektur, Konventionen und Fallstricke des Projekts. Details zur ursprünglichen
> Planung stehen in `PLAN.md`. **Bei Architekturänderungen beide Dateien aktualisieren!**

## 1. Was ist dieses Projekt?

**vue-panel** ist eine Dashboard-Engine für Home Assistant (HA), die Lovelace **komplett ersetzt**:
- Kein YAML — die gesamte Dashboard-Konfiguration wird **im Browser visuell bearbeitet** (wie Lovelace-Editor) und via HA-WebSocket in `.storage` gespeichert (pro User, geräteübergreifend).
- Vue 3.5 (Composition API, `<script setup>`) + TypeScript + Vite + Pinia + vue-router (Hash) + vue-i18n v11.
- Zielgeräte: Wand-Tablets im Landscape (SideNav links) und Smartphones (BottomNav unten), Breakpoint 1024px.
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

- Build-Output nach HA `config/www/vue-panel/` hochladen.
- `configuration.yaml` (einmalig, Snippet in PLAN.md §8): `panel_custom` mit `module_url: /local/vue-panel/loader.js`, `embed_iframe: false`. **Noch nicht beim Nutzer eingerichtet!** (Sein HA: `home.local`, altes Panel läuft unter `url_path: home-panel`.)
- `public/loader.js` = stabiler Einstiegspunkt: lädt `version.txt` mit `cache: 'no-store'`, erstellt iframe auf `index.html?ver=<version>`, sendet Auth+Sprache per `postMessage({type:'vue-panel:auth', hassUrl, access_token, expires, language})`. Message-Typ **niemals umbenennen**.
- Update-Workflow: `version.txt` bumpen (aktuell **1.1.0**) → build → `dist/` hochladen. Kein HA-Neustart nötig.
- `module_url` MUSS ein ES-Modul sein (HA macht `import()`), niemals eine HTML-Datei. `url_path: home` ist reserviert (war der ursprüngliche Bug des Nutzers).

## 4. Verzeichnisstruktur & Kernkonzepte

```
src/
├─ main.ts                    # Pinia, Catch-all-Hash-Router (hierarchische View-Pfade), i18n, connect()
├─ App.vue                    # Verbindungsstatus-Overlay + RouterView + DialogHost
├─ theme/default/main.css    # Globale Styles des Default-Themes: Farb-Variablen (dark default, [data-theme='light']), Scrollbars, Form-Basics
├─ i18n/                      # vue-i18n v11 (legacy:false), locales/en.ts + de.ts
├─ core/
│  ├─ ha/                     # connection.ts (WebSocket, Dual-Auth), useEntity, useService
│  ├─ registry/cardRegistry.ts# Card-Auto-Discovery (import.meta.glob), defineCard, Schema-Typen
│  ├─ config/                 # types.ts, dashboardStore.ts (Pinia), persistence.ts (HA user_data)
│  ├─ editor/                 # EditFab, CardPicker, CardConfigDialog, SchemaForm, EntityPicker,
│  │                          # ViewSettingsDialog, DashboardSettingsDialog
│  ├─ ui/                     # DÜNNE WRAPPER: BaseCard/BaseDialog/BaseButton → themed('…'),
│  │                          # MdiIcon, DialogHost.vue + dialogService.ts (alert/confirm/prompt)
│  ├─ composables/            # useClock, useMediaQuery, useTheme
│  ├─ kiosk/                  # useIdleSeconds, Screensaver.vue
│  └─ dev/DevSidebar.vue      # Dev-only Tools (Sprache, Export/Import, Reset) — nicht i18n'd
├─ shell/                     # AppShell (Toolbar, Undo/Redo, Kiosk, Subview-Header), SideNav,
│                             # BottomNav, ViewRenderer (Layout-Map)
├─ layouts/                   # SectionsLayout, FlexLayout, GridLayout, SidebarLayout, PanelLayout
│                             # + useSectionEditing.ts (geteilte Edit-Logik) + LayoutSection.vue
├─ cards/                     # 1 Ordner = 1 Card (siehe §5)
└─ theme/                     # Theme-System (siehe §6)
```

### Datenmodell (`core/config/types.ts`)
`DashboardConfig { version:1, settings?, views[] }` → `ViewConfig { id, title, icon, path?, layout, layoutOptions?, subview?, background?, showSidebar?, showHeader?, padding?, margin?, width?, sections[] }` → `SectionConfig { id, columnSpan?, cardOrientation?, padding?, margin?, cards[] }` (Abschnitte haben **kein** `title`/`icon` — Überschriften sind Cards vom Typ `section-title`) → `CardConfig { id, type, config, css?, size? }`.
`padding`/`margin` sind `BoxValue { top?, right?, bottom?, left?, unit?, linked? }` aus `core/ui/boxInput.ts` (`boxToCss()` → CSS-Shorthand, `normalizeBox()` verwirft leere Werte).
`DashboardSettings { theme: 'dark'|'light'|'auto', uiTheme: string, screensaverMinutes, autoReturnSeconds }` (0 = aus).

### Persistenz (kein YAML!)
- localStorage `vue-panel:dashboard` = sofortiger Cache; remote via WebSocket `frontend/set_user_data`/`get_user_data`, Key `vue-panel-dashboard`, debounced 800ms (`persistence.ts`).
- Beim Connect gewinnt die Remote-Config; gibt es keine, wird lokal/Default hochgeladen (`syncFromRemote`).
- **Undo/Redo**: JSON-Snapshot-Stacks im Store (max 50). `save()` = mit History, `persist()` = ohne (für undo/redo/sync). Strg+Z/Y + Toolbar-Buttons im Edit-Modus.

### Auth (core/ha/connection.ts)
- Dev: Long-lived Token aus `.env.local`. Produktion: postMessage vom loader.js (inkl. `language`).
- Auth-Objekt ist ein Cast `as unknown as Auth` mit Gettern; `refreshAccessToken()` wartet auf nächste postMessage.

### i18n
- Priorität: **HA-Sprache (Produktion, gewinnt immer)** > localStorage `vue-panel:locale` (Dev-Wahl) > Browser > 'en'.
- Nur en + de. Card-Manifeste referenzieren i18n-Keys (`'cards.light.name'`), übersetzt beim Rendern.
- Standalone `t()` aus `@/i18n` für Nicht-Component-Code (Store, Composables).

## 5. Cards erstellen (Kern-Feature!)

1 Ordner unter `src/cards/<name>/` mit `manifest.ts` + Komponente — **fertig, keine Registrierung nötig** (eager glob in `cardRegistry.ts`).

```ts
// src/cards/foo/manifest.ts
export default defineCard({
  type: 'foo', name: 'cards.foo.name', icon: 'mdi:star',
  component: () => import('./FooCard.vue'),           // lazy!
  schema: { entity: { type: 'entity', domain: 'light', label: 'cards.foo.entity' } },
  defaultSize: { cols: 1, rows: 1 },
})
```
- Schema-Feldtypen: `entity` (mit `domain`), `string`, `number`, `boolean`, `select` (options), `view` (View-Auswahl, z.B. room-tile) → Editor-Formular wird auto-generiert (SchemaForm + Live-Preview).
- Card-Komponente bekommt Prop `config`; nutzt `useEntity(() => props.config.entity)`, `useService('domain')` aus `@/core/ha`.
- **Cards nutzen KEIN `BaseCard`** — jede Card trägt die komplette Kachel-Optik (background, border-radius, padding, box-shadow, active-Zustand, …) selbst in ihrem eigenen `<style scoped>`-Block. Grund: der CSS-Tab zeigt/kontrolliert so die GESAMTE Card inkl. Kachel. Standard-Kachel-Block (in jede Card kopieren und anpassen): `background: var(--card-bg); border-radius: var(--card-radius); padding: 16px; min-height: 80px; height: 100%; box-shadow: var(--card-shadow); color: var(--text-primary);` — aktiv: `background: var(--card-bg-active); color: var(--text-on-active);`.
- **Regel: Cards importieren nur aus dem eigenen Ordner + `@/core/*`** — nie aus anderen Cards.
- i18n-Keys der Card in `en.ts` UND `de.ts` ergänzen. Gemeinsame Keys: `cards.common.noEntity/notFound`.
- Vorhandene Cards: clock, light, sensor, thermostat, cover, weather, media, room-tile, menu, section-title (Referenz: `light`).
- `manifest.fullRow: true` → die Card belegt immer eine ganze Zeile ihres Abschnitts (`grid-column: 1 / -1`, `flex-basis/width: 100%`, gesetzt in `LayoutSection.styleFor` — schlägt auch das `slotStyle` des Layouts) und ist im Flex-Layout **nicht** resizebar (`canResize()`). Nutzt `section-title`.
- **Per-Card-CSS**: Jede Card hat im Konfigurationsdialog einen Tab „CSS“ (`CardConfigDialog.vue`), vorbefüllt mit dem Default-CSS der Card (`cardDefaultCss()` in `cardRegistry.ts` extrahiert die `<style>`-Blöcke der SFCs per `?raw`-Glob). Abweichungen werden als `CardConfig.css` gespeichert und zur Laufzeit über `core/ui/CardCss.vue` angewendet: injizierter `<style>` mit nativem CSS-Nesting `[data-vp-card="<id>"] { … }`; der Render-Wrapper (`.card-slot`/`.nav-card-slot`/`.panel-slot`) trägt das passende `data-vp-card`-Attribut. Entspricht das CSS dem Default oder ist leer, wird KEIN Override gespeichert.

## 6. Theme-System (`src/theme/`)

- `src/theme/<themeName>/<Komponente>/` mit `index.vue` + `style.css`. Vorhanden: `default/{AddTile,BoxInput,Button,Card,Checkbox,CodeEditor,Collapsible,Dialog,Input,SelectMenu,Tabs}`.
- **Collapsible** = aufklappbare Box zum Gruppieren von Einstellungen (`title`, `icon?`, `defaultOpen?` — **Default zu**, Default-Slot); Wrapper `@/core/ui/BaseCollapsible.vue`. Konvention: In jedem „Erweitert"-Tab liegen die Gruppen in Collapsibles, die **erste sichtbare** Box bekommt `default-open`.
- **BoxInput** = wiederverwendbares Vierseiten-Feld (Oben/Rechts/Unten/Links + Einheit + Ketten-Button) für Padding/Margin; Wrapper `@/core/ui/BaseBoxInput.vue`, Wert-Typ + Helfer in `@/core/ui/boxInput.ts`.
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

- 5 Layouts (`ViewRenderer.vue`-Map): sections (Default, wie HA "Sections": Abschnitte als Spalten nebeneinander; `layoutOptions.maxColumns` 1–6, `dense` = Masonry via CSS-Multi-Columns, `topMargin` = 80px Platz oben; Einstellungen im ViewSettingsDialog nur bei layout=sections sichtbar), flex (jede Card mit eigener fester Pixelgröße, im Edit-Mode per Resize-Griff an der rechten unteren Ecke; ersetzt das alte `tiles`-Layout — gespeicherte `layout: 'tiles'`-Werte werden als Alias auf FlexLayout gemappt. Der Container ist `flex-wrap: wrap`: Abschnitte ohne `width` füllen per `flex: 1 1 100%` eine eigene Zeile, Abschnitte mit fester `width` stehen per inline `flex: 0 0 auto` nebeneinander), grid (feste Spalten via `layoutOptions.columns`), sidebar (letzter Abschnitt = rechte Spalte), panel (erste Card der ersten Section füllt alles). Card-Größe liegt in `card.size.width/height` (px), gesetzt via `store.updateCardSize()` — entweder per Resize-Griff oder im Card-Dialog über den Tab „Größe" (`CardConfigDialog` mit `sizable`/`initialSize`, gibt die Größe als 3. Argument von `save` zurück; nur FlexLayout setzt das Prop).
- Geteilte Edit-Logik in `layouts/useSectionEditing.ts` (Dialoge, Drag&Drop für Cards UND ganze Sections, Section-Ops) + `LayoutSection.vue` (props/emits-basiert, `gridStyle`/`hideHeader`/`columnSpan` für Varianten). Im Edit-Modus wird jede Section eine sichtbare Box (gestrichelter Rahmen) mit schwebender Toolbar oben rechts: ≡ Drag-Handle (Section umsortieren via `store.moveSection`), ✏ Einstellungen, Löschen. **Neue Layouts diese Bausteine wiederverwenden.**
- **Section-Dialog** (`core/editor/SectionSettingsDialog.vue`): Tab „Allgemein" (Ausrichtung der Cards `auto|vertical|horizontal`; dazu `contentAlign` = `left|center|right` als `justify-content` der Card-Zeile — nur sichtbar bei layout=flex oder horizontaler Ausrichtung, schlägt die View-Ausrichtung) + Tab „Erweitert" mit Collapsibles „Größe" (bei layout=sections: Breite in Spalten; bei layout=flex: Volle Breite (Default) oder eigene Breite in px → `SectionConfig.width`) und „Abstände" (Margin/Padding via `BaseBoxInput`). Wird von allen 4 Section-Layouts gerendert; `addSection` legt den Abschnitt sofort an und öffnet den Dialog. Ausrichtung/Spacing wertet `LayoutSection.vue` aus, `columnSpan` setzt `grid-column: span N` (in `dense`-Modus ignoriert).
- **View-Tab „Erweitert"** (`ViewSettingsDialog`): zwei `BaseCollapsible`-Boxen — „Spezifische Einstellungen für die Abschnittsansicht" (nur bei layout=sections: maxColumns, dense, topMargin) und „Abstände & Ausrichtung" mit Margin, Padding, Breite (`default|full`), Ausrichtung (`left|center|right`). `ViewRenderer.vue` legt einen `.view-box`-Wrapper darum, setzt Padding/Margin inline, bei `full` die Variable `--view-max-width: none` und für die Ausrichtung `--view-align` (die Auto-Margins). Alle Layouts nutzen `max-width: var(--view-max-width, …)` und `margin: var(--view-align, 0 auto)` statt fester Werte. Damit die Ausrichtung überhaupt sichtbar wird, rechnet `SectionsLayout` seine `max-width` aus den **tatsächlich belegten** Spalten (`usedColumns`, inkl. Add-Tile im Edit-Modus), nicht aus `maxColumns`. Im Flex-Layout wirkt die Ausrichtung als `justify-content` auf die **Abschnitts-Reihe** (Default links); wie die Cards innerhalb eines Abschnitts stehen, regelt dessen eigenes `contentAlign`.
- Edit-Modus: `store.editMode` (EditFab unten rechts). Toolbar: Undo/Redo, View-Einstellungen, Dashboard-Einstellungen. Im Edit-Modus erscheinen Subviews in der Nav.
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

- [ ] Panel in der `configuration.yaml` des Nutzers registrieren + `dist/` nach `config/www/vue-panel/` deployen (Snippet PLAN.md §8).
- [ ] Git-Repo für vue-panel initialisieren (bisher keins!).
- [ ] Weitere Cards (z.B. Kamera, Verlaufs-Graph, Szenen/Buttons, Alarm).
- [ ] Beispiel-Custom-Theme als Vorlage.
- [ ] `size.rows` wird noch nicht ausgewertet (nur `cols` als grid-column span).
- [ ] Wetter-Forecast (benötigt `weather/subscribe_forecast` Subscription).
