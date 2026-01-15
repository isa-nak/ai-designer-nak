// AI Provider types
export type AIProvider = 'claude' | 'openai'

export interface AIProviderConfig {
  id: AIProvider
  name: string
  model: string
  hasKey: boolean
}

export const AI_PROVIDERS: Record<AIProvider, Omit<AIProviderConfig, 'hasKey'>> = {
  claude: { id: 'claude', name: 'Claude', model: 'Sonnet' },
  openai: { id: 'openai', name: 'OpenAI', model: 'GPT-4o' },
}

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

// Custom color palette for when no design system is available
export interface CustomColorPalette {
  primary: string
  primaryDark: string
  background: string
  backgroundCard: string
  textPrimary: string
  textSecondary: string
  border: string
  success: string
  error: string
  warning: string
}

export const DEFAULT_COLOR_PALETTE: CustomColorPalette = {
  primary: '#18A0FB',
  primaryDark: '#0D8CE6',
  background: '#FAFAFA',
  backgroundCard: '#FFFFFF',
  textPrimary: '#212121',
  textSecondary: '#757575',
  border: '#E0E0E0',
  success: '#2EB86B',
  error: '#E84545',
  warning: '#FFC107',
}

export interface PluginSettings {
  claudeApiKey: string
  openaiApiKey: string
  selectedProvider: AIProvider
  contextInstructions: string
  viewport: ViewportPreset
  customColors: CustomColorPalette
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
  isToken: boolean // True if this is a semantic token (alias), false if primitive
  description?: string // Optional description for better AI context
}

export interface TextStyleInfo {
  id: string
  name: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  lineHeight?: number
  letterSpacing?: number
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
  // Spacing variable references (use instead of raw numbers)
  paddingVariable?: string
  itemSpacingVariable?: string
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
  primaryAxisSizingMode?: 'FIXED' | 'HUG' | 'FILL'
  counterAxisSizingMode?: 'FIXED' | 'HUG' | 'FILL'
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX'
  layoutAlign?: 'STRETCH' | 'INHERIT' | 'MIN' | 'CENTER' | 'MAX'
  layoutGrow?: number
  layoutPositioning?: 'AUTO' | 'ABSOLUTE'
  padding?: { top: number; right: number; bottom: number; left: number }
  itemSpacing?: number
  // Spacing variable references (use instead of raw numbers)
  paddingVariable?: string
  itemSpacingVariable?: string
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
  textStyleName?: string  // Reference to Figma text style by name
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

// Extended fill with variable reference
export interface Fill {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'IMAGE'
  color?: { r: number; g: number; b: number }
  colorVariable?: string  // Reference to color variable by name
  opacity?: number
  gradientStops?: Array<{ position: number; color: { r: number; g: number; b: number; a?: number } }>
  visible?: boolean
}

// Extended stroke with variable reference
export interface Stroke {
  type: 'SOLID'
  color?: { r: number; g: number; b: number }
  colorVariable?: string  // Reference to color variable by name
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
