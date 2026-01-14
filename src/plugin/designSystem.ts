/**
 * Design System Extractor
 *
 * Extracts color variables, spacing variables, text styles, and components
 * from the current Figma file to provide context to AI generation.
 */

import type { DesignSystemContext } from '../shared/types'
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
 * Extract color and spacing variables from local variable collections
 */
async function extractVariables(): Promise<[
  DesignSystemContext['colorVariables'],
  DesignSystemContext['spacingVariables']
]> {
  const colorVariables: DesignSystemContext['colorVariables'] = []
  const spacingVariables: DesignSystemContext['spacingVariables'] = []

  try {
    const collections = await figma.variables.getLocalVariableCollectionsAsync()

    for (const collection of collections) {
      for (const variableId of collection.variableIds) {
        const variable = await figma.variables.getVariableByIdAsync(variableId)
        if (!variable) continue

        const modeId = Object.keys(variable.valuesByMode)[0]
        const value = variable.valuesByMode[modeId]

        if (variable.resolvedType === 'COLOR' && typeof value === 'object' && 'r' in value) {
          if (colorVariables.length < DESIGN_SYSTEM_LIMITS.MAX_COLOR_VARIABLES) {
            colorVariables.push({
              id: variable.id,
              name: variable.name,
              collection: collection.name,
              value: rgbToHex(value as RGB)
            })
          }
        } else if (variable.resolvedType === 'FLOAT' && typeof value === 'number') {
          if (spacingVariables.length < DESIGN_SYSTEM_LIMITS.MAX_SPACING_VARIABLES) {
            spacingVariables.push({
              id: variable.id,
              name: variable.name,
              collection: collection.name,
              value: value
            })
          }
        }
      }
    }
  } catch (e) {
    console.log('Could not extract variables:', e)
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
