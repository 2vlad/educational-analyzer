'use client'

import ProgramCard from './ProgramCard'
import type { Program } from '@/types/programs'

interface ProgramsCardsViewProps {
  programs: Program[]
}

// Mock data - will be replaced with real aggregated metrics from API
const getMockMetrics = (programTitle: string = '') => {
  // Different colors for different programs
  const colors: ('green' | 'beige')[] = ['green', 'beige', 'green']
  const colorIndex = programTitle.length % colors.length

  return {
    metrics: [
      {
        name: 'Интерес',
        score: 1,
        comment:
          "Обычный текст, без души, как инструкция Что поправить: → Добавить обращения к студенту, например, 'Обратите внимание', 'Помните', 'Важно'.",
      },
      {
        name: 'Логика',
        score: 1,
        comment:
          "Обычный текст, без души, как инструкция Что поправить: → Добавить обращения к студенту, например, 'Обратите внимание', 'Помните', 'Важно'.",
      },
      {
        name: 'Забота',
        score: 0,
        comment:
          "Обычный текст, без души, как инструкция Что поправить: → Добавить обращения к студенту, например, 'Обратите внимание', 'Помните', 'Важно'.",
      },
      {
        name: 'Понятность',
        score: 2,
        comment:
          "Обычный текст, без души, как инструкция Что поправить: → Добавить обращения к студенту, например, 'Обратите внимание', 'Помните', 'Важно'.",
      },
    ],
    color: colors[colorIndex],
  }
}

export default function ProgramsCardsView({ programs }: ProgramsCardsViewProps) {
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <h2 className="text-2xl font-semibold mb-6 uppercase tracking-wide">Программы</h2>

      <div className="space-y-4 max-w-5xl">
        {programs.map((program) => {
          const { metrics, color } = getMockMetrics(program.title)

          return (
            <ProgramCard
              key={program.id}
              title={program.title}
              metrics={metrics}
              completedLessons={program.completedCount}
              totalLessons={program.lessonsCount}
              color={color}
            />
          )
        })}
      </div>
    </div>
  )
}
