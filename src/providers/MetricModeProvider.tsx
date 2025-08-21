'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

type MetricMode = 'lx' | 'custom'

interface MetricModeContextType {
  metricMode: MetricMode
  setMetricMode: (mode: MetricMode) => void
}

const MetricModeContext = createContext<MetricModeContextType | undefined>(undefined)

export function MetricModeProvider({ children }: { children: React.ReactNode }) {
  const [metricMode, setMetricMode] = useState<MetricMode>('lx')

  // Load metric mode from localStorage on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('metricMode') as MetricMode | null
    if (savedMode) {
      setMetricMode(savedMode)
    }
  }, [])

  const handleSetMetricMode = (mode: MetricMode) => {
    setMetricMode(mode)
    localStorage.setItem('metricMode', mode)
  }

  return (
    <MetricModeContext.Provider value={{ metricMode, setMetricMode: handleSetMetricMode }}>
      {children}
    </MetricModeContext.Provider>
  )
}

export function useMetricMode() {
  const context = useContext(MetricModeContext)
  if (context === undefined) {
    throw new Error('useMetricMode must be used within a MetricModeProvider')
  }
  return context
}