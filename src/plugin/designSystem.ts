/**
 * Design System Extractor
 *
 * Extracts semantic tokens (color, spacing) and text styles from the Figma file.
 * PRIORITIZES tokens (aliases) over primitives for AI generation.
 */

import type { DesignSystemContext, VariableInfo } from '../shared/types'
import { rgbToHex } from '../shared/utils/colors'
import { getFontWeight } from '../shared/utils/fonts'
import { DESIGN_SYSTEM_LIMITS } from '../shared/constants'

/**
 * Extract the complete design system from the current Figma file
 */
export async function extractDesignSystem(): Promise<DesignSystemContext> {
  const [colorVariables, spacingVariables] = await extractVariables()
  const textStyles = await extractTextStyles()
  const components = await extractComponents()

  return { colorVariables, spacingVariables, textStyles, components }
}

/**
 * Check if a variable value is an alias (references another variable)
 */
function isVariableAlias(value: unknown): value is VariableAlias {
  return typeof value === 'object' && value !== null && 'type' in value && (value as VariableAlias).type === 'VARIABLE_ALIAS'
}

/**
 * Check if a collection name suggests it contains semantic tokens vs primitives.
 * Specifically looks for collection named "Tokens" first, then falls back to patterns.
 */
function isTokenCollection(collectionName: string): boolean {
  const name = collectionName.toLowerCase()

  // Exact match for "Tokens" collection (highest priority)
  if (name === 'tokens' || name === 'token') {
    return true
  }

  // Primitive collection patterns (NOT tokens)
  const primitivePatterns = ['primitive', 'base', 'core', 'foundation', 'scale', 'palette', 'brand']
  if (primitivePatterns.some(p => name.includes(p))) {
    return false
  }

  // Token collection patterns
  const tokenPatterns = ['semantic', 'token', 'theme', 'alias', 'component']
  if (tokenPatterns.some(p => name.includes(p))) {
    return true
  }

  // Default: NOT a token collection (be conservative)
  return false
}

/**
 * Check if a variable name suggests it's a semantic token vs primitive.
 * Semantic tokens usually have names like "Background/Primary", "Text/Secondary"
 * Primitives usually have names like "Blue/500", "Gray/100"
 */
function isSemanticVariableName(variableName: string): boolean {
  const name = variableName.toLowerCase()

  // Semantic naming patterns
  const semanticPatterns = [
    'background', 'surface', 'text', 'foreground', 'border', 'stroke',
    'action', 'button', 'input', 'card', 'modal', 'overlay',
    'primary', 'secondary', 'tertiary', 'success', 'error', 'warning', 'info',
    'disabled', 'hover', 'pressed', 'focused', 'active', 'selected'
  ]

  return semanticPatterns.some(p => name.includes(p))
}

/**
 * Get the resolved color value from a variable, following alias chains
 */
async function resolveColorValue(variable: Variable): Promise<RGB | null> {
  const modeId = Object.keys(variable.valuesByMode)[0]
  let value = variable.valuesByMode[modeId]

  // Follow alias chain to get final color
  let depth = 0
  while (isVariableAlias(value) && depth < 10) {
    const aliasedVar = await figma.variables.getVariableByIdAsync(value.id)
    if (!aliasedVar) break
    const aliasModeId = Object.keys(aliasedVar.valuesByMode)[0]
    value = aliasedVar.valuesByMode[aliasModeId]
    depth++
  }

  if (typeof value === 'object' && value !== null && 'r' in value) {
    return value as RGB
  }
  return null
}

/**
 * Get the resolved number value from a variable, following alias chains
 */
async function resolveNumberValue(variable: Variable): Promise<number | null> {
  const modeId = Object.keys(variable.valuesByMode)[0]
  let value = variable.valuesByMode[modeId]

  // Follow alias chain to get final number
  let depth = 0
  while (isVariableAlias(value) && depth < 10) {
    const aliasedVar = await figma.variables.getVariableByIdAsync(value.id)
    if (!aliasedVar) break
    const aliasModeId = Object.keys(aliasedVar.valuesByMode)[0]
    value = aliasedVar.valuesByMode[aliasModeId]
    depth++
  }

  if (typeof value === 'number') {
    return value
  }
  return null
}

/**
 * Extract color and spacing variables, prioritizing TOKENS over primitives.
 * Token detection uses multiple heuristics:
 * 1. Variable value is an alias (references another variable)
 * 2. Collection name suggests semantic tokens (e.g., "Semantic", "Tokens")
 * 3. Variable name follows semantic patterns (e.g., "Background/Primary")
 */
