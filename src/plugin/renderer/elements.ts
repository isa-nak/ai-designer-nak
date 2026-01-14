/**
 * Element rendering functions for different node types
 */

import type { FrameNode as DesignFrame, ElementNode, DesignSystemContext } from '../../shared/types'
import { findTextStyle } from './styleCache'
import { convertFillWithVariable, convertStrokeWithVariable, convertEffect } from './paints'
import { loadFont, getFontStyle } from './fontLoader'

// Render a single element
export async function renderElement(
  element: ElementNode,
  designSystem: DesignSystemContext | null
): Promise<SceneNode | null> {
  let node: SceneNode | null = null

  switch (element.type) {
    case 'FRAME':
      node = await renderFrame(element, designSystem)
      break
    case 'TEXT':
      node = await renderText(element, designSystem)
      break
    case 'RECTANGLE':
      node = await renderRectangle(element, designSystem)
      break
    case 'ELLIPSE':
      node = await renderEllipse(element, designSystem)
      break
    case 'LINE':
      node = await renderLine(element, designSystem)
      break
    case 'INSTANCE':
      node = await renderInstance(element, designSystem)
      break
    default:
      // Fallback to frame for unknown types
      node = await renderFrame(element, designSystem)
  }

  return node
}

// Render frame (container with auto-layout)
export async function renderFrame(
  element: ElementNode,
  designSystem: DesignSystemContext | null
): Promise<FrameNode> {
  const frame = figma.createFrame()
  frame.name = element.name || 'Frame'

  await applyFrameProperties(frame, element, designSystem)

  // Render children
  if (element.children) {
    for (const child of element.children) {
      const childNode = await renderElement(child, designSystem)
      if (childNode) {
        frame.appendChild(childNode)
      }
    }
  }

  return frame
}

// Apply properties common to frames
export async function applyFrameProperties(
  frame: FrameNode,
  props: ElementNode | DesignFrame,
  designSystem: DesignSystemContext | null
): Promise<void> {
  // Size (set before auto-layout to establish initial dimensions)
  if (props.width !== undefined && props.height !== undefined) {
    frame.resize(props.width, props.height)
  }

  // Auto-layout
  if (props.layoutMode && props.layoutMode !== 'NONE') {
    frame.layoutMode = props.layoutMode

    if (props.primaryAxisAlignItems) {
      frame.primaryAxisAlignItems = props.primaryAxisAlignItems
    }
    if (props.counterAxisAlignItems) {
      // Validate counterAxisAlignItems - only MIN, MAX, CENTER, BASELINE are valid
      const validCounterAxis = ['MIN', 'MAX', 'CENTER', 'BASELINE']
      const counterValue = validCounterAxis.includes(props.counterAxisAlignItems)
        ? props.counterAxisAlignItems
        : 'CENTER' // Default to CENTER if invalid (e.g., STRETCH)
      frame.counterAxisAlignItems = counterValue as 'MIN' | 'MAX' | 'CENTER' | 'BASELINE'
    }
    if (props.itemSpacing !== undefined) {
      frame.itemSpacing = props.itemSpacing
    }

    // Padding
    if (props.padding) {
      frame.paddingTop = props.padding.top
      frame.paddingRight = props.padding.right
      frame.paddingBottom = props.padding.bottom
      frame.paddingLeft = props.padding.left
    }

    // Sizing modes for auto-layout - CRITICAL for preventing 1px elements
    if ('primaryAxisSizingMode' in props && props.primaryAxisSizingMode) {
      const sizingMode = props.primaryAxisSizingMode
      if (sizingMode === 'HUG') {
        frame.primaryAxisSizingMode = 'AUTO'
      } else if (sizingMode === 'FIXED') {
        frame.primaryAxisSizingMode = 'FIXED'
      } else if (sizingMode === 'FILL') {
        // FILL means the element should grow - handled by layoutGrow
        frame.primaryAxisSizingMode = 'AUTO'
      }
    } else {
      // Default to HUG (AUTO) to prevent 1px issues
      frame.primaryAxisSizingMode = 'AUTO'
    }

    if ('counterAxisSizingMode' in props && props.counterAxisSizingMode) {
      const sizingMode = props.counterAxisSizingMode
      if (sizingMode === 'HUG') {
        frame.counterAxisSizingMode = 'AUTO'
      } else if (sizingMode === 'FIXED') {
        frame.counterAxisSizingMode = 'FIXED'
      } else if (sizingMode === 'FILL') {
        // FILL on counter axis means STRETCH
        frame.counterAxisSizingMode = 'AUTO'
      }
    } else {
      // Default to HUG (AUTO) to prevent 1px issues
      frame.counterAxisSizingMode = 'AUTO'
    }
  }

  // Apply fills with variable support
  if (props.fills && props.fills.length > 0) {
    const paints: Paint[] = []
    for (const fill of props.fills) {
      const paint = await convertFillWithVariable(frame, fill)
      if (paint) paints.push(paint)
    }
    if (paints.length > 0) {
      frame.fills = paints
    }
  }

  // Apply strokes with variable support
  if (props.strokes && props.strokes.length > 0) {
    const paints: Paint[] = []
    for (const stroke of props.strokes) {
      const paint = await convertStrokeWithVariable(frame, stroke)
      if (paint) paints.push(paint)
    }
    if (paints.length > 0) {
      frame.strokes = paints
    }
  }

  // Stroke weight
  if ('strokeWeight' in props && props.strokeWeight !== undefined) {
    frame.strokeWeight = props.strokeWeight
  }

  // Corner radius
  if (props.cornerRadius !== undefined) {
    frame.cornerRadius = props.cornerRadius
  }

  // Effects (shadows, blur)
  if (props.effects && props.effects.length > 0) {
    frame.effects = props.effects.map(e => convertEffect(e)).filter(Boolean) as Effect[]
  }

  // Clip content
  if (props.clipsContent !== undefined) {
    frame.clipsContent = props.clipsContent
  }

  // Opacity
  if ('opacity' in props && props.opacity !== undefined) {
    frame.opacity = props.opacity
  }

  // Layout positioning (for absolute positioning within auto-layout parent)
  if ('layoutPositioning' in props && props.layoutPositioning === 'ABSOLUTE') {
    frame.layoutPositioning = 'ABSOLUTE'
    if ('x' in props && props.x !== undefined) frame.x = props.x
    if ('y' in props && props.y !== undefined) frame.y = props.y
  }

  // Layout align (for children of auto-layout)
  if ('layoutAlign' in props && props.layoutAlign) {
    if (props.layoutAlign === 'STRETCH') {
      frame.layoutAlign = 'STRETCH'
    }
  }

  // Layout grow
  if ('layoutGrow' in props && props.layoutGrow !== undefined) {
    frame.layoutGrow = props.layoutGrow
  }
}

