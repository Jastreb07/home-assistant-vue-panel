"""One-off helper: give the weather detail card a condition-coloured sky."""

import io

PATH = "custom_components/vue_panel/bundled_cards/vue-panel/weather-detail/index.html"
source = io.open(PATH, encoding="utf-8").read()

# ── Root gets the sky, and the whole card turns to light-on-dark ──────
OLD_ROOT = """    .wd {
        display: flex;
        flex-direction: column;
        gap: 18px;
        width: 100%;
        color: var(--text-primary)
    }
"""
NEW_ROOT = """    /*
     * The card fills the whole dialog and paints its own sky, so it also
     * brings the padding the dialog would otherwise provide.
     */
    .wd {
        position: relative;
        isolation: isolate;
        display: flex;
        flex-direction: column;
        gap: 18px;
        width: 100%;
        min-height: 100%;
        padding: 22px 24px 20px;
        color: #fff
    }

    /*
     * Sky behind everything, drawn from two gradients: a vertical one for the
     * time of day and a soft radial highlight where the light comes from.
     * Purely CSS — no image has to be fetched, and it stays sharp at any size.
     */
    .wd::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        background:
            radial-gradient(120% 80% at var(--wd-glow-x, 78%) var(--wd-glow-y, 12%),
            var(--wd-glow, rgba(255, 255, 255, .32)) 0%, transparent 60%),
            linear-gradient(180deg, var(--wd-sky-top, #33506e) 0%, var(--wd-sky-bottom, #7d93ab) 100%);
        transition: background .5s ease
    }

    /* ── One palette per weather state ── */
    .wd[data-condition='sunny'] {
        --wd-sky-top: #2f7fd4;
        --wd-sky-bottom: #9ed2f5;
        --wd-glow: rgba(255, 214, 130, .85)
    }

    .wd[data-condition='clear-night'] {
        --wd-sky-top: #0d1633;
        --wd-sky-bottom: #33406b;
        --wd-glow: rgba(180, 198, 255, .35);
        --wd-glow-x: 80%;
        --wd-glow-y: 18%
    }

    .wd[data-condition='partlycloudy'] {
        --wd-sky-top: #3a72b0;
        --wd-sky-bottom: #adc6dc;
        --wd-glow: rgba(255, 226, 165, .6)
    }

    .wd[data-condition='cloudy'] {
        --wd-sky-top: #4a5b६e;
        --wd-sky-bottom: #93a3b4;
        --wd-glow: rgba(255, 255, 255, .3)
    }

    .wd[data-condition='fog'] {
        --wd-sky-top: #5d6870;
        --wd-sky-bottom: #b3bcc2;
        --wd-glow: rgba(255, 255, 255, .38);
        --wd-glow-x: 50%;
        --wd-glow-y: 55%
    }

    .wd[data-condition='rainy'] {
        --wd-sky-top: #2d3f57;
        --wd-sky-bottom: #6e8298;
        --wd-glow: rgba(190, 215, 240, .28)
    }

    .wd[data-condition='pouring'] {
        --wd-sky-top: #1e2c3d;
        --wd-sky-bottom: #4f6579;
        --wd-glow: rgba(170, 200, 230, .22)
    }

    .wd[data-condition='snowy'],
    .wd[data-condition='snowy-rainy'],
    .wd[data-condition='hail'] {
        --wd-sky-top: #5a6b80;
        --wd-sky-bottom: #c2ccd8;
        --wd-glow: rgba(255, 255, 255, .45)
    }

    .wd[data-condition='lightning'],
    .wd[data-condition='lightning-rainy'] {
        --wd-sky-top: #241d3a;
        --wd-sky-bottom: #4d4a6b;
        --wd-glow: rgba(240, 214, 120, .3)
    }

    .wd[data-condition='windy'],
    .wd[data-condition='windy-variant'] {
        --wd-sky-top: #38606b;
        --wd-sky-bottom: #a3bcbd;
        --wd-glow: rgba(255, 255, 255, .32)
    }

    .wd[data-condition='exceptional'] {
        --wd-sky-top: #6b2f24;
        --wd-sky-bottom: #c98a63;
        --wd-glow: rgba(255, 200, 140, .4)
    }
"""
assert OLD_ROOT in source
source = source.replace(OLD_ROOT, NEW_ROOT, 1)

