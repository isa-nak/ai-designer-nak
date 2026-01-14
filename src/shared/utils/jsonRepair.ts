/**
 * JSON repair utilities for handling truncated AI responses
 */

import type { FrameNode } from '../types'

/**
 * Find the last index where we have a complete JSON value
 */
export function findLastCompleteIndex(json: string): number {
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

    if (char === '{') {
      braceCount++
    } else if (char === '}') {
      braceCount--
      if (braceCount >= 0) lastGoodIndex = i
    } else if (char === '[') {
      bracketCount++
    } else if (char === ']') {
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

/**
 * Attempt to repair truncated JSON by closing open brackets/braces
 */
export function repairTruncatedJson(text: string): string {
  let json = text.trim()

  // Remove any trailing incomplete content after the last complete structure
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

/**
 * Parse design JSON from AI response text
 * Handles markdown code blocks and truncated responses
 */
export function parseDesignJson(text: string): FrameNode {
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
    throw new Error('Failed to parse response as JSON. The response may have been truncated. Try a simpler design request.')
  }
}
