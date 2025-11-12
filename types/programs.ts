/**
 * Program and Lesson types for Programs page
 */

export interface Program {
  id: string
  title: string
  lessonsCount: number
  completedCount: number
  status: 'draft' | 'active' | 'completed'
  sourceType: 'yonote' | 'generic_list' | 'manual'
}

export interface Lesson {
  id: string
  programId: string
  title: string
  status: 'not-started' | 'analyzing' | 'completed' | 'failed'
  order: number
}
