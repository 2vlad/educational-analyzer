'use client'

import { useEffect, useState } from 'react'

interface SimpleLoaderProps {
  message?: string
}

const messages = [
  'Отправка на анализ...',
  'Анализ логики...',
  'Оценка практичности...',
  'Проверка сложности...',
  'Анализ интереса...',
  'Оценка качества...',
  'Подготовка результатов...',
]

export function SimpleLoader({ message }: SimpleLoaderProps) {
  const [currentMessage, setCurrentMessage] = useState(message || messages[0])
  const [messageIndex, setMessageIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (message) {
      // If a specific message is provided, use it
      setIsVisible(false)
      globalThis.setTimeout(() => {
        setCurrentMessage(message)
        setIsVisible(true)
      }, 150)
    } else {
      // Otherwise cycle through messages
      const interval = globalThis.setInterval(() => {
        setIsVisible(false)
        globalThis.setTimeout(() => {
          setMessageIndex((prev) => (prev + 1) % messages.length)
          setIsVisible(true)
        }, 150)
      }, 2500)

      return () => globalThis.clearInterval(interval)
    }
  }, [message])

  useEffect(() => {
    if (!message) {
      setCurrentMessage(messages[messageIndex])
    }
  }, [messageIndex, message])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div
          className={`text-2xl font-medium text-gray-800 transition-all duration-300 transform ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
          }`}
        >
          {currentMessage}
        </div>
        <div className="mt-8 flex justify-center gap-1">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}
