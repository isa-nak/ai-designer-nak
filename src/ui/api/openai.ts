import type { DesignSystemContext, FrameNode, ViewportSize } from '../../shared/types'
import { buildSystemPrompt } from './prompts'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

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

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
}

// Stream design generation from OpenAI
export async function streamOpenAIGeneration(
  options: GenerationOptions
): Promise<FrameNode> {
  const { prompt, apiKey, viewport, designSystem, contextInstructions, imageData, existingDesign, onProgress } = options

  const systemPrompt = buildSystemPrompt(viewport, designSystem, contextInstructions)

  // Build user message
  let userContent: OpenAIMessage['content']

  if (imageData) {
    // Include image reference
    userContent = [
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
  } else if (existingDesign) {
    userContent = `Here is the current design:\n${JSON.stringify(existingDesign, null, 2)}\n\nUser request: ${prompt}\n\nGenerate the updated design JSON maintaining the overall structure but applying the requested changes:`
  } else {
    userContent = `Create a ${viewport.name.toLowerCase()} screen design for: ${prompt}\n\nGenerate the design JSON:`
  }

  const messages: OpenAIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ]

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 8192,
      messages,
      stream: true,
    }),
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
    buffer = lines.pop() || '' // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') continue

        try {
          const event = JSON.parse(data)
          const delta = event.choices?.[0]?.delta?.content

          if (delta) {
            fullText += delta
            onProgress?.(fullText)
          }

          if (event.choices?.[0]?.finish_reason === 'stop') {
            break
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
  }

  try {
    const parsed = JSON.parse(jsonText)

    if (!parsed.name && !parsed.children) {
      throw new Error('Invalid design structure: missing name or children')
    }

    return parsed as FrameNode
  } catch (e) {
    console.error('Failed to parse design JSON:', e)
    console.error('Raw text:', text)
    throw new Error(`Failed to parse OpenAI's response as JSON. The AI may have returned an invalid format.`)
  }
}
