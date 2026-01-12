import type { FrameNode as DesignFrame, ElementNode, Fill, Stroke, Effect, DesignSystemContext } from '../shared/types'

// Cache for loaded fonts
const loadedFonts = new Set<string>()

// Main render function
export async function renderDesign(
  design: DesignFrame,
  viewport: { width: number; height: number },
  designSystem: DesignSystemContext | null
): Promise<FrameNode> {
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

// Render a single element
async function renderElement(
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
async function renderFrame(
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
async function applyFrameProperties(
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
      frame.counterAxisAlignItems = props.counterAxisAlignItems
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

    // Sizing modes for auto-layout
    frame.primaryAxisSizingMode = 'AUTO'
    frame.counterAxisSizingMode = 'AUTO'
  }

  // Fills
  if (props.fills && props.fills.length > 0) {
    frame.fills = props.fills.map(f => convertFill(f)).filter(Boolean) as Paint[]
  }

  // Strokes
  if (props.strokes && props.strokes.length > 0) {
    frame.strokes = props.strokes.map(s => convertStroke(s)).filter(Boolean) as Paint[]
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

// Render text element
async function renderText(
  element: ElementNode,
  designSystem: DesignSystemContext | null
): Promise<TextNode> {
  const text = figma.createText()
  text.name = element.name || 'Text'

  // Load font before setting characters
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

  // Fills (text color)
  if (element.fills && element.fills.length > 0) {
    text.fills = element.fills.map(f => convertFill(f)).filter(Boolean) as Paint[]
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

  // Fills
  if (element.fills && element.fills.length > 0) {
    rect.fills = element.fills.map(f => convertFill(f)).filter(Boolean) as Paint[]
  }

  // Strokes
  if (element.strokes && element.strokes.length > 0) {
    rect.strokes = element.strokes.map(s => convertStroke(s)).filter(Boolean) as Paint[]
    if (element.strokeWeight !== undefined) {
      rect.strokeWeight = element.strokeWeight
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

  // Fills
  if (element.fills && element.fills.length > 0) {
    ellipse.fills = element.fills.map(f => convertFill(f)).filter(Boolean) as Paint[]
  }

  // Strokes
  if (element.strokes && element.strokes.length > 0) {
    ellipse.strokes = element.strokes.map(s => convertStroke(s)).filter(Boolean) as Paint[]
    if (element.strokeWeight !== undefined) {
      ellipse.strokeWeight = element.strokeWeight
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

  // Strokes
  if (element.strokes && element.strokes.length > 0) {
    line.strokes = element.strokes.map(s => convertStroke(s)).filter(Boolean) as Paint[]
    if (element.strokeWeight !== undefined) {
      line.strokeWeight = element.strokeWeight
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

// Convert our Fill type to Figma Paint
function convertFill(fill: Fill): Paint | null {
  if (fill.visible === false) return null

  if (fill.type === 'SOLID' && fill.color) {
    return {
      type: 'SOLID',
      color: { r: fill.color.r, g: fill.color.g, b: fill.color.b },
      opacity: fill.opacity ?? 1,
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

// Convert our Stroke type to Figma Paint
function convertStroke(stroke: Stroke): Paint | null {
  return {
    type: 'SOLID',
    color: { r: stroke.color.r, g: stroke.color.g, b: stroke.color.b },
    opacity: stroke.opacity ?? 1,
  }
}

// Convert our Effect type to Figma Effect
function convertEffect(effect: Effect): Effect | null {
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

// Get font style name from weight
function getFontStyle(weight: number): string {
  const styles: Record<number, string> = {
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
  return styles[weight] || 'Regular'
}

// Load a font and return the actually loaded font
async function loadFont(family: string, style: string): Promise<FontName> {
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
