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
- ab `2.0.0-alpha.21`/Engine `2.1.18` hält die AppShell die URL immer auf dem Pfad der aktiven
  View und leitet leere oder unbekannte Pfade auf die Standard-View (erste View) um. Die
  Edit-Toolbar nutzt das neue `ViewSelectMenu`, das die Standard-View mit einem Stern markiert und
  Views über Pfeile umsortiert; die Menu-Card unterscheidet `parent`/`child` und rahmt den Parent
  nur ein, solange eine seiner Unteransichten aktiv ist;
- ab `2.0.0-alpha.22`/Engine `2.1.19` spiegelt der Loader die Route in beide Richtungen: Der
  Panel-Unterpfad kommt als `routePath` im Kontext und als `vue-panel:route` in die Engine, jede
  Engine-Navigation geht als `vue-panel:navigate` zurück und landet über
  `history.pushState`/`replaceState` samt `location-changed` in der HA-Adresszeile. Damit steht
  der View-Pfad als `/<panel>/<view-pfad>` im Browser und funktioniert für Deep-Links, Reload,
  Teilen und die Zurück-Taste;
- ab `2.0.0-alpha.26`/Engine `2.1.23` sizen sich Bar-Cards nach ihrem eigenen Inhalt
  (fit-content) statt nach einer festen Box oder einem erzwungenen Ausfüllen: `BarColumnCards.styleFor()`
  setzt entlang der Balkenachse weder eine feste Pixelgröße noch `flex: 1 1 0`, sondern
  `flex: 0 1 auto` ohne Breiten-/Höhenvorgabe — das Manifest-`defaultSize` wird für Bar-Cards
  nirgends mehr verwendet. Quer zur Balkenachse bleibt der bestehende `--bar-card-cross`-Fallback
  unverändert. Zwei vorherige Versuche sind daran gescheitert, dass entweder ein per Manifest
  vergebenes `defaultSize` die Navigation künstlich auf eine feste Box klemmte, oder ein
  pauschales `flex: 1 1 0` kompakte Cards wie Uhr/Wetter auf die volle Breite/Höhe der Leiste
  gestreckt hat; ein dafür ergänzter Größen-Tab im Bar-Card-Dialog erwies sich als unnötig
  kompliziert und wurde wieder entfernt, weil praktisch jede Card ihr Wurzelelement ohnehin auf
  `width: 100%; height: 100%` ihres Slots stylt (siehe `menu.html`) — ein Slot ohne eigene feste
  Box lässt solche Cards einfach auf ihre natürliche Inhaltsgröße schrumpfen;
- ab `2.0.0-alpha.27`/Engine `2.1.24` scrollt bei Header und Bottom-Bar jede Spalte für sich,
  statt die ganze Leiste horizontal zu verschieben: `ShellBarHost.vue` trennt die äußere,
  nicht scrollende Editier-Box (`columnOuterStyle()`, Toolbar-Chrome, Padding/Margin) von einem
  inneren `.bar-column-scroll`-Wrapper (`columnInnerStyle()`), der die eigentliche Card-Ausrichtung
  trägt und bei Header/Bottom `overflow-x: auto` bekommt. `fit`-Spalten dürfen jetzt zusätzlich
  schrumpfen (`flex: 0 1 auto` statt `0 0 auto`), damit der verfügbare Platz zuerst unter den
  Spalten aufgeteilt wird und erst die überschüssige Spalte selbst scrollt. So bleiben z. B. eine
  fixe Uhr-Spalte links und eine lange Navigation rechts unabhängig voneinander sichtbar, statt
  dass ein Scrollen der ganzen Leiste auch die Uhr wegschiebt;
- ab `2.0.0-alpha.28`/Engine `2.1.25` funktioniert dieses Spalten-Scrolling tatsächlich in jedem
  Größenmodus: `BarColumnCards.styleFor()` gibt Bar-Cards `flex: 0 0 auto` statt `0 1 auto`. Mit
  `flex-shrink: 1` hatte der Flexbox-Algorithmus jede Card innerhalb einer engen Spalte einfach
  bis auf 0 zusammengedrückt, statt echten Overflow zu erzeugen — `overflow-x: auto` am
  `.bar-column-scroll`-Wrapper hat dadurch nie eine Scrollbar gezeigt, außer zufällig bei
  `full`-Spalten, wo vorher noch die alte, inzwischen entfernte Ganze-Leiste-Scrollbar griff.
  `flex-shrink: 0` lässt Cards auf ihrer natürlichen Inhaltsgröße bestehen; passt der Inhalt nicht
  in die Spalte, entsteht echter Overflow, den `.bar-column-scroll` jetzt in jedem Größenmodus
  (`fit`/`full`/`fixed`) korrekt scrollbar macht;
- ab `2.0.0-alpha.29`/Engine `2.1.26` sind zwei Regressionen aus alpha.27/28 behoben:
  `columnOuterStyle()` lässt `fit`-Spalten nur noch in Header/Bottom schrumpfen — Sidebars stapeln
  ihre Spalten stattdessen weiterhin mit `flex: 0 0 auto` (natürliche Höhe), sonst würden Cards wie
  die Uhr zusammengequetscht statt dass die ganze Sidebar (bereits vorhandenes
  `overflow-y: auto` am Host) als Liste scrollt. Zweitens verwendet `columnInnerStyle()` für jedes
  `align` außer `start` jetzt `justify-content: safe <align>` statt nur `<align>`: Ohne `safe`
  macht Zentrieren/Endausrichten eines überlaufenden Flex-Containers den Überlauf auf der
  Anfangsseite unerreichbar — die Bottom-Bar-Spalte (per Default `align: center`) ließ sich zwar
  scrollen, zeigte aber nie das erste Menüelement, weil die Browser-Startposition schon mittig in
  den Overflow hinein lag;
