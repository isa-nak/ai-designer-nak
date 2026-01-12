// Viewport presets
export type ViewportPreset = 'mobile' | 'tablet' | 'desktop' | 'custom'

export interface ViewportSize {
  width: number
  height: number
  name: string
}

export const VIEWPORT_PRESETS: Record<ViewportPreset, ViewportSize> = {
  mobile: { width: 375, height: 812, name: 'Mobile' },
  tablet: { width: 768, height: 1024, name: 'Tablet' },
  desktop: { width: 1440, height: 900, name: 'Desktop' },
  custom: { width: 400, height: 600, name: 'Custom' },
}

// Message types between UI and plugin
export type MessageToPlugin =
  | { type: 'generate-screen'; prompt: string; imageData?: string }
  | { type: 'regenerate-selection'; instructions: string }
  | { type: 'save-settings'; settings: PluginSettings }
  | { type: 'load-settings' }
  | { type: 'get-selection' }
  | { type: 'refresh-design-system' }
  | { type: 'render-design'; design: FrameNode; viewport: ViewportSize }
  | { type: 'request-selection-data' }

export type MessageToUI =
  | { type: 'settings-loaded'; settings: PluginSettings }
  | { type: 'selection-changed'; selection: SelectionInfo | null }
  | { type: 'design-system-loaded'; designSystem: DesignSystemContext }
  | { type: 'generation-started' }
  | { type: 'generation-progress'; content: string }
  | { type: 'generation-complete'; success: boolean; message?: string }
  | { type: 'selection-data'; data: FrameNode | null }
  | { type: 'error'; message: string }

export interface PluginSettings {
  apiKey: string
  contextInstructions: string
  viewport: ViewportPreset
}

export interface SelectionInfo {
  id: string
  name: string
  type: string
  hasMultiple: boolean
  count: number
}

export interface DesignSystemContext {
  colorVariables: VariableInfo[]
  spacingVariables: VariableInfo[]
  textStyles: TextStyleInfo[]
  components: ComponentInfo[]
}

export interface VariableInfo {
  id: string
  name: string
  collection: string
  value: string | number
}

export interface TextStyleInfo {
  id: string
  name: string
  fontFamily: string
  fontSize: number
  fontWeight: number
}


export interface ComponentInfo {
  key: string
  name: string
  description?: string
}

// Design node types for Claude to generate
export interface FrameNode {
  name: string
  width?: number
  height?: number
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL'
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX'
  padding?: { top: number; right: number; bottom: number; left: number }
  itemSpacing?: number
  fills?: Fill[]
  strokes?: Stroke[]
  cornerRadius?: number
  effects?: Effect[]
  clipsContent?: boolean
  children?: ElementNode[]
}

export interface ElementNode {
  type: 'FRAME' | 'TEXT' | 'RECTANGLE' | 'ELLIPSE' | 'INSTANCE' | 'VECTOR' | 'LINE'
  name: string
  width?: number
  height?: number
  x?: number
  y?: number
  // Auto-layout properties
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL'
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX'
  layoutAlign?: 'STRETCH' | 'INHERIT' | 'MIN' | 'CENTER' | 'MAX'
  layoutGrow?: number
  layoutPositioning?: 'AUTO' | 'ABSOLUTE'
  padding?: { top: number; right: number; bottom: number; left: number }
  itemSpacing?: number
  // Appearance
  fills?: Fill[]
  strokes?: Stroke[]
  strokeWeight?: number
  cornerRadius?: number
  opacity?: number
  effects?: Effect[]
  clipsContent?: boolean
  // Text properties
  characters?: string
  fontSize?: number
  fontWeight?: number
  fontFamily?: string
  textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED'
  textAlignVertical?: 'TOP' | 'CENTER' | 'BOTTOM'
  lineHeight?: number | { value: number; unit: 'PIXELS' | 'PERCENT' }
  letterSpacing?: number
  textCase?: 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE'
  textDecoration?: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH'
  // Component instance
  componentKey?: string
  componentProperties?: Record<string, string | boolean>
  // Children
  children?: ElementNode[]
}

export interface Fill {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'IMAGE'
  color?: { r: number; g: number; b: number }
  opacity?: number
  gradientStops?: Array<{ position: number; color: { r: number; g: number; b: number; a?: number } }>
  visible?: boolean
}

export interface Stroke {
  type: 'SOLID'
  color: { r: number; g: number; b: number }
  opacity?: number
}

export interface Effect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR'
  color?: { r: number; g: number; b: number; a: number }
  offset?: { x: number; y: number }
  radius?: number
  spread?: number
  visible?: boolean
}
