import type { CustomColorPalette, DesignSystemContext, FrameNode, ViewportSize } from '../../shared/types'
import { buildSystemPrompt } from './prompts'

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'

interface GenerationOptions {
  prompt: string
  apiKey: string
  viewport: ViewportSize
  designSystem: DesignSystemContext | null
  contextInstructions: string
  customColors?: CustomColorPalette
  imageData?: string
  existingDesign?: FrameNode
  onProgress?: (text: string) => void
}

interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }>
}

// Stream design generation from Claude
export async function streamClaudeGeneration(
  options: GenerationOptions
): Promise<FrameNode> {
  const { prompt, apiKey, viewport, designSystem, contextInstructions, customColors, imageData, existingDesign, onProgress } = options

  const systemPrompt = buildSystemPrompt(viewport, designSystem, contextInstructions, customColors)

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
    throw new Error(`Claude API error: ${response.status} - ${errorText}`)
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
        }
      }
    }
  }

  // Parse the final JSON
  const design = parseDesignJson(fullText)
  return design
}

// Attempt to repair truncated JSON
function repairTruncatedJson(text: string): string {
  let json = text.trim()

  // Remove any trailing incomplete content after the last complete structure
  // Find the last complete property value
  const lastCompleteIndex = findLastCompleteIndex(json)
  if (lastCompleteIndex > 0 && lastCompleteIndex < json.length - 1) {
    json = json.slice(0, lastCompleteIndex + 1)
  }

  // Count unclosed brackets
  let braceCount = 0
  let bracketCount = 0
  let inString = false
  let escapeNext = false

  for (const char of json) {
    if (escapeNext) {
      escapeNext = false
      continue
    }
    if (char === '\\') {
      escapeNext = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue

    if (char === '{') braceCount++
    else if (char === '}') braceCount--
    else if (char === '[') bracketCount++
    else if (char === ']') bracketCount--
  }

  // Close any unclosed strings (rough heuristic)
  if (inString) {
    json += '"'
  }

  // Remove trailing comma if present
  json = json.replace(/,\s*$/, '')

  // Close unclosed brackets and braces
  while (bracketCount > 0) {
    json += ']'
    bracketCount--
  }
  while (braceCount > 0) {
    json += '}'
    braceCount--
  }

  return json
}

// Find the last index where we have a complete JSON value
function findLastCompleteIndex(json: string): number {
  let lastGoodIndex = -1
  let braceCount = 0
  let bracketCount = 0
  let inString = false
  let escapeNext = false

  for (let i = 0; i < json.length; i++) {
    const char = json[i]

    if (escapeNext) {
      escapeNext = false
      continue
    }
    if (char === '\\') {
      escapeNext = true
      continue
    }
    if (char === '"') {
      inString = !inString
      if (!inString) lastGoodIndex = i
      continue
    }
    if (inString) continue

    if (char === '{') braceCount++
    else if (char === '}') {
      braceCount--
      if (braceCount >= 0) lastGoodIndex = i
    } else if (char === '[') bracketCount++
    else if (char === ']') {
      bracketCount--
      if (bracketCount >= 0) lastGoodIndex = i
    } else if (char === ',' || char === ':') {
      lastGoodIndex = i
    } else if (/\d/.test(char)) {
      lastGoodIndex = i
    }
  }

  return lastGoodIndex
}

// Parse design JSON from response
function parseDesignJson(text: string): FrameNode {
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
  } else if (firstBrace !== -1) {
    // JSON might be truncated - extract from first brace
    jsonText = jsonText.slice(firstBrace)
  }

  // First attempt: try parsing as-is
  try {
    const parsed = JSON.parse(jsonText)
    if (parsed.name || parsed.children) {
      return parsed as FrameNode
    }
  } catch {
    // Continue to repair attempt
  }

  // Second attempt: try repairing truncated JSON
  try {
    const repairedJson = repairTruncatedJson(jsonText)
    const parsed = JSON.parse(repairedJson)

    if (!parsed.name && !parsed.children) {
      throw new Error('Invalid design structure: missing name or children')
    }

    console.log('Successfully repaired truncated JSON')
    return parsed as FrameNode
  } catch (e) {
    console.error('Failed to parse design JSON:', e)
    console.error('Raw text:', text.slice(0, 500) + '...')
    throw new Error(`Failed to parse response as JSON. The response may have been truncated. Try a simpler design request.`)
  }
}