- ab `2.0.0-alpha.30`/Engine `2.1.27` bleibt die „+ Card“-Kachel einer Bar-Spalte im Edit-Modus
  über `position: sticky` am Ende des scrollenden Bereichs stehen (`right: 0` in Header/Bottom,
  `bottom: 0` in Sidebars), statt mit den übrigen Cards aus dem sichtbaren Bereich zu scrollen;
  `sticky` löst dabei gegen den nächsten scrollenden Vorfahren auf (`.bar-column-scroll` bzw. den
  Sidebar-Host), obwohl `BarColumnCards` selbst `display: contents` nutzt;
- ab `2.0.0-alpha.31`/Engine `2.1.28` ersetzt ein echter innerer Scroll-Wrapper den `sticky`-Ansatz
  aus alpha.30: `BarColumnCards.vue` legt die Cards jetzt in eine eigene `.bar-cards-track`, die als
  Flex-Geschwister neben der „+ Card“-Kachel liegt (beide sind über das weiterhin `display:
  contents` nutzende `.bar-column-cards` in ShellBarHosts `.bar-column-scroll` eingehängt). Nur
  diese Track scrollt (Header/Bottom horizontal), die Kachel bleibt außerhalb davon und ist dadurch
  immer sichtbar, ohne über `position: sticky` gegen einen fremden Scroll-Container aufgelöst
  werden zu müssen. Haupt-Achsen-Ausrichtung (`align`, inkl. `safe`-Fallback) und `--bar-card-cross`
  ziehen dafür von ShellBarHosts `columnInnerStyle()` in `BarColumnCards.vue`s neue `trackStyle()`
  um; `ShellBarHost.columnScrollStyle()` richtet nur noch Track und Kachel gemeinsam über die
  Querachse aus;
- ab `2.0.0-alpha.32`/Engine `2.1.29` bekommt die neue `.bar-cards-track` (und ihr Elternwrapper
  `.bar-column-scroll`) in Header/Bottom eine explizite `height: 100%` statt sich nur auf
  `align-items: stretch` über mehrere verschachtelte Flex-Ebenen zu verlassen (Host → Spalte →
  Scroll-Wrapper → Track). Sobald ein Zwischenelement selbst zum Scroll-Container wird, ist diese
  Stretch-Vererbung nicht zuverlässig — die Track fiel auf ihre ungeklemmte Inhaltshöhe zurück und
  streckte die ganze Spalte über die Bar-Höhe hinaus auf; Sidebars bekommen dasselbe mit
  `width: 100%`;
- ab `2.0.0-alpha.33`/Engine `2.1.30` scrollen auch Sidebar-Spalten intern: `.bar-cards-track`
  erhält in Spaltenrichtung `overflow-y: auto` (analog zum horizontalen Scrollen in
  Header/Bottom), `fit`-Spalten dürfen wieder in beiden Richtungen schrumpfen
  (`columnOuterStyle()` ohne Richtungs-Sonderfall) und der Sidebar-Host scrollt nicht mehr selbst
  (`overflow: hidden` statt `hidden auto`) — dadurch bleibt die „+ Card“-Kachel auch in Sidebars
  immer sichtbar statt ans Ende der Card-Liste zu wandern;
- ab `2.0.0-alpha.34`/Engine `2.1.31` reservieren Header und Bottom-Bar im Edit-Modus 45px
  zusätzlichen Platz oben (`padding-top`, Host-Höhe wächst um denselben Betrag), damit die auf
  `top: -40px` verschobene `vp-editable-area-toolbar` der Spalten innerhalb der Bar sichtbar
  bleibt statt aus dem Viewport zu ragen;
- ab `2.0.0-alpha.35`/Engine `2.1.32` bleibt das Card-Edit-Overlay (`vp-card-edit-surface`)
  strikt innerhalb seiner Card: Die drei Card-Wrapper `.card-slot` (LayoutSection), `.panel-slot`
  (PanelLayout) und `.bar-card` (BarColumnCards) erzeugen per `isolation: isolate` einen eigenen
  Stacking-Context, sodass das `z-index: 4` des Overlays nicht mehr in die Seiten-Stapelreihenfolge
  entweicht und über fremden Elementen malt;
- ab `2.0.0-alpha.36`/Engine `2.1.33` bekommt die Edit-Toolbar der View (`.edit-toolbar` in
  AppShell) `position: relative; z-index: 10`, sodass ihr View-Dropdown garantiert über allen
  Card-Edit-Overlays liegt; außerdem deckt die `vp-card-edit-surface` auch bei resizebaren Cards
  die volle Card-Fläche ab — statt eines 24px-Streifens unten wird nur noch die Resize-Ecke per
  `clip-path` ausgespart (die Aussparung nimmt auch Pointer-Events aus, der native Resize-Griff
  bleibt greifbar);
- ab `2.0.0-alpha.37`/Engine `2.1.34` besitzt die Abschnitts-Toolbar zusätzlich „Duplizieren“
  (Kopie mit frischen IDs direkt hinter dem Original, `store.duplicateSection`) und „Kopieren“
  (Abschnitt samt Cards in die App-Zwischenablage `vue-panel:section-clipboard` plus
  System-Clipboard, `copySectionToClipboard` in `cardClipboard.ts`); liegt ein kopierter
  Abschnitt vor, zeigt jedes Section-Layout neben „+ Abschnitt“ eine Kachel „Kopierten
  Abschnitt einfügen“ (`store.pasteSection`, hängt ihn mit neuen IDs an die View an);
