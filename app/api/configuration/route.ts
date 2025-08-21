import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { z } from 'zod'

// Schema for creating a new metric configuration
const createMetricSchema = z.object({
  name: z.string().min(1).max(50),
  prompt_text: z.string().min(10).max(5000),
  display_order: z.number().int().positive().optional(),
  is_active: z.boolean().optional().default(true),
})

// Schema for updating a metric configuration
const updateMetricSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50).optional(),
  prompt_text: z.string().min(10).max(5000).optional(),
  display_order: z.number().int().positive().optional(),
  is_active: z.boolean().optional(),
})

/**
 * GET /api/configuration
 * Fetch user's metric configurations
 */
export async function GET(request: NextRequest) {
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

    // Fetch user's configurations
    const { data: configurations, error } = await supabase
      .from('metric_configurations')
      .select('*')
      .eq('user_id', user.id)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Failed to fetch configurations:', error)
      return NextResponse.json({ error: 'Failed to fetch configurations' }, { status: 500 })
    }

    return NextResponse.json({
      configurations: configurations || [],
      count: configurations?.length || 0,
    })
  } catch (error) {
    console.error('Configuration GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/configuration
 * Create a new metric configuration
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

    // Parse and validate request body
    const body = await request.json()
    const validation = createMetricSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 },
      )
    }

    const { name, prompt_text, display_order, is_active } = validation.data

    // Check for duplicate metric name for this user
    const { data: existing } = await supabase
      .from('metric_configurations')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', name)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'A metric with this name already exists' }, { status: 409 })
    }

    // If no display_order provided, get the max and add 1
    let finalDisplayOrder = display_order
    if (!finalDisplayOrder) {
      const { data: maxOrder } = await supabase
        .from('metric_configurations')
        .select('display_order')
        .eq('user_id', user.id)
        .order('display_order', { ascending: false })
        .limit(1)
        .single()

      finalDisplayOrder = (maxOrder?.display_order || 0) + 1
    }

    // Create the new configuration
    const { data: newConfig, error: createError } = await supabase
      .from('metric_configurations')
      .insert({
        user_id: user.id,
        name,
        prompt_text,
        display_order: finalDisplayOrder,
        is_active,
      })
      .select()
      .single()

    if (createError) {
      console.error('Failed to create configuration:', createError)
      return NextResponse.json({ error: 'Failed to create configuration' }, { status: 500 })
    }

    return NextResponse.json(
      {
        message: 'Configuration created successfully',
        configuration: newConfig,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Configuration POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/configuration
 * Update an existing metric configuration
 */
export async function PUT(request: NextRequest) {
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

    // Parse and validate request body
    const body = await request.json()
    const validation = updateMetricSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 },
      )
    }

    const { id, name, prompt_text, display_order, is_active } = validation.data

    // Build update object with only provided fields
    const updates: any = {}
    if (name !== undefined) updates.name = name
    if (prompt_text !== undefined) updates.prompt_text = prompt_text
    if (display_order !== undefined) updates.display_order = display_order
    if (is_active !== undefined) updates.is_active = is_active

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Update the configuration (RLS ensures user owns it)
    const { data: updatedConfig, error: updateError } = await supabase
      .from('metric_configurations')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError || !updatedConfig) {
      if (updateError?.code === 'PGRST116') {
        return NextResponse.json({ error: 'Configuration not found' }, { status: 404 })
      }
      console.error('Failed to update configuration:', updateError)
      return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Configuration updated successfully',
      configuration: updatedConfig,
    })
  } catch (error) {
    console.error('Configuration PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/configuration
 * Delete a metric configuration (soft or hard delete)
 */
export async function DELETE(request: NextRequest) {
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

    // Get configuration ID from query params
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const hardDelete = searchParams.get('hard') === 'true'

    if (!id) {
      return NextResponse.json({ error: 'Configuration ID required' }, { status: 400 })
    }

    if (hardDelete) {
      // Hard delete - permanently remove the configuration
      const { error: deleteError } = await supabase
        .from('metric_configurations')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (deleteError) {
        if (deleteError.code === 'PGRST116') {
          return NextResponse.json({ error: 'Configuration not found' }, { status: 404 })
        }
        console.error('Failed to delete configuration:', deleteError)
        return NextResponse.json({ error: 'Failed to delete configuration' }, { status: 500 })
      }

      return NextResponse.json({
        message: 'Configuration permanently deleted',
      })
    } else {
      // Soft delete - set is_active to false
      const { data: updatedConfig, error: updateError } = await supabase
        .from('metric_configurations')
        .update({ is_active: false })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (updateError || !updatedConfig) {
        if (updateError?.code === 'PGRST116') {
          return NextResponse.json({ error: 'Configuration not found' }, { status: 404 })
        }
        console.error('Failed to deactivate configuration:', updateError)
        return NextResponse.json({ error: 'Failed to deactivate configuration' }, { status: 500 })
      }

      return NextResponse.json({
        message: 'Configuration deactivated',
        configuration: updatedConfig,
      })
    }
  } catch (error) {
    console.error('Configuration DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
