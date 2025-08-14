'use client'

import React from 'react'
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion'
import type { AnalysisProgress } from '@/src/services/ProgressService'

const METRIC_NAMES: Record<string, string> = {
  logic: 'Логика',
  practical: 'Польза',
  complexity: 'Уровень',
  interest: 'Цепляет',
  care: 'С душой',
}

const METRIC_DESCRIPTIONS: Record<string, string> = {
  logic: 'Структура и последовательность',
  practical: 'Применимость на практике',
  complexity: 'Соответствие уровню',
  interest: 'Увлекательность подачи',
  care: 'Качество материала',
}

interface ModernProgressTrackerProps {
  progress: AnalysisProgress | null
  overallProgress: number
  message: string
}

export function ModernProgressTracker({
  progress,
  overallProgress,
  message,
}: ModernProgressTrackerProps) {
  // Use spring animation for smooth progress
  const springProgress = useSpring(overallProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })

  // Transform progress to rotation for circular indicator
  const rotation = useTransform(springProgress, [0, 100], [0, 360])

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900" />

        {/* Animated gradient orbs */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl"
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"
          animate={{
            x: [0, -100, 0],
            y: [0, 50, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-4xl"
        >
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-12"
          >
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Анализ в процессе
            </h1>
            <AnimatePresence mode="wait">
              <motion.p
                key={message}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-xl text-gray-400"
              >
                {message}
              </motion.p>
            </AnimatePresence>
          </motion.div>

          {/* Central Progress Circle */}
          <div className="flex justify-center mb-12">
            <div className="relative w-48 h-48">
              {/* Background circle */}
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="96"
                  cy="96"
                  r="88"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-gray-800"
                />
              </svg>

              {/* Progress circle */}
              <motion.svg
                className="absolute inset-0 w-full h-full -rotate-90"
                style={{ rotate: rotation }}
              >
                <motion.circle
                  cx="96"
                  cy="96"
                  r="88"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={553.1}
                  initial={{ strokeDashoffset: 553.1 }}
                  animate={{ strokeDashoffset: 553.1 - (553.1 * overallProgress) / 100 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8B5CF6" />
                    <stop offset="50%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#10B981" />
                  </linearGradient>
                </defs>
              </motion.svg>

              {/* Center content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.div
                  key={overallProgress}
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="text-5xl font-bold"
                >
                  {Math.round(overallProgress)}
                </motion.div>
                <div className="text-gray-500 text-sm">процентов</div>
              </div>
            </div>
          </div>

          {/* Metrics Cards */}
          {progress?.metricStatus && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="grid grid-cols-5 gap-4"
            >
              {progress.metricStatus.map((metric, index) => (
                <motion.div
                  key={metric.metric}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
                  className="relative"
                >
                  <div
                    className={`
                      p-6 rounded-2xl border backdrop-blur-xl transition-all duration-500
                      ${
                        metric.status === 'completed'
                          ? 'bg-green-500/10 border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.3)]'
                          : metric.status === 'processing'
                            ? 'bg-blue-500/10 border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.3)] animate-pulse'
                            : metric.status === 'failed'
                              ? 'bg-red-500/10 border-red-500/30'
                              : 'bg-gray-900/50 border-gray-800'
                      }
                    `}
                  >
                    {/* Metric Icon/Number */}
                    <div className="flex justify-center mb-3">
                      <div className="relative">
                        <motion.div
                          className={`
                            w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg
                            ${
                              metric.status === 'completed'
                                ? 'bg-green-500 text-white'
                                : metric.status === 'processing'
                                  ? 'bg-blue-500 text-white'
                                  : metric.status === 'failed'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-gray-800 text-gray-500'
                            }
                          `}
                          animate={
                            metric.status === 'processing'
                              ? {
                                  scale: [1, 1.1, 1],
                                }
                              : {}
                          }
                          transition={{
                            duration: 1,
                            repeat: metric.status === 'processing' ? Infinity : 0,
                          }}
                        >
                          {metric.status === 'completed' ? (
                            '✓'
                          ) : metric.status === 'failed' ? (
                            '✗'
                          ) : metric.status === 'processing' ? (
                            <motion.span
                              animate={{ rotate: 360 }}
                              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                            >
                              ⟳
                            </motion.span>
                          ) : (
                            index + 1
                          )}
                        </motion.div>

                        {/* Processing indicator ring */}
                        {metric.status === 'processing' && (
                          <motion.div
                            className="absolute inset-0 rounded-full border-2 border-blue-400"
                            initial={{ scale: 1, opacity: 1 }}
                            animate={{ scale: 1.5, opacity: 0 }}
                            transition={{ duration: 1, repeat: Infinity }}
                          />
                        )}
                      </div>
                    </div>

                    {/* Metric Name */}
                    <h3 className="text-center font-semibold text-sm mb-1">
                      {METRIC_NAMES[metric.metric]}
                    </h3>

                    {/* Progress for processing metrics */}
                    {metric.status === 'processing' && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-2"
                      >
                        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                            initial={{ width: '0%' }}
                            animate={{ width: `${metric.progress}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 text-center mt-1">
                          {Math.round(metric.progress)}%
                        </p>
                      </motion.div>
                    )}

                    {/* Tooltip on hover */}
                    <motion.div
                      className="absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 pointer-events-none whitespace-nowrap"
                      whileHover={{ opacity: 1 }}
                    >
                      {METRIC_DESCRIPTIONS[metric.metric]}
                    </motion.div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Fun animated elements */}
          <div className="mt-12 flex justify-center">
            <motion.div
              className="flex space-x-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 bg-gray-600 rounded-full"
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.3, 1, 0.3],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </motion.div>
          </div>

          {/* Stats footer */}
          {progress && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-8 text-center text-gray-500 text-sm"
            >
              Проанализировано {progress.completedMetrics} из {progress.totalMetrics} критериев
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
