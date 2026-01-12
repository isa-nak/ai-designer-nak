import type { FrameNode as DesignFrame, ElementNode, Fill, Stroke, Effect } from '../shared/types'

// Serialize the current selection to JSON
export function serializeSelection(): DesignFrame | null {
  const selection = figma.currentPage.selection
  if (selection.length === 0) return null

  const first = selection[0]

  // Only serialize frame-like nodes
  if (first.type === 'FRAME' || first.type === 'COMPONENT' || first.type === 'INSTANCE') {
    return serializeFrameNode(first as FrameNode)
  }

  // For other types, wrap in a virtual frame
  return {
    name: 'Selection',
    width: 'width' in first ? first.width : undefined,
    height: 'height' in first ? first.height : undefined,
    children: [serializeNode(first)].filter(Boolean) as ElementNode[],
  }
}

// Serialize a frame node
function serializeFrameNode(frame: FrameNode): DesignFrame {
  const result: DesignFrame = {
    name: frame.name,
    width: frame.width,
    height: frame.height,
  }

  // Auto-layout
  if (frame.layoutMode !== 'NONE') {
    result.layoutMode = frame.layoutMode
    result.primaryAxisAlignItems = frame.primaryAxisAlignItems
    result.counterAxisAlignItems = frame.counterAxisAlignItems
    result.itemSpacing = frame.itemSpacing

    if (frame.paddingTop || frame.paddingRight || frame.paddingBottom || frame.paddingLeft) {
      result.padding = {
        top: frame.paddingTop,
        right: frame.paddingRight,
        bottom: frame.paddingBottom,
        left: frame.paddingLeft,
      }
    }
  }

  // Fills
  const fills = serializeFills(frame.fills as readonly Paint[])
  if (fills.length > 0) {
    result.fills = fills
  }

  // Strokes
  const strokes = serializeStrokes(frame.strokes as readonly Paint[])
  if (strokes.length > 0) {
    result.strokes = strokes
  }

  // Corner radius
  if (typeof frame.cornerRadius === 'number' && frame.cornerRadius > 0) {
    result.cornerRadius = frame.cornerRadius
  }

  // Effects
  const effects = serializeEffects(frame.effects as readonly Effect[])
  if (effects.length > 0) {
    result.effects = effects
  }

  // Clip content
  if (frame.clipsContent) {
    result.clipsContent = frame.clipsContent
  }

  // Children
  if (frame.children.length > 0) {
    const children = frame.children
      .map(child => serializeNode(child))
      .filter(Boolean) as ElementNode[]
    if (children.length > 0) {
      result.children = children
    }
  }

  return result
}

// Serialize any scene node
function serializeNode(node: SceneNode): ElementNode | null {
  switch (node.type) {
    case 'FRAME':
    case 'COMPONENT':
    case 'COMPONENT_SET':
      return serializeFrameElement(node as FrameNode)
    case 'INSTANCE':
      return serializeInstance(node as InstanceNode)
    case 'TEXT':
      return serializeText(node as TextNode)
    case 'RECTANGLE':
      return serializeRectangle(node as RectangleNode)
    case 'ELLIPSE':
      return serializeEllipse(node as EllipseNode)
    case 'LINE':
      return serializeLine(node as LineNode)
    case 'GROUP':
      return serializeGroup(node as GroupNode)
    default:
      return null
  }
}

// Serialize a frame as an element
function serializeFrameElement(frame: FrameNode): ElementNode {
  const result: ElementNode = {
    type: 'FRAME',
    name: frame.name,
    width: frame.width,
    height: frame.height,
  }

  // Position (for absolute positioning)
  if (frame.layoutPositioning === 'ABSOLUTE') {
    result.layoutPositioning = 'ABSOLUTE'
    result.x = frame.x
    result.y = frame.y
  }

  // Auto-layout
  if (frame.layoutMode !== 'NONE') {
    result.layoutMode = frame.layoutMode
    result.primaryAxisAlignItems = frame.primaryAxisAlignItems
    result.counterAxisAlignItems = frame.counterAxisAlignItems
    result.itemSpacing = frame.itemSpacing

    if (frame.paddingTop || frame.paddingRight || frame.paddingBottom || frame.paddingLeft) {
      result.padding = {
        top: frame.paddingTop,
        right: frame.paddingRight,
        bottom: frame.paddingBottom,
        left: frame.paddingLeft,
      }
    }
  }

  // Layout properties (as child of auto-layout)
  if (frame.layoutAlign !== 'INHERIT') {
    result.layoutAlign = frame.layoutAlign as ElementNode['layoutAlign']
  }
  if (frame.layoutGrow !== 0) {
    result.layoutGrow = frame.layoutGrow
  }

  // Fills
  const fills = serializeFills(frame.fills as readonly Paint[])
  if (fills.length > 0) {
    result.fills = fills
  }

  // Strokes
  const strokes = serializeStrokes(frame.strokes as readonly Paint[])
  if (strokes.length > 0) {
    result.strokes = strokes
  }

  // Corner radius
  if (typeof frame.cornerRadius === 'number' && frame.cornerRadius > 0) {
    result.cornerRadius = frame.cornerRadius
  }

  // Opacity
  if (frame.opacity !== 1) {
    result.opacity = frame.opacity
  }

  // Effects
  const effects = serializeEffects(frame.effects as readonly Effect[])
  if (effects.length > 0) {
    result.effects = effects
  }

  // Clip content
  if (frame.clipsContent) {
    result.clipsContent = frame.clipsContent
  }

  // Children
  if (frame.children.length > 0) {
    const children = frame.children
      .map(child => serializeNode(child))
      .filter(Boolean) as ElementNode[]
    if (children.length > 0) {
      result.children = children
    }
  }

  return result
}

