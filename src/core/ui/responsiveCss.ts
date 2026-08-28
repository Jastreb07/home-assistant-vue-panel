export interface ResponsiveVisibility {
  mobile: boolean
  tablet: boolean
  desktop: boolean
  mobileMax: number
  tabletMax: number
}

export const defaultResponsiveVisibility: ResponsiveVisibility = {
  mobile: true,
  tablet: true,
  desktop: true,
  mobileMax: 767,
  tabletMax: 1023,
}

/** Which of the three device classes a viewport width falls into. */
export function deviceForWidth(
  width: number,
  value: ResponsiveVisibility = defaultResponsiveVisibility,
): 'mobile' | 'tablet' | 'desktop' {
  if (width <= value.mobileMax) return 'mobile'
  return width <= value.tabletMax ? 'tablet' : 'desktop'
}

/** True when a bar/card with this visibility is shown at the given width. */
export function matchesViewport(
  value: ResponsiveVisibility | undefined,
  width: number,
): boolean {
  const visibility = normalized({ ...defaultResponsiveVisibility, ...value })
  return visibility[deviceForWidth(width, visibility)]
}

const START = '/* vue-panel:responsive:start'
const END = '/* vue-panel:responsive:end */'
const BLOCK_RE = /\/\* vue-panel:responsive:start\s*\n([\s\S]*?)\n\*\/[\s\S]*?\/\* vue-panel:responsive:end \*\//g

function normalized(value: ResponsiveVisibility): ResponsiveVisibility {
  const mobileMax = Math.min(Math.max(Math.round(Number(value.mobileMax) || 767), 320), 2000)
  const tabletMax = Math.min(
    Math.max(Math.round(Number(value.tabletMax) || 1023), mobileMax + 1),
    4000,
  )
  return {
    mobile: value.mobile !== false,
    tablet: value.tablet !== false,
    desktop: value.desktop !== false,
    mobileMax,
    tabletMax,
  }
}

export function responsiveVisibilityFromCss(css: string): ResponsiveVisibility {
  const match = [...css.matchAll(BLOCK_RE)][0]
  if (!match?.[1]) return { ...defaultResponsiveVisibility }
  try {
    const saved = JSON.parse(match[1]) as Partial<ResponsiveVisibility>
    return normalized({ ...defaultResponsiveVisibility, ...saved })
  } catch {
    return { ...defaultResponsiveVisibility }
  }
}

export function withoutResponsiveCss(css: string): string {
  return css.replace(BLOCK_RE, '').trimEnd()
}

/**
 * A card hidden on the current device would otherwise vanish while editing
 * it — strip its responsive-visibility rules (and only those; any other
 * custom CSS in the same string is left untouched) so edit mode always shows
 * every card.
 */
export function editableCardCss(css: string, editMode: boolean): string {
  return editMode ? withoutResponsiveCss(css) : css
}

export function withResponsiveCss(css: string, value: ResponsiveVisibility): string {
  const visibility = normalized(value)
  const base = withoutResponsiveCss(css)
  const usesDefaults = visibility.mobile && visibility.tablet && visibility.desktop
    && visibility.mobileMax === defaultResponsiveVisibility.mobileMax
    && visibility.tabletMax === defaultResponsiveVisibility.tabletMax
  if (usesDefaults) return base

  const rules: string[] = []
  if (!visibility.mobile) {
    rules.push(`@media (max-width: ${visibility.mobileMax}px) {\n  & { display: none !important; }\n}`)
  }
  if (!visibility.tablet) {
    rules.push(
      `@media (min-width: ${visibility.mobileMax + 1}px) and (max-width: ${visibility.tabletMax}px) {\n  & { display: none !important; }\n}`,
    )
  }
  if (!visibility.desktop) {
    rules.push(`@media (min-width: ${visibility.tabletMax + 1}px) {\n  & { display: none !important; }\n}`)
  }

  const metadata = JSON.stringify(visibility)
  const block = `${START}\n${metadata}\n*/${rules.length ? `\n${rules.join('\n')}` : ''}\n${END}`
  return `${base}${base ? '\n\n' : ''}${block}`
}
