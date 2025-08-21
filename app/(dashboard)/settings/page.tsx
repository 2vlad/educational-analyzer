'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/src/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { MetricConfig } from '@/src/types/metrics'
import MetricListView from '@/components/settings/MetricListView'
import AddMetricForm from '@/components/settings/AddMetricForm'
import MetricPreview from '@/components/settings/MetricPreview'
import { Toaster, toast } from 'react-hot-toast'
import { Loader2, Plus } from 'lucide-react'

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [metrics, setMetrics] = useState<MetricConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingMetric, setEditingMetric] = useState<MetricConfig | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [authLoading, user, router])

  useEffect(() => {
    if (user) {
      fetchMetrics()
    }
  }, [user])

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/configuration')
      if (!response.ok) throw new Error('Failed to fetch metrics')
      const data = await response.json()
      setMetrics(data.configurations || [])
    } catch (error) {
      console.error('Error fetching metrics:', error)
      toast.error('Failed to load metrics')
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
      const response = await fetch('/api/configuration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      })

      if (!response.ok) throw new Error('Failed to update metric')
      setEditingMetric(null)
      toast.success('Metric updated successfully')
    } catch (error) {
      // Rollback on error
      setMetrics(previousMetrics)
      console.error('Error updating metric:', error)
      toast.error('Failed to update metric')
    }
  }

  const handleDeleteMetric = async (id: string, hard: boolean = false) => {
    // Optimistic update
    const previousMetrics = [...metrics]
    if (hard) {
      setMetrics(metrics.filter((m) => m.id !== id))
    } else {
      setMetrics(metrics.map((m) => (m.id === id ? { ...m, is_active: false } : m)))
    }

    try {
      const url = `/api/configuration?id=${id}${hard ? '&hard=true' : ''}`
      const response = await fetch(url, { method: 'DELETE' })

      if (!response.ok) throw new Error('Failed to delete metric')
      toast.success(hard ? 'Metric deleted permanently' : 'Metric deactivated')
    } catch (error) {
      // Rollback on error
      setMetrics(previousMetrics)
      console.error('Error deleting metric:', error)
      toast.error('Failed to delete metric')
    }
  }

  const handleResetToDefaults = async () => {
    if (!confirm('This will reset all your metrics to the default settings. Are you sure?')) {
      return
    }

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

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-[1200px] mx-auto">
        <Toaster position="top-right" />

        {/* Header - Лёха AI style */}
        <header className="mb-12">
          <div className="mb-4">
            <h1 className="text-[48px] font-bold text-black mb-2">Настройки метрик</h1>
            <p className="text-[16px] text-black/70">
              Настройте критерии оценки контента под ваши потребности
            </p>
          </div>
          <button
            onClick={handleResetToDefaults}
            className="px-6 py-2 text-sm text-black/60 hover:text-black hover:bg-gray-100 rounded-full transition-colors"
          >
            Сбросить к стандартным
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Metric List */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-gray-200 p-8" style={{ borderRadius: '40px' }}>
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-[24px] font-semibold text-black">Ваши метрики</h2>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Добавить метрику
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
          </div>

          {/* Sidebar - Preview */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-gray-200 p-8 sticky top-4" style={{ borderRadius: '40px' }}>
              <div className="mb-6">
                <h2 className="text-[24px] font-semibold text-black">Предпросмотр</h2>
                <p className="text-[14px] text-black/70 mt-1">
                  Так будут выглядеть метрики при анализе
                </p>
              </div>
              <MetricPreview metrics={metrics.filter((m) => m.is_active)} />
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
            isEdit
          />
        )}
      </div>
    </div>
  )
}