// Render text element with text style support
async function renderText(
  element: ElementNode,
  designSystem: DesignSystemContext | null
): Promise<TextNode> {
  const text = figma.createText()
  text.name = element.name || 'Text'

  // Check if we should apply a text style
  if (element.textStyleName) {
    const textStyle = findTextStyle(element.textStyleName)
    if (textStyle) {
      // Load the font from the style
      await figma.loadFontAsync(textStyle.fontName)
      text.characters = element.characters || ''
      // Apply the text style
      text.textStyleId = textStyle.id
    } else {
      // Style not found, fall back to manual properties
      console.log(`Text style "${element.textStyleName}" not found, using fallback`)
      await applyManualTextProperties(text, element)
    }
  } else {
    // No style specified, use manual properties
    await applyManualTextProperties(text, element)
  }

  // Apply fills with variable support (text color)
  if (element.fills && element.fills.length > 0) {
    const paints: Paint[] = []
    for (const fill of element.fills) {
      const paint = await convertFillWithVariable(text, fill)
      if (paint) paints.push(paint)
    }
    if (paints.length > 0) {
      text.fills = paints
    }
  }

  // Size constraints
  if (element.width !== undefined) {
    text.resize(element.width, text.height)
    text.textAutoResize = 'HEIGHT'
  }

  // Layout properties for auto-layout
  if (element.layoutAlign) {
    if (element.layoutAlign === 'STRETCH') {
      text.layoutAlign = 'STRETCH'
      text.textAutoResize = 'HEIGHT'
    }
  }
  if (element.layoutGrow !== undefined) {
    text.layoutGrow = element.layoutGrow
  }

  // Opacity
  if (element.opacity !== undefined) {
    text.opacity = element.opacity
  }

  return text
}

// Apply manual text properties when no style is used
async function applyManualTextProperties(text: TextNode, element: ElementNode): Promise<void> {
  const fontFamily = element.fontFamily || 'Inter'
  const fontWeight = element.fontWeight || 400
  const fontStyle = getFontStyle(fontWeight)

  const loadedFont = await loadFont(fontFamily, fontStyle)
  text.fontName = loadedFont

  // Set text content
  text.characters = element.characters || ''

  // Font size
  if (element.fontSize) {
    text.fontSize = element.fontSize
  }

  // Text alignment
  if (element.textAlignHorizontal) {
    text.textAlignHorizontal = element.textAlignHorizontal
  }
  if (element.textAlignVertical) {
    text.textAlignVertical = element.textAlignVertical
  }

  // Line height
  if (element.lineHeight !== undefined) {
    if (typeof element.lineHeight === 'number') {
      text.lineHeight = { value: element.lineHeight, unit: 'PIXELS' }
    } else {
      text.lineHeight = element.lineHeight
    }
  }

  // Letter spacing
  if (element.letterSpacing !== undefined) {
    text.letterSpacing = { value: element.letterSpacing, unit: 'PIXELS' }
  }

  // Text decoration
  if (element.textDecoration) {
    text.textDecoration = element.textDecoration
  }

  // Text case
  if (element.textCase) {
    text.textCase = element.textCase
  }
}

