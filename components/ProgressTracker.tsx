'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AnalysisProgress } from '@/src/services/ProgressService'
import { useSmoothProgress } from '@/src/hooks/useSmoothProgress'

const METRIC_NAMES: Record<string, string> = {
  logic: 'Логика и структура',
  practical: 'Практическая польза',
  complexity: 'Уровень сложности',
  interest: 'Увлекательность',
  care: 'Качество подачи',
}

const METRIC_ICONS: Record<string, string> = {
  logic: '🧩',
  practical: '🎯',
  complexity: '📊',
  interest: '✨',
  care: '💡',
}

interface ProgressTrackerProps {
  progress: AnalysisProgress | null
  overallProgress: number
  message: string
}

export function ProgressTracker({ progress, overallProgress, message }: ProgressTrackerProps) {
  // Use smooth progress hook for buttery smooth animations
  const displayProgress = useSmoothProgress(overallProgress, 600)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-2xl"
      >
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-700 p-8 text-white">
            <motion.h1
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold mb-2"
            >
              Анализируем ваш контент
            </motion.h1>
            <motion.p
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-gray-200"
            >
              ИИ-студент Лёха внимательно изучает материал
            </motion.p>
          </div>

          {/* Progress Section */}
          <div className="p-8">
            {/* Main Progress Bar */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-3">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={message}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.3 }}
                    className="text-gray-700 font-medium"
                  >
                    {message}
                  </motion.p>
                </AnimatePresence>
                <motion.span
                  key={displayProgress}
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="text-2xl font-bold text-gray-800"
                >
                  {Math.round(displayProgress)}%
                </motion.span>
              </div>

              <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${displayProgress}%` }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                >
                  {/* Shimmer effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    animate={{ x: ['0%', '200%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    style={{ width: '50%' }}
                  />
                </motion.div>
              </div>
            </div>

            {/* Metrics Grid */}
            {progress?.metricStatus && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="space-y-4"
              >
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                  Анализ по критериям
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {progress.metricStatus.map((metric, index) => (
                    <motion.div
                      key={metric.metric}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`
                        relative p-4 rounded-xl border-2 transition-all duration-300
                        ${
                          metric.status === 'completed'
                            ? 'bg-green-50 border-green-300'
                            : metric.status === 'processing'
                              ? 'bg-blue-50 border-blue-300 shadow-lg'
                              : metric.status === 'failed'
                                ? 'bg-red-50 border-red-300'
                                : 'bg-gray-50 border-gray-200'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <motion.span
                            initial={{ rotate: 0 }}
                            animate={{
                              rotate: metric.status === 'processing' ? [0, 10, -10, 0] : 0,
                            }}
                            transition={{
                              duration: 0.5,
                              repeat: metric.status === 'processing' ? Infinity : 0,
                              repeatDelay: 0.5,
                            }}
                            className="text-2xl"
                          >
                            {METRIC_ICONS[metric.metric] || '📝'}
                          </motion.span>
                          <span className="font-semibold text-gray-800">
                            {METRIC_NAMES[metric.metric] || metric.metric}
                          </span>
                        </div>

                        {/* Status Icon */}
                        <div className="relative">
                          {metric.status === 'completed' && (
                            <motion.div
                              initial={{ scale: 0, rotate: -180 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: 'spring', bounce: 0.5 }}
                              className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center"
                            >
                              <span className="text-white text-sm">✓</span>
                            </motion.div>
                          )}
                          {metric.status === 'processing' && (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                              className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full"
                            />
                          )}
                          {metric.status === 'failed' && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                            >
                              <span className="text-white text-sm">✗</span>
                            </motion.div>
                          )}
                          {metric.status === 'pending' && (
                            <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                              <span className="text-gray-600 text-xs">•</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Metric Progress Bar */}
                      {metric.status === 'processing' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-2"
                        >
                          <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                            <motion.div
                              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                              initial={{ width: '0%' }}
                              animate={{ width: `${metric.progress}%` }}
                              transition={{ duration: 0.3, ease: 'easeOut' }}
                            />
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            {Math.round(metric.progress)}% завершено
                          </p>
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Fun Loading Messages */}
            <AnimatePresence>
              {progress?.currentMetric && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg"
                >
                  <p className="text-sm text-gray-700 text-center">
                    <span className="inline-block mr-2">{getRandomEmoji()}</span>
                    {getRandomMessage(progress.currentMetric)}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stats */}
            {progress && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="mt-6 flex justify-center space-x-8 text-sm text-gray-600"
              >
                <div>
                  <span className="font-semibold">{progress.completedMetrics}</span>
                  <span className="text-gray-500"> из </span>
                  <span className="font-semibold">{progress.totalMetrics}</span>
                  <span className="text-gray-500"> критериев</span>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Decorative Elements */}
        <motion.div
          className="absolute -top-10 -left-10 w-20 h-20 bg-purple-200 rounded-full opacity-20"
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute -bottom-10 -right-10 w-32 h-32 bg-blue-200 rounded-full opacity-20"
          animate={{
            scale: [1, 1.3, 1],
            rotate: [360, 180, 0],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
        />
      </motion.div>
    </div>
  )
}

// Helper functions for fun messages
function getRandomEmoji(): string {
  const emojis = ['🤔', '💭', '🧐', '📚', '🎓', '✏️', '📖', '🔍', '💡', '🚀']
  return emojis[Math.floor(Math.random() * emojis.length)]
}

function getRandomMessage(metric: string): string {
  const messages: Record<string, string[]> = {
    logic: [
      'Лёха проверяет логические связи...',
      'Анализируем структуру материала...',
      'Ищем причинно-следственные связи...',
    ],
    practical: [
      'Лёха думает, где это пригодится...',
      'Оцениваем практическую ценность...',
      'Проверяем применимость знаний...',
    ],
    complexity: [
      'Лёха оценивает уровень сложности...',
      'Проверяем доступность материала...',
      'Анализируем глубину изложения...',
    ],
    interest: [
      'Лёха проверяет, не заскучает ли...',
      'Оцениваем увлекательность...',
      'Ищем интересные моменты...',
    ],
    care: [
      'Лёха чувствует душу в материале...',
      'Проверяем качество подачи...',
      'Оцениваем внимание к деталям...',
    ],
  }

  const metricMessages = messages[metric] || ['Анализируем...']
  return metricMessages[Math.floor(Math.random() * metricMessages.length)]
}
