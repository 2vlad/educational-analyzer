import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'

/**
 * POST /api/configuration/reset
 * Reset user's configurations to default metrics
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Start a transaction by deleting existing user configs and copying defaults

    // 1. Delete all existing user configurations
    const { error: deleteError } = await supabase
      .from('metric_configurations')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Failed to delete existing configurations:', deleteError)
      return NextResponse.json({ error: 'Failed to reset configurations' }, { status: 500 })
    }

    // 2. Fetch default configurations (where user_id is NULL)
    const { data: defaultConfigs, error: fetchError } = await supabase
      .from('metric_configurations')
      .select('*')
      .is('user_id', null)
      .order('display_order', { ascending: true })

    if (fetchError || !defaultConfigs || defaultConfigs.length === 0) {
      console.error('Failed to fetch default configurations:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch default configurations' }, { status: 500 })
    }

    // 3. Copy default configurations to user
    const userConfigs = defaultConfigs.map((config) => ({
      user_id: user.id,
      name: config.name,
      prompt_text: config.prompt_text,
      display_order: config.display_order,
      is_active: config.is_active,
    }))

    const { data: newConfigs, error: insertError } = await supabase
      .from('metric_configurations')
      .insert(userConfigs)
      .select()

    if (insertError) {
      console.error('Failed to create default configurations:', insertError)
      return NextResponse.json(
        { error: 'Failed to create default configurations' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      message: 'Configurations reset to defaults successfully',
      configurations: newConfigs,
      count: newConfigs?.length || 0,
    })
  } catch (error) {
    console.error('Configuration reset error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
