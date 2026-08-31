# Meteocons

Animated weather icons by [Bas Milius](https://bas.dev), MIT licensed — see
`LICENSE` in this folder.

- Source: <https://meteocons.com>
- Package: `@meteocons/svg` version `0.1.0`, `fill` style
- Files: `https://unpkg.com/@meteocons/svg@0.1.0/fill/<name>.svg`

Only the icons the weather card maps to a Home Assistant weather state are
kept here. To update, download the same file names from a newer version of the
package and replace them; nothing else references these files by content.

The SVGs animate through native `<animate>` elements, so they play inside a
plain `<img>` without any script.
