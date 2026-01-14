/**
 * OpenAI API handler for design generation
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

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
}

/**
 * Build the user message content based on inputs
 */
function buildUserContent(
  prompt: string,
  viewport: ViewportSize,
  imageData?: string,
  existingDesign?: FrameNode
): OpenAIMessage['content'] {
  if (imageData) {
    return [
      {
        type: 'image_url',
        image_url: { url: imageData },
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
 * Stream design generation from OpenAI API
 */
export async function streamOpenAIGeneration(options: GenerationOptions): Promise<FrameNode> {
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

  const messages: OpenAIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ]

  const response = await fetch(API_CONFIG.OPENAI.URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: API_CONFIG.OPENAI.MODEL,
      max_tokens: API_CONFIG.OPENAI.MAX_TOKENS,
      messages,
      stream: true,
    }),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
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
          const content = event.choices?.[0]?.delta?.content

          if (content) {
            fullText += content
            onProgress?.(fullText)
          }

          if (event.choices?.[0]?.finish_reason === 'stop') {
            break
          }
        } catch {
          // Ignore JSON parse errors for non-JSON lines
        }
      }
    }
  }

  return parseDesignJson(fullText)
}
