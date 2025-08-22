'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

type MetricMode = 'lx' | 'custom'

interface MetricModeContextType {
  metricMode: MetricMode
  setMetricMode: (mode: MetricMode) => void
}

const MetricModeContext = createContext<MetricModeContextType | undefined>(undefined)

export function MetricModeProvider({ children }: { children: React.ReactNode }) {
  const [metricMode, setMetricMode] = useState<MetricMode>('lx')
  const pathname = usePathname()

  // Set metric mode based on current path
  useEffect(() => {
    // Set mode based on current pathname
    if (pathname === '/custom') {
      setMetricMode('custom')
    } else {
      // For all other pages (including /, /programs, /history, etc.), default to 'lx'
      setMetricMode('lx')
    }
  }, [pathname])

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