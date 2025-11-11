'use client'

import { useState } from 'react'
import { Info, X } from 'lucide-react'

export default function PromptGuide() {
  const [isOpen, setIsOpen] = useState(false)

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-black transition-colors"
      >
        <Info className="w-4 h-4" />
        Как писать эффективные промпты
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-[20px] max-w-2xl w-full max-h-[80vh] overflow-auto p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-[24px] font-semibold text-black">Руководство по созданию промптов</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-[18px] font-medium text-black mb-2">Базовая структура промпта</h3>
            <p className="text-[14px] text-gray-700 mb-3">
              Для получения детального анализа ваш промпт должен четко описывать критерий оценки:
            </p>
            <div className="bg-gray-100 p-4 rounded-lg">
              <code className="text-[13px] text-black">
                Оцени [что именно] в диапазоне от -2 до +2, где:
                <br />
                -2 = [очень плохо]
                <br />
                -1 = [плохо]
                <br />
                0 = [нейтрально]
                <br />
                +1 = [хорошо]
                <br />
                +2 = [отлично]
                <br />
                <br />
                Обрати внимание на [конкретные аспекты].
              </code>
            </div>
          </div>

          <div>
            <h3 className="text-[18px] font-medium text-black mb-2">Примеры хороших промптов</h3>

            <div className="space-y-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-[14px] font-medium text-black mb-2">📊 Структурированность</h4>
                <p className="text-[13px] text-gray-700">
                  Оцени структурированность материала от -2 до +2. Проверь наличие логичного
                  введения, основной части и выводов. Обрати внимание на переходы между темами и
                  общую организацию контента.
                </p>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-[14px] font-medium text-black mb-2">
                  🎯 Практическая применимость
                </h4>
                <p className="text-[13px] text-gray-700">
                  Оцени практическую ценность материала от -2 до +2. Есть ли конкретные примеры,
                  пошаговые инструкции, реальные кейсы? Сможет ли студент применить знания на
                  практике?
                </p>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-[14px] font-medium text-black mb-2">💡 Ясность изложения</h4>
                <p className="text-[13px] text-gray-700">
                  Оцени ясность и доступность изложения от -2 до +2. Используется ли простой язык?
                  Объясняются ли сложные термины? Подходит ли стиль целевой аудитории?
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[18px] font-medium text-black mb-2">
              Автоматическое форматирование
            </h3>
            <p className="text-[14px] text-gray-700">
              Система автоматически добавит к вашему промпту запрос на детальный анализ в формате
              JSON, включая примеры из текста и рекомендации по улучшению. Вам нужно только описать
              критерий оценки.
            </p>
          </div>

          <div className="bg-gray-100 p-4 rounded-lg">
            <p className="text-[14px] text-blue-800">
              <strong>Совет:</strong> Чем конкретнее ваш промпт, тем точнее будет анализ. Избегайте
              слишком общих формулировок вроде "оцени качество".
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsOpen(false)}
          className="mt-6 px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
        >
          Понятно
        </button>
      </div>
    </div>
  )
}
