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

export default function ModelSelector() {
  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  useEffect(() => {
    fetchModels()
    // Load saved model preference
    const savedModel = localStorage.getItem('selectedModel')
    if (savedModel) {
      setSelectedModel(savedModel)
    }
  }, [])

  const fetchModels = async () => {
    try {
      const response = await fetch('/api/models')
      if (!response.ok) throw new Error('Failed to fetch models')
      const data = await response.json()
      setModels(data.models || [])
      
      // Set default model if none selected
      if (!selectedModel && data.models?.length > 0) {
        const defaultModel = data.models[0].id
        setSelectedModel(defaultModel)
        localStorage.setItem('selectedModel', defaultModel)
      }
    } catch (error) {
      console.error('Error fetching models:', error)
      // Set default models if API fails
      setModels([
        { id: 'claude-haiku', name: 'Claude Haiku' },
        { id: 'claude-sonnet-4', name: 'Claude Sonnet' },
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gemini-pro', name: 'Gemini Pro' },
        { id: 'yandex-gpt-pro', name: 'YandexGPT' },
      ])
    }
  }

  const handleModelChange = (value: string) => {
    setSelectedModel(value)
    localStorage.setItem('selectedModel', value)
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
      <SelectTrigger className="relative w-full !h-14 !px-6 !pr-14 text-[20px] font-light text-black bg-[#F2F2F2] hover:bg-gray-100 transition-colors rounded-[50px] border-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0">
        <SelectValue placeholder="Выберите модель" />
        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
          <ChevronRight
            className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
              isDropdownOpen ? 'rotate-90' : ''
            }`}
          />
        </div>
      </SelectTrigger>
      <SelectContent className="bg-white text-black rounded-2xl border-gray-200">
        {models.map((model) => (
          <SelectItem
            key={model.id}
            value={model.id}
            className="text-[20px] text-black py-2"
          >
            {model.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}