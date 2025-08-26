'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/src/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { MetricConfig } from '@/src/types/metrics'
import MetricListView from '@/components/settings/MetricListView'
import AddMetricForm from '@/components/settings/AddMetricForm'
import { Toaster, toast } from 'react-hot-toast'
import { Loader2, Plus } from 'lucide-react'
import ModelSelector from '@/components/ModelSelector'
import UnifiedHeader from '@/components/layout/UnifiedHeader'

export default function CustomMetricsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [metrics, setMetrics] = useState<MetricConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingMetric, setEditingMetric] = useState<MetricConfig | null>(null)
  const [content, setContent] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  useEffect(() => {
    // Fetch metrics when component mounts or user changes
    fetchMetrics()
  }, [user])

  const fetchMetrics = async () => {
    try {
      // Only fetch user metrics if authenticated
      if (user) {
        const response = await fetch('/api/configuration')
        if (!response.ok) throw new Error('Failed to fetch metrics')
        const data = await response.json()
        setMetrics(data.configurations || [])
      } else {
        // Use default LX metrics for non-authenticated users
        setMetrics([
          { id: 'logic', name: 'Логика', prompt_text: 'Оцените логическую структуру и аргументацию', display_order: 1, is_active: true },
          { id: 'practical', name: 'Польза', prompt_text: 'Оцените практическую применимость', display_order: 2, is_active: true },
          { id: 'complexity', name: 'Сложность', prompt_text: 'Оцените глубину и сложность содержания', display_order: 3, is_active: true },
          { id: 'interest', name: 'Интерес', prompt_text: 'Оцените вовлеченность и уровень интереса', display_order: 4, is_active: true },
          { id: 'care', name: 'Забота', prompt_text: 'Оцените внимание к деталям и качество', display_order: 5, is_active: true }
        ])
      }
    } catch (error) {
      console.error('Error fetching metrics:', error)
      // Use default metrics as fallback
      setMetrics([
        { id: 'logic', name: 'Логика', prompt_text: 'Оцените логическую структуру и аргументацию', display_order: 1, is_active: true },
        { id: 'practical', name: 'Польза', prompt_text: 'Оцените практическую применимость', display_order: 2, is_active: true },
        { id: 'complexity', name: 'Сложность', prompt_text: 'Оцените глубину и сложность содержания', display_order: 3, is_active: true },
        { id: 'interest', name: 'Интерес', prompt_text: 'Оцените вовлеченность и уровень интереса', display_order: 4, is_active: true },
        { id: 'care', name: 'Забота', prompt_text: 'Оцените внимание к деталям и качество', display_order: 5, is_active: true }
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleReorder = async (updatedMetrics: MetricConfig[]) => {
    // Optimistic update
    const previousMetrics = [...metrics]
    setMetrics(updatedMetrics)

    try {
      const configurations = updatedMetrics.map((metric, index) => ({
        id: metric.id,
        display_order: index + 1,
      }))

      const response = await fetch('/api/configuration/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configurations }),
      })

      if (!response.ok) throw new Error('Failed to reorder metrics')
      toast.success('Metrics reordered successfully')
    } catch (error) {
      // Rollback on error
      setMetrics(previousMetrics)
      console.error('Error reordering metrics:', error)
      toast.error('Failed to reorder metrics')
    }
  }

  const handleAddMetric = async (metric: Omit<MetricConfig, 'id'>) => {
    try {
      const response = await fetch('/api/configuration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metric),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add metric')
      }

      const data = await response.json()
      setMetrics([...metrics, data.configuration])
      setShowAddForm(false)
      toast.success('Metric added successfully')
    } catch (error: any) {
      console.error('Error adding metric:', error)
      toast.error(error.message || 'Failed to add metric')
    }
  }

  const handleUpdateMetric = async (id: string, updates: Partial<MetricConfig>) => {
    // Optimistic update
    const previousMetrics = [...metrics]
    setMetrics(metrics.map((m) => (m.id === id ? { ...m, ...updates } : m)))

    try {
      const response = await fetch(`/api/configuration/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) throw new Error('Failed to update metric')
      toast.success('Metric updated successfully')
    } catch (error) {
      // Rollback on error
      setMetrics(previousMetrics)
      console.error('Error updating metric:', error)
      toast.error('Failed to update metric')
    }
  }

  const handleDeleteMetric = async (id: string) => {
    // Optimistic update
    const previousMetrics = [...metrics]
    setMetrics(metrics.filter((m) => m.id !== id))

    try {
      const response = await fetch(`/api/configuration/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete metric')
      toast.success('Metric deleted successfully')
    } catch (error) {
      // Rollback on error
      setMetrics(previousMetrics)
      console.error('Error deleting metric:', error)
      toast.error('Failed to delete metric')
    }
  }

  const handleResetToDefaults = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/configuration/reset', {
        method: 'POST',
      })

      if (!response.ok) throw new Error('Failed to reset metrics')
      const data = await response.json()
      setMetrics(data.configurations || [])
      toast.success('Metrics reset to defaults')
    } catch (error) {
      console.error('Error resetting metrics:', error)
      toast.error('Failed to reset metrics')
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyze = async () => {
    if (!content.trim() || isAnalyzing) return

    setIsAnalyzing(true)
    try {
      // Get selected model from localStorage
      const selectedModel = localStorage.getItem('selectedModel') || 'yandex-gpt-pro'
      
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          metricMode: 'custom',
          modelId: selectedModel,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Analysis failed')
      }

      const data = await response.json()
      
      // Store the analysis result and navigate to results
      sessionStorage.setItem('analysisResult', JSON.stringify(data))
      sessionStorage.setItem('analysisContent', content)
      router.push('/')
    } catch (error: any) {
      console.error('Analysis error:', error)
      toast.error(error.message || 'Failed to analyze content')
    } finally {
      setIsAnalyzing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <UnifiedHeader />
      
      <div className="flex-1 flex justify-center p-6">
        <div className="w-full max-w-[450px] mt-[50px]">
          <Toaster position="top-right" />

        {/* Header - Лёха AI style */}
        <header className="mb-10">
          <div className="mb-4">
            <h1 className="text-[48px] font-bold text-black mb-3 leading-tight" style={{ fontFamily: 'Inter, sans-serif' }}>
              Мой сет
            </h1>
            <p className="text-[20px] font-normal text-black" style={{ fontFamily: 'Inter, sans-serif', lineHeight: '120%' }}>
              настройте критерии оценки
              <br />
              контента под ваши
              <br />
              потребности
            </p>
          </div>
          <button
            onClick={handleResetToDefaults}
            className="px-6 py-2 text-sm text-black/60 hover:text-black hover:bg-gray-100 rounded-full transition-colors"
          >
            Сбросить к стандартным
          </button>
        </header>

        {/* Model Selector */}
        <div className="mb-6">
          <label className="block text-[15px] font-normal text-gray-500 mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>
            Модель
          </label>
          <ModelSelector />
        </div>

        {/* Main Content - Metric List */}
        {user ? (
          <div className="bg-white border border-gray-200 p-6 mb-6" style={{ borderRadius: '20px' }}>
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-[20px] font-semibold text-black">Ваши метрики</h2>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Добавить
                </button>
              </div>
            </div>

            <MetricListView
              metrics={metrics}
              onReorder={handleReorder}
              onEdit={setEditingMetric}
              onDelete={handleDeleteMetric}
              onToggleActive={(id, active) => handleUpdateMetric(id, { is_active: active })}
            />
          </div>
        ) : (
          <div className="bg-[#F5F5F5] p-6 mb-6" style={{ borderRadius: '20px' }}>
            <p className="text-center text-gray-600">
              Войдите в систему, чтобы настроить собственные метрики
            </p>
          </div>
        )}

        {/* Content Analysis Section - matching LX page */}
        <div className="mb-6">
          <label className="block text-[15px] font-normal text-gray-500 mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>
            Контент
          </label>
          <div className="relative">
            <div className="w-full h-48 relative bg-[#F2F2F2] rounded-[50px] px-3 py-3">
              <textarea
                placeholder="Текст урока"
                value={content}
                onChange={(e) => {
                  const text = e.target.value
                  if (text.length <= 25000) {
                    setContent(text)
                  }
                }}
                className="w-full h-[140px] pl-2 pr-20 pb-24 pt-2 text-[20px] font-light text-black leading-relaxed 
                          bg-transparent border-0 outline-none focus:outline-none focus:ring-0 resize-none placeholder:text-gray-400/60"
                maxLength={25000}
                style={{ fontFamily: 'Inter, sans-serif' }}
              />

              {/* Character Counter */}
              {content && (
                <div className="absolute bottom-3 right-[200px] text-[12px] text-gray-400">
                  {content.length} / 25000
                </div>
              )}

              {/* Analyze Button inside textarea */}
              <button
                onClick={handleAnalyze}
                disabled={!content.trim() || isAnalyzing}
                className="absolute bottom-3 right-3 px-8 py-3.5 h-[42px] text-[14px] font-normal bg-[#1a1a1a] text-white 
                         hover:opacity-80 disabled:opacity-50
                         rounded-full transition-opacity duration-200 flex items-center justify-center"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Анализируем...
                  </>
                ) : (
                  'Проанализировать'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Add Metric Modal */}
        {showAddForm && (
          <AddMetricForm
            onSubmit={handleAddMetric}
            onCancel={() => setShowAddForm(false)}
            existingNames={metrics.map((m) => m.name)}
          />
        )}

        {/* Edit Metric Modal */}
        {editingMetric && (
          <AddMetricForm
            metric={editingMetric}
            onSubmit={(updates) => handleUpdateMetric(editingMetric.id, updates)}
            onCancel={() => setEditingMetric(null)}
            existingNames={metrics.filter((m) => m.id !== editingMetric.id).map((m) => m.name)}
          />
        )}
        </div>
      </div>
    </div>
  )
}