- ab `2.0.0-alpha.38`/Engine `2.1.35` haben beide Sidebar-Hosts normal `gap: 20px` zwischen den
  Spalten und nur im Edit-Modus 45px (Klasse `is-editing` auf dem Host); das Flex-Layout erhält
  im Edit-Modus `row-gap: 45px`, damit die bei `top: -40px` verankerten Abschnitts-Toolbars
  zwischen den Zeilen sichtbar bleiben;
- ab `2.0.0-alpha.39`/Engine `2.1.36` erhöht auch das Sections-Layout im Edit-Modus seinen
  vertikalen Abstand: der Grid-`row-gap` (bzw. `margin-bottom` im dense-Modus) wächst von 24px
  auf 45px, horizontal bleiben 24px;
- ab `2.0.0-alpha.40`/Engine `2.1.40` lassen sich die Views im Dropdown zusätzlich per Drag & Drop
  sortieren: jede Zeile hat links einen Ziehgriff, die Zielzeile wird gestrichelt markiert und der
  Drop landet über `store.moveViewTo()` an der absoluten Position. Die Pfeile hoch/runter bleiben
  erhalten, die oberste View ist weiterhin die Standard-View (Stern);
- ab `2.0.0-alpha.41`/Engine `2.1.41` bekommt `BaseViewSelectMenu` selbst den Default
  `reorderable: true`. Ohne ihn castete Vue das ausgelassene Boolean-Prop im Wrapper zu `false`,
  und dieses explizite `false` überschrieb den Default der Theme-Komponente — dadurch fehlten
  Pfeile, Ziehgriff und Hinweistext im Dropdown. Merke: Thin Wrapper müssen Boolean-Defaults
  spiegeln;
- ab `2.0.0-alpha.42`/Engine `2.1.42` kennt das Card-Format v2 den Variablentyp `list`
  (`itemFields` mit skalaren Feldern, optional `nestable`, kein `default`, keine verschachtelten
  Listen). `ListField.vue` rendert dafür einen Menü-Builder im WordPress-Stil: Einträge einzeln
  oder alle Ansichten auf einmal hinzufügen, hoch/runter schieben, ein- und ausrücken (max. Tiefe
  2) und je Eintrag die Felder über die wiederverwendete `SchemaForm` bearbeiten. Konvention: das
  erste `string`-Feld ist der Zeilentitel, das erste `icon`-Feld das Zeilenicon und das erste
  `view`-Feld das Navigationsziel; ein Eintrag ohne Ziel wird zur Überschrift. Die Menu-Card
  besitzt dadurch die Variable `items`; ohne konfigurierte Einträge listet sie weiterhin alle
  Ansichten automatisch. Der Card-Editor bietet den Typ in der Auswahl an, die Feinkonfiguration
  der `itemFields` erfolgt im JSON-Tab;
- ab `2.0.0-alpha.44`/Engine `2.1.44` gibt es die Core-Card `vue-panel/entity`: eine generische
  Kachel für genau eine beliebige Entität im gewohnten Tile-Stil (Icon-Kreis oben, Name und Status
  unten). Icon-Auflösung: konfiguriertes Icon → Entity-Icon → Domain-Standardicon; der Status zeigt
  Einheit beziehungsweise einen übersetzten Zustand. Schaltbare Domains toggeln beim Klick über
  `homeassistant.turn_on/turn_off`, alle anderen bleiben reine Anzeige. Der Listen-Editor bietet für
  Listen mit `entity`-Feld jetzt einen Entity-Picker zum Schnellanlegen und nutzt die Entity-ID als
  Zeilentitel-Fallback;
- ab `2.0.0-alpha.45`/Engine `2.1.45` ersetzt die Menu-Card die Schalter „Titel anzeigen“ und
  „Icons anzeigen“ durch die Auswahl `display` mit „Icon und Text“, „Nur Icon“ und „Nur Text“.
  Ältere Instanzen fallen weiterhin auf `showTitles`/`showIcons` zurück. Ohne Text bekommt jeder
  Eintrag ein Ersatzicon plus Tooltip, und Überschriften ohne darstellbaren Inhalt entfallen;
- ab `2.2.0`/Engine `2.2.0` gibt es Popups und Detailansichten: `DashboardConfig.popups` hält global
  definierte Dialoge, die wie eine Flex-View Sections und Cards aufnehmen. Cards für Dialoge tragen die
  neue Area `dialog`; die neue Tap-Action `popup` öffnet ein Popup, `more-info` öffnet die
  Detailansicht. Die Card-API kennt dafür `vuePanel.showDetail()` und `vuePanel.openPopup()` unter der
  Capability `dialog:open`, außerdem `vuePanel.context` und `${variable}`-Platzhalter in Instanzwerten.
  Erste mitgelieferte Detail-Card ist `vue-panel/light-detail`;
- ab `2.2.42`/Engine `2.2.72` zeigt der Theme-Dialog auf Smartphones (`max-width: 767px`) immer
  Vollbild: `.vp-dialog` wird fixiert, randlos und `100dvh` hoch, der Backdrop verliert sein
  Padding, und eine per Prop gesetzte Breite oder Body-Höhe wird überschrieben. Kurzer Inhalt
  steht dabei mittig (`justify-content: safe center` am Body — `safe`, damit langer Inhalt weiter
  von oben scrollbar bleibt); waagerecht zentrieren sich die Cards über `margin-inline: auto`
  selbst. Die frühere 600px-Regel (nur volle Breite) ist damit ersetzt;
