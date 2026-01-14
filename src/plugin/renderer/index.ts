/**
 * Design Renderer - Main entry point
 *
 * Renders AI-generated design JSON into Figma nodes
 */

import type { FrameNode as DesignFrame, DesignSystemContext } from '../../shared/types'
import { initializeCaches } from './styleCache'
import { renderElement, applyFrameProperties } from './elements'

// Re-export useful items
export { findTextStyle, findColorVariable, findSpacingVariable } from './styleCache'
export { convertFillWithVariable, convertStrokeWithVariable, convertEffect } from './paints'
export { loadFont, getFontStyle } from './fontLoader'

// Main render function
export async function renderDesign(
  design: DesignFrame,
  viewport: { width: number; height: number },
  designSystem: DesignSystemContext | null
): Promise<FrameNode> {
  // Initialize style/variable caches
  await initializeCaches()

  const frame = figma.createFrame()
  frame.name = design.name || 'Generated Screen'
  frame.resize(viewport.width, viewport.height)

  // Position at viewport center
  frame.x = figma.viewport.center.x - viewport.width / 2
  frame.y = figma.viewport.center.y - viewport.height / 2

  // Ensure root frame has auto layout if not specified
  if (!design.layoutMode || design.layoutMode === 'NONE') {
    design.layoutMode = 'VERTICAL'
    design.primaryAxisAlignItems = design.primaryAxisAlignItems || 'MIN'
    design.counterAxisAlignItems = design.counterAxisAlignItems || 'CENTER'
  }

  // Apply frame properties
  await applyFrameProperties(frame, design, designSystem)

  // For root frame, set fixed size to viewport dimensions
  frame.primaryAxisSizingMode = 'FIXED'
  frame.counterAxisSizingMode = 'FIXED'
  frame.resize(viewport.width, viewport.height)

  // Render children
  if (design.children) {
    for (const child of design.children) {
      const node = await renderElement(child, designSystem)
      if (node) {
        frame.appendChild(node)
      }
    }
  }

  return frame
}
