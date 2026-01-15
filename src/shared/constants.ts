/**
 * Centralized constants for the plugin
 * All magic values and configuration should live here
 */

// =============================================================================
// API CONFIGURATION
// =============================================================================

export const API_CONFIG = {
  CLAUDE: {
    URL: 'https://api.anthropic.com/v1/messages',
    MODEL: 'claude-sonnet-4-20250514',
    VERSION: '2023-06-01',
    MAX_TOKENS: 8192,
  },
  OPENAI: {
    URL: 'https://api.openai.com/v1/chat/completions',
    MODEL: 'gpt-4o',
    MAX_TOKENS: 8192,
  },
} as const

// =============================================================================
// DESIGN SYSTEM LIMITS
// =============================================================================

export const DESIGN_SYSTEM_LIMITS = {
  MAX_COLOR_VARIABLES: 50,  // Increased for token-based design systems
  MAX_SPACING_VARIABLES: 30, // Increased for spacing scales
  MAX_TEXT_STYLES: 25,
  MAX_COMPONENTS: 50,
} as const

// =============================================================================
// UI CONFIGURATION
// =============================================================================

export const UI_CONFIG = {
  /** Maximum characters before truncating streaming preview */
  STREAM_PREVIEW_MAX_LENGTH: 200,
  /** Characters to show in truncated preview */
  STREAM_PREVIEW_TRUNCATE_AT: 100,
  /** Minimum font size for readable text */
  MIN_FONT_SIZE: 12,
  /** Minimum touch target size for buttons */
  MIN_TOUCH_TARGET: 44,
  /** Maximum nesting depth to avoid truncation */
  MAX_NESTING_DEPTH: 4,
} as const

// =============================================================================
// DEFAULT VALUES
// =============================================================================

export const DEFAULTS = {
  FONT_FAMILY: 'Inter',
  FONT_STYLE: 'Regular',
  FONT_WEIGHT: 400,
  CORNER_RADIUS: 8,
  PADDING: 16,
  ITEM_SPACING: 8,
  STROKE_WEIGHT: 1,
  OPACITY: 1,
} as const

// =============================================================================
// EXAMPLE PROMPTS
// =============================================================================

export const EXAMPLE_PROMPTS = [
  {
    label: 'Login screen',
    prompt: 'Create a modern login screen with email and password fields',
  },
  {
    label: 'Settings page',
    prompt: 'Create a settings page with profile section and toggle options',
  },
  {
    label: 'Product card',
    prompt: 'Create a product card with image, title, price, and buy button',
  },
] as const

// =============================================================================
// ERROR MESSAGES
// =============================================================================

export const ERROR_MESSAGES = {
  NO_API_KEY: 'Please add an API key in settings',
  GENERATION_FAILED: 'Failed to generate design',
  JSON_PARSE_FAILED: 'Failed to parse response as JSON. The response may have been truncated. Try a simpler design request.',
  COMPONENT_NOT_FOUND: (key: string) => `Component ${key} not found, rendering as frame`,
  STYLE_NOT_FOUND: (name: string) => `Style "${name}" not found, using fallback`,
  VARIABLE_NOT_FOUND: (name: string) => `Variable "${name}" not found`,
} as const

// =============================================================================
// PLUGIN MESSAGES
// =============================================================================

export const PLUGIN_MESSAGE_TYPES = {
  // UI -> Plugin
  GENERATE_SCREEN: 'generate-screen',
  REGENERATE_SELECTION: 'regenerate-selection',
  SAVE_SETTINGS: 'save-settings',
  LOAD_SETTINGS: 'load-settings',
  GET_SELECTION: 'get-selection',
  REFRESH_DESIGN_SYSTEM: 'refresh-design-system',
  RENDER_DESIGN: 'render-design',
  REQUEST_SELECTION_DATA: 'request-selection-data',

  // Plugin -> UI
  SETTINGS_LOADED: 'settings-loaded',
  SELECTION_CHANGED: 'selection-changed',
  DESIGN_SYSTEM_LOADED: 'design-system-loaded',
  GENERATION_STARTED: 'generation-started',
  GENERATION_PROGRESS: 'generation-progress',
  GENERATION_COMPLETE: 'generation-complete',
  SELECTION_DATA: 'selection-data',
  ERROR: 'error',
} as const

// =============================================================================
// LAYOUT CONSTANTS
// =============================================================================

export const LAYOUT = {
  MODES: {
    NONE: 'NONE',
    HORIZONTAL: 'HORIZONTAL',
    VERTICAL: 'VERTICAL',
  },
  SIZING: {
    FIXED: 'FIXED',
    HUG: 'HUG',
    FILL: 'FILL',
  },
  ALIGN: {
    MIN: 'MIN',
    CENTER: 'CENTER',
    MAX: 'MAX',
    SPACE_BETWEEN: 'SPACE_BETWEEN',
    STRETCH: 'STRETCH',
    INHERIT: 'INHERIT',
  },
} as const
