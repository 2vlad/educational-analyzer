'use client'

import { useState } from 'react'
import { ChevronRight, RefreshCw, Trash2 } from 'lucide-react'
import { Gauge } from '@/components/ui/gauge'

interface MetricScore {
  name: string
  score: number
  comment: string
  fix?: string
}

interface LessonCardProps {
  title: string
  metrics: MetricScore[]
  totalScore: number
  maxScore: number
  color: 'green' | 'amber' | 'red' | 'gray'
  analyzed: boolean
  loading?: boolean
  analyzing?: boolean
  onAnalyze?: () => void
  onDelete?: () => void
}

export function LessonCardWithGauge({
  title,
  metrics,
  totalScore,
  maxScore,
  color,
  analyzed,
  loading = false,
  analyzing = false,
  onAnalyze,
  onDelete,
}: LessonCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const bgColor =
    color === 'green'
      ? 'bg-[#eafee7]'
      : color === 'amber'
        ? 'bg-[#fef9e7]'
        : color === 'red'
          ? 'bg-[#fee7e7]'
          : 'bg-[#f5f5f5]' // gray

  const formatScore = (score: number) => {
    if (score > 0) return `+${score}`
    if (score < 0) return `${score}`
    return '0'
  }

  const handleToggle = () => {
    // Only allow toggle if analyzed
    if (analyzed) {
      setIsExpanded(!isExpanded)
    }
  }

  return (
    <section
      className={`relative ${bgColor} rounded-2xl px-[28px] py-6 transition-all ${
        analyzed ? 'cursor-pointer' : ''
      } ${isExpanded ? '' : 'min-h-[65px]'}`}
      role={analyzed ? 'button' : 'region'}
      aria-expanded={analyzed ? isExpanded : undefined}
      aria-labelledby={`lesson-${title}`}
      onClick={handleToggle}
      tabIndex={analyzed ? 0 : -1}
      onKeyDown={(e) => {
        if (analyzed && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          handleToggle()
        }
      }}
    >
      {/* Delete button - top right corner */}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (globalThis.confirm('Вы уверены, что хотите удалить этот урок?')) {
              onDelete()
            }
          }}
          aria-label="Удалить урок"
          className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-red-600 transition-colors"
        >
          <Trash2 className="w-4 h-4" strokeWidth={2} />
        </button>
      )}

      <div className="grid items-center gap-4 grid-cols-[1fr_auto]">
        {/* Left: Title and metrics (collapsed) */}
        <div>
          <h2 id={`lesson-${title}`} className="text-[19px] font-bold leading-tight mb-2">
            {title}
          </h2>

          {/* Metrics inline (only in collapsed state) */}
          {!isExpanded && (
            <div className="flex items-center gap-4 flex-wrap text-[11px] font-medium">
              {loading ? (
                <div className="text-gray-400 animate-pulse">Загрузка метрик...</div>
              ) : !analyzed ? (
                <div className="text-gray-400">Не проанализировано</div>
              ) : (
                metrics.map((metric, index) => (
                  <div key={index}>
                    {metric.name} <b>{formatScore(metric.score)}</b>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right: Gauge, analyze button, and chevron */}
        <div className="flex items-center gap-3">
          <Gauge
            value={totalScore}
            max={maxScore}
            aria-label={`Оценка ${totalScore} из ${maxScore}`}
          />

          {/* Analyze button - only for unanalyzed lessons */}
          {!analyzed && !loading && onAnalyze && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (!analyzing) onAnalyze()
              }}
              disabled={analyzing}
              aria-label={analyzing ? 'Анализ запущен...' : 'Проанализировать урок'}
              className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                analyzing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-black text-white hover:bg-gray-800'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} strokeWidth={2} />
            </button>
          )}

          {/* Chevron indicator - stays in same place, rotates */}
          <div
            aria-hidden="true"
            className="w-6 h-6 text-[#9ea4a0] transition-transform duration-300"
            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            <ChevronRight className="w-6 h-6" strokeWidth={2} />
          </div>
        </div>
      </div>

      {/* Expanded panel */}
      {isExpanded && analyzed && (
        <div className="mt-4 space-y-4" role="region" aria-labelledby={`lesson-${title}`}>
          {metrics.map((metric, index) => (
            <section key={index} className="space-y-1">
              <h3 className="font-bold text-[11px]">
                {metric.name} <span>{formatScore(metric.score)}</span>
              </h3>
              <p className="text-[11px] leading-normal">{metric.comment}</p>
              {metric.fix && (
                <p className="text-[11px] leading-normal">
                  <b>Что поправить:</b> {metric.fix}
                </p>
              )}
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