- ab Engine `2.2.4` zeigt `vue-panel/light-detail` ein Dial im Stil der HA-Detailansicht und
  blendet Helligkeit, Farbtemperatur, Farbe und Effekte nur ein, wenn `supported_color_modes`
  beziehungsweise `effect_list` sie hergeben. Seit `2.2.42` teilt es sich die komplette Optik mit
  `vue-panel/thermostat-detail`: derselbe unten offene 270°-Bogen samt Trefferband, Griff,
  Tipp-Animation und Zeigerlogik, dieselbe Formsprache und Metrikzeile (die Icons stehen
  hier als Reihe über dem mittig stehenden Wert: Glühbirne an/aus, aktiver Effekt, Warnung), dieselbe Pillen-Gruppe in der Bogenlücke und dasselbe radiale Menü mit
  Weichzeichner auf dem `.vp-dialog-body`. In der Gruppe sitzen der Ein/Aus-Schalter (links, im
  Akzent eingefärbt, wenn das Licht an ist) und die Effektauswahl (rechts, radiales Menü); ohne
  Effekte bleibt der Schalter als volle Pille. Die Metriken zeigen Helligkeit und Kelvin, im Bogen
  steht der Wert des aktiven Reglers. Die drei Modusknöpfe (Helligkeit, Kelvin, Farbe) bleiben
  unter dem Bogen, Halten öffnet weiterhin die Schnellwerte. Im Farbmodus zeigt der Bogen den vollen Farbverlauf: ein
  `conic-gradient` (Drehpunkt = Bogenmitte, `from 135deg`) wird mit `--vp-arc-mask` auf exakt
  denselben Pfad samt Strichbreite und runden Enden wie `.arc-value` maskiert, sodass er wie die
  übrigen Bögen sitzt; der Griff trägt den gewählten Farbton, und in der Mitte steht statt der
  Zahl eine runde Farbfläche mit der tatsächlichen Lichtfarbe (Farbton vom Regler, Sättigung aus
  `hs_color`). Dialogbreite (`defaultSize.width` 396 → `md`) und die vom
  Inhalt bestimmte Höhe entsprechen ebenfalls der Thermostat-Card;
- ab Engine `2.2.6` sind die Flächen der Detail-Card theme-fest: Ring, Schalter und Modus-Kacheln
  mischen ihre Farbe über `color-mix(… currentColor …)` statt über weiß-transparente Werte, die im
  hellen Theme unsichtbar waren; die Modus-Icons erben `--text-primary`/`--text-secondary`, ein
  ausgeschaltetes Licht bleibt vollständig neutral (kein Akzent), der doppelte Card-Titel unter den
  Kacheln entfällt und `PopupFrame` zeigt eine Detailansicht in einem schmalen Dialog mit
  zentrierter Card statt in einem breiten, linksbündigen;
- ab `2.2.8`/Engine `2.2.29` folgt der Default-Dialog der Home-Assistant-Popup-Geometrie: 28px
  Radius, eine 64px hohe Kopfzeile mit führendem Schließen-Button, Material-Elevation, 24px
  Inhaltsabstand und ein nahezu viewportfüllendes responsives Layout. Der Dialog unterstützt
  zusätzlich einen optionalen Kontexttitel und Header-Aktionen, besitzt ARIA-Dialogsemantik,
  fokussiert beim Öffnen den Schließen-Button und lässt sich mit Escape schließen;
- ab `2.2.9`/Engine `2.2.30` bietet der Tipp-Aktionseditor zusätzlich `ha-more-info`
  („Natives Home-Assistant-Popup“) an. Die Card-Runtime reicht die Entity über `showNativeDetail()` und
  `vue-panel:ha-more-info` an den Loader weiter; dieser öffnet im HA-Elterndokument den nativen
  Mehr-Info-Dialog über das zusammengesetzte `hass-more-info`-Event. `more-info` bleibt davon
  getrennt und öffnet weiterhin die Vue-Panel-Detailansicht;
- ab `2.2.10`/Engine `2.2.31` besitzt „Card hinzufügen“ eine lokalisierte Suchleiste mit
  Löschschalter. Sie filtert live über Card-Name, Beschreibung, technischen Typ und Gruppe,
  blendet leere Gruppen aus und unterscheidet zwischen einem leeren Bereich und einer Suche ohne
  Treffer; die separate Zwischenablage-Aktion bleibt dabei immer erreichbar;
- ab `2.2.11`/Engine `2.2.32` besitzt „View bearbeiten“ direkt hinter „Allgemein“ den Tab
  „Hintergrund“. Bilder werden per Drag & Drop über Home Assistants Image-Upload-Medienquelle
  gespeichert oder über den nativen HA-Medienbrowser ausgewählt; im Dashboard bleibt die stabile
  `media-source://`-ID erhalten und wird zur Anzeige in eine signierte URL aufgelöst. Deckkraft,
  mitscrollende/feste Verbindung, Größe, Ausrichtung und Wiederholung entsprechen dem nativen
  Lovelace-Hintergrundmodell. Der Loader vermittelt Medienauswahl und Upload zwischen Engine-iframe
  und HA-Elterndokument;
- ab `2.2.12`/Engine `2.2.33` überträgt die Engine eine bestehende Medienauswahl als plain JSON
  statt als nicht klonbaren Vue-Proxy. Der temporäre native HA-Medienselector wird außerdem als
  Kind des Panel-Custom-Elements eingehängt, damit sein zusammengesetztes `show-dialog`-Event durch
  den HA-Komponentenbaum zum Dialog-Host aufsteigt; direkt unter `document.body` blieb das Event
  außerhalb dieses Baums und der Klick auf „aus Medien auswählen“ hatte keine sichtbare Wirkung;
- ab `2.2.15`/Engine `2.2.35` verwendet `vue-panel/thermostat` das kompakte 140×108-Kacheldesign:
  Thermostat-Icon oben, aktuelle Temperatur und optionale Luftfeuchtigkeit in einer Kennzahlenzeile
  sowie Name und lokalisierter Betriebszustand darunter. Die früheren Sollwert-Schaltflächen und
  die dafür benötigte Schrittweitenvariable sind entfernt; Tipp-Aktionen gelten für die ganze Card;
