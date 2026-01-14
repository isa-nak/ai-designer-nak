/**
 * Style and variable caching for the renderer
 */

// Cache for loaded fonts
export const loadedFonts = new Set<string>()

// Cache for looked up styles and variables
let textStyleCache: Map<string, TextStyle> | null = null
let colorVariableCache: Map<string, Variable> | null = null
let spacingVariableCache: Map<string, Variable> | null = null

// Initialize caches from design system
export async function initializeCaches(): Promise<void> {
  // Cache text styles
  textStyleCache = new Map()
  try {
    const textStyles = await figma.getLocalTextStylesAsync()
    for (const style of textStyles) {
      textStyleCache.set(style.name, style)
      // Also add without slashes for flexible matching
      const simpleName = style.name.split('/').pop() || style.name
      if (!textStyleCache.has(simpleName)) {
        textStyleCache.set(simpleName, style)
      }
    }
  } catch (e) {
    console.log('Could not load text styles:', e)
  }

  // Cache color and spacing variables
  colorVariableCache = new Map()
  spacingVariableCache = new Map()
  try {
    const collections = await figma.variables.getLocalVariableCollectionsAsync()
    for (const collection of collections) {
      for (const variableId of collection.variableIds) {
        const variable = await figma.variables.getVariableByIdAsync(variableId)
        if (!variable) continue

        if (variable.resolvedType === 'COLOR') {
          colorVariableCache.set(variable.name, variable)
          // Also add with collection prefix
          colorVariableCache.set(`${collection.name}/${variable.name}`, variable)
        } else if (variable.resolvedType === 'FLOAT') {
          spacingVariableCache.set(variable.name, variable)
          spacingVariableCache.set(`${collection.name}/${variable.name}`, variable)
        }
      }
    }
  } catch (e) {
    console.log('Could not load variables:', e)
  }
}

// Find text style by name (flexible matching)
export function findTextStyle(name: string): TextStyle | null {
  if (!textStyleCache) return null

  // Try exact match
  if (textStyleCache.has(name)) {
    return textStyleCache.get(name)!
  }

  // Try case-insensitive match
  const nameLower = name.toLowerCase()
  for (const [key, style] of textStyleCache) {
    if (key.toLowerCase() === nameLower) {
      return style
    }
  }

  // Try partial match (e.g., "Body" matches "Typography/Body/Regular")
  for (const [key, style] of textStyleCache) {
    if (key.toLowerCase().includes(nameLower) || nameLower.includes(key.toLowerCase())) {
      return style
    }
  }

  return null
}

// Find color variable by name (flexible matching)
export function findColorVariable(name: string): Variable | null {
  if (!colorVariableCache) return null

  // Try exact match
  if (colorVariableCache.has(name)) {
    return colorVariableCache.get(name)!
  }

  // Try case-insensitive match
  const nameLower = name.toLowerCase()
  for (const [key, variable] of colorVariableCache) {
    if (key.toLowerCase() === nameLower) {
      return variable
    }
  }

  // Try partial match
  for (const [key, variable] of colorVariableCache) {
    if (key.toLowerCase().includes(nameLower) || nameLower.includes(key.toLowerCase())) {
      return variable
    }
  }

  return null
}

// Find spacing variable by name
export function findSpacingVariable(name: string): Variable | null {
  if (!spacingVariableCache) return null

  if (spacingVariableCache.has(name)) {
    return spacingVariableCache.get(name)!
  }

  const nameLower = name.toLowerCase()
  for (const [key, variable] of spacingVariableCache) {
    if (key.toLowerCase() === nameLower || key.toLowerCase().includes(nameLower)) {
      return variable
    }
  }

  return null
}