// Serialize component instance
function serializeInstance(instance: InstanceNode): ElementNode {
  const result: ElementNode = {
    type: 'INSTANCE',
    name: instance.name,
    width: instance.width,
    height: instance.height,
  }

  // Get main component key
  const mainComponent = instance.mainComponent
  if (mainComponent) {
    result.componentKey = mainComponent.key
  }

  // Layout properties
  if (instance.layoutAlign !== 'INHERIT') {
    result.layoutAlign = instance.layoutAlign as ElementNode['layoutAlign']
  }
  if (instance.layoutGrow !== 0) {
    result.layoutGrow = instance.layoutGrow
  }

  // Opacity
  if (instance.opacity !== 1) {
    result.opacity = instance.opacity
  }

  return result
}

// Serialize text node
function serializeText(text: TextNode): ElementNode {
  const result: ElementNode = {
    type: 'TEXT',
    name: text.name,
    characters: text.characters,
    width: text.width,
    height: text.height,
  }

  // Font properties (assuming uniform styling)
  const fontName = text.fontName
  if (fontName !== figma.mixed) {
    result.fontFamily = fontName.family
    result.fontWeight = getFontWeight(fontName.style)
  }

  const fontSize = text.fontSize
  if (fontSize !== figma.mixed) {
    result.fontSize = fontSize
  }

  // Text alignment
  result.textAlignHorizontal = text.textAlignHorizontal
  result.textAlignVertical = text.textAlignVertical

  // Line height
  const lineHeight = text.lineHeight
  if (lineHeight !== figma.mixed && lineHeight.unit !== 'AUTO') {
    result.lineHeight = lineHeight
  }

  // Letter spacing
  const letterSpacing = text.letterSpacing
  if (letterSpacing !== figma.mixed && letterSpacing.value !== 0) {
    result.letterSpacing = letterSpacing.value
  }

  // Text decoration
  const textDecoration = text.textDecoration
  if (textDecoration !== figma.mixed && textDecoration !== 'NONE') {
    result.textDecoration = textDecoration
  }

  // Fills (text color)
  const fills = serializeFills(text.fills as readonly Paint[])
  if (fills.length > 0) {
    result.fills = fills
  }

  // Layout properties
  if (text.layoutAlign !== 'INHERIT') {
    result.layoutAlign = text.layoutAlign as ElementNode['layoutAlign']
  }
  if (text.layoutGrow !== 0) {
    result.layoutGrow = text.layoutGrow
  }

  // Opacity
  if (text.opacity !== 1) {
    result.opacity = text.opacity
  }

  return result
}

// Serialize rectangle
function serializeRectangle(rect: RectangleNode): ElementNode {
  const result: ElementNode = {
    type: 'RECTANGLE',
    name: rect.name,
    width: rect.width,
    height: rect.height,
  }

  // Fills
  const fills = serializeFills(rect.fills as readonly Paint[])
  if (fills.length > 0) {
    result.fills = fills
  }

  // Strokes
  const strokes = serializeStrokes(rect.strokes as readonly Paint[])
  if (strokes.length > 0) {
    result.strokes = strokes
    result.strokeWeight = rect.strokeWeight as number
  }

  // Corner radius
  if (typeof rect.cornerRadius === 'number' && rect.cornerRadius > 0) {
    result.cornerRadius = rect.cornerRadius
  }

  // Opacity
  if (rect.opacity !== 1) {
    result.opacity = rect.opacity
  }

  // Effects
  const effects = serializeEffects(rect.effects as readonly Effect[])
  if (effects.length > 0) {
    result.effects = effects
  }

  // Layout properties
  if (rect.layoutAlign !== 'INHERIT') {
    result.layoutAlign = rect.layoutAlign as ElementNode['layoutAlign']
  }
  if (rect.layoutGrow !== 0) {
    result.layoutGrow = rect.layoutGrow
  }

  return result
}

