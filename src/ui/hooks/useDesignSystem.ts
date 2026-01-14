/**
 * Hook for managing design system context from Figma
 */

import { useState, useEffect, useCallback } from 'react'
import type { DesignSystemContext, SelectionInfo, FrameNode } from '../../shared/types'

interface UseDesignSystemReturn {
  designSystem: DesignSystemContext | null
  selection: SelectionInfo | null
  selectionData: FrameNode | null
  refreshDesignSystem: () => void
  requestSelectionData: () => void
}

export function useDesignSystem(): UseDesignSystemReturn {
  const [designSystem, setDesignSystem] = useState<DesignSystemContext | null>(null)
  const [selection, setSelection] = useState<SelectionInfo | null>(null)
  const [selectionData, setSelectionData] = useState<FrameNode | null>(null)

  const refreshDesignSystem = useCallback(() => {
    parent.postMessage({ pluginMessage: { type: 'refresh-design-system' } }, '*')
  }, [])

  const requestSelectionData = useCallback(() => {
    parent.postMessage({ pluginMessage: { type: 'request-selection-data' } }, '*')
  }, [])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage
      if (!msg) return

      switch (msg.type) {
        case 'selection-changed':
          setSelection(msg.selection)
          if (msg.selection) {
            requestSelectionData()
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
      }
    }

    window.addEventListener('message', handleMessage)

    // Initial requests
    refreshDesignSystem()
    parent.postMessage({ pluginMessage: { type: 'get-selection' } }, '*')

    return () => window.removeEventListener('message', handleMessage)
  }, [refreshDesignSystem, requestSelectionData])

  return {
    designSystem,
    selection,
    selectionData,
    refreshDesignSystem,
    requestSelectionData,
  }
}
