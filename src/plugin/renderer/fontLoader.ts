/**
 * Font loading utilities
 */

import { getFontStyle } from '../../shared/utils/fonts'
import { loadedFonts } from './styleCache'

export { getFontStyle }

// Load a font and return the actually loaded font
export async function loadFont(family: string, style: string): Promise<FontName> {
  const fontKey = `${family}-${style}`

  // Check if already loaded
  if (loadedFonts.has(fontKey)) {
    return { family, style }
  }

  try {
    await figma.loadFontAsync({ family, style })
    loadedFonts.add(fontKey)
    return { family, style }
  } catch {
    // Try Inter with same style
    if (family !== 'Inter') {
      try {
        await figma.loadFontAsync({ family: 'Inter', style })
        loadedFonts.add(`Inter-${style}`)
        return { family: 'Inter', style }
      } catch {
        // Fallback to Inter Regular
      }
    }

    // Final fallback: Inter Regular
    try {
      await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
      loadedFonts.add('Inter-Regular')
    } catch {
      // Inter Regular should always be available
    }
    return { family: 'Inter', style: 'Regular' }
  }
}
