'use client'

import { useAuth } from '@/src/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Settings, History, FileText, TrendingUp, Loader2, ArrowRight } from 'lucide-react'

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState({
    totalAnalyses: 0,
    activeMetrics: 0,
    lastAnalysis: null as Date | null,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [authLoading, user, router])

  useEffect(() => {
    if (user) {
      fetchStats()
    }
  }, [user])

  const fetchStats = async () => {
    try {
      // Fetch user metrics
      const metricsResponse = await fetch('/api/configuration')
      const metricsData = await metricsResponse.json()

      setStats({
        totalAnalyses: 0, // Will be implemented with history endpoint
        activeMetrics: metricsData.configurations?.filter((m: any) => m.is_active).length || 0,
        lastAnalysis: null, // Will be implemented with history endpoint
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Welcome back!</h1>
        <p className="text-gray-600 mt-2">
          Analyze educational content and track your evaluation metrics
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <FileText className="w-8 h-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">{stats.totalAnalyses}</span>
          </div>
          <h3 className="text-sm font-medium text-gray-600">Total Analyses</h3>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8 text-green-600" />
            <span className="text-2xl font-bold text-gray-900">{stats.activeMetrics}</span>
          </div>
          <h3 className="text-sm font-medium text-gray-600">Active Metrics</h3>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <History className="w-8 h-8 text-purple-600" />
            <span className="text-sm font-medium text-gray-900">
              {stats.lastAnalysis
                ? new Date(stats.lastAnalysis).toLocaleDateString()
                : 'No analyses yet'}
            </span>
          </div>
          <h3 className="text-sm font-medium text-gray-600">Last Analysis</h3>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/"
          className="group bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">New Analysis</h2>
              <p className="text-gray-600">
                Analyze educational content using your customized metrics
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
          </div>
        </Link>

        <Link
          href="/settings"
          className="group bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Configure Metrics</h2>
              <p className="text-gray-600">
                Customize your evaluation criteria and analysis prompts
              </p>
            </div>
            <Settings className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
          </div>
        </Link>

        <Link
          href="/history"
          className="group bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">View History</h2>
              <p className="text-gray-600">
                Review your past analyses and track progress over time
              </p>
            </div>
            <History className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
          </div>
        </Link>

        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Pro Tips</h2>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Drag and drop to reorder your metrics</li>
                <li>• Deactivate metrics temporarily without deleting</li>
                <li>• Each analysis saves the metrics used for reference</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