- ab `2.2.16`/Engine `2.2.35` ergänzt die Thermostat-Card die Solltemperatur oben rechts. Eine
  Instanzoption vertauscht die Position von Ist- und Solltemperatur; Icon, beide Temperaturen,
  Luftfeuchtigkeit, Name und Betriebszustand lassen sich jeweils unabhängig ausblenden;
- ab `2.2.17`/Engine `2.2.35` formatiert die Thermostat-Card ihre Messwerte mit konfigurierbaren
  0–3 Nachkommastellen (Standard 2). Better Thermostat wird über dessen `window_open`-Attribut
  automatisch erkannt; alternativ überschreibt ein frei gewählter `binary_sensor` den
  Fensterzustand. Bei geöffnetem Fenster erscheint in der Kennzahlenzeile ein blaues Fenstericon.
  Kachel, 38px-Iconkreis und 24px-Haupticon verwenden wieder die gemeinsamen Core-Card-Maße und
  Theme-Variablen;
- ab `2.2.18`/Engine `2.2.35` zeigt die Thermostat-Card oben rechts getrennte Heiz- und
  AC-Sollwerte: `target_temp_low`/`temperature` mit Feuersymbol sowie darunter `target_temp_high`
  mit Schneeflocke. Während `hvac_action: heating` wird die Heizzeile orange, während
  `hvac_action: cooling` die Kühlzeile blau. Die Tauschoption tauscht Ist- und Heiztemperatur;
  die AC-Zeile bleibt separat und besitzt einen eigenen Sichtbarkeitsschalter;
- ab `2.2.19`/Engine `2.2.36` verschiebt das Default-Theme jeden `.tile__icon` innerhalb einer
  portablen Card einheitlich um 4px nach links und oben. Die Theme-Tokens
  `--tile-icon-offset-x`/`--tile-icon-offset-y` und die CSS-`translate`-Eigenschaft verändern nur
  die optische Position, nicht den Layoutfluss oder bestehende Transform-Animationen;
- ab `2.2.20`/Engine `2.2.36` verwendet die Thermostat-Card standardmäßig eine statt zwei
  Nachkommastellen. Explizit konfigurierte Instanzwerte bleiben unverändert; die Auswahl von
  null bis drei Stellen bleibt erhalten;
- ab `2.2.41`/Engine `2.2.36` liefert die Integration die Dialog-Card `vue-panel/thermostat-detail`
  mit. Sie verwendet bewusst dieselbe Bogen- und Knopfsprache wie `vue-panel/light-detail`
  (Spurfarbe `rgba(0,0,0,.075)`, runde Enden, 23px-Griff mit 4px weißem Rand, Pillen-Schalter,
  Popup-Listen), nur ist der Bogen kein voller Kreis, sondern ein unten offener 270°-Bogen
  (Mittelpunkt 180/160, Radius 140 im Viewbox 360×300, Start 135°). Er hat einen Heiz- und einen
  Kühl-Griff (Drag, Klick, Mausrad und Pfeiltasten), einen grauen Punkt für die Isttemperatur,
  umschaltbare Soll-Werte für `target_temp_low`/`target_temp_high` (ganze Zahl groß, Einheit und
  Nachkommastellen klein daneben), Istwert und Luftfeuchte als Metriken sowie
  unten in der Lücke des Bogens zwei nebeneinanderstehende Dropdowns für Voreinstellung
  (`preset_modes` → `climate.set_preset_mode`, wird ohne Presets ausgeblendet) und Betriebsart
  (`hvac_modes` → `climate.set_hvac_mode`). Das Ausschalten steckt im Betriebsart-Menü: `off` ist
  ein Eintrag wie jeder andere und wird bei Entities ohne `off` in `hvac_modes` über
  `climate.turn_off`/`turn_on` nachgebildet — einen eigenen Ein/Aus-Schalter gibt es nicht mehr.
  Die Gruppe hat die feste Breite `--selects-width` (200px, unter 390px 180px), beide Auslöser je
  die Hälfte davon, und hängt um `--selects-overhang` unter den Bogen — genau diesen Betrag
  reserviert das untere Padding der Card, damit sie keine feste Höhe braucht: der Dialog wächst mit
  dem Inhalt. Mit `defaultSize.width` 396 (< 424) wählt `PopupFrame` den `md`-Dialog statt `lg`; zu lange Beschriftungen werden über `applyTextScroll()` zu Lauftexten
  (Hülle `.pill-label` schneidet ab, `.pill-text` wandert per `vp-text-scroll`). Beide bilden einen zusammenhängenden Segmentschalter: außen
  abgerundet (links Presets, rechts Betriebsart), in der Mitte eine Trennlinie, und die Menüs
  öffnen sich als radiales Tortenmenü: `buildRadial()` zeichnet aus den Optionen ein SVG mit
  Ringsegmenten (Viewbox 320, Nabe r 62, Ring 74–150, erstes Segment oben) samt Beschriftung im
  Segment, `layoutMenu()` legt es fixiert auf die Bogenmitte und skaliert es mit dem Bogen. Die
  Nabe zeigt die Gruppenüberschrift und den angepeilten Eintrag. Beide `.menu`-Elemente hängen an
  der Card-Wurzel und nicht in `.select`: `.selects` ist per `transform` zentriert und wäre damit
  der Bezugsrahmen für `position: fixed` — dort landeten die Menüs außerhalb des Bildes. Weiter: das aktuell gewählte Segment ist
  hell invertiert, ein Klick auf die Nabe schließt. Unter drei Einträgen füllen gedimmte,
  nicht bedienbare Platzhalter-Segmente den Ring auf (`MIN_SEGMENTS`). Solange eine Liste offen ist, legt der `.scrim` einen
  `backdrop-filter: blur(8px)` mit leichter Abdunklung über den Dialoginhalt; er
  wird beim Öffnen per `card.closest('.vp-dialog-body').getBoundingClientRect()` genau auf den
  Dialog-Body gelegt (ohne Dialog auf die Card), sodass Kopf- und Fußzeile scharf bleiben. Ein
  Klick darauf oder Escape schließt die Liste. Der Ein/Aus-Schalter sitzt unten mittig in der Lücke des Bogens. Auslöser-Pillen und Schalter
  tragen das Styling des Schalters aus `light-detail` (40px hohe Pille, `border-radius: 999px`,
  gleiche Hover-/Active-/Offen-Zustände). Runde Modus-Knöpfe gibt es nicht mehr. In der Hinweiszeile zeigt zwischen Warn- und
  Fenstericon ein eingefärbtes Icon, was das Gerät gerade tut (`hvac_action`: Flamme orange,
  Schneeflocke blau, Leerlauf grau …); der als `translation.actions.*` übersetzte Text steht als
  `title`/`alt` daran; die eingestellte Betriebsart steht dagegen im Dropdown, damit beides nicht
  dasselbe Wort doppelt anzeigt.
  Alle Zeigergesten hängen an einem unsichtbaren, 44 Einheiten breiten Trefferpfad
  (`.arc-hit`, `pointer-events: stroke`) direkt auf dem Bogen — nicht an der Dial-Fläche. Damit
  lässt sich der Wert nur auf dem Bogen selbst ziehen, die Fläche darin bleibt klick- und
  scrollbar, und `touch-action: none` gilt ebenfalls nur für dieses Band. Drücken und Ziehen sind
  getrennt: `pointerdown` setzt nur `is-pressed` (Cursor und leichte Skalierung), sodass ein Tipp
  auf den Bogen animiert auf die getippte Stelle läuft. Erst wenn der Zeiger sich um mehr als vier
  Pixel bewegt, kommt `is-dragging` dazu und schaltet die Übergänge von Füllung, Griffen und
  Ist-Punkt ab — sonst liefe die Bogenfüllung dem Finger sichtbar hinterher.
  Optional zeigt ein `binary_sensor` als `windowSensor` ein Fenster-offen-Hinweisicon; ohne ihn
  greifen die Attribute `window_open`/`door_open`, das Warnicon kommt aus `degraded_mode`,
  `unavailable_sensors` und `devices_errors` (Better Thermostat), die Kühlschwelle notfalls aus
  `bt_preset_cool_temperature` und die Schrittweite aus `bt_target_temp_step`.
  Bedienelemente erscheinen nur, wenn `supported_features` beziehungsweise die Attribute
  (`current_humidity`, `hvac_action`, Bereichs-Sollwerte) sie hergeben. Die
  Thermostat-Card öffnet die Ansicht per `detail`-Zuordnung und hat als Tap-Default `more-info`;
