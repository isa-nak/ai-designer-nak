/**
 * Individual chat message component
 */

import React from 'react'

export interface ChatMessageData {
  id: string
  role: 'user' | 'assistant'
  content: string
  imageData?: string
  isStreaming?: boolean
}

interface ChatMessageProps {
  message: ChatMessageData
}

export function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div className={`message ${message.role} ${message.isStreaming ? 'streaming' : ''}`}>
      {message.imageData && (
        <img src={message.imageData} alt="Reference" className="message-image" />
      )}
      <p>{message.content}</p>
    </div>
  )
}
