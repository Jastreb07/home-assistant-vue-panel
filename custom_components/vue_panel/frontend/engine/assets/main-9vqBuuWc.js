var e=`/* ─────────────────────────────────────────────────────────────\r
   Global stylesheet of the "default" theme.\r
   Every theme may ship its own main.css; the default theme's\r
   main.css is ALWAYS loaded first as a fallback, the active\r
   theme's main.css (if any) is loaded on top.\r
   ───────────────────────────────────────────────────────────── */\r
\r
/* Theme variables — dark is the default theme */\r
:root,\r
:host {\r
  --bg: #14161a;\r
  --nav-bg: #1b1e24;\r
  --card-bg: #23272f;\r
  --card-bg-active: #f5b82e;\r
  --card-radius: 18px;
  --card-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  --tile-icon-offset-x: -4px;
  --tile-icon-offset-y: -4px;
  --text-primary: #eceff4;\r
  --text-secondary: #9aa3b2;\r
  --text-on-active: #1b1e24;\r
  --divider: #323844;\r
  --nav-item-hover: rgba(255, 255, 255, 0.06);\r
  --nav-item-active: rgba(255, 255, 255, 0.12);\r
  --accent: #f5b82e;\r
  --scrollbar-track: transparent;\r
  --scrollbar-thumb: #3a4150;\r
  --scrollbar-thumb-hover: #4a5365;\r
  /* Code editor syntax colors */\r
  --code-comment: #6b7280;\r
  --code-selector: #7fd1c1;\r
  --code-property: #9ecbff;\r
  --code-string: #e5c07b;\r
  --code-number: #d19a66;\r
  --code-keyword: #c792ea;\r
  --code-function: #82aaff;\r
  --code-invalid: #e0706f;\r
}\r
\r
[data-theme='light'],\r
:host([data-theme='light']),\r
:host-context([data-theme='light']) {\r
  --bg: #f2f4f8;\r
  --nav-bg: #ffffff;\r
  --card-bg: #ffffff;\r
  --card-bg-active: #f5b82e;\r
  --card-shadow: 0 2px 8px rgba(30, 40, 60, 0.1);\r
  --text-primary: #1c2330;\r
  --text-secondary: #5c6675;\r
  --text-on-active: #1b1e24;\r
  --divider: #d8dde6;\r
  --nav-item-hover: rgba(0, 0, 0, 0.05);\r
  --nav-item-active: rgba(0, 0, 0, 0.09);\r
  --accent: #e0a416;\r
  --scrollbar-thumb: #c3cad6;\r
  --scrollbar-thumb-hover: #a9b2c2;\r
  --code-comment: #8a94a6;\r
  --code-selector: #1a7f6b;\r
  --code-property: #1e5eb8;\r
  --code-string: #a15c00;\r
  --code-number: #b5480d;\r
  --code-keyword: #8250df;\r
  --code-function: #0550ae;\r
  --code-invalid: #b3403f;\r
}\r
\r
/* ── Shared control size scale (Nuxt UI-like) ──────────────────\r
   One source of truth for Button, Input and SelectMenu so all\r
   controls line up. Components set \`vp-size-<size>\` on their root\r
   and read the tokens below — a CSS-only theme can rescale\r
   everything by overriding just these classes. */\r
.vp-size-xs {\r
  --vp-control-height: 26px;\r
  --vp-control-font: 12px;\r
  --vp-control-pad-x: 8px;\r
  --vp-control-radius: 8px;\r
  --vp-control-icon: 14px;\r
}\r
.vp-size-sm {\r
  --vp-control-height: 32px;\r
  --vp-control-font: 13px;\r
  --vp-control-pad-x: 10px;\r
  --vp-control-radius: 8px;\r
  --vp-control-icon: 16px;\r
}\r
.vp-size-md {\r
  --vp-control-height: 40px;\r
  --vp-control-font: 14px;\r
  --vp-control-pad-x: 12px;\r
  --vp-control-radius: 10px;\r
  --vp-control-icon: 22px;\r
}\r
.vp-size-lg {\r
  --vp-control-height: 48px;\r
  --vp-control-font: 15px;\r
  --vp-control-pad-x: 14px;\r
  --vp-control-radius: 10px;\r
  --vp-control-icon: 24px;\r
}\r
.vp-size-xl {\r
  --vp-control-height: 56px;\r
  --vp-control-font: 16px;\r
  --vp-control-pad-x: 16px;\r
  --vp-control-radius: 12px;\r
  --vp-control-icon: 26px;\r
}\r
\r
* {\r
  box-sizing: border-box;\r
}\r
\r
html,\r
body,\r
#app {\r
  height: 100%;\r
  margin: 0;\r
}\r
\r
body,\r
:host {\r
  background: var(--bg);\r
  color: var(--text-primary);\r
  font-family:\r
    'Segoe UI',\r
    system-ui,\r
    -apple-system,\r
    Roboto,\r
    sans-serif;\r
  -webkit-font-smoothing: antialiased;\r
  overscroll-behavior: none;\r
}\r
\r
button {
  font-family: inherit;
}

/* Keep the leading tile icon aligned consistently across portable cards. */
[data-vp-card-scope] .tile__icon {
  translate: var(--tile-icon-offset-x) var(--tile-icon-offset-y);
}

/* ── Scrollbars (match the theme design) ── */
* {\r
  scrollbar-width: thin; /* Firefox */\r
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);\r
}\r
::-webkit-scrollbar {\r
  width: 8px;\r
  height: 8px;\r
}\r
::-webkit-scrollbar-track {\r
  background: var(--scrollbar-track);\r
}\r
::-webkit-scrollbar-thumb {\r
  background: var(--scrollbar-thumb);\r
  border-radius: 8px;\r
}\r
::-webkit-scrollbar-thumb:hover {\r
  background: var(--scrollbar-thumb-hover);\r
}\r
::-webkit-scrollbar-corner {\r
  background: transparent;\r
}\r
\r
/*\r
 * Touch devices — phones and tablets — hide their scrollbars natively and\r
 * scroll by dragging, so a permanently visible bar only eats space and looks\r
 * out of place. Keyed on the input method rather than the viewport width: a\r
 * narrow desktop window still has a mouse and still needs its scrollbar.\r
 * Scrolling itself is untouched, only the indicator goes away.\r
 */\r
@media (hover: none) and (pointer: coarse) {\r
  * {\r
    scrollbar-width: none; /* Firefox */\r
    -ms-overflow-style: none; /* legacy Edge */\r
  }\r
  ::-webkit-scrollbar {\r
    width: 0;\r
    height: 0;\r
  }\r
}\r
\r
/* ── Base form styles (editor dialogs) ── */\r
input[type='text'],\r
input[type='number'],\r
input:not([type]),\r
select {\r
  background: var(--card-bg);\r
  border: 1px solid var(--divider);\r
  border-radius: 10px;\r
  color: var(--text-primary);\r
  padding: 10px 12px;\r
  font-size: 14px;\r
  font-family: inherit;\r
  outline: none;\r
}\r
input:focus,\r
select:focus {\r
  border-color: var(--accent);\r
}\r
`;export{e as default};