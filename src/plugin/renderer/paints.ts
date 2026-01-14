/**
 * Paint conversion utilities (fills, strokes, effects)
 */

import type { Fill, Stroke, Effect } from '../../shared/types'
import { findColorVariable } from './styleCache'

// Helper to extract clean RGB (no alpha) from any color object
function toRGB(color: { r: number; g: number; b: number; a?: number }): RGB {
  return { r: color.r, g: color.g, b: color.b }
}

// Helper to extract opacity from fill/color
function getOpacity(fill: Fill): number {
  // Use explicit opacity if provided, otherwise check for alpha in color
  if (fill.opacity !== undefined) return fill.opacity
  if (fill.color && 'a' in fill.color && fill.color.a !== undefined) return fill.color.a
  return 1
}

// Convert fill with variable binding support
export async function convertFillWithVariable(node: SceneNode, fill: Fill): Promise<Paint | null> {
  if (fill.visible === false) return null

  // Check if we should use a color variable
  if (fill.colorVariable) {
    const variable = findColorVariable(fill.colorVariable)
    if (variable) {
      // Create a solid paint and bind to variable
      const paint: SolidPaint = {
        type: 'SOLID',
        color: { r: 0.5, g: 0.5, b: 0.5 }, // Placeholder, will be overridden by variable
        opacity: getOpacity(fill),
      }

      // Try to bind the fill to the variable
      try {
        if ('fills' in node) {
          // We need to set fills first, then bind
          const currentFills = [...(node.fills as Paint[])]
          currentFills.push(paint)
          node.fills = currentFills

          // Now bind the last fill to the variable
          const fillIndex = currentFills.length - 1
          node.setBoundVariable('fills', fillIndex, 'color', variable)

          // Return null since we already added it
          return null
        }
      } catch (e) {
        console.log(`Could not bind variable ${fill.colorVariable}:`, e)
      }

      // Fall back to getting the variable's value
      const modeId = Object.keys(variable.valuesByMode)[0]
      const colorValue = variable.valuesByMode[modeId]
      if (colorValue && typeof colorValue === 'object' && 'r' in colorValue) {
        return {
          type: 'SOLID',
          color: toRGB(colorValue as { r: number; g: number; b: number }),
          opacity: getOpacity(fill),
        }
      }
    } else {
      console.log(`Color variable "${fill.colorVariable}" not found`)
    }
  }

  // Fall back to raw color value - handle both with and without explicit type
  if (fill.color) {
    return {
      type: 'SOLID',
      color: toRGB(fill.color),
      opacity: getOpacity(fill),
    }
  }

  if (fill.type === 'GRADIENT_LINEAR' && fill.gradientStops) {
    return {
      type: 'GRADIENT_LINEAR',
      gradientStops: fill.gradientStops.map(stop => ({
        position: stop.position,
        color: {
          r: stop.color.r,
          g: stop.color.g,
          b: stop.color.b,
          a: stop.color.a ?? 1,
        },
      })),
      gradientTransform: [
        [1, 0, 0],
        [0, 1, 0],
      ],
    }
  }

  return null
}

// Helper to get stroke opacity
function getStrokeOpacity(stroke: Stroke): number {
  if (stroke.opacity !== undefined) return stroke.opacity
  if (stroke.color && 'a' in stroke.color && stroke.color.a !== undefined) return stroke.color.a
  return 1
}

// Convert stroke with variable binding support
export async function convertStrokeWithVariable(node: SceneNode, stroke: Stroke): Promise<Paint | null> {
  // Check if we should use a color variable
  if (stroke.colorVariable) {
    const variable = findColorVariable(stroke.colorVariable)
    if (variable) {
      // Get the variable's value
      const modeId = Object.keys(variable.valuesByMode)[0]
      const colorValue = variable.valuesByMode[modeId]
      if (colorValue && typeof colorValue === 'object' && 'r' in colorValue) {
        return {
          type: 'SOLID',
          color: toRGB(colorValue as { r: number; g: number; b: number }),
          opacity: getStrokeOpacity(stroke),
        }
      }
    } else {
      console.log(`Color variable "${stroke.colorVariable}" not found`)
    }
  }

  // Fall back to raw color value
  if (stroke.color) {
    return {
      type: 'SOLID',
      color: toRGB(stroke.color),
      opacity: getStrokeOpacity(stroke),
    }
  }

  return null
}

// Convert our Effect type to Figma Effect
export function convertEffect(effect: Effect): Effect | null {
  if (effect.visible === false) return null

  if (effect.type === 'DROP_SHADOW' && effect.color) {
    return {
      type: 'DROP_SHADOW',
      color: effect.color,
      offset: effect.offset || { x: 0, y: 4 },
      radius: effect.radius ?? 8,
      spread: effect.spread ?? 0,
      visible: true,
      blendMode: 'NORMAL',
    }
  }

  if (effect.type === 'INNER_SHADOW' && effect.color) {
    return {
      type: 'INNER_SHADOW',
      color: effect.color,
      offset: effect.offset || { x: 0, y: 2 },
      radius: effect.radius ?? 4,
      spread: effect.spread ?? 0,
      visible: true,
      blendMode: 'NORMAL',
    }
  }

  if (effect.type === 'LAYER_BLUR') {
    return {
      type: 'LAYER_BLUR',
      radius: effect.radius ?? 4,
      visible: true,
    }
  }

  if (effect.type === 'BACKGROUND_BLUR') {
    return {
      type: 'BACKGROUND_BLUR',
      radius: effect.radius ?? 10,
      visible: true,
    }
  }

  return null
}
