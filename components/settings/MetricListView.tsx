'use client'

import { useState } from 'react'
import { MetricConfig } from '@/src/types/metrics'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Edit2, Trash2, Eye, EyeOff, MoreVertical, AlertCircle } from 'lucide-react'

interface MetricListViewProps {
  metrics: MetricConfig[]
  onReorder: (metrics: MetricConfig[]) => void
  onEdit: (metric: MetricConfig) => void
  onDelete: (id: string, hard: boolean) => void
  onToggleActive: (id: string, active: boolean) => void
}

interface MetricItemProps {
  metric: MetricConfig
  onEdit: () => void
  onDelete: (hard: boolean) => void
  onToggleActive: (active: boolean) => void
}

function MetricItem({ metric, onEdit, onDelete, onToggleActive }: MetricItemProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: metric.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 bg-white border-b last:border-b-0 ${
        !metric.is_active ? 'opacity-60' : ''
      } ${isDragging ? 'shadow-lg' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-5 h-5" />
        </button>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-gray-900">{metric.name}</h3>
            {!metric.is_active && (
              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                Неактивна
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 line-clamp-2">{metric.prompt_text}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Active Toggle */}
          <button
            onClick={() => onToggleActive(!metric.is_active)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title={metric.is_active ? 'Деактивировать' : 'Активировать'}
          >
            {metric.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          {/* Edit */}
          <button
            onClick={onEdit}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Редактировать"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          {/* More Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      setShowDeleteConfirm(true)
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Удалить навсегда
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900">Удалить метрику</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Вы уверены, что хотите навсегда удалить "{metric.name}"? Это действие нельзя
                  отменить.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  onDelete(true)
                  setShowDeleteConfirm(false)
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Удалить навсегда
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MetricListView({
  metrics,
  onReorder,
  onEdit,
  onDelete,
  onToggleActive,
}: MetricListViewProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = metrics.findIndex((m) => m.id === active.id)
      const newIndex = metrics.findIndex((m) => m.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newMetrics = arrayMove(metrics, oldIndex, newIndex)
        onReorder(newMetrics)
      }
    }
  }

  if (metrics.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>Метрики ещё не настроены.</p>
        <p className="text-sm mt-2">Нажмите "Добавить метрику", чтобы создать первую метрику.</p>
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={metrics.map((m) => m.id)} strategy={verticalListSortingStrategy}>
        <div className="divide-y divide-gray-200">
          {metrics.map((metric) => (
            <MetricItem
              key={metric.id}
              metric={metric}
              onEdit={() => onEdit(metric)}
              onDelete={(hard) => onDelete(metric.id, hard)}
              onToggleActive={(active) => onToggleActive(metric.id, active)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