- ab Engine `2.2.5` bedeutet die Aktion `default` beim Halten „automatische Detailansicht“: hat die
  Card für die Geste keine eigene Aktion (`handlers.default` liefert `undefined`), ruft
  `bindGestures` `vuePanel.showDetail({entity})`. Alle mitgelieferten Cards verhalten sich damit
  ohne Konfiguration wie `more-info` ohne Ziel; `light.html` hat deshalb keinen expliziten
  `hold`-Default mehr;
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
- Der Loader hält die HA-Adresszeile und die Engine-Route synchron: `route` → `routePath`/
  `vue-panel:route` in die Engine, `vue-panel:navigate` → `history.pushState`/`replaceState` +
  `location-changed` in HA. Deep-Links wie `/vue-test/uebersicht/wohnzimmer` funktionieren dadurch
  direkt im Browser.
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
`DashboardConfig { format, formatVersion, revision, settings?, bars?, views[] }` → `BarConfig` je Position (`sidebar-left|sidebar-right|header|bottom`) → `BarEntry { id, size, placement?, css?, columns[] }` → `BarColumn { id, sizeMode?, size?, padding?, margin?, align?, crossAlign?, cards[] }`; `ViewConfig { id, title, icon, path?, layout, layoutOptions?, subview?, background?, showSidebarLeft?, showSidebarRight?, showHeader?, showBottom?, padding?, margin?, width?, sections[] }` → `SectionConfig { id, columnSpan?, cardOrientation?, cardsPerRow?, padding?, margin?, cards[] }` (Abschnitte haben **kein** `title`/`icon` — Überschriften sind Cards vom Typ `vue-panel/section-title`) → `CardConfig { id, type, config, css?, size? }`. `ViewConfig.background` verwendet Home Assistants Hintergrundform mit `image` (vorzugsweise stabile `media-source://`-Referenz), `opacity`, `attachment`, `size`, `alignment` und `repeat`; alte String-Werte werden bis zum nächsten Speichern weiterhin dargestellt.
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
  room-tile, menu, entity und section-title, dazu die Dialog-Cards light-detail,
  thermostat-detail und weather-detail. Weather-detail lädt Tages- und Stundenwerte über `weather.get_forecasts`:
  Tageswerte zeigen einen gemeinsamen Min-/Max-Maßstab mit vertikalen Bereichsbalken,
  Stundenwerte einen horizontalen Zeitstrom mit Tageswechsel-Pills; beide zeigen Wettericon,
  Temperatur und Niederschlag. Der Kopf zeigt zustands- und tageszeitabhängige, lokal gebündelte
  Wetterillustrationen aus `weather-forecast-extended` mit Temperatur- und Zustandspille. Der
  180px hohe Head liegt direkt unter der normalen Dialog-Kopfzeile und reicht links/rechts ohne
  Innenabstand bis an den Dialogrand. Das Motiv liegt als 280px hohe Hintergrundebene hinter dem
  oberen Dialoginhalt und blendet nach unten transparent aus; der Dialog-Header bleibt unverändert.
  Die Bars sind Engine-Komponenten und keine Cards mehr.
