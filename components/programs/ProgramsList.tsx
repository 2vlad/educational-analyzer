'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Program } from '@/app/(dashboard)/programs/page'

interface ProgramsListProps {
  programs: Program[]
  selectedProgram: Program | null
  onSelectProgram: (program: Program) => void
  onAddProgram: () => void
}

export default function ProgramsList({
  programs,
  selectedProgram,
  onSelectProgram,
  onAddProgram,
}: ProgramsListProps) {
  return (
    <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col">
      {/* Programs list */}
      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
          Программы
        </h2>
        <div className="space-y-2">
          {programs.map((program) => (
            <button
              key={program.id}
              onClick={() => onSelectProgram(program)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                selectedProgram?.id === program.id
                  ? 'bg-white shadow-sm border border-gray-200'
                  : 'hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{program.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {program.completedCount} из {program.lessonsCount} уроков
                  </p>
                </div>
                {program.status === 'completed' && (
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
                )}
              </div>
              {program.lessonsCount > 0 && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{
                        width: `${(program.completedCount / program.lessonsCount) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Add program button */}
      <div className="p-4 border-t border-gray-200">
        <Button
          onClick={onAddProgram}
          className="w-full bg-black text-white hover:bg-gray-800"
        >
          <Plus className="w-4 h-4 mr-2" />
          Добавить новую программу
        </Button>
      </div>
    </div>
  )
}