import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/src/lib/supabase/server'
import { DEFAULT_STUDENT_CHARACTER, normalizeStudentCharacter } from '@/src/utils/studentCharacter'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ studentCharacter: DEFAULT_STUDENT_CHARACTER })
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('student_character')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('Failed to load student character:', error)
    return NextResponse.json({ studentCharacter: DEFAULT_STUDENT_CHARACTER })
  }

  return NextResponse.json({
    studentCharacter: normalizeStudentCharacter(data?.student_character || undefined),
  })
}

const updateSchema = z.object({
  studentCharacter: z.string().min(5).max(500),
})

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Некорректные данные', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const normalized = normalizeStudentCharacter(parsed.data.studentCharacter)

  const { error } = await supabase
    .from('profiles')
    .update({ student_character: normalized })
    .eq('id', user.id)

  if (error) {
    console.error('Failed to update student character:', error)
    return NextResponse.json({ error: 'Не удалось сохранить характер' }, { status: 500 })
  }

  return NextResponse.json({ studentCharacter: normalized })
}
