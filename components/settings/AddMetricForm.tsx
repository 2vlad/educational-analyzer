'use client'

import { useState, useEffect } from 'react'
import { MetricConfig } from '@/src/types/metrics'
import { X, AlertCircle } from 'lucide-react'

interface AddMetricFormProps {
  metric?: MetricConfig
  onSubmit: (metric: Omit<MetricConfig, 'id'>) => void
  onCancel: () => void
  existingNames: string[]
  isEdit?: boolean
}

export default function AddMetricForm({
  metric,
  onSubmit,
  onCancel,
  existingNames,
  isEdit = false,
}: AddMetricFormProps) {
  const [name, setName] = useState(metric?.name || '')
  const [promptText, setPromptText] = useState(metric?.prompt_text || '')
  const [isActive, setIsActive] = useState(metric?.is_active ?? true)
  const [errors, setErrors] = useState<{ name?: string; prompt?: string }>({})
  const [submitting, setSubmitting] = useState(false)

  const nameCharLimit = 50
  const promptCharLimit = 5000

  useEffect(() => {
    // Reset errors when form values change
    setErrors({})
  }, [name, promptText])

  const validate = () => {
    const newErrors: { name?: string; prompt?: string } = {}

    if (!name.trim()) {
      newErrors.name = 'Название метрики обязательно'
    } else if (name.length > nameCharLimit) {
      newErrors.name = `Название должно быть не более ${nameCharLimit} символов`
    } else if (!isEdit && existingNames.includes(name.trim())) {
      newErrors.name = 'Метрика с таким названием уже существует'
    }

    if (!promptText.trim()) {
      newErrors.prompt = 'Описание метрики обязательно'
    } else if (promptText.length < 10) {
      newErrors.prompt = 'Описание должно содержать минимум 10 символов'
    } else if (promptText.length > promptCharLimit) {
      newErrors.prompt = `Описание должно быть не более ${promptCharLimit} символов`
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    setSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        prompt_text: promptText.trim(),
        is_active: isActive,
        display_order: metric?.display_order || 999, // Will be calculated server-side if new
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-900">
              {isEdit ? 'Редактировать метрику' : 'Добавить новую метрику'}
            </h2>
            <button
              onClick={onCancel}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Name Field */}
          <div className="mb-6">
            <label htmlFor="name" className="block text-sm font-medium text-gray-500 mb-2">
              Название метрики
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Например: Ясность, Вовлечённость, Техническая точность"
              disabled={submitting}
            />
            <div className="mt-2 flex items-center justify-between">
              <span
                className={`text-xs ${
                  name.length > nameCharLimit ? 'text-red-600' : 'text-gray-500'
                }`}
              >
                {name.length}/{nameCharLimit} символов
              </span>
              {errors.name && (
                <span className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.name}
                </span>
              )}
            </div>
          </div>

          {/* Prompt Field */}
          <div className="mb-6">
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-500 mb-2">
              Описание метрики
            </label>
            <textarea
              id="prompt"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={6}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none ${
                errors.prompt ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Введите критерии оценки для этой метрики. Укажите конкретно, какие аспекты следует оценивать и как."
              disabled={submitting}
            />
            <div className="mt-2 flex items-center justify-between">
              <span
                className={`text-xs ${
                  promptText.length > promptCharLimit ? 'text-red-600' : 'text-gray-500'
                }`}
              >
                {promptText.length}/{promptCharLimit} символов
              </span>
              {errors.prompt && (
                <span className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.prompt}
                </span>
              )}
            </div>
          </div>

          {/* Active Toggle */}
          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                disabled={submitting}
              />
              <div>
                <span className="text-sm font-medium text-black">Активна</span>
                <p className="text-xs text-gray-600">
                  Активные метрики будут использоваться при анализе. Неактивные сохраняются, но не
                  используются.
                </p>
              </div>
            </label>
          </div>

          {/* Tips */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 mb-2">
              Советы по написанию хороших метрик:
            </h3>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Будьте конкретны в том, какие аспекты следует оценивать</li>
              <li>• Включите чёткие критерии оценки (что хорошо/плохо)</li>
              <li>• Учитывайте контекст и целевую аудиторию</li>
              <li>• Используйте ясный и однозначный язык</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={submitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={submitting}
            >
              {submitting ? 'Сохранение...' : isEdit ? 'Сохранить изменения' : 'Добавить метрику'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
