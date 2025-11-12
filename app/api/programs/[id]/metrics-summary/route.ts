import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

interface MetricScore {
  score: number
  comment: string
}

interface AggregatedMetric {
  name: string
  avgScore: number
  roundedScore: number // -1, 0, 1, 2
  topComment: string | null
  lessonsAnalyzed: number
}

/**
 * GET /api/programs/[id]/metrics-summary
 *
 * Returns aggregated metrics for all analyzed lessons in a program
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: programId } = await params
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify program ownership
    const { data: program, error: programError } = await supabase
      .from('programs')
      .select('id, user_id')
      .eq('id', programId)
      .eq('user_id', user.id)
      .single()

    if (programError || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    // Get all lessons for this program
    const { data: lessons, error: lessonsError } = await supabase
      .from('program_lessons')
      .select('id')
      .eq('program_id', programId)

    if (lessonsError) {
      console.error('Error fetching lessons:', lessonsError)
      return NextResponse.json({ error: 'Failed to fetch lessons' }, { status: 500 })
    }

    if (!lessons || lessons.length === 0) {
      // No lessons yet
      return NextResponse.json({
        programId,
        metrics: [],
        lessonsTotal: 0,
        lessonsAnalyzed: 0,
      })
    }

    const lessonIds = lessons.map((l) => l.id)

    // Get all completed analyses for these lessons
    const { data: analyses, error: analysesError } = await supabase
      .from('analyses')
      .select('id, lesson_id, results, status')
      .in('lesson_id', lessonIds)
      .eq('status', 'completed')
      .not('results', 'is', null)

    if (analysesError) {
      console.error('Error fetching analyses:', analysesError)
      return NextResponse.json({ error: 'Failed to fetch analyses' }, { status: 500 })
    }

    if (!analyses || analyses.length === 0) {
      // No analyses yet
      return NextResponse.json({
        programId,
        metrics: [],
        lessonsTotal: lessons.length,
        lessonsAnalyzed: 0,
      })
    }

    // Aggregate metrics
    const metricsMap = new Map<string, MetricScore[]>()

    analyses.forEach((analysis) => {
      if (!analysis.results) return

      Object.entries(analysis.results).forEach(([metricName, metricData]) => {
        // Skip non-metric fields
        if (
          metricName === 'lessonTitle' ||
          metricName === 'hotFixes' ||
          metricName === 'quickWin'
        ) {
          return
        }

        // Type guard for metric data
        if (
          typeof metricData === 'object' &&
          metricData !== null &&
          'score' in metricData &&
          'comment' in metricData
        ) {
          const { score, comment } = metricData as { score: number; comment: string }

          if (!metricsMap.has(metricName)) {
            metricsMap.set(metricName, [])
          }

          metricsMap.get(metricName)!.push({ score, comment })
        }
      })
    })

    // Calculate aggregated metrics
    const aggregatedMetrics: AggregatedMetric[] = []

    metricsMap.forEach((scores, metricName) => {
      // Calculate average score
      const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length

      // Round to nearest integer (-1, 0, 1, 2)
      const roundedScore = Math.round(avgScore)

      // Find most common comment (or pick one with median score)
      const sortedByScore = [...scores].sort((a, b) => b.score - a.score)
      const topComment = sortedByScore[0]?.comment || null

      aggregatedMetrics.push({
        name: metricName,
        avgScore: Math.round(avgScore * 100) / 100, // Round to 2 decimals
        roundedScore,
        topComment,
        lessonsAnalyzed: scores.length,
      })
    })

    // Sort metrics by name for consistent order
    aggregatedMetrics.sort((a, b) => a.name.localeCompare(b.name, 'ru'))

    return NextResponse.json({
      programId,
      metrics: aggregatedMetrics,
      lessonsTotal: lessons.length,
      lessonsAnalyzed: analyses.length,
    })
  } catch (error) {
    console.error('Error in GET /api/programs/[id]/metrics-summary:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
