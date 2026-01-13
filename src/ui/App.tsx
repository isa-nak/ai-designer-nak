import React, { useState, useEffect, useRef } from 'react'
import type { MessageToUI, PluginSettings, SelectionInfo, DesignSystemContext, FrameNode, ViewportPreset, AIProvider, CustomColorPalette } from '../shared/types'
import { VIEWPORT_PRESETS, AI_PROVIDERS, DEFAULT_COLOR_PALETTE } from '../shared/types'
import { generateDesign } from './api'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  imageData?: string
  isStreaming?: boolean
}

type SettingsTab = 'general' | 'colors'

const COLOR_LABELS: Record<keyof CustomColorPalette, string> = {
  primary: 'Primary',
  primaryDark: 'Primary Dark',
  background: 'Background',
  backgroundCard: 'Card Background',
  textPrimary: 'Text Primary',
  textSecondary: 'Text Secondary',
  border: 'Border',
  success: 'Success',
  error: 'Error',
  warning: 'Warning',
}

const DEFAULT_SETTINGS: PluginSettings = {
  claudeApiKey: '',
  openaiApiKey: '',
  selectedProvider: 'claude',
  contextInstructions: '',
  viewport: 'mobile',
  customColors: DEFAULT_COLOR_PALETTE
}

export default function App() {
  const [settings, setSettings] = useState<PluginSettings>(DEFAULT_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [imageData, setImageData] = useState<string | null>(null)
  const [selection, setSelection] = useState<SelectionInfo | null>(null)
  const [selectionData, setSelectionData] = useState<FrameNode | null>(null)
  const [designSystem, setDesignSystem] = useState<DesignSystemContext | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [jsonPreview, setJsonPreview] = useState<string | null>(null)
  const [showJsonPreview, setShowJsonPreview] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get current API key based on selected provider
  const currentApiKey = settings.selectedProvider === 'claude'
    ? settings.claudeApiKey
    : settings.openaiApiKey

  // Check which providers have API keys
  const hasClaudeKey = settings.claudeApiKey.trim().length > 0
  const hasOpenaiKey = settings.openaiApiKey.trim().length > 0

  useEffect(() => {
    // Request initial data
    parent.postMessage({ pluginMessage: { type: 'load-settings' } }, '*')
    parent.postMessage({ pluginMessage: { type: 'refresh-design-system' } }, '*')
    parent.postMessage({ pluginMessage: { type: 'get-selection' } }, '*')

    // Listen for messages from plugin
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage as MessageToUI
      if (!msg) return

      switch (msg.type) {
        case 'settings-loaded':
          // Merge with defaults to handle missing fields from old settings
          setSettings({ ...DEFAULT_SETTINGS, ...msg.settings })
          if (!msg.settings.claudeApiKey && !msg.settings.openaiApiKey) {
            setSettingsOpen(true)
          }
          break
        case 'selection-changed':
          setSelection(msg.selection)
          if (msg.selection) {
            parent.postMessage({ pluginMessage: { type: 'request-selection-data' } }, '*')
          } else {
            setSelectionData(null)
          }
          break
        case 'selection-data':
          setSelectionData(msg.data)
          break
        case 'design-system-loaded':
          setDesignSystem(msg.designSystem)
          break
        case 'generation-started':
          break
        case 'generation-complete':
          setIsGenerating(false)
          setStreamingContent('')
          if (msg.success) {
            setMessages(prev => {
              const updated = [...prev]
              const lastIdx = updated.length - 1
              if (lastIdx >= 0 && updated[lastIdx].isStreaming) {
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  content: msg.message || 'Design generated successfully!',
                  isStreaming: false
                }
              }
              return updated
            })
          }
          break
        case 'error':
          setIsGenerating(false)
          setStreamingContent('')
          setMessages(prev => {
            const updated = [...prev]
            const lastIdx = updated.length - 1
            if (lastIdx >= 0 && updated[lastIdx].isStreaming) {
              updated[lastIdx] = {
                ...updated[lastIdx],
                content: `Error: ${msg.message}`,
                isStreaming: false
              }
            } else {
              updated.push({
                id: Date.now().toString(),
                role: 'assistant',
                content: `Error: ${msg.message}`
              })
            }
            return updated
          })
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleSaveSettings = () => {
    parent.postMessage({ pluginMessage: { type: 'save-settings', settings } }, '*')
    setSettingsOpen(false)
  }

  const handleProviderChange = (provider: AIProvider) => {
    const newSettings = { ...settings, selectedProvider: provider }
    setSettings(newSettings)
    parent.postMessage({ pluginMessage: { type: 'save-settings', settings: newSettings } }, '*')
  }

  const handleSubmit = async () => {
    if (!input.trim() && !imageData) return
    if (!currentApiKey) {
      setSettingsOpen(true)
      return
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      imageData: imageData || undefined
    }
    setMessages(prev => [...prev, userMessage])

    const providerName = AI_PROVIDERS[settings.selectedProvider].name
    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: `Generating with ${providerName}...`,
      isStreaming: true
    }
    setMessages(prev => [...prev, assistantMessage])

    setInput('')
    setImageData(null)
    setIsGenerating(true)
    setStreamingContent('')

    const viewport = VIEWPORT_PRESETS[settings.viewport]

    try {
      const design = await generateDesign({
        prompt: input,
        provider: settings.selectedProvider,
        apiKey: currentApiKey,
        viewport,
        designSystem,
        contextInstructions: settings.contextInstructions,
        customColors: settings.customColors,
        imageData: imageData || undefined,
        existingDesign: selection ? selectionData || undefined : undefined,
        onProgress: (text) => {
          setStreamingContent(text)
          setJsonPreview(text) // Store raw JSON for preview
          setMessages(prev => {
            const updated = [...prev]
            const lastIdx = updated.length - 1
            if (lastIdx >= 0 && updated[lastIdx].isStreaming) {
              const preview = text.length > 200
                ? text.slice(0, 100) + '...\n\n[Generating design...]'
                : text
              updated[lastIdx] = {
                ...updated[lastIdx],
                content: preview
              }
            }
            return updated
          })
        }
      })

      // Store the final design JSON for preview
      setJsonPreview(JSON.stringify(design, null, 2))

      parent.postMessage({
        pluginMessage: {
          type: 'render-design',
          design,
          viewport
        }
      }, '*')

    } catch (error) {
      setIsGenerating(false)
      setStreamingContent('')
      setMessages(prev => {
        const updated = [...prev]
        const lastIdx = updated.length - 1
        if (lastIdx >= 0 && updated[lastIdx].isStreaming) {
          updated[lastIdx] = {
            ...updated[lastIdx],
            content: `Error: ${error instanceof Error ? error.message : 'Failed to generate design'}`,
            isStreaming: false
          }
        }
        return updated
      })
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setImageData(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const viewportOptions: ViewportPreset[] = ['mobile', 'tablet', 'desktop']
  const providerOptions: AIProvider[] = ['claude', 'openai']

  return (
    <div className="container">
      {/* Settings Panel */}
      <div className="settings-header" onClick={() => setSettingsOpen(!settingsOpen)}>
        <span>Settings</span>
        <span className="chevron">{settingsOpen ? '−' : '+'}</span>
      </div>

      {settingsOpen && (
        <div className="settings-panel">
          {/* Settings Tabs */}
          <div className="settings-tabs">
            <button
              className={`settings-tab ${settingsTab === 'general' ? 'active' : ''}`}
              onClick={() => setSettingsTab('general')}
            >
              General
            </button>
            <button
              className={`settings-tab ${settingsTab === 'colors' ? 'active' : ''}`}
              onClick={() => setSettingsTab('colors')}
            >
              Colors
            </button>
          </div>

          {/* General Tab */}
          {settingsTab === 'general' && (
            <>
              <label>
                Claude API Key
                <input
                  type="password"
                  value={settings.claudeApiKey}
                  onChange={e => setSettings({ ...settings, claudeApiKey: e.target.value })}
                  placeholder="sk-ant-..."
                />
              </label>

              <label>
                OpenAI API Key
                <input
                  type="password"
                  value={settings.openaiApiKey}
                  onChange={e => setSettings({ ...settings, openaiApiKey: e.target.value })}
                  placeholder="sk-..."
                />
              </label>

              <label>
                Viewport
                <div className="viewport-selector">
                  {viewportOptions.map(v => (
                    <button
                      key={v}
                      className={`viewport-option ${settings.viewport === v ? 'active' : ''}`}
                      onClick={() => setSettings({ ...settings, viewport: v })}
                    >
                      {VIEWPORT_PRESETS[v].name}
                      <span className="viewport-size">
                        {VIEWPORT_PRESETS[v].width}x{VIEWPORT_PRESETS[v].height}
                      </span>
                    </button>
                  ))}
                </div>
              </label>

              <label>
                Context Instructions
                <textarea
                  value={settings.contextInstructions}
                  onChange={e => setSettings({ ...settings, contextInstructions: e.target.value })}
                  placeholder="Design guidelines: Always use 8px grid. Use Inter font. Mobile-first..."
                  rows={3}
                />
              </label>
            </>
          )}

          {/* Colors Tab */}
          {settingsTab === 'colors' && (
            <>
              <p className="colors-note">
                Default colors used when no design system is available.
                {designSystem && designSystem.colorVariables.length > 0 && (
                  <span className="colors-hint"> (Design system detected - these will be overridden)</span>
                )}
              </p>
              <div className="color-grid">
                {(Object.keys(COLOR_LABELS) as Array<keyof CustomColorPalette>).map(colorKey => (
                  <div key={colorKey} className="color-item">
                    <label>{COLOR_LABELS[colorKey]}</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={settings.customColors?.[colorKey] || DEFAULT_COLOR_PALETTE[colorKey]}
                        onChange={e => setSettings({
                          ...settings,
                          customColors: {
                            ...DEFAULT_COLOR_PALETTE,
                            ...settings.customColors,
                            [colorKey]: e.target.value
                          }
                        })}
                      />
                      <input
                        type="text"
                        value={settings.customColors?.[colorKey] || DEFAULT_COLOR_PALETTE[colorKey]}
                        onChange={e => setSettings({
                          ...settings,
                          customColors: {
                            ...DEFAULT_COLOR_PALETTE,
                            ...settings.customColors,
                            [colorKey]: e.target.value
                          }
                        })}
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="reset-colors"
                onClick={() => setSettings({ ...settings, customColors: DEFAULT_COLOR_PALETTE })}
              >
                Reset to Defaults
              </button>
            </>
          )}

          <button onClick={handleSaveSettings}>Save Settings</button>
        </div>
      )}

      {/* Model Selector */}
      <div className="model-selector">
        {providerOptions.map(p => {
          const provider = AI_PROVIDERS[p]
          const hasKey = p === 'claude' ? hasClaudeKey : hasOpenaiKey
          const isSelected = settings.selectedProvider === p

          return (
            <button
              key={p}
              className={`model-option ${isSelected ? 'active' : ''} ${!hasKey ? 'disabled' : ''}`}
              onClick={() => hasKey && handleProviderChange(p)}
              disabled={!hasKey}
              title={!hasKey ? `Add ${provider.name} API key in settings` : `Use ${provider.name}`}
            >
              <span className="model-name">{provider.name}</span>
              <span className="model-variant">{provider.model}</span>
            </button>
          )
        })}
      </div>

      {/* Design System Info */}
      {designSystem && (
        <div className="design-system-info">
          <span className="ds-badge">{designSystem.colorVariables.length} colors</span>
          <span className="ds-badge">{designSystem.textStyles.length} text styles</span>
          <span className="ds-badge">{designSystem.components.length} components</span>
        </div>
      )}

      {/* Chat Messages */}
      <div className="chat-container">
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🎨</div>
            <h3>AI Designer</h3>
            <p>Describe a screen to generate, or select a frame and describe changes.</p>
            <div className="example-prompts">
              <button onClick={() => setInput('Create a modern login screen with email and password fields')}>
                Login screen
              </button>
              <button onClick={() => setInput('Create a settings page with profile section and toggle options')}>
                Settings page
              </button>
              <button onClick={() => setInput('Create a product card with image, title, price, and buy button')}>
                Product card
              </button>
            </div>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.role} ${msg.isStreaming ? 'streaming' : ''}`}>
            {msg.imageData && (
              <img src={msg.imageData} alt="Reference" className="message-image" />
            )}
            <p>{msg.content}</p>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Selection Info */}
      {selection && (
        <div className="selection-info">
          <span className="selection-icon">◻</span>
          <span>
            {selection.name}
            {selection.hasMultiple && ` (+${selection.count - 1} more)`}
          </span>
          <span className="selection-hint">Will be replaced</span>
        </div>
      )}

      {/* Image Preview */}
      {imageData && (
        <div className="image-preview">
          <img src={imageData} alt="Upload preview" />
          <button onClick={() => setImageData(null)}>✕</button>
        </div>
      )}

      {/* Input Area */}
      <div className="input-area">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          hidden
        />
        <button
          className="icon-button"
          onClick={() => fileInputRef.current?.click()}
          title="Add image reference"
          disabled={isGenerating}
        >
          📷
        </button>
        <button
          className={`icon-button ${jsonPreview ? 'has-json' : ''}`}
          onClick={() => setShowJsonPreview(true)}
          title="View JSON"
          disabled={!jsonPreview}
        >
          {'{ }'}
        </button>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
          placeholder={selection ? 'Describe changes to selection...' : 'Describe a screen to generate...'}
          disabled={isGenerating}
        />
        <button
          onClick={handleSubmit}
          disabled={isGenerating || (!input.trim() && !imageData)}
          className={isGenerating ? 'generating' : ''}
        >
          {isGenerating ? '...' : selection ? 'Update' : 'Generate'}
        </button>
      </div>

      {/* JSON Preview Modal */}
      {showJsonPreview && jsonPreview && (
        <div className="json-preview-overlay" onClick={() => setShowJsonPreview(false)}>
          <div className="json-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="json-preview-header">
              <h3>Generated JSON</h3>
              <div className="json-preview-actions">
                <button
                  className="copy-json"
                  onClick={() => {
                    navigator.clipboard.writeText(jsonPreview)
                    alert('JSON copied to clipboard!')
                  }}
                >
                  Copy
                </button>
                <button className="close-json" onClick={() => setShowJsonPreview(false)}>
                  ✕
                </button>
              </div>
            </div>
            <pre className="json-preview-content">
              {jsonPreview}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
