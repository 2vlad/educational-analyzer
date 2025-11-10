'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, Play, RefreshCw, Eye, Trash2, Edit, Upload, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Program, Lesson } from '@/app/programs/page'

interface ProgramLessonsProps {
  program: Program
  lessons: Lesson[]
  loading?: boolean
}

export default function ProgramLessons({ program, lessons, loading = false }: ProgramLessonsProps) {
  const router = useRouter()
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(new Set())

  const handleAnalyze = (lesson: Lesson) => {
    // Navigate to analysis page with lesson content
    router.push(`/programs/${program.id}/lessons/${lesson.id}/analyze`)
  }

  const handleViewResults = (lesson: Lesson) => {
    // Navigate to results page
    router.push(`/programs/${program.id}/lessons/${lesson.id}/results`)
  }

  const handleReanalyze = (lesson: Lesson) => {
    // Re-run analysis
    handleAnalyze(lesson)
  }

  const toggleLessonSelection = (lessonId: string) => {
    const newSelection = new Set(selectedLessons)
    if (newSelection.has(lessonId)) {
      newSelection.delete(lessonId)
    } else {
      newSelection.add(lessonId)
    }
    setSelectedLessons(newSelection)
  }

  const getStatusIcon = (status: Lesson['status']) => {
    switch (status) {
      case 'completed':
        return (
          <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
            <svg
              className="w-3 h-3 text-white"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
        )
      case 'error':
        return (
          <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
            <svg
              className="w-3 h-3 text-white"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
          </div>
        )
      case 'in-progress':
        return (
          <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
            <Clock className="w-3 h-3 text-white" />
          </div>
        )
      default:
        return <div className="w-5 h-5 bg-gray-300 rounded-full" />
    }
  }

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Загрузка уроков...</p>
          </div>
        </div>
      </div>
    )
  }

  if (lessons.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{program.title}</h1>
          <p className="text-gray-600 mt-1">Уроки еще не загружены</p>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-gray-500 mb-4">
              Нажмите "Загрузить уроки" в списке программ, чтобы загрузить список уроков
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{program.title}</h1>
        <p className="text-gray-600 mt-1">
          {program.completedCount} из {program.lessonsCount} уроков завершено
        </p>
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {selectedLessons.size > 0 && (
            <>
              <Button variant="outline" size="sm">
                <Play className="w-4 h-4 mr-2" />
                Анализировать выбранные ({selectedLessons.size})
              </Button>
              <Button variant="outline" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Удалить
              </Button>
            </>
          )}
        </div>
        <Button className="bg-black text-white hover:bg-gray-800">
          <Upload className="w-4 h-4 mr-2" />
          Добавить урок
        </Button>
      </div>

      {/* Lessons list */}
      <div className="space-y-2">
        {lessons.map((lesson) => (
          <div
            key={lesson.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-4">
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={selectedLessons.has(lesson.id)}
                onChange={() => toggleLessonSelection(lesson.id)}
                className="w-4 h-4 rounded border-gray-300 text-black focus:ring-gray-800"
              />

              {/* Status icon */}
              {getStatusIcon(lesson.status)}

              {/* Lesson info */}
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">
                  Урок {lesson.order}. {lesson.title}
                </h3>
                {lesson.status === 'error' && (
                  <p className="text-sm text-red-600 mt-1">Ошибка при анализе</p>
                )}
                {lesson.status === 'in-progress' && (
                  <p className="text-sm text-yellow-600 mt-1">Анализируется...</p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {lesson.status === 'not-started' && (
                  <Button
                    size="sm"
                    onClick={() => handleAnalyze(lesson)}
                    className="bg-black text-white hover:bg-gray-800"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Анализировать
                  </Button>
                )}
                {lesson.status === 'completed' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewResults(lesson)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Результаты
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReanalyze(lesson)}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Переанализировать
                    </Button>
                  </>
                )}
                {lesson.status === 'error' && (
                  <Button
                    size="sm"
                    onClick={() => handleReanalyze(lesson)}
                    className="bg-red-500 text-white hover:bg-red-600"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Повторить
                  </Button>
                )}

                {/* More options */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Edit className="w-4 h-4 mr-2" />
                      Редактировать
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Удалить
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {lessons.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">В этой программе пока нет уроков</p>
          <Button className="mt-4 bg-black text-white hover:bg-gray-800">
            <Upload className="w-4 h-4 mr-2" />
            Добавить первый урок
          </Button>
        </div>
      )}
    </div>
  )
}