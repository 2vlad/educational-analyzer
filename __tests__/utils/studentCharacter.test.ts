import { describe, expect, it } from '@jest/globals'
import {
  DEFAULT_STUDENT_CHARACTER,
  applyStudentCharacter,
  normalizeStudentCharacter,
} from '@/src/utils/studentCharacter'

describe('normalizeStudentCharacter', () => {
  it('returns default when character is empty', () => {
    expect(normalizeStudentCharacter()).toBe(DEFAULT_STUDENT_CHARACTER)
    expect(normalizeStudentCharacter('   ')).toBe(DEFAULT_STUDENT_CHARACTER)
  })

  it('trims and collapses whitespace', () => {
    expect(normalizeStudentCharacter('  Ты — Лёха,  дружелюбный студент  ')).toBe(
      'Ты — Лёха, дружелюбный студент.',
    )
  })

  it('keeps expressive punctuation at the end', () => {
    expect(normalizeStudentCharacter('Ты — Лёха, активный студент!')).toBe(
      'Ты — Лёха, активный студент!',
    )
    expect(normalizeStudentCharacter('Ты — Лёха, любознательный студент?')).toBe(
      'Ты — Лёха, любознательный студент?',
    )
    expect(normalizeStudentCharacter('Ты — Лёха, внимательный студент…')).toBe(
      'Ты — Лёха, внимательный студент…',
    )
  })
})

describe('applyStudentCharacter', () => {
  const basePrompt =
    'Ты — Лёха, студент без опыта в программировании, который изучает материал. Оцени материал.'

  it('replaces existing persona line with the provided character', () => {
    const updated = applyStudentCharacter(basePrompt, 'Ты — Лёха, энергичный наставник!')
    expect(updated).toBe('Ты — Лёха, энергичный наставник! Оцени материал.')
  })

  it('replaces persona even when original prompt ends with an exclamation mark', () => {
    const promptWithExclamation =
      'Ты — Лёха, студент без опыта в программировании, который изучает материал! Проведи анализ.'
    const updated = applyStudentCharacter(promptWithExclamation, 'Ты — Лёха, уверенный ментор.')
    expect(updated).toBe('Ты — Лёха, уверенный ментор. Проведи анализ.')
  })

  it('prefixes persona when prompt does not define it', () => {
    const prompt = 'Проанализируй материал по критериям качества.'
    const updated = applyStudentCharacter(prompt, 'Ты — Лёха, внимательный студент?')
    expect(updated).toBe(
      'Ты — Лёха, внимательный студент?\n\nПроанализируй материал по критериям качества.',
    )
  })
})
