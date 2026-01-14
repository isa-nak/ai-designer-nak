/**
 * Settings panel component for API keys and configuration
 */

import React, { useState } from 'react'
import type { PluginSettings, CustomColorPalette } from '../../shared/types'
import { DEFAULT_COLOR_PALETTE } from '../../shared/types'

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

interface SettingsPanelProps {
  settings: PluginSettings
  onSettingsChange: (settings: PluginSettings) => void
  onSave: () => void
  hasDesignSystem: boolean
}

export function SettingsPanel({
  settings,
  onSettingsChange,
  onSave,
  hasDesignSystem,
}: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

  const updateField = <K extends keyof PluginSettings>(key: K, value: PluginSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  const updateColor = (colorKey: keyof CustomColorPalette, value: string) => {
    onSettingsChange({
      ...settings,
      customColors: {
        ...DEFAULT_COLOR_PALETTE,
        ...settings.customColors,
        [colorKey]: value,
      },
    })
  }

  const resetColors = () => {
    onSettingsChange({ ...settings, customColors: DEFAULT_COLOR_PALETTE })
  }

  return (
    <div className="settings-panel">
      {/* Tabs */}
      <div className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          General
        </button>
        <button
          className={`settings-tab ${activeTab === 'colors' ? 'active' : ''}`}
          onClick={() => setActiveTab('colors')}
        >
          Colors
        </button>
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <>
          <label>
            Claude API Key
            <input
              type="password"
              value={settings.claudeApiKey}
              onChange={e => updateField('claudeApiKey', e.target.value)}
              placeholder="sk-ant-..."
            />
          </label>

          <label>
            OpenAI API Key
            <input
              type="password"
              value={settings.openaiApiKey}
              onChange={e => updateField('openaiApiKey', e.target.value)}
              placeholder="sk-..."
            />
          </label>

          <label>
            Context Instructions
            <textarea
              value={settings.contextInstructions}
              onChange={e => updateField('contextInstructions', e.target.value)}
              placeholder="Design guidelines: Always use 8px grid. Use Inter font. Mobile-first..."
              rows={3}
            />
          </label>
        </>
      )}

      {/* Colors Tab */}
      {activeTab === 'colors' && (
        <>
          <p className="colors-note">
            Default colors used when no design system is available.
            {hasDesignSystem && (
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
                    onChange={e => updateColor(colorKey, e.target.value)}
                  />
                  <input
                    type="text"
                    value={settings.customColors?.[colorKey] || DEFAULT_COLOR_PALETTE[colorKey]}
                    onChange={e => updateColor(colorKey, e.target.value)}
                    placeholder="#000000"
                  />
                </div>
              </div>
            ))}
          </div>
          <button className="reset-colors" onClick={resetColors}>
            Reset to Defaults
          </button>
        </>
      )}

      <button onClick={onSave}>Save Settings</button>
    </div>
  )
}