# ── Text and dividers now sit on the sky ─────────────────────────────
REPLACEMENTS = [
    (
        """    .wd-updated {
        margin: 2px 0 0;
        color: var(--text-secondary);
        font-size: 12px;
        line-height: 1.2
    }""",
        """    .wd-updated {
        margin: 2px 0 0;
        color: rgba(255, 255, 255, .78);
        font-size: 12px;
        line-height: 1.2
    }""",
    ),
    (
        """    .wd-range {
        margin-top: 2px;
        color: var(--text-secondary);
        font-size: 12px;
        white-space: nowrap
    }""",
        """    .wd-range {
        margin-top: 2px;
        color: rgba(255, 255, 255, .78);
        font-size: 12px;
        white-space: nowrap
    }""",
    ),
    (
        """    .wd-tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        border-bottom: 1px solid var(--divider);
        margin-bottom: 14px
    }""",
        """    .wd-tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        border-bottom: 1px solid rgba(255, 255, 255, .25);
        margin-bottom: 14px
    }""",
    ),
    (
        """    .wd-tab {
        border: 0;
        border-bottom: 2px solid transparent;
        padding: 10px 4px;
        background: transparent;
        color: var(--text-secondary);""",
        """    .wd-tab {
        border: 0;
        border-bottom: 2px solid transparent;
        padding: 10px 4px;
        background: transparent;
        color: rgba(255, 255, 255, .72);""",
    ),
    (
        """    .wd-tab:hover {
        color: var(--text-primary)
    }

    .wd-tab.is-active {
        color: var(--accent);
        border-bottom-color: var(--accent)
    }""",
        """    .wd-tab:hover {
        color: #fff
    }

    .wd-tab.is-active {
        color: #fff;
        border-bottom-color: #fff
    }""",
    ),
    (
        """    .wd-forecast-low {
        color: var(--text-secondary);
        font-size: 12px;
        font-variant-numeric: tabular-nums
    }""",
        """    .wd-forecast-low {
        color: rgba(255, 255, 255, .72);
        font-size: 12px;
        font-variant-numeric: tabular-nums
    }""",
    ),
    (
        """    .wd-empty {
        margin: 0;
        color: var(--text-secondary);
        font-size: 12px
    }""",
        """    .wd-empty {
        margin: 0;
        color: rgba(255, 255, 255, .78);
        font-size: 12px
    }""",
    ),
    (
        """    .wd-attribution {
        margin: 0;
        color: var(--text-secondary);
        font-size: 11px;
        line-height: 1.35
    }""",
        """    .wd-attribution {
        margin: 0;
        color: rgba(255, 255, 255, .62);
        font-size: 11px;
        line-height: 1.35
    }""",
    ),
    (
        """    .wd-forecast-day {
        min-height: 16px;
        color: var(--text-primary);
        font-size: 12px;
        line-height: 16px;
        align-self: flex-start
    }""",
        """    .wd-forecast-day {
        min-height: 16px;
        color: #fff;
        font-size: 12px;
        line-height: 16px;
        align-self: flex-start
    }""",
    ),
]
for old, new in REPLACEMENTS:
    assert old in source, old[:60]
    source = source.replace(old, new, 1)

# ── The condition drives the palette ─────────────────────────────────
OLD_SET = """    setIcon(icon, state || 'unknown', iconUrl(state));"""
NEW_SET = """    /* Picks the sky palette; an unknown state keeps the neutral default */
    document.getElementById('card').dataset.condition = animatedIcons[state] ? state : '';

    setIcon(icon, state || 'unknown', iconUrl(state));"""
assert OLD_SET in source
source = source.replace(OLD_SET, NEW_SET, 1)

io.open(PATH, "w", encoding="utf-8", newline="\n").write(source)
print("sky added")