- **Cards in Popups und Detailansichten**: `areas` enthält `dialog`. Solche Cards laufen nicht auf
  dem Dashboard, sondern in einem Popup oder einer Detailansicht und erhalten deren Werte über
  `vuePanel.context` sowie über `${variable}`-Platzhalter in ihren eigenen Instanzwerten. Das
  optionale Metadatenfeld `detail` (`card`, `entityKey`, `variables`) legt fest, welche
  Dialog-Card die Aktion `more-info` dieser Card öffnet. Details in §6a.
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
- **Platzierung zur Laufzeit**: Jede Card erfährt ihren Bereich (`dashboard`, `sidebar`, `header`,
  `bottom`, `dialog`) über `vuePanel.area` und als `data-vp-area` auf ihrem Scope-Element. Damit
  bringt eine Card ihre eigene Variante pro Platzierung mit, statt sie konfigurieren zu lassen —
  im CSS über `&[data-vp-area='sidebar'] …` (das `&` ist Pflicht, das Attribut sitzt am
  Scope-Element selbst). Der Wert ist je Instanz fest; Umhängen erzeugt eine neue Instanz.
- `fullRow: true` belegt eine ganze Abschnittszeile und ist im Flex-Layout nicht resizebar.
- **Per-Card-CSS**: `cardDefaultCss()` lädt bei portablen Cards das Stylesheet aus dem privaten
  Card-Dokument. Abweichungen liegen als `CardConfig.css` an der Instanz. Responsive-Regeln wirken
  am äußeren Slot; das übrige Override wird über `CardCss` an die Card-Runtime gereicht und ersetzt
  dort das Card-Stylesheet.
- **Responsive Sichtbarkeit jeder Card**: `CardConfigDialog` besitzt immer den Tab „Sichtbarkeit“ → Collapsible „Responsive Design“. Smartphone, Tablet und Desktop lassen sich einzeln aktivieren; `mobileMax` (Default 767px) und `tabletMax` (Default 1023px) sind frei einstellbar. `core/ui/responsiveCss.ts` schreibt die Auswahl unmittelbar als markierten Block `vue-panel:responsive:start/end` mit verschachtelten Media Queries in `CardConfig.css`. Der Block ist im CSS-Tab sichtbar; beim erneuten Öffnen wird die UI aus seinen JSON-Metadaten rekonstruiert. Manifeste können über `defaultResponsive` abweichende Card-Defaults vorgeben; die Sidebar-Bar ist dadurch auf Smartphones standardmäßig aus. Keine separaten Visibility-Felder im Datenmodell anlegen.

## 6. Theme-System (`src/theme/`)

- `src/theme/<themeName>/<Komponente>/` mit `index.vue` + `style.css`. Vorhanden: `default/{AddTile,BoxInput,Button,Card,Checkbox,CodeEditor,Collapsible,Dialog,Input,SelectMenu,Tabs,VariableCard,ViewSelectMenu}`. Der CodeEditor unterstützt CSS, HTML, JavaScript und JSON; nur CSS aktiviert den CSS-Linter. Der Theme-Dialog unterstützt zusätzlich `size="full"` für randlose Vollbild-Werkzeuge; Tab-Einträge können mit `align: 'end'` rechts ausgerichtet werden.
- **Collapsible** = aufklappbare Box zum Gruppieren von Einstellungen (`title`, `icon?`, `defaultOpen?` — **Default zu**, Default-Slot); Wrapper `@/core/ui/BaseCollapsible.vue`. Konvention: In jedem „Erweitert"-Tab liegen die Gruppen in Collapsibles, die **erste sichtbare** Box bekommt `default-open`.
- **BoxInput** = wiederverwendbares Vierseiten-Feld (Oben/Rechts/Unten/Links + Einheit + Ketten-Button) für Padding/Margin; Wrapper `@/core/ui/BaseBoxInput.vue`, Wert-Typ + Helfer in `@/core/ui/boxInput.ts`.
- **VariableCard** = wiederverwendbare, aufklappbare Hülle für einen Variablen-Schemaeintrag (`title`, `marker?`, `defaultOpen?`, `removeLabel`, `remove`-Event, Default-Slot); Wrapper `@/core/ui/BaseVariableCard.vue`. Die Löschaktion ist vom Toggle getrennt.
- **ViewSelectMenu** = auf Views spezialisiertes Dropdown statt des generischen SelectMenu (`modelValue` = View-`id`, `views`, `size`, `searchable`, `reorderable`; Events `update:modelValue` und `move`); Wrapper `@/core/ui/BaseViewSelectMenu.vue`, Typen und Helfer in `@/core/ui/viewSelect.ts`. Es rückt Unteransichten nach Pfadtiefe ein, markiert die oberste View als Standard-View mit `mdi:star` und verschiebt Views über die beiden Pfeile rechts (auch per Alt+↑/↓) via `store.moveView()`. Während einer Suche sind die Pfeile ausgeblendet, weil das Umsortieren einer gefilterten Liste mehrdeutig wäre. Verwendet in der Edit-Toolbar der AppShell.
- **Globales CSS pro Theme**: `src/theme/<themeName>/main.css` (Variablen, Scrollbars, Form-Basics). `loadGlobalStyles()` (registry) lädt IMMER zuerst `default/main.css` (Fallback), dann das `main.css` des aktiven Themes obendrauf. Aufruf in `main.ts`: einmal sofort, einmal nach `syncFromRemote()` (wenn `settings.uiTheme` bekannt ist). Es gibt keine `src/style.css` mehr.
- **CSS ist NICHT scoped**, sondern namespaced (`vp-card`, `vp-dialog`, `vp-btn`) — absichtlich, damit CSS-only-Themes überschreiben können. Komponenten importieren ihr CSS NICHT selbst; die Registry lädt es.
- Auflösung (`theme/registry.ts`, `themed('Card')`): Default-CSS immer zuerst → Theme-CSS obendrauf (falls vorhanden) → Theme-`index.vue` ersetzt Default-`index.vue`, sonst Fallback auf default.
- Verbraucher nutzen **immer die Wrapper** `@/core/ui/BaseCard|BaseDialog|BaseButton` (stabile Imports). Neue UI-Basiskomponente = Ordner in `theme/default/` + Wrapper in `core/ui/`. **Ausnahme: Cards** — sie stylen ihre Kachel selbst (siehe §5) und verwenden BaseCard nicht.
- Theme-Wahl: Dashboard-Einstellungen → `settings.uiTheme`; Wechsel macht `location.reload()` (Komponenten-Cache).
- Farbschema (dark/light/auto) ist davon getrennt: `settings.theme` → `useTheme()` setzt `<html data-theme>`.

