import type { MessageToPlugin, MessageToUI, PluginSettings, DesignSystemContext, SelectionInfo, ViewportSize } from '../shared/types'
import { DEFAULT_COLOR_PALETTE } from '../shared/types'
import { renderDesign } from './renderer'
import { serializeSelection } from './serializer'

figma.showUI(__html__, { width: 420, height: 650 })

// Store design system for rendering
let cachedDesignSystem: DesignSystemContext | null = null

// Handle messages from UI
figma.ui.onmessage = async (msg: MessageToPlugin) => {
  switch (msg.type) {
    case 'render-design':
      await handleRenderDesign(msg.design, msg.viewport)
      break
    case 'request-selection-data':
      await handleRequestSelectionData()
      break
    case 'save-settings':
      await saveSettings(msg.settings)
      break
    case 'load-settings':
      await loadSettings()
      break
    case 'get-selection':
      sendSelectionInfo()
      break
    case 'refresh-design-system':
      await sendDesignSystem()
      break
    // Legacy message types (kept for backwards compatibility)
    case 'generate-screen':
    case 'regenerate-selection':
      // These are now handled in UI with Claude API
      break
  }
}

// Track selection changes
figma.on('selectionchange', () => {
  sendSelectionInfo()
})

// Initialize
async function init() {
  await loadSettings()
  await sendDesignSystem()
  sendSelectionInfo()
}

init()

// Settings management
async function saveSettings(settings: PluginSettings) {
  await figma.clientStorage.setAsync('settings', settings)
}

async function loadSettings() {
  const settings = await figma.clientStorage.getAsync('settings') as PluginSettings | undefined
  sendToUI({
    type: 'settings-loaded',
    settings: settings || {
      claudeApiKey: '',
      openaiApiKey: '',
      selectedProvider: 'claude',
      contextInstructions: '',
      viewport: 'mobile',
      customColors: DEFAULT_COLOR_PALETTE
    }
  })
}

// Selection handling
function sendSelectionInfo() {
  const selection = figma.currentPage.selection
  if (selection.length === 0) {
    sendToUI({ type: 'selection-changed', selection: null })
    return
  }

  const first = selection[0]
  const info: SelectionInfo = {
    id: first.id,
    name: first.name,
    type: first.type,
    hasMultiple: selection.length > 1,
    count: selection.length
  }
  sendToUI({ type: 'selection-changed', selection: info })
}

// Handle request for selection data (for regeneration)
async function handleRequestSelectionData() {
  const data = serializeSelection()
  sendToUI({ type: 'selection-data', data })
}

// Design system extraction
async function sendDesignSystem() {
  const designSystem = await extractDesignSystem()
  cachedDesignSystem = designSystem
  sendToUI({ type: 'design-system-loaded', designSystem })
}

async function extractDesignSystem(): Promise<DesignSystemContext> {
  const colorVariables: DesignSystemContext['colorVariables'] = []
  const spacingVariables: DesignSystemContext['spacingVariables'] = []

  // Extract local variables
  try {
    const collections = await figma.variables.getLocalVariableCollectionsAsync()
    for (const collection of collections) {
      for (const variableId of collection.variableIds) {
        const variable = await figma.variables.getVariableByIdAsync(variableId)
        if (!variable) continue

        const modeId = Object.keys(variable.valuesByMode)[0]
        const value = variable.valuesByMode[modeId]

        if (variable.resolvedType === 'COLOR' && typeof value === 'object' && 'r' in value) {
          colorVariables.push({
            id: variable.id,
            name: variable.name,
            collection: collection.name,
            value: rgbToHex(value as RGB)
          })
        } else if (variable.resolvedType === 'FLOAT' && typeof value === 'number') {
          spacingVariables.push({
            id: variable.id,
            name: variable.name,
            collection: collection.name,
            value: value
          })
        }
      }
    }
  } catch (e) {
    // Variables API might not be available
    console.log('Could not extract variables:', e)
  }

  // Extract text styles
  const textStyles: DesignSystemContext['textStyles'] = []
  try {
    const localTextStyles = await figma.getLocalTextStylesAsync()
    for (const style of localTextStyles) {
      textStyles.push({
        id: style.id,
        name: style.name,
        fontFamily: style.fontName.family,
        fontSize: style.fontSize as number,
        fontWeight: getFontWeight(style.fontName.style)
      })
    }
  } catch (e) {
    console.log('Could not extract text styles:', e)
  }

  // Extract local components
  const components: DesignSystemContext['components'] = []
  try {
    const localComponents = figma.root.findAllWithCriteria({ types: ['COMPONENT'] })
    for (const comp of localComponents.slice(0, 50)) { // Limit to 50
      components.push({
        key: comp.key,
        name: comp.name,
        description: comp.description || undefined
      })
    }
  } catch (e) {
    console.log('Could not extract components:', e)
  }

  return { colorVariables, spacingVariables, textStyles, components }
}

function rgbToHex(color: RGB): string {
  const r = Math.round(color.r * 255)
  const g = Math.round(color.g * 255)
  const b = Math.round(color.b * 255)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function getFontWeight(style: string): number {
  const weights: Record<string, number> = {
    'Thin': 100, 'ExtraLight': 200, 'Light': 300, 'Regular': 400,
    'Medium': 500, 'SemiBold': 600, 'Bold': 700, 'ExtraBold': 800, 'Black': 900
  }
  return weights[style] || 400
}

// Render design from Claude's JSON output
async function handleRenderDesign(design: any, viewport: ViewportSize) {
  sendToUI({ type: 'generation-started' })

  try {
    // If there's a selection, we might want to replace it
    const selection = figma.currentPage.selection
    let shouldReplace = false
    let replaceNode: SceneNode | null = null

    if (selection.length === 1) {
      const selected = selection[0]
      if (selected.type === 'FRAME' || selected.type === 'COMPONENT' || selected.type === 'INSTANCE') {
        shouldReplace = true
        replaceNode = selected
      }
    }

    // Render the new design
    const frame = await renderDesign(design, viewport, cachedDesignSystem)

    if (shouldReplace && replaceNode) {
      // Position new frame where the old one was
      frame.x = replaceNode.x
      frame.y = replaceNode.y

      // Remove old node
      replaceNode.remove()
    }

    // Select the new frame and zoom to it
    figma.currentPage.selection = [frame]
    figma.viewport.scrollAndZoomIntoView([frame])

    sendToUI({
      type: 'generation-complete',
      success: true,
      message: `Created "${frame.name}" with ${countChildren(frame)} elements`
    })
  } catch (error) {
    console.error('Render error:', error)
    sendToUI({
      type: 'error',
      message: error instanceof Error ? error.message : 'Failed to render design'
    })
  }
}

// Count total children in a node
function countChildren(node: SceneNode): number {
  let count = 0
  if ('children' in node) {
    count = node.children.length
    for (const child of node.children) {
      count += countChildren(child)
    }
  }
  return count
}

function sendToUI(msg: MessageToUI) {
  figma.ui.postMessage(msg)
}
