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
  const visibility = normalizeVisibility({ ...defaultResponsiveVisibility, ...value })
  return visibility[deviceForWidth(width, visibility)]
}

export function normalizeVisibility(value: ResponsiveVisibility): ResponsiveVisibility {
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

/**
 * The `@media` rules that hide a card/bar outside its visible device
 * classes — generated at render time from the structured visibility field,
 * never mixed into the user's own CSS. Relies on native CSS nesting (`&`)
 * referring to the selector it gets embedded into (see CardCss.vue).
 */
export function visibilityMediaCss(value: ResponsiveVisibility | undefined): string {
  const visibility = normalizeVisibility({ ...defaultResponsiveVisibility, ...value })
  const usesDefaults = visibility.mobile && visibility.tablet && visibility.desktop
    && visibility.mobileMax === defaultResponsiveVisibility.mobileMax
    && visibility.tabletMax === defaultResponsiveVisibility.tabletMax
  if (usesDefaults) return ''

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
  return rules.join('\n')
}
