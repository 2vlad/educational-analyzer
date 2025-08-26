'use client'

import { useAuth } from '@/src/providers/AuthProvider'
import { useMetricMode } from '@/src/providers/MetricModeProvider'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Settings, History, LogOut, User, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

export default function UnifiedHeader() {
  const { user, signOut } = useAuth()
  const { metricMode, setMetricMode } = useMetricMode()
  const pathname = usePathname()
  const router = useRouter()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleModeChange = (mode: 'lx' | 'custom') => {
    setMetricMode(mode)
    // Redirect to appropriate page based on mode
    if (mode === 'custom') {
      router.push('/custom')
    } else {
      router.push('/')
    }
  }

  return (
    <header className="bg-white">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="text-xl font-bold text-black">
            Лёха AI
          </Link>

          {/* Centered Toggle */}
          <div className="hidden md:flex items-center absolute left-1/2 transform -translate-x-1/2">
            {/* Metric Mode Toggle */}
            <div className="flex items-center bg-gray-100 rounded-full p-1">
              <button
                onClick={() => handleModeChange('lx')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                  metricMode === 'lx'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                LX
              </button>
              <button
                onClick={() => handleModeChange('custom')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                  metricMode === 'custom'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Мой сет
              </button>
            </div>
          </div>

          {/* User Menu */}
          <div className="relative">
            {!user ? (
              <Link href="/login">
                <Button className="bg-black text-white hover:bg-gray-800 rounded-full px-6">
                  Войти
                </Button>
              </Link>
            ) : (
              <>
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
                      </div>

                      {/* Toggle for Mobile */}
                      <div className="p-3 border-b border-gray-200 md:hidden">
                        <div className="flex items-center bg-gray-100 rounded-full p-1">
                          <button
                            onClick={() => handleModeChange('lx')}
                            className={`flex-1 px-2 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                              metricMode === 'lx'
                                ? 'bg-white text-black shadow-sm'
                                : 'text-gray-600'
                            }`}
                          >
                            LX
                          </button>
                          <button
                            onClick={() => handleModeChange('custom')}
                            className={`flex-1 px-2 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                              metricMode === 'custom'
                                ? 'bg-white text-black shadow-sm'
                                : 'text-gray-600'
                            }`}
                          >
                            Мой сет
                          </button>
                        </div>
                      </div>

                      {/* Desktop Menu Items - History and Programs */}
                      <div className="border-b border-gray-200">
                        <Link
                          href="/programs"
                          onClick={() => setShowUserMenu(false)}
                          className={`flex items-center gap-3 px-4 py-2 text-sm ${
                            pathname.startsWith('/programs')
                              ? 'bg-gray-100 text-black font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                          Программы
                        </Link>
                        <Link
                          href="/history"
                          onClick={() => setShowUserMenu(false)}
                          className={`flex items-center gap-3 px-4 py-2 text-sm ${
                            pathname === '/history'
                              ? 'bg-gray-100 text-black font-medium'
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
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}