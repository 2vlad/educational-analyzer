export const DEFAULT_STUDENT_CHARACTER =
  'Ты — Лёха, студент без опыта в программировании, который изучает материал.'

export function normalizeStudentCharacter(character?: string): string {
  const trimmed = character?.trim()
  if (!trimmed) {
    return DEFAULT_STUDENT_CHARACTER
  }
  // Replace multiple spaces with single and ensure ends with a period
  const normalized = trimmed.replace(/\s+/g, ' ')
  return normalized.endsWith('.') ? normalized : `${normalized}.`
}

export function applyStudentCharacter(prompt: string, character?: string): string {
  const persona = normalizeStudentCharacter(character)
  if (!persona) {
    return prompt
  }

  const personaPattern = /^Ты\s+—[^.]*\./
  if (personaPattern.test(prompt)) {
    return prompt.replace(personaPattern, persona)
  }

  return `${persona}\n\n${prompt}`
}
