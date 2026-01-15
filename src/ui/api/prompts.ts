/**
 * System prompt builder for AI design generation
 */

import type { CustomColorPalette, DesignSystemContext, ViewportSize } from '../../shared/types'
import { DEFAULT_COLOR_PALETTE } from '../../shared/types'
import { DESIGN_SYSTEM_LIMITS } from '../../shared/constants'
import { formatColorForPrompt } from '../../shared/utils/colors'

// Build the system prompt that instructs the AI how to generate Figma-compatible JSON
export function buildSystemPrompt(
  viewport: ViewportSize,
  designSystem: DesignSystemContext | null,
  contextInstructions: string,
  customColors?: CustomColorPalette
): string {
  let prompt = `You are a UI/UX design assistant that generates Figma-compatible design specifications in JSON format.

## Output Format
You MUST respond with valid JSON only. No markdown, no explanations, just the JSON object.

## CRITICAL: Frame Sizing
Every FRAME must have sizing modes set to prevent 1px wide/tall elements:
- "primaryAxisSizingMode": "HUG" | "FILL" | "FIXED" - how frame sizes along its layout direction
- "counterAxisSizingMode": "HUG" | "FILL" | "FIXED" - how frame sizes perpendicular to layout

SIZING RULES:
- Root frame: primaryAxisSizingMode: "HUG", counterAxisSizingMode: "FIXED" (uses viewport width)
- Container frames: Usually "HUG" for both (wraps content)
- Full-width elements: Use "layoutAlign": "STRETCH" to fill parent width
- Growing elements: Use "layoutGrow": 1 to expand in parent's direction

The JSON must follow this schema for a frame/screen:
{
  "name": "Screen Name",
  "layoutMode": "VERTICAL",
  "primaryAxisSizingMode": "HUG",
  "counterAxisSizingMode": "FIXED",
  "children": [
    {
      "type": "FRAME" | "TEXT" | "RECTANGLE" | "ELLIPSE" | "LINE",
      "name": "Element Name",
      "layoutMode": "NONE" | "HORIZONTAL" | "VERTICAL",
      "primaryAxisSizingMode": "HUG" | "FILL" | "FIXED",
      "counterAxisSizingMode": "HUG" | "FILL" | "FIXED",
      "primaryAxisAlignItems": "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN",
      "counterAxisAlignItems": "MIN" | "CENTER" | "MAX",
      "padding": { "top": number, "right": number, "bottom": number, "left": number },
      "itemSpacing": number,
      "layoutAlign": "STRETCH" | "INHERIT",
      "layoutGrow": number,
      "fills": [...],
      "strokes": [...],
      "strokeWeight": number,
      "cornerRadius": number,
      "effects": [...],
      "children": [...]
    }
  ]
}

## Design Guidelines
- Target viewport: ${viewport.width}x${viewport.height}px (${viewport.name})
- ROOT FRAME MUST have layoutMode: "VERTICAL" with proper padding
- Use auto-layout (layoutMode: "VERTICAL" or "HORIZONTAL") for ALL containers
- EVERY FRAME must have primaryAxisSizingMode and counterAxisSizingMode set
- Use layoutAlign: "STRETCH" for elements that should fill parent width
- Colors are in 0-1 range (e.g., white is { "r": 1, "g": 1, "b": 1 })
- Create semantic, descriptive names for layers`

  // Add design system context if available
  const hasDesignSystem = designSystem && (
    designSystem.colorVariables.length > 0 ||
    designSystem.spacingVariables.length > 0 ||
    designSystem.textStyles.length > 0 ||
    designSystem.components.length > 0
  )

  if (hasDesignSystem && designSystem) {
    const hasColors = designSystem.colorVariables.length > 0
    const hasSpacing = designSystem.spacingVariables.length > 0
    const hasTextStyles = designSystem.textStyles.length > 0
    const hasComponents = designSystem.components.length > 0

    prompt += `

## DESIGN SYSTEM TOKENS - MANDATORY USAGE
This file has semantic design tokens. You MUST use these tokens by name - NEVER use raw values.`

    if (hasColors) {
      // ONLY show token names - DO NOT show hex values so AI can't use raw colors
      const colorList = designSystem.colorVariables
        .slice(0, DESIGN_SYSTEM_LIMITS.MAX_COLOR_VARIABLES)
        .map(c => `- "${c.name}"`)
        .join('\n')

      prompt += `

### COLOR TOKENS - USE "colorVariable" ONLY (MANDATORY)
You MUST use these exact token names for ALL colors. Raw RGB/hex values are NOT allowed.

Available color tokens:
${colorList}

ONLY valid format - use colorVariable with exact token name:
"fills": [{ "type": "SOLID", "colorVariable": "Background/Primary" }]
"strokes": [{ "type": "SOLID", "colorVariable": "Border/Default" }]

INVALID - these formats will cause errors:
"fills": [{ "type": "SOLID", "color": { "r": 1, "g": 1, "b": 1 } }]
"fills": [{ "type": "SOLID", "color": "#FFFFFF" }]

Pick the most semantically appropriate token for each use case.`
    }

    if (hasSpacing) {
      // Show spacing tokens with values (needed for AI to pick appropriate sizes)
      const spacingList = designSystem.spacingVariables
        .slice(0, DESIGN_SYSTEM_LIMITS.MAX_SPACING_VARIABLES)
        .map(s => `- "${s.name}" = ${s.value}px`)
        .join('\n')

      prompt += `

### SPACING TOKENS - USE "paddingVariable" and "itemSpacingVariable" (MANDATORY)
You MUST use these exact token names for ALL spacing. Raw numbers are NOT allowed.

Available spacing tokens:
${spacingList}

ONLY valid format - use variable names:
"paddingVariable": "Spacing/md"
"itemSpacingVariable": "Spacing/sm"

INVALID - these formats will cause errors:
"padding": { "top": 16, "right": 16, "bottom": 16, "left": 16 }
"itemSpacing": 8

Pick the token with the closest value for your needs.`
    }

    if (hasTextStyles) {
      prompt += `

### TEXT STYLES - USE "textStyleName" (REQUIRED)
Available text styles (use exact name string):
${designSystem.textStyles.slice(0, DESIGN_SYSTEM_LIMITS.MAX_TEXT_STYLES).map(s => `- "${s.name}" (${s.fontFamily} ${s.fontWeight} ${s.fontSize}px)`).join('\n')}

CORRECT:
{ "type": "TEXT", "characters": "Hello", "textStyleName": "Body/Regular" }

WRONG - Never set font properties manually:
{ "type": "TEXT", "characters": "Hello", "fontSize": 16, "fontFamily": "Inter" }`
    }

    if (hasComponents) {
      prompt += `

### Available Components (use type: "INSTANCE" with componentKey):
${designSystem.components.slice(0, DESIGN_SYSTEM_LIMITS.MAX_COMPONENTS).map(c => `- ${c.name}: "${c.key}"${c.description ? ` - ${c.description}` : ''}`).join('\n')}`
    }

    prompt += `

## STRICT TOKEN RULES - FOLLOW EXACTLY
1. COLORS: Use "colorVariable" with token name - NEVER raw RGB values
2. TEXT: Use "textStyleName" - NEVER fontSize/fontFamily/fontWeight
3. SPACING: Use "paddingVariable"/"itemSpacingVariable" - NEVER raw numbers
4. Choose semantically appropriate tokens (e.g., "Background/Primary" for main bg, "Text/Primary" for main text)
5. If a token name seems appropriate for the context, USE IT`

  } else {
    // No design system - use custom colors or defaults
    const colors = customColors || DEFAULT_COLOR_PALETTE

    prompt += `

## Color Palette (USE THESE COLORS)
Use this color palette for your designs:

### Primary Colors
- Primary: ${formatColorForPrompt(colors.primary)}
- Primary Dark: ${formatColorForPrompt(colors.primaryDark)}

### Backgrounds
- Background: ${formatColorForPrompt(colors.background)}
- Card Background: ${formatColorForPrompt(colors.backgroundCard)}

### Text Colors
- Text Primary: ${formatColorForPrompt(colors.textPrimary)}
- Text Secondary: ${formatColorForPrompt(colors.textSecondary)}

### UI Colors
- Border: ${formatColorForPrompt(colors.border)}
- Success: ${formatColorForPrompt(colors.success)}
- Error: ${formatColorForPrompt(colors.error)}
- Warning: ${formatColorForPrompt(colors.warning)}

Use Background (${colors.background}) for page backgrounds.
Use fontFamily: "Inter", fontWeight: 400 or 700.`
  }

  // Add user's custom context instructions
  if (contextInstructions.trim()) {
    prompt += `

## Additional Design Requirements
${contextInstructions}`
  }

  prompt += `

## Input Fields Example (using tokens)
For text input fields, use a FRAME with design tokens:
{
  "type": "FRAME",
  "name": "Input Field",
  "layoutMode": "HORIZONTAL",
  "primaryAxisSizingMode": "HUG",
  "counterAxisSizingMode": "HUG",
  "counterAxisAlignItems": "CENTER",
  "paddingVariable": "Spacing/md",
  "itemSpacingVariable": "Spacing/sm",
  "cornerRadius": 8,
  "fills": [{ "type": "SOLID", "colorVariable": "Background/Secondary" }],
  "strokes": [{ "type": "SOLID", "colorVariable": "Border/Default" }],
  "strokeWeight": 1,
  "layoutAlign": "STRETCH",
  "children": [
    { "type": "TEXT", "name": "Placeholder", "characters": "Enter text...", "textStyleName": "Body/Regular", "fills": [{ "type": "SOLID", "colorVariable": "Text/Secondary" }], "layoutGrow": 1 }
  ]
}

## Important Rules
1. ONLY output valid JSON - no markdown code blocks, no explanations
2. The root object should have "name" and "children" properties
3. Every FRAME must have primaryAxisSizingMode and counterAxisSizingMode
4. Use realistic content (not "Lorem ipsum")
5. Ensure good touch targets (minimum 44px for buttons)
6. counterAxisAlignItems can ONLY be: "MIN", "CENTER", "MAX"
7. Max 3-4 levels of nesting to avoid truncation
8. ALWAYS use design tokens - colorVariable, paddingVariable, itemSpacingVariable, textStyleName`

  return prompt
}
