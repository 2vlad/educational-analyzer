'use client'

import { useEffect } from 'react'
import { useAuth } from '@/src/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import UnifiedHeader from '@/components/layout/UnifiedHeader'
import { Toaster } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import ModelSelector from '@/components/ModelSelector'

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [authLoading, user, router])

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-white">
      <UnifiedHeader />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-[1200px] mx-auto">
          <Toaster position="top-right" />

          {/* Header - Лёха AI style */}
          <header className="mb-12">
            <div className="mb-4">
              <h1 className="text-[48px] font-bold text-black mb-2">Настройки</h1>
              <p className="text-[16px] text-black/70">Общие настройки приложения</p>
            </div>
          </header>

          {/* Model Selector */}
          <div className="bg-white border border-gray-200 p-8" style={{ borderRadius: '40px' }}>
            <div className="mb-6">
              <h2 className="text-[24px] font-semibold text-black">Модель AI</h2>
              <p className="text-[14px] text-black/70 mt-1">Выберите модель для анализа контента</p>
            </div>
            <ModelSelector />
          </div>
        </div>
      </div>
    </div>
  )
}
