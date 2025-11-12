'use client'

import { useEffect, useState } from 'react'
import ProgramCard from './ProgramCard'
import type { Program } from '@/types/programs'
import { apiService } from '@/src/services/api'

interface ProgramsCardsViewProps {
  programs: Program[]
}

interface ProgramWithMetrics extends Program {
  metrics?: Array<{
    name: string
    score: number
    comment: string | null
  }>
  metricsLoading?: boolean
  color: 'green' | 'beige'
}

export default function ProgramsCardsView({ programs }: ProgramsCardsViewProps) {
  const [programsWithMetrics, setProgramsWithMetrics] = useState<ProgramWithMetrics[]>([])

  useEffect(() => {
    // Initialize programs with colors
    const colors: ('green' | 'beige')[] = ['green', 'beige', 'green']

    const initialPrograms: ProgramWithMetrics[] = programs.map((program, index) => ({
      ...program,
      metrics: undefined,
      metricsLoading: true,
      color: colors[index % colors.length],
    }))

    setProgramsWithMetrics(initialPrograms)

    // Load metrics for each program
    programs.forEach(async (program) => {
      try {
        const summary = await apiService.getProgramMetricsSummary(program.id)

        const metrics = summary.metrics.map((m) => ({
          name: m.name,
          score: m.roundedScore,
          comment: m.topComment,
        }))

        setProgramsWithMetrics((prev) =>
          prev.map((p) => (p.id === program.id ? { ...p, metrics, metricsLoading: false } : p)),
        )
      } catch (error) {
        console.error(`Failed to load metrics for program ${program.id}:`, error)

        // Set empty metrics on error
        setProgramsWithMetrics((prev) =>
          prev.map((p) => (p.id === program.id ? { ...p, metrics: [], metricsLoading: false } : p)),
        )
      }
    })
  }, [programs])

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <h2 className="text-2xl font-semibold mb-6 uppercase tracking-wide">Программы</h2>

      <div className="space-y-4 max-w-5xl">
        {programsWithMetrics.map((program) => (
          <ProgramCard
            key={program.id}
            title={program.title}
            metrics={program.metrics || []}
            completedLessons={program.completedCount}
            totalLessons={program.lessonsCount}
            color={program.color}
            loading={program.metricsLoading}
          />
        ))}
      </div>
    </div>
  )
}
