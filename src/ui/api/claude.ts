/**
 * Claude API handler for design generation
 */

import type { CustomColorPalette, DesignSystemContext, FrameNode, ViewportSize } from '../../shared/types'
import { API_CONFIG } from '../../shared/constants'
import { parseDesignJson } from '../../shared/utils/jsonRepair'
import { buildSystemPrompt } from './prompts'

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
  signal?: AbortSignal
}

interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }>
}

/**
 * Build the user message content based on inputs
 */
function buildUserContent(
  prompt: string,
  viewport: ViewportSize,
  imageData?: string,
  existingDesign?: FrameNode
): ClaudeMessage['content'] {
  if (imageData) {
    const base64Data = imageData.split(',')[1] || imageData
    const mediaType = imageData.includes('png') ? 'image/png' : 'image/jpeg'

    return [
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
  }

  if (existingDesign) {
    return `Here is the current design:\n${JSON.stringify(existingDesign, null, 2)}\n\nUser request: ${prompt}\n\nGenerate the updated design JSON maintaining the overall structure but applying the requested changes:`
  }

  return `Create a ${viewport.name.toLowerCase()} screen design for: ${prompt}\n\nGenerate the design JSON:`
}

/**
 * Stream design generation from Claude API
 */
export async function streamClaudeGeneration(options: GenerationOptions): Promise<FrameNode> {
  const {
    prompt,
    apiKey,
    viewport,
    designSystem,
    contextInstructions,
    customColors,
    imageData,
    existingDesign,
    onProgress,
    signal,
  } = options

  const systemPrompt = buildSystemPrompt(viewport, designSystem, contextInstructions, customColors)
  const userContent = buildUserContent(prompt, viewport, imageData, existingDesign)

  const messages: ClaudeMessage[] = [{ role: 'user', content: userContent }]

  const response = await fetch(API_CONFIG.CLAUDE.URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': API_CONFIG.CLAUDE.VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: API_CONFIG.CLAUDE.MODEL,
      max_tokens: API_CONFIG.CLAUDE.MAX_TOKENS,
      system: systemPrompt,
      messages,
      stream: true,
    }),
    signal,
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
    buffer = lines.pop() || ''

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
        } catch {
          // Ignore JSON parse errors for non-JSON lines
        }
      }
    }
  }

  return parseDesignJson(fullText)
}
