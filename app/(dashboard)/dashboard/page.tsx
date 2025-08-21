'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function DashboardPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to main page - the app maintains a unified interface
    router.push('/')
  }, [router])

  return null
}