## 6a. Popups & Detailansicht (`src/core/popups/`)

- `DashboardConfig.popups: PopupConfig[]` — global, unabhängig von Views. Ein `PopupConfig` hat
  `id`, `title`, `icon?`, `size?` (`sm|md|lg|full`), `width?`/`height?` (px), `css?`, `align?`,
  `padding?` und `sections[]`. Der Inhalt ist **wie eine Flex-View**: `PopupFrame.vue` baut aus dem
  Popup eine synthetische `ViewConfig` mit `layout: 'flex'` und rendert sie über `FlexLayout` mit
  `area="dialog"` — dadurch gilt die komplette `useSectionEditing`-Werkzeugleiste unverändert.
- Store: Views und Popups teilen sich alle Section-/Card-Actions. `sectionHost(id)` löst beide auf,
  alle Actions nehmen deshalb `hostId` statt `viewId`. Popup-Actions: `addPopup`, `updatePopup`,
  `removePopup`, `duplicatePopup`, `movePopup`; Getter `popups`, `popupById`.
- Verwaltung im Edit-Modus über den Toolbar-Button der AppShell → `PopupManagerDialog.vue`
  (Liste, sortieren, duplizieren, löschen, „Cards bearbeiten“) und `PopupSettingsDialog.vue`.
- Laufzeit: `popupService.ts` hält den Dialogstapel (`openPopup`, `openDetail`, `closePopup`),
  `PopupHost.vue` rendert ihn (einmal in der AppShell). Der Kontext wird über `popupContextKey`
  bereitgestellt; `resolvePlaceholders()` ersetzt `${key}` in Instanzwerten (reiner Platzhalter
  behält den Typ, gemischter Text wird interpoliert), `pickVariables()` schränkt die Übergabe ein.
- Detailauflösung (`openDetail`): Ziel der Tap-Action → `detail.card` der Card → Domain-Standard
  `vue-panel/<domain>-detail` (falls im Katalog) → eingebauter `EntityDetailFallback.vue`
  (Name, Status, Attribute). Die aufgelöste Entity liegt im Kontext immer unter `entity`.
- **Nicht verwechseln mit dem Dialog-Service unten**: der ist für Alert/Confirm/Prompt der Engine.

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
- **View-URLs**: Intern referenzieren Menü, room-tile & Co. immer die **View-`id`**; die URL nutzt `view.path` (Fallback: `id`) und darf hierarchisch sein, z. B. `uebersicht/wohnzimmer`. Helfer in `dashboardStore.ts`: `viewPath(view)`, `normalizeRoutePath(path)`, `slugify(title)`, `slugifyPath(path)`, Getter `viewByRoute(path)` und `defaultView`. Der Catch-all-Hash-Router akzeptiert beliebig viele Segmente. Der View-Dialog slugifiziert jedes Segment einzeln, erhält `/` und macht den vollständigen Pfad beim Speichern eindeutig; danach emittiert er `navigate`, damit die Route dem neuen Pfad folgt. **Die AppShell hält die URL immer auf dem Pfad der aktiven View** (`navigatePanel(path, { replace: true })`): leere oder unbekannte Pfade landen auf der Standard-View (= erste View der Liste), jede View ist damit direkt per URL aufrufbar. Der Redirect wartet auf `store.loaded`, damit ein Deep-Link nicht von der Platzhalter-Config überschrieben wird. Die Menu-Card markiert neben dem exakten Ziel (`active`) auch Pfad-Eltern (`active-parent`) und kennzeichnet Struktur über `parent`/`child`; Parent und Child sehen gleich aus, der Parent bekommt nur einen dezenten Rahmen, solange eine seiner Unteransichten aktiv ist. `CardRuntime` benachrichtigt `subscribeNavigation` auch bei Änderungen an der View-Liste (Reihenfolge, Titel, Icon, Pfad).
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
- [ ] Weitere Detail-Cards je Domain (`vue-panel/<domain>-detail`, bisher `light` und `weather`).
- [ ] Weitere Cards (z.B. Kamera, Verlaufs-Graph, Szenen/Buttons, Alarm).
- [ ] Beispiel-Custom-Theme als Vorlage.
- [ ] `size.rows` wird noch nicht ausgewertet (nur `cols` als grid-column span).
- [x] Wetter-Forecast über `weather.get_forecasts` mit Tages-/Stundenumschaltung.
