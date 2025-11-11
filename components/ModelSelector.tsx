'use client'

import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Model {
  id: string
  name: string
}

interface ModelSelectorProps {
  onModelChange?: (modelId: string) => void
}

export default function ModelSelector({ onModelChange }: ModelSelectorProps = {}) {
  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  useEffect(() => {
    fetchModels()
    // Load saved model preference
    if (typeof window !== 'undefined') {
      const savedModel = window.localStorage.getItem('selectedModel')
      if (savedModel) {
        setSelectedModel(savedModel)
        // Notify parent of initial model
        if (onModelChange) {
          onModelChange(savedModel)
        }
      }
    }
  }, [])

  const fetchModels = async () => {
    try {
      const response = await fetch('/api/models')
      if (!response.ok) throw new Error('Failed to fetch models')
      const data = await response.json()
      setModels(data.models || [])

      // Set default model if none selected
      if (!selectedModel && data.defaultModel) {
        setSelectedModel(data.defaultModel)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('selectedModel', data.defaultModel)
        }
        // Notify parent of default model
        if (onModelChange) {
          onModelChange(data.defaultModel)
        }
      } else if (!selectedModel && data.models?.length > 0) {
        // Fallback to first available model if no default
        const defaultModel = data.models[0].id
        setSelectedModel(defaultModel)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('selectedModel', defaultModel)
        }
        // Notify parent of fallback model
        if (onModelChange) {
          onModelChange(defaultModel)
        }
      }
    } catch (error) {
      console.error('Error fetching models:', error)
      // Set default models if API fails
      setModels([
        { id: 'yandex-gpt-pro', name: 'YandexGPT Pro' },
        { id: 'claude-haiku', name: 'Claude 3.5 Haiku' },
        { id: 'claude-sonnet-4', name: 'Claude 3.5 Sonnet' },
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gemini-pro', name: 'Gemini 2.5 Flash' },
      ])
      // Set default to yandex-gpt-pro on API failure
      if (!selectedModel) {
        setSelectedModel('yandex-gpt-pro')
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('selectedModel', 'yandex-gpt-pro')
        }
        // Notify parent of fallback model
        if (onModelChange) {
          onModelChange('yandex-gpt-pro')
        }
      }
    }
  }

  const handleModelChange = (value: string) => {
    setSelectedModel(value)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('selectedModel', value)
    }
    // Call optional callback
    if (onModelChange) {
      onModelChange(value)
    }
  }

  if (models.length === 0) {
    return (
      <div className="w-full h-14 px-6 flex items-center text-[20px] font-light text-black bg-[#F2F2F2] rounded-[50px]">
        Загрузка моделей...
      </div>
    )
  }

  return (
    <Select
      value={selectedModel}
      onValueChange={handleModelChange}
      onOpenChange={setIsDropdownOpen}
    >
      <SelectTrigger className="relative w-full !h-14 !px-6 !pr-14 text-[20px] font-light text-black dark:text-white bg-white dark:bg-[#2a2d3e] hover:bg-gray-50 dark:hover:bg-[#353850] transition-colors rounded-[50px] border border-gray-300 dark:border-gray-600 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0">
        <SelectValue placeholder="Выберите модель" />
        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
          <ChevronRight
            className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
              isDropdownOpen ? 'rotate-90' : ''
            }`}
          />
        </div>
      </SelectTrigger>
      <SelectContent className="bg-white dark:bg-[#2a2d3e] text-black dark:text-white rounded-2xl border-gray-300 dark:border-gray-600">
        {models.map((model) => (
          <SelectItem
            key={model.id}
            value={model.id}
            className="text-[20px] text-black dark:text-white py-2"
          >
            {model.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
