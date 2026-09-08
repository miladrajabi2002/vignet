'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const LearningCountContext = createContext<{
  count: number
  setCount: (count: number) => void
} | null>(null)

export function LearningCountProvider({ initialCount, children }: { initialCount: number; children: ReactNode }) {
  const [count, setCount] = useState(initialCount)
  useEffect(() => setCount(initialCount), [initialCount])
  const value = useMemo(() => ({ count, setCount }), [count])
  return <LearningCountContext.Provider value={value}>{children}</LearningCountContext.Provider>
}

export function useLearningCount() {
  return useContext(LearningCountContext)
}
