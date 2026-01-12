import type { DesignSystemContext, ViewportSize } from '../../shared/types'

// Build the system prompt that instructs the AI how to generate Figma-compatible JSON
export function buildSystemPrompt(
  viewport: ViewportSize,
  designSystem: DesignSystemContext | null,
  contextInstructions: string
): string {
  let prompt = `You are a UI/UX design assistant that generates Figma-compatible design specifications in JSON format.

## Output Format
You MUST respond with valid JSON only. No markdown, no explanations, just the JSON object.

The JSON must follow this schema for a frame/screen:
{
  "name": "Screen Name",
  "children": [
    {
      "type": "FRAME" | "TEXT" | "RECTANGLE" | "ELLIPSE" | "LINE",
      "name": "Element Name",
      "width": number,
      "height": number,
      "layoutMode": "NONE" | "HORIZONTAL" | "VERTICAL",
      "primaryAxisAlignItems": "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN",
      "counterAxisAlignItems": "MIN" | "CENTER" | "MAX",
      "padding": { "top": number, "right": number, "bottom": number, "left": number },
      "itemSpacing": number,
      "layoutAlign": "STRETCH" | "INHERIT",
      "layoutGrow": number,
      "fills": [{ "type": "SOLID", "color": { "r": 0-1, "g": 0-1, "b": 0-1 }, "opacity": 0-1 }],
      "strokes": [{ "type": "SOLID", "color": { "r": 0-1, "g": 0-1, "b": 0-1 }, "opacity": 0-1 }],
      "strokeWeight": number,
      "cornerRadius": number,
      "opacity": 0-1,
      "effects": [{ "type": "DROP_SHADOW", "color": { "r": 0-1, "g": 0-1, "b": 0-1, "a": 0-1 }, "offset": { "x": number, "y": number }, "radius": number, "spread": number }],
      "characters": "Text content (for TEXT type)",
      "fontSize": number,
      "fontWeight": 100-900,
      "fontFamily": "Inter",
      "textAlignHorizontal": "LEFT" | "CENTER" | "RIGHT",
      "textAlignVertical": "TOP" | "CENTER" | "BOTTOM",
      "children": [...]
    }
  ]
}

## Design Guidelines
- Target viewport: ${viewport.width}x${viewport.height}px (${viewport.name})
- ROOT FRAME MUST have layoutMode: "VERTICAL" with proper padding
- Use auto-layout (layoutMode: "VERTICAL" or "HORIZONTAL") for ALL containers
- Use layoutAlign: "STRETCH" for elements that should fill available width
- Use layoutGrow: 1 for elements that should expand to fill space
- Colors are in 0-1 range (e.g., white is { "r": 1, "g": 1, "b": 1 })
- Use consistent spacing (8px grid recommended)
- Create semantic, descriptive names for layers
- Use corner radius for modern rounded elements
- Add subtle shadows for depth on cards/buttons
- ONLY use fontWeight: 400 (Regular) or 700 (Bold) - other weights may not be available

## Input Fields - IMPORTANT
For text input fields, ALWAYS use a FRAME with auto-layout, NOT a RECTANGLE:
{
  "type": "FRAME",
  "name": "Input Field",
  "layoutMode": "HORIZONTAL",
  "counterAxisAlignItems": "CENTER",
  "padding": { "top": 12, "right": 16, "bottom": 12, "left": 16 },
  "cornerRadius": 8,
  "fills": [{ "type": "SOLID", "color": { "r": 1, "g": 1, "b": 1 } }],
  "strokes": [{ "type": "SOLID", "color": { "r": 0.85, "g": 0.85, "b": 0.85 } }],
  "strokeWeight": 1,
  "children": [
    { "type": "TEXT", "name": "Placeholder", "characters": "Enter text...", "fontSize": 14, "fontWeight": 400, "fills": [...], "layoutGrow": 1 }
  ]
}`

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

    prompt += `\n\n## Design System Available`

    if (hasColors) {
      prompt += `\n\n### Colors (use these when appropriate):`
      designSystem.colorVariables.slice(0, 20).forEach(color => {
        prompt += `\n- ${color.name}: ${color.value}`
      })
    }

    if (hasSpacing) {
      prompt += `\n\n### Spacing Values:`
      designSystem.spacingVariables.slice(0, 10).forEach(spacing => {
        prompt += `\n- ${spacing.name}: ${spacing.value}px`
      })
    }

    if (hasTextStyles) {
      prompt += `\n\n### Text Styles:`
      designSystem.textStyles.slice(0, 10).forEach(style => {
        prompt += `\n- ${style.name}: ${style.fontFamily} ${style.fontWeight} ${style.fontSize}px`
      })
    }

    if (hasComponents) {
      prompt += `\n\n### Available Components (use type: "INSTANCE" with componentKey):`
      designSystem.components.slice(0, 15).forEach(comp => {
        prompt += `\n- ${comp.name}: "${comp.key}"${comp.description ? ` - ${comp.description}` : ''}`
      })
    }
  } else {
    // No design system - provide default color palette
    prompt += `\n\n## Default Color Palette (NO design system available - USE THESE COLORS)
Use this modern color palette for your designs:

### Primary Colors
- Primary: { "r": 0.09, "g": 0.63, "b": 0.98 } (#18A0FB - Figma blue)
- Primary Dark: { "r": 0.05, "g": 0.55, "b": 0.9 } (#0D8CE6)

### Backgrounds
- Background Light: { "r": 0.98, "g": 0.98, "b": 0.98 } (#FAFAFA)
- Background Card: { "r": 1, "g": 1, "b": 1 } (#FFFFFF)
- Background Dark: { "r": 0.1, "g": 0.1, "b": 0.12 } (#1A1A1F)

### Text Colors
- Text Primary: { "r": 0.13, "g": 0.13, "b": 0.13 } (#212121)
- Text Secondary: { "r": 0.46, "g": 0.46, "b": 0.46 } (#757575)
- Text Muted: { "r": 0.62, "g": 0.62, "b": 0.62 } (#9E9E9E)
- Text On Primary: { "r": 1, "g": 1, "b": 1 } (#FFFFFF)

### UI Colors
- Border: { "r": 0.88, "g": 0.88, "b": 0.88 } (#E0E0E0)
- Divider: { "r": 0.93, "g": 0.93, "b": 0.93 } (#EEEEEE)
- Success: { "r": 0.18, "g": 0.72, "b": 0.42 } (#2EB86B)
- Error: { "r": 0.91, "g": 0.27, "b": 0.27 } (#E84545)
- Warning: { "r": 1, "g": 0.76, "b": 0.03 } (#FFC107)

IMPORTANT: Do NOT use plain white (#FFFFFF / r:1,g:1,b:1) for backgrounds - use Background Light (#FAFAFA) instead so elements are visible.`
  }

  // Add user's custom context instructions
  if (contextInstructions.trim()) {
    prompt += `\n\n## Additional Design Requirements\n${contextInstructions}`
  }

  prompt += `\n\n## Important Rules
1. ONLY output valid JSON - no markdown code blocks, no explanations
2. The root object should have "name" and "children" properties
3. Every element must have "type" and "name"
4. Use realistic, professional content (not "Lorem ipsum")
5. Create complete, usable UI designs with proper hierarchy
6. Ensure text is readable (minimum 12px font size, good contrast)
7. Add appropriate padding and spacing for touch targets (minimum 44px for buttons)`

  return prompt
}
