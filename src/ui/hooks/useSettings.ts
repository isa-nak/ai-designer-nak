/**
 * Hook for managing plugin settings with auto-save
 */

import { useState, useCallback, useEffect } from 'react'
import type { PluginSettings, AIProvider, ViewportPreset } from '../../shared/types'
import { DEFAULT_COLOR_PALETTE } from '../../shared/types'

const DEFAULT_SETTINGS: PluginSettings = {
  claudeApiKey: '',
  openaiApiKey: '',
  selectedProvider: 'claude',
  contextInstructions: '',
  viewport: 'mobile',
  customColors: DEFAULT_COLOR_PALETTE,
}

interface UseSettingsReturn {
  settings: PluginSettings
  setSettings: React.Dispatch<React.SetStateAction<PluginSettings>>
  updateSetting: <K extends keyof PluginSettings>(key: K, value: PluginSettings[K]) => void
  saveSettings: () => void
  hasClaudeKey: boolean
  hasOpenaiKey: boolean
  currentApiKey: string
  updateProvider: (provider: AIProvider) => void
  updateViewport: (viewport: ViewportPreset) => void
}

export function useSettings(onSettingsLoaded?: (settings: PluginSettings) => void): UseSettingsReturn {
  const [settings, setSettings] = useState<PluginSettings>(DEFAULT_SETTINGS)

  // Derived state
  const hasClaudeKey = settings.claudeApiKey.trim().length > 0
  const hasOpenaiKey = settings.openaiApiKey.trim().length > 0
  const currentApiKey = settings.selectedProvider === 'claude'
    ? settings.claudeApiKey
    : settings.openaiApiKey

  // Send settings to plugin
  const saveSettings = useCallback(() => {
    parent.postMessage({ pluginMessage: { type: 'save-settings', settings } }, '*')
  }, [settings])

  // Update a single setting and save
  const updateSetting = useCallback(<K extends keyof PluginSettings>(
    key: K,
    value: PluginSettings[K]
  ) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value }
      parent.postMessage({ pluginMessage: { type: 'save-settings', settings: newSettings } }, '*')
      return newSettings
    })
  }, [])

  // Quick helpers for common updates
  const updateProvider = useCallback((provider: AIProvider) => {
    updateSetting('selectedProvider', provider)
  }, [updateSetting])

  const updateViewport = useCallback((viewport: ViewportPreset) => {
    updateSetting('viewport', viewport)
  }, [updateSetting])

  // Handle settings loaded from plugin
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage
      if (!msg) return

      if (msg.type === 'settings-loaded') {
        const loaded = { ...DEFAULT_SETTINGS, ...msg.settings }
        setSettings(loaded)
        onSettingsLoaded?.(loaded)
      }
    }

    window.addEventListener('message', handleMessage)
    parent.postMessage({ pluginMessage: { type: 'load-settings' } }, '*')

    return () => window.removeEventListener('message', handleMessage)
  }, [onSettingsLoaded])

  return {
    settings,
    setSettings,
    updateSetting,
    saveSettings,
    hasClaudeKey,
    hasOpenaiKey,
    currentApiKey,
    updateProvider,
    updateViewport,
  }
}
