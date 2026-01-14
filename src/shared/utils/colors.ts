/**
 * Color utility functions for converting between hex and RGB formats
 */

export interface RGB {
  r: number
  g: number
  b: number
}

export interface RGBA extends RGB {
  a: number
}

/**
 * Convert hex color string to RGB (0-1 range for Figma)
 */
export function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return {
      r: Math.round((parseInt(result[1], 16) / 255) * 100) / 100,
      g: Math.round((parseInt(result[2], 16) / 255) * 100) / 100,
      b: Math.round((parseInt(result[3], 16) / 255) * 100) / 100,
    }
  }
  return { r: 0, g: 0, b: 0 }
}

/**
 * Convert RGB (0-1 range) to hex color string
 */
export function rgbToHex(color: RGB): string {
  const r = Math.round(color.r * 255)
  const g = Math.round(color.g * 255)
  const b = Math.round(color.b * 255)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * Format color for display in prompts (shows both RGB and hex)
 */
export function formatColorForPrompt(hex: string): string {
  const rgb = hexToRgb(hex)
  return `{ "r": ${rgb.r}, "g": ${rgb.g}, "b": ${rgb.b} } (${hex})`
}

/**
 * Validate hex color format
 */
export function isValidHex(hex: string): boolean {
  return /^#?([a-f\d]{3}|[a-f\d]{6})$/i.test(hex)
}

/**
 * Normalize hex color (ensure # prefix, expand shorthand)
 */
export function normalizeHex(hex: string): string {
  let normalized = hex.startsWith('#') ? hex : `#${hex}`

  // Expand shorthand (e.g., #ABC -> #AABBCC)
  if (normalized.length === 4) {
    normalized = `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
  }

  return normalized.toUpperCase()
}
