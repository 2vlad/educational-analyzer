'use client'

import { useAuth } from '@/src/providers/AuthProvider'
import { useMetricMode } from '@/src/providers/MetricModeProvider'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Settings, History, LogOut, User, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

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
    <header className="bg-background border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="text-xl font-bold text-foreground">
            Лёха AI
          </Link>

          {/* Centered Toggle */}
          <div className="hidden md:flex items-center absolute left-1/2 transform -translate-x-1/2">
            {/* Metric Mode Toggle */}
            <div className="flex items-center bg-secondary rounded-full p-1">
              <button
                onClick={() => handleModeChange('lx')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                  metricMode === 'lx'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                LX
              </button>
              <button
                onClick={() => handleModeChange('custom')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                  metricMode === 'custom'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Мой сет
              </button>
            </div>
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="relative">
            {!user ? (
              <Link href="/login">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-6">
                  Войти
                </Button>
              </Link>
            ) : (
              <>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary transition-colors"
                >
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <span className="hidden md:block text-sm font-medium text-foreground">
                    {user?.email}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>

                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-background rounded-lg shadow-lg border border-border z-20">
                      <div className="p-3 border-b border-border">
                        <p className="text-sm font-medium text-foreground">{user?.email}</p>
                      </div>

                      {/* Toggle for Mobile */}
                      <div className="p-3 border-b border-border md:hidden">
                        <div className="flex items-center bg-secondary rounded-full p-1">
                          <button
                            onClick={() => handleModeChange('lx')}
                            className={`flex-1 px-2 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                              metricMode === 'lx'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground'
                            }`}
                          >
                            LX
                          </button>
                          <button
                            onClick={() => handleModeChange('custom')}
                            className={`flex-1 px-2 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                              metricMode === 'custom'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground'
                            }`}
                          >
                            Мой сет
                          </button>
                        </div>
                      </div>

                      {/* Desktop Menu Items - History and Programs */}
                      <div className="border-b border-border">
                        <Link
                          href="/programs"
                          onClick={() => setShowUserMenu(false)}
                          className={`flex items-center gap-3 px-4 py-2 text-sm ${
                            pathname.startsWith('/programs')
                              ? 'bg-secondary text-foreground font-medium'
                              : 'text-foreground hover:bg-secondary/50'
                          }`}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                            />
                          </svg>
                          Программы
                        </Link>
                        <Link
                          href="/history"
                          onClick={() => setShowUserMenu(false)}
                          className={`flex items-center gap-3 px-4 py-2 text-sm ${
                            pathname === '/history'
                              ? 'bg-secondary text-foreground font-medium'
                              : 'text-foreground hover:bg-secondary/50'
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
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
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
      </div>
    </header>
  )
}
