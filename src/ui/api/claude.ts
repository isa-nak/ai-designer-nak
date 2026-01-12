import type { DesignSystemContext, FrameNode, ViewportSize } from '../../shared/types'

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'

interface GenerationOptions {
  prompt: string
  apiKey: string
  viewport: ViewportSize
  designSystem: DesignSystemContext | null
  contextInstructions: string
  imageData?: string
  existingDesign?: FrameNode
  onProgress?: (text: string) => void
}

interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }>
}

// Build the system prompt that instructs Claude how to generate Figma-compatible JSON
function buildSystemPrompt(
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
- Use auto-layout (layoutMode: "VERTICAL" or "HORIZONTAL") for responsive designs
- Use layoutAlign: "STRETCH" for elements that should fill available width
- Use layoutGrow: 1 for elements that should expand to fill space
- Colors are in 0-1 range (e.g., white is { "r": 1, "g": 1, "b": 1 })
- Use consistent spacing (8px grid recommended)
- Create semantic, descriptive names for layers
- Use corner radius for modern rounded elements
- Add subtle shadows for depth on cards/buttons`

  // Add design system context if available
  if (designSystem) {
    const hasColors = designSystem.colorVariables.length > 0
    const hasSpacing = designSystem.spacingVariables.length > 0
    const hasTextStyles = designSystem.textStyles.length > 0
    const hasComponents = designSystem.components.length > 0

    if (hasColors || hasSpacing || hasTextStyles || hasComponents) {
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
    }
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

// Stream design generation from Claude
export async function streamDesignGeneration(
  options: GenerationOptions
): Promise<FrameNode> {
  const { prompt, apiKey, viewport, designSystem, contextInstructions, imageData, existingDesign, onProgress } = options

  const systemPrompt = buildSystemPrompt(viewport, designSystem, contextInstructions)

  // Build user message
  let userContent: ClaudeMessage['content']

  if (imageData) {
    // Include image reference
    const base64Data = imageData.split(',')[1] || imageData
    const mediaType = imageData.includes('png') ? 'image/png' : 'image/jpeg'

    userContent = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Data,
        },
      },
      {
        type: 'text',
        text: existingDesign
          ? `Here is the current design:\n${JSON.stringify(existingDesign, null, 2)}\n\nUser request: ${prompt}\n\nGenerate the updated design JSON:`
          : `Reference the attached image for visual inspiration.\n\nUser request: ${prompt}\n\nGenerate the design JSON:`,
      },
    ]
  } else if (existingDesign) {
    userContent = `Here is the current design:\n${JSON.stringify(existingDesign, null, 2)}\n\nUser request: ${prompt}\n\nGenerate the updated design JSON maintaining the overall structure but applying the requested changes:`
  } else {
    userContent = `Create a ${viewport.name.toLowerCase()} screen design for: ${prompt}\n\nGenerate the design JSON:`
  }

  const messages: ClaudeMessage[] = [
    { role: 'user', content: userContent },
  ]

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages,
      stream: true,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API error: ${response.status} - ${errorText}`)
  }

  if (!response.body) {
    throw new Error('No response body')
  }

  // Process streaming response
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Process complete SSE events
    const lines = buffer.split('\n')
    buffer = lines.pop() || '' // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') continue

        try {
          const event = JSON.parse(data)

          if (event.type === 'content_block_delta' && event.delta?.text) {
            fullText += event.delta.text
            onProgress?.(fullText)
          }

          if (event.type === 'message_stop') {
            break
          }

          if (event.type === 'error') {
            throw new Error(event.error?.message || 'Stream error')
          }
        } catch (e) {
          // Ignore JSON parse errors for non-JSON lines
          if (data.trim() && !data.startsWith('event:')) {
            console.warn('Failed to parse SSE data:', data)
          }
        }
      }
    }
  }

  // Parse the final JSON
  const design = parseDesignJson(fullText)
  return design
}

// Parse design JSON from Claude's response
function parseDesignJson(text: string): FrameNode {
  // Try to extract JSON from the response
  let jsonText = text.trim()

  // Remove markdown code blocks if present
  if (jsonText.startsWith('```')) {
    const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) {
      jsonText = match[1].trim()
    }
  }

  // Try to find JSON object boundaries
  const firstBrace = jsonText.indexOf('{')
  const lastBrace = jsonText.lastIndexOf('}')

  if (firstBrace !== -1 && lastBrace !== -1) {
    jsonText = jsonText.slice(firstBrace, lastBrace + 1)
  }

  try {
    const parsed = JSON.parse(jsonText)

    // Validate basic structure
    if (!parsed.name && !parsed.children) {
      throw new Error('Invalid design structure: missing name or children')
    }

    return parsed as FrameNode
  } catch (e) {
    console.error('Failed to parse design JSON:', e)
    console.error('Raw text:', text)
    throw new Error(`Failed to parse Claude's response as JSON. The AI may have returned an invalid format.`)
  }
}

// Non-streaming fallback (simpler, for testing)
export async function generateDesign(options: Omit<GenerationOptions, 'onProgress'>): Promise<FrameNode> {
  return streamDesignGeneration({ ...options, onProgress: undefined })
}
