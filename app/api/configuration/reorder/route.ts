import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { z } from 'zod'

// Schema for reordering metrics
const reorderSchema = z.object({
  configurations: z
    .array(
      z.object({
        id: z.string().uuid(),
        display_order: z.number().int().positive(),
      }),
    )
    .min(1),
})

/**
 * PATCH /api/configuration/reorder
 * Bulk update display_order for drag-and-drop reordering
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

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
    const validation = reorderSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 },
      )
    }

    const { configurations } = validation.data

    // Verify all configurations belong to the user
    const configIds = configurations.map((c) => c.id)
    const { data: userConfigs, error: fetchError } = await supabase
      .from('metric_configurations')
      .select('id')
      .eq('user_id', user.id)
      .in('id', configIds)

    if (fetchError) {
      console.error('Failed to verify configurations:', fetchError)
      return NextResponse.json({ error: 'Failed to verify configurations' }, { status: 500 })
    }

    if (!userConfigs || userConfigs.length !== configurations.length) {
      return NextResponse.json(
        { error: 'Some configurations not found or unauthorized' },
        { status: 403 },
      )
    }

    // Perform bulk update using Promise.all for efficiency
    const updatePromises = configurations.map(({ id, display_order }) =>
      supabase
        .from('metric_configurations')
        .update({ display_order })
        .eq('id', id)
        .eq('user_id', user.id),
    )

    const results = await Promise.all(updatePromises)

    // Check if any updates failed
    const failedUpdates = results.filter((result) => result.error)
    if (failedUpdates.length > 0) {
      console.error('Some updates failed:', failedUpdates)
      return NextResponse.json(
        {
          error: 'Some configurations failed to update',
          failed: failedUpdates.length,
        },
        { status: 500 },
      )
    }

    // Fetch and return the updated configurations
    const { data: updatedConfigs, error: finalFetchError } = await supabase
      .from('metric_configurations')
      .select('*')
      .eq('user_id', user.id)
      .in('id', configIds)
      .order('display_order', { ascending: true })

    if (finalFetchError) {
      console.error('Failed to fetch updated configurations:', finalFetchError)
      // Still return success since updates were made
      return NextResponse.json({
        message: 'Configurations reordered successfully',
        warning: 'Could not fetch updated configurations',
      })
    }

    return NextResponse.json({
      message: 'Configurations reordered successfully',
      configurations: updatedConfigs,
    })
  } catch (error) {
    console.error('Configuration reorder error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
