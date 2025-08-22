'use client'

import { useState } from 'react'
import UnifiedHeader from '@/components/layout/UnifiedHeader'
import ProgramsList from '@/components/programs/ProgramsList'
import ProgramLessons from '@/components/programs/ProgramLessons'
import AddProgramModal from '@/components/programs/AddProgramModal'

export interface Program {
  id: string
  title: string
  lessonsCount: number
  completedCount: number
  status: 'active' | 'completed' | 'draft'
}

export interface Lesson {
  id: string
  programId: string
  title: string
  status: 'completed' | 'error' | 'in-progress' | 'not-started'
  order: number
  content?: string
  analysisId?: string
}

// Mock data - replace with actual data from database
const mockPrograms: Program[] = [
  { id: '1', title: 'JavaScript', lessonsCount: 10, completedCount: 7, status: 'active' },
  { id: '2', title: 'Python для новичков', lessonsCount: 8, completedCount: 8, status: 'completed' },
  { id: '3', title: 'Кибербезопасность', lessonsCount: 12, completedCount: 3, status: 'active' },
  { id: '4', title: 'Машинное обучение', lessonsCount: 15, completedCount: 0, status: 'draft' },
  { id: '5', title: 'React Advanced', lessonsCount: 10, completedCount: 5, status: 'active' },
]

const mockLessons: Record<string, Lesson[]> = {
  '1': [
    { id: '1-1', programId: '1', title: 'Введение в JavaScript', status: 'completed', order: 1 },
    { id: '1-2', programId: '1', title: 'Переменные и типы данных', status: 'completed', order: 2 },
    { id: '1-3', programId: '1', title: 'Функции и области видимости', status: 'completed', order: 3 },
    { id: '1-4', programId: '1', title: 'Объекты и массивы', status: 'completed', order: 4 },
    { id: '1-5', programId: '1', title: 'Асинхронное программирование', status: 'completed', order: 5 },
    { id: '1-6', programId: '1', title: 'Promises и async/await', status: 'completed', order: 6 },
    { id: '1-7', programId: '1', title: 'ES6+ возможности', status: 'completed', order: 7 },
    { id: '1-8', programId: '1', title: 'Работа с DOM', status: 'in-progress', order: 8 },
    { id: '1-9', programId: '1', title: 'События и обработчики', status: 'not-started', order: 9 },
    { id: '1-10', programId: '1', title: 'Модули и импорты', status: 'not-started', order: 10 },
  ],
  '2': [
    { id: '2-1', programId: '2', title: 'Установка Python', status: 'completed', order: 1 },
    { id: '2-2', programId: '2', title: 'Основы синтаксиса', status: 'completed', order: 2 },
    { id: '2-3', programId: '2', title: 'Структуры данных', status: 'completed', order: 3 },
    { id: '2-4', programId: '2', title: 'Функции в Python', status: 'completed', order: 4 },
    { id: '2-5', programId: '2', title: 'ООП в Python', status: 'completed', order: 5 },
    { id: '2-6', programId: '2', title: 'Работа с файлами', status: 'completed', order: 6 },
    { id: '2-7', programId: '2', title: 'Исключения', status: 'completed', order: 7 },
    { id: '2-8', programId: '2', title: 'Библиотеки и pip', status: 'completed', order: 8 },
  ],
  '3': [
    { id: '3-1', programId: '3', title: 'Основы безопасности', status: 'completed', order: 1 },
    { id: '3-2', programId: '3', title: 'Криптография', status: 'completed', order: 2 },
    { id: '3-3', programId: '3', title: 'Сетевая безопасность', status: 'completed', order: 3 },
    { id: '3-4', programId: '3', title: 'Веб-уязвимости', status: 'error', order: 4 },
    { id: '3-5', programId: '3', title: 'SQL инъекции', status: 'not-started', order: 5 },
    { id: '3-6', programId: '3', title: 'XSS атаки', status: 'not-started', order: 6 },
    { id: '3-7', programId: '3', title: 'CSRF защита', status: 'not-started', order: 7 },
    { id: '3-8', programId: '3', title: 'Аутентификация', status: 'not-started', order: 8 },
    { id: '3-9', programId: '3', title: 'Авторизация', status: 'not-started', order: 9 },
    { id: '3-10', programId: '3', title: 'Безопасность API', status: 'not-started', order: 10 },
    { id: '3-11', programId: '3', title: 'Пентестинг', status: 'not-started', order: 11 },
    { id: '3-12', programId: '3', title: 'Compliance и стандарты', status: 'not-started', order: 12 },
  ],
}

export default function ProgramsPage() {
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(mockPrograms[0])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [programs, setPrograms] = useState<Program[]>(mockPrograms)

  const handleAddProgram = (title: string) => {
    const newProgram: Program = {
      id: String(programs.length + 1),
      title,
      lessonsCount: 0,
      completedCount: 0,
      status: 'draft',
    }
    setPrograms([...programs, newProgram])
    setSelectedProgram(newProgram)
    setIsAddModalOpen(false)
  }

  const lessons = selectedProgram ? (mockLessons[selectedProgram.id] || []) : []

  return (
    <div className="min-h-screen bg-white">
      <UnifiedHeader />
      
      <div className="flex h-[calc(100vh-64px)]">
        {/* Sidebar with programs list */}
        <ProgramsList
          programs={programs}
          selectedProgram={selectedProgram}
          onSelectProgram={setSelectedProgram}
          onAddProgram={() => setIsAddModalOpen(true)}
        />

        {/* Main content area with lessons */}
        <div className="flex-1 overflow-y-auto">
          {selectedProgram && (
            <ProgramLessons
              program={selectedProgram}
              lessons={lessons}
            />
          )}
        </div>
      </div>

      {/* Add Program Modal */}
      <AddProgramModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddProgram}
      />
    </div>
  )
}