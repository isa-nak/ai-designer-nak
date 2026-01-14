/**
 * Font utility functions for weight/style conversion
 */

/**
 * Mapping of font weight numbers to style names
 */
export const FONT_WEIGHT_TO_STYLE: Record<number, string> = {
  100: 'Thin',
  200: 'ExtraLight',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
  800: 'ExtraBold',
  900: 'Black',
}

/**
 * Mapping of font style names to weight numbers
 */
export const FONT_STYLE_TO_WEIGHT: Record<string, number> = {
  'Thin': 100,
  'Hairline': 100,
  'ExtraLight': 200,
  'UltraLight': 200,
  'Light': 300,
  'Regular': 400,
  'Normal': 400,
  'Medium': 500,
  'SemiBold': 600,
  'DemiBold': 600,
  'Bold': 700,
  'ExtraBold': 800,
  'UltraBold': 800,
  'Black': 900,
  'Heavy': 900,
}

/**
 * Get font style name from weight number
 */
export function getFontStyle(weight: number): string {
  return FONT_WEIGHT_TO_STYLE[weight] || 'Regular'
}

/**
 * Get font weight number from style name
 */
export function getFontWeight(style: string): number {
  // Try exact match first
  if (FONT_STYLE_TO_WEIGHT[style] !== undefined) {
    return FONT_STYLE_TO_WEIGHT[style]
  }

  // Try case-insensitive match
  const styleLower = style.toLowerCase()
  for (const [key, value] of Object.entries(FONT_STYLE_TO_WEIGHT)) {
    if (key.toLowerCase() === styleLower) {
      return value
    }
  }

  // Default to Regular
  return 400
}

/**
 * Common safe fonts that are available in Figma
 */
export const SAFE_FONTS = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Source Sans Pro',
  'Nunito',
  'Raleway',
  'Ubuntu',
]

/**
 * Default fallback font
 */
export const DEFAULT_FONT = 'Inter'
export const DEFAULT_FONT_STYLE = 'Regular'
export const DEFAULT_FONT_WEIGHT = 400