async function extractVariables(): Promise<[
  DesignSystemContext['colorVariables'],
  DesignSystemContext['spacingVariables']
]> {
  const colorTokens: VariableInfo[] = []
  const colorPrimitives: VariableInfo[] = []
  const spacingTokens: VariableInfo[] = []
  const spacingPrimitives: VariableInfo[] = []

  try {
    const collections = await figma.variables.getLocalVariableCollectionsAsync()
    console.log(`Found ${collections.length} variable collections:`, collections.map(c => c.name))

    for (const collection of collections) {
      const collectionIsTokens = isTokenCollection(collection.name)

      for (const variableId of collection.variableIds) {
        const variable = await figma.variables.getVariableByIdAsync(variableId)
        if (!variable) continue

        const modeId = Object.keys(variable.valuesByMode)[0]
        const rawValue = variable.valuesByMode[modeId]

        // Determine if this is a token:
        // 1. If collection is named "Tokens", ALL variables in it are tokens
        // 2. Or if the value is an alias (references another variable)
        // 3. Or if collection is semantic AND variable name is semantic
        const valueIsAlias = isVariableAlias(rawValue)
        const nameIsSemantic = isSemanticVariableName(variable.name)
        const isToken = collectionIsTokens || valueIsAlias || nameIsSemantic

        if (variable.resolvedType === 'COLOR') {
          const resolvedColor = await resolveColorValue(variable)
          if (resolvedColor) {
            const colorInfo: VariableInfo = {
              id: variable.id,
              name: variable.name,
              collection: collection.name,
              value: rgbToHex(resolvedColor),
              isToken,
              description: variable.description || undefined
            }

            if (isToken) {
              colorTokens.push(colorInfo)
            } else {
              colorPrimitives.push(colorInfo)
            }
          }
        } else if (variable.resolvedType === 'FLOAT') {
          const resolvedNumber = await resolveNumberValue(variable)
          if (resolvedNumber !== null) {
            const spacingInfo: VariableInfo = {
              id: variable.id,
              name: variable.name,
              collection: collection.name,
              value: resolvedNumber,
              isToken,
              description: variable.description || undefined
            }

            if (isToken) {
              spacingTokens.push(spacingInfo)
            } else {
              spacingPrimitives.push(spacingInfo)
            }
          }
        }
      }
    }
  } catch (e) {
    console.log('Could not extract variables:', e)
  }

  // Prioritize tokens over primitives
  // If we have tokens, use them; otherwise fall back to primitives
  const colorVariables = colorTokens.length > 0
    ? colorTokens.slice(0, DESIGN_SYSTEM_LIMITS.MAX_COLOR_VARIABLES)
    : colorPrimitives.slice(0, DESIGN_SYSTEM_LIMITS.MAX_COLOR_VARIABLES)

  const spacingVariables = spacingTokens.length > 0
    ? spacingTokens.slice(0, DESIGN_SYSTEM_LIMITS.MAX_SPACING_VARIABLES)
    : spacingPrimitives.slice(0, DESIGN_SYSTEM_LIMITS.MAX_SPACING_VARIABLES)

  console.log(`Extracted ${colorTokens.length} color tokens, ${colorPrimitives.length} color primitives`)
  console.log(`Extracted ${spacingTokens.length} spacing tokens, ${spacingPrimitives.length} spacing primitives`)
  console.log(`Using: ${colorVariables.length} colors, ${spacingVariables.length} spacing values`)
  if (colorTokens.length > 0) {
    console.log('Sample tokens:', colorTokens.slice(0, 5).map(t => t.name))
  }

  return [colorVariables, spacingVariables]
}

/**
 * Extract local text styles
 */
async function extractTextStyles(): Promise<DesignSystemContext['textStyles']> {
  const textStyles: DesignSystemContext['textStyles'] = []

  try {
    const localTextStyles = await figma.getLocalTextStylesAsync()

    for (const style of localTextStyles.slice(0, DESIGN_SYSTEM_LIMITS.MAX_TEXT_STYLES)) {
      const textStyle: DesignSystemContext['textStyles'][0] = {
        id: style.id,
        name: style.name,
        fontFamily: style.fontName.family,
        fontSize: style.fontSize as number,
        fontWeight: getFontWeight(style.fontName.style)
      }

      // Extract line height if it's a pixel value
      if (style.lineHeight && typeof style.lineHeight === 'object' && 'value' in style.lineHeight) {
        if (style.lineHeight.unit === 'PIXELS') {
          textStyle.lineHeight = style.lineHeight.value
        }
      }

      // Extract letter spacing if it's a pixel value
      if (style.letterSpacing && typeof style.letterSpacing === 'object' && 'value' in style.letterSpacing) {
        if (style.letterSpacing.unit === 'PIXELS') {
          textStyle.letterSpacing = style.letterSpacing.value
        }
      }

      textStyles.push(textStyle)
    }
  } catch (e) {
    console.log('Could not extract text styles:', e)
  }

  return textStyles
}

/**
 * Extract local components
 */
async function extractComponents(): Promise<DesignSystemContext['components']> {
  const components: DesignSystemContext['components'] = []

  try {
    const localComponents = figma.root.findAllWithCriteria({ types: ['COMPONENT'] })

    for (const comp of localComponents.slice(0, DESIGN_SYSTEM_LIMITS.MAX_COMPONENTS)) {
      components.push({
        key: comp.key,
        name: comp.name,
        description: comp.description || undefined
      })
    }
  } catch (e) {
    console.log('Could not extract components:', e)
  }

  return components
}