// Render rectangle
async function renderRectangle(
  element: ElementNode,
  designSystem: DesignSystemContext | null
): Promise<RectangleNode> {
  const rect = figma.createRectangle()
  rect.name = element.name || 'Rectangle'

  // Size
  if (element.width !== undefined && element.height !== undefined) {
    rect.resize(element.width, element.height)
  }

  // Apply fills with variable support
  if (element.fills && element.fills.length > 0) {
    const paints: Paint[] = []
    for (const fill of element.fills) {
      const paint = await convertFillWithVariable(rect, fill)
      if (paint) paints.push(paint)
    }
    if (paints.length > 0) {
      rect.fills = paints
    }
  }

  // Apply strokes with variable support
  if (element.strokes && element.strokes.length > 0) {
    const paints: Paint[] = []
    for (const stroke of element.strokes) {
      const paint = await convertStrokeWithVariable(rect, stroke)
      if (paint) paints.push(paint)
    }
    if (paints.length > 0) {
      rect.strokes = paints
      if (element.strokeWeight !== undefined) {
        rect.strokeWeight = element.strokeWeight
      }
    }
  }

  // Corner radius
  if (element.cornerRadius !== undefined) {
    rect.cornerRadius = element.cornerRadius
  }

  // Effects
  if (element.effects && element.effects.length > 0) {
    rect.effects = element.effects.map(e => convertEffect(e)).filter(Boolean) as Effect[]
  }

  // Opacity
  if (element.opacity !== undefined) {
    rect.opacity = element.opacity
  }

  // Layout properties
  if (element.layoutAlign) {
    if (element.layoutAlign === 'STRETCH') {
      rect.layoutAlign = 'STRETCH'
    }
  }
  if (element.layoutGrow !== undefined) {
    rect.layoutGrow = element.layoutGrow
  }

  return rect
}

// Render ellipse
async function renderEllipse(
  element: ElementNode,
  designSystem: DesignSystemContext | null
): Promise<EllipseNode> {
  const ellipse = figma.createEllipse()
  ellipse.name = element.name || 'Ellipse'

  // Size
  if (element.width !== undefined && element.height !== undefined) {
    ellipse.resize(element.width, element.height)
  }

  // Apply fills with variable support
  if (element.fills && element.fills.length > 0) {
    const paints: Paint[] = []
    for (const fill of element.fills) {
      const paint = await convertFillWithVariable(ellipse, fill)
      if (paint) paints.push(paint)
    }
    if (paints.length > 0) {
      ellipse.fills = paints
    }
  }

  // Apply strokes with variable support
  if (element.strokes && element.strokes.length > 0) {
    const paints: Paint[] = []
    for (const stroke of element.strokes) {
      const paint = await convertStrokeWithVariable(ellipse, stroke)
      if (paint) paints.push(paint)
    }
    if (paints.length > 0) {
      ellipse.strokes = paints
      if (element.strokeWeight !== undefined) {
        ellipse.strokeWeight = element.strokeWeight
      }
    }
  }

  // Effects
  if (element.effects && element.effects.length > 0) {
    ellipse.effects = element.effects.map(e => convertEffect(e)).filter(Boolean) as Effect[]
  }

  // Opacity
  if (element.opacity !== undefined) {
    ellipse.opacity = element.opacity
  }

  return ellipse
}

// Render line
async function renderLine(
  element: ElementNode,
  designSystem: DesignSystemContext | null
): Promise<LineNode> {
  const line = figma.createLine()
  line.name = element.name || 'Line'

  // Size (width determines line length)
  if (element.width !== undefined) {
    line.resize(element.width, 0)
  }

  // Apply strokes with variable support
  if (element.strokes && element.strokes.length > 0) {
    const paints: Paint[] = []
    for (const stroke of element.strokes) {
      const paint = await convertStrokeWithVariable(line, stroke)
      if (paint) paints.push(paint)
    }
    if (paints.length > 0) {
      line.strokes = paints
      if (element.strokeWeight !== undefined) {
        line.strokeWeight = element.strokeWeight
      }
    }
  } else {
    // Default stroke for visibility
    line.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
  }

  // Opacity
  if (element.opacity !== undefined) {
    line.opacity = element.opacity
  }

  return line
}

// Render component instance
async function renderInstance(
  element: ElementNode,
  designSystem: DesignSystemContext | null
): Promise<SceneNode> {
  if (!element.componentKey) {
    // Fallback to frame if no component key
    return renderFrame(element, designSystem)
  }

  try {
    // Try to find the component by key
    const component = await figma.importComponentByKeyAsync(element.componentKey)
    const instance = component.createInstance()
    instance.name = element.name || component.name

    // Apply size if specified
    if (element.width !== undefined && element.height !== undefined) {
      instance.resize(element.width, element.height)
    }

    // Apply component properties if provided
    if (element.componentProperties) {
      for (const [key, value] of Object.entries(element.componentProperties)) {
        try {
          instance.setProperties({ [key]: value })
        } catch {
          // Property might not exist, skip
        }
      }
    }

    // Layout properties
    if (element.layoutAlign === 'STRETCH') {
      instance.layoutAlign = 'STRETCH'
    }
    if (element.layoutGrow !== undefined) {
      instance.layoutGrow = element.layoutGrow
    }

    return instance
  } catch {
    // Component not found, fallback to frame with children
    console.log(`Component ${element.componentKey} not found, rendering as frame`)
    return renderFrame(element, designSystem)
  }
}
