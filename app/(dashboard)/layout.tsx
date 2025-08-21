'use client'

import { useAuth } from '@/src/providers/AuthProvider'
import { useMetricMode } from '@/src/providers/MetricModeProvider'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Settings, History, LogOut, User, ChevronDown } from 'lucide-react'
import { useState } from 'react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth()
  const { metricMode, setMetricMode } = useMetricMode()
  const pathname = usePathname()
  const router = useRouter()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleModeChange = (mode: 'lx' | 'custom') => {
    setMetricMode(mode)
    // Always redirect to main page when switching modes
    router.push('/')
  }

  const handleSettingsClick = () => {
    router.push('/settings')
  }

  // Determine which button is active
  const isSettingsActive = pathname === '/settings'


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="text-xl font-bold text-black">
              Лёха AI
            </Link>

            {/* Centered Toggle with Settings */}
            <div className="hidden md:flex items-center absolute left-1/2 transform -translate-x-1/2">
              {/* Metric Mode Toggle with Settings */}
              <div className="flex items-center bg-gray-100 rounded-full p-1">
                <button
                  onClick={() => handleModeChange('lx')}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    metricMode === 'lx' && !isSettingsActive
                      ? 'bg-white text-black shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  LX
                </button>
                <button
                  onClick={() => handleModeChange('custom')}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    metricMode === 'custom' && !isSettingsActive
                      ? 'bg-white text-black shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Мой сет
                </button>
                <button
                  onClick={handleSettingsClick}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    isSettingsActive
                      ? 'bg-white text-black shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Настройки
                </button>
              </div>
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="hidden md:block text-sm font-medium text-gray-700">
                  {user?.email}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                    <div className="p-3 border-b border-gray-200">
                      <p className="text-sm font-medium text-gray-900">{user?.email}</p>
                      <p className="text-xs text-gray-500 mt-1">Бесплатный план</p>
                    </div>

                    {/* Metric Mode Toggle for Mobile */}
                    <div className="p-3 border-b border-gray-200 md:hidden">
                      <div className="flex items-center bg-gray-100 rounded-full p-1">
                        <button
                          onClick={() => handleModeChange('lx')}
                          className={`flex-1 px-2 py-1.5 rounded-full text-xs font-medium transition-all ${
                            metricMode === 'lx' && !isSettingsActive
                              ? 'bg-white text-black shadow-sm'
                              : 'text-gray-600'
                          }`}
                        >
                          LX
                        </button>
                        <button
                          onClick={() => handleModeChange('custom')}
                          className={`flex-1 px-2 py-1.5 rounded-full text-xs font-medium transition-all ${
                            metricMode === 'custom' && !isSettingsActive
                              ? 'bg-white text-black shadow-sm'
                              : 'text-gray-600'
                          }`}
                        >
                          Мой сет
                        </button>
                        <button
                          onClick={handleSettingsClick}
                          className={`flex-1 px-2 py-1.5 rounded-full text-xs font-medium transition-all ${
                            isSettingsActive
                              ? 'bg-white text-black shadow-sm'
                              : 'text-gray-600'
                          }`}
                        >
                          Настройки
                        </button>
                      </div>
                    </div>

                    {/* Desktop Menu Items - Only History now */}
                    <div className="border-b border-gray-200">
                      <Link
                        href="/history"
                        onClick={() => setShowUserMenu(false)}
                        className={`flex items-center gap-3 px-4 py-2 text-sm ${
                          pathname === '/history'
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <History className="w-4 h-4" />
                        История анализов
                      </Link>
                    </div>

                    <button
                      onClick={() => {
                        setShowUserMenu(false)
                        signOut()
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="w-4 h-4" />
                      Выйти
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>
    </div>
  )
}
