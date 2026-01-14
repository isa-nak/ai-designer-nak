/**
 * Input area component with image upload and generation controls
 */

import React, { useRef } from 'react'

interface InputAreaProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onStop: () => void
  onImageUpload: (imageData: string) => void
  isGenerating: boolean
  hasSelection: boolean
  imageData: string | null
  onClearImage: () => void
  jsonPreview: string | null
  onShowJson: () => void
}

export function InputArea({
  value,
  onChange,
  onSubmit,
  onStop,
  onImageUpload,
  isGenerating,
  hasSelection,
  imageData,
  onClearImage,
  jsonPreview,
  onShowJson,
}: InputAreaProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      onImageUpload(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }

  const canSubmit = value.trim() || imageData

  return (
    <>
      {/* Image Preview */}
      {imageData && (
        <div className="image-preview">
          <img src={imageData} alt="Upload preview" />
          <button onClick={onClearImage}>✕</button>
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
          onClick={onShowJson}
          title="View JSON"
          disabled={!jsonPreview}
        >
          {'{ }'}
        </button>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={hasSelection ? 'Describe changes to selection...' : 'Describe a screen to generate...'}
          disabled={isGenerating}
        />
        {isGenerating ? (
          <button onClick={onStop} className="stop-button">
            Stop
          </button>
        ) : (
          <button onClick={onSubmit} disabled={!canSubmit}>
            {hasSelection ? 'Update' : 'Generate'}
          </button>
        )}
      </div>
    </>
  )
}
