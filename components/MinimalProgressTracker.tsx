'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AnalysisProgress } from '@/src/services/ProgressService'
import { useSmoothProgress } from '@/src/hooks/useSmoothProgress'

const METRIC_NAMES: Record<string, string> = {
  logic: 'Логика',
  practical: 'Польза',
  complexity: 'Уровень',
  interest: 'Интерес',
  care: 'Качество',
  cognitive_load: 'Когнитивная нагрузка',
}

interface MinimalProgressTrackerProps {
  progress: AnalysisProgress | null
  overallProgress: number
  message: string
}

export function MinimalProgressTracker({
  progress,
  overallProgress,
  message,
}: MinimalProgressTrackerProps) {
  const displayProgress = useSmoothProgress(overallProgress, 800)
  const [pulseIntensity, setPulseIntensity] = React.useState(0)

  // Create pulse effect when progress updates
  React.useEffect(() => {
    setPulseIntensity(1)
    const timer = window.setTimeout(() => setPulseIntensity(0), 300)
    return () => window.clearTimeout(timer)
  }, [overallProgress])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-2xl">
        {/* Logo/Title Area */}
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-12 text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-black">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              className="text-2xl"
            >
              🎓
            </motion.div>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Анализ контента</h1>
          <AnimatePresence mode="wait">
            <motion.p
              key={message}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="text-gray-500"
            >
              {message}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* Main Progress Section */}
        <div className="space-y-8">
          {/* Linear Progress Bar */}
          <div>
            <div className="flex justify-between items-baseline mb-3">
              <span className="text-sm font-medium text-gray-700">Прогресс</span>
              <motion.span
                className="text-sm font-mono text-gray-900"
                key={displayProgress}
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
              >
                {Math.round(displayProgress)}%
              </motion.span>
            </div>

            <div className="relative">
              {/* Background track */}
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                {/* Progress fill */}
                <motion.div
                  className="h-full bg-black rounded-full relative"
                  style={{ width: `${displayProgress}%` }}
                  transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  {/* Animated shimmer */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: 'linear',
                      repeatDelay: 3,
                    }}
                    style={{ width: '50%' }}
                  />

                  {/* Leading edge glow */}
                  <motion.div
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-black rounded-full"
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [1, 0.5, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    style={{
                      boxShadow: `0 0 ${10 + pulseIntensity * 20}px rgba(0, 0, 0, ${0.3 + pulseIntensity * 0.3})`,
                    }}
                  />
                </motion.div>
              </div>
            </div>
          </div>

          {/* Metrics List */}
          {progress?.metricStatus && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="space-y-3"
            >
              {progress.metricStatus.map((metric, index) => (
                <motion.div
                  key={metric.metric}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * index }}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    {/* Status indicator */}
                    <div className="relative">
                      {metric.status === 'completed' && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', bounce: 0.5 }}
                          className="w-5 h-5"
                        >
                          <svg viewBox="0 0 20 20" fill="none">
                            <motion.circle
                              cx="10"
                              cy="10"
                              r="9"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="text-green-500"
                              initial={{ pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                              transition={{ duration: 0.5 }}
                            />
                            <motion.path
                              d="M6 10l3 3 5-6"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="text-green-500"
                              initial={{ pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                              transition={{ duration: 0.3, delay: 0.2 }}
                            />
                          </svg>
                        </motion.div>
                      )}
                      {metric.status === 'processing' && (
                        <motion.div
                          className="w-5 h-5"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        >
                          <svg viewBox="0 0 20 20" fill="none">
                            <circle
                              cx="10"
                              cy="10"
                              r="9"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="text-gray-200"
                            />
                            <path
                              d="M10 1a9 9 0 019 9"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              className="text-blue-500"
                            />
                          </svg>
                        </motion.div>
                      )}
                      {metric.status === 'failed' && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-5 h-5"
                        >
                          <svg viewBox="0 0 20 20" fill="none">
                            <circle
                              cx="10"
                              cy="10"
                              r="9"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="text-red-500"
                            />
                            <path
                              d="M7 7l6 6M13 7l-6 6"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              className="text-red-500"
                            />
                          </svg>
                        </motion.div>
                      )}
                      {metric.status === 'pending' && (
                        <div className="w-5 h-5">
                          <svg viewBox="0 0 20 20" fill="none">
                            <circle
                              cx="10"
                              cy="10"
                              r="9"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeDasharray="4 2"
                              className="text-gray-300"
                            />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Metric name */}
                    <span
                      className={`text-sm font-medium ${
                        metric.status === 'completed'
                          ? 'text-gray-900'
                          : metric.status === 'processing'
                            ? 'text-blue-600'
                            : metric.status === 'failed'
                              ? 'text-red-600'
                              : 'text-gray-400'
                      }`}
                    >
                      {METRIC_NAMES[metric.metric] || metric.metric}
                    </span>
                  </div>

                  {/* Right side status */}
                  <div className="flex items-center space-x-2">
                    {metric.status === 'processing' && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-xs text-blue-600 font-mono"
                      >
                        {Math.round(metric.progress)}%
                      </motion.span>
                    )}
                    {metric.status === 'completed' && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-xs text-green-600"
                      >
                        Готово
                      </motion.span>
                    )}
                    {metric.status === 'failed' && (
                      <span className="text-xs text-red-600">Ошибка</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Time estimate */}
          {progress && overallProgress < 100 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="pt-4 border-t border-gray-100"
            >
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Осталось примерно {Math.ceil((100 - overallProgress) / 10)} сек</span>
                <div className="flex space-x-1">
                  {[...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1 h-1 bg-gray-400 rounded-full"
                      animate={{
                        opacity: [0.3, 1, 0.3],
                      }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