// Serialize ellipse
function serializeEllipse(ellipse: EllipseNode): ElementNode {
  const result: ElementNode = {
    type: 'ELLIPSE',
    name: ellipse.name,
    width: ellipse.width,
    height: ellipse.height,
  }

  // Fills
  const fills = serializeFills(ellipse.fills as readonly Paint[])
  if (fills.length > 0) {
    result.fills = fills
  }

  // Strokes
  const strokes = serializeStrokes(ellipse.strokes as readonly Paint[])
  if (strokes.length > 0) {
    result.strokes = strokes
    result.strokeWeight = ellipse.strokeWeight as number
  }

  // Opacity
  if (ellipse.opacity !== 1) {
    result.opacity = ellipse.opacity
  }

  // Effects
  const effects = serializeEffects(ellipse.effects as readonly Effect[])
  if (effects.length > 0) {
    result.effects = effects
  }

  return result
}

// Serialize line
function serializeLine(line: LineNode): ElementNode {
  const result: ElementNode = {
    type: 'LINE',
    name: line.name,
    width: line.width,
  }

  // Strokes
  const strokes = serializeStrokes(line.strokes as readonly Paint[])
  if (strokes.length > 0) {
    result.strokes = strokes
    result.strokeWeight = line.strokeWeight as number
  }

  // Opacity
  if (line.opacity !== 1) {
    result.opacity = line.opacity
  }

  return result
}

// Serialize group (convert to frame)
function serializeGroup(group: GroupNode): ElementNode {
  const result: ElementNode = {
    type: 'FRAME',
    name: group.name,
    width: group.width,
    height: group.height,
  }

  // Opacity
  if (group.opacity !== 1) {
    result.opacity = group.opacity
  }

  // Children
  if (group.children.length > 0) {
    const children = group.children
      .map(child => serializeNode(child))
      .filter(Boolean) as ElementNode[]
    if (children.length > 0) {
      result.children = children
    }
  }

  return result
}

// Serialize fills
function serializeFills(fills: readonly Paint[]): Fill[] {
  return fills
    .filter(fill => fill.visible !== false)
    .map(fill => {
      if (fill.type === 'SOLID') {
        return {
          type: 'SOLID' as const,
          color: { r: fill.color.r, g: fill.color.g, b: fill.color.b },
          opacity: fill.opacity,
        }
      }
      if (fill.type === 'GRADIENT_LINEAR') {
        return {
          type: 'GRADIENT_LINEAR' as const,
          gradientStops: fill.gradientStops.map(stop => ({
            position: stop.position,
            color: {
              r: stop.color.r,
              g: stop.color.g,
              b: stop.color.b,
              a: stop.color.a,
            },
          })),
        }
      }
      return null
    })
    .filter(Boolean) as Fill[]
}

// Serialize strokes
function serializeStrokes(strokes: readonly Paint[]): Stroke[] {
  return strokes
    .filter(stroke => stroke.visible !== false && stroke.type === 'SOLID')
    .map(stroke => {
      if (stroke.type === 'SOLID') {
        return {
          type: 'SOLID' as const,
          color: { r: stroke.color.r, g: stroke.color.g, b: stroke.color.b },
          opacity: stroke.opacity,
        }
      }
      return null
    })
    .filter(Boolean) as Stroke[]
}

// Serialize effects
function serializeEffects(effects: readonly Effect[]): Effect[] {
  return effects
    .filter(effect => effect.visible !== false)
    .map(effect => {
      if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
        return {
          type: effect.type,
          color: effect.color,
          offset: effect.offset,
          radius: effect.radius,
          spread: effect.spread,
        }
      }
      if (effect.type === 'LAYER_BLUR' || effect.type === 'BACKGROUND_BLUR') {
        return {
          type: effect.type,
          radius: effect.radius,
        }
      }
      return null
    })
    .filter(Boolean) as Effect[]
}

// Get font weight from style name
function getFontWeight(style: string): number {
  const weights: Record<string, number> = {
    Thin: 100,
    ExtraLight: 200,
    Light: 300,
    Regular: 400,
    Medium: 500,
    SemiBold: 600,
    Bold: 700,
    ExtraBold: 800,
    Black: 900,
  }
  return weights[style] || 400
}
