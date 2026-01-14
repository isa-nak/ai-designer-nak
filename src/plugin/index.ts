import type { MessageToPlugin, MessageToUI, PluginSettings, DesignSystemContext, SelectionInfo, ViewportSize } from '../shared/types'
import { DEFAULT_COLOR_PALETTE } from '../shared/types'
import { renderDesign } from './renderer/index'
import { serializeSelection } from './serializer'
import { extractDesignSystem } from './designSystem'

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
