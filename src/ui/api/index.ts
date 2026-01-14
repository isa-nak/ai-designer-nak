import type { AIProvider, CustomColorPalette, DesignSystemContext, FrameNode, ViewportSize } from '../../shared/types'
import { streamClaudeGeneration } from './claude'
import { streamOpenAIGeneration } from './openai'

export interface GenerationOptions {
  prompt: string
  provider: AIProvider
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

// Unified design generation function that routes to the appropriate provider
export async function generateDesign(options: GenerationOptions): Promise<FrameNode> {
  const { provider, ...rest } = options

  switch (provider) {
    case 'claude':
      return streamClaudeGeneration(rest)
    case 'openai':
      return streamOpenAIGeneration(rest)
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

// Re-export for convenience
export { streamClaudeGeneration } from './claude'
export { streamOpenAIGeneration } from './openai'
export { buildSystemPrompt } from './prompts'
