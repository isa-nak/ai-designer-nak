import React, { useState, useEffect, useRef } from 'react'
import type { MessageToUI, PluginSettings, SelectionInfo, DesignSystemContext, FrameNode, ViewportPreset } from '../shared/types'
import { VIEWPORT_PRESETS } from '../shared/types'
import { streamDesignGeneration } from './api/claude'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  imageData?: string
  isStreaming?: boolean
}

export default function App() {
  const [settings, setSettings] = useState<PluginSettings>({
    apiKey: '',
    contextInstructions: '',
    viewport: 'mobile'
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [imageData, setImageData] = useState<string | null>(null)
  const [selection, setSelection] = useState<SelectionInfo | null>(null)
  const [selectionData, setSelectionData] = useState<FrameNode | null>(null)
  const [designSystem, setDesignSystem] = useState<DesignSystemContext | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')

  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
          setSettings(msg.settings)
          if (!msg.settings.apiKey) setSettingsOpen(true)
          break
        case 'selection-changed':
          setSelection(msg.selection)
          // Request selection data when selection changes
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
          // Already handled in UI
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

  const handleSubmit = async () => {
    if (!input.trim() && !imageData) return
    if (!settings.apiKey) {
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

    // Add streaming assistant message
    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: 'Generating design...',
      isStreaming: true
    }
    setMessages(prev => [...prev, assistantMessage])

    setInput('')
    setImageData(null)
    setIsGenerating(true)
    setStreamingContent('')

    const viewport = VIEWPORT_PRESETS[settings.viewport]

    try {
      const design = await streamDesignGeneration({
        prompt: input,
        apiKey: settings.apiKey,
        viewport,
        designSystem,
        contextInstructions: settings.contextInstructions,
        imageData: imageData || undefined,
        existingDesign: selection ? selectionData || undefined : undefined,
        onProgress: (text) => {
          setStreamingContent(text)
          setMessages(prev => {
            const updated = [...prev]
            const lastIdx = updated.length - 1
            if (lastIdx >= 0 && updated[lastIdx].isStreaming) {
              // Show truncated preview of JSON being generated
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

      // Send to plugin for rendering
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

  return (
    <div className="container">
      {/* Settings Panel */}
      <div className="settings-header" onClick={() => setSettingsOpen(!settingsOpen)}>
        <span>Settings</span>
        <span className="chevron">{settingsOpen ? '−' : '+'}</span>
      </div>

      {settingsOpen && (
        <div className="settings-panel">
          <label>
            API Key
            <input
              type="password"
              value={settings.apiKey}
              onChange={e => setSettings({ ...settings, apiKey: e.target.value })}
              placeholder="sk-ant-..."
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
          <button onClick={handleSaveSettings}>Save Settings</button>
        </div>
      )}

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
            <h3>Claude Design</h3>
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
    </div>
  )
}
