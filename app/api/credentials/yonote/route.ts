import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { encryptForStorage, validatePassword } from '@/src/services/crypto/secretBox'
import { z } from 'zod'

const saveCredentialSchema = z.object({
  name: z.string().min(1).max(255),
  cookie: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = saveCredentialSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { name, cookie, expiresAt } = validationResult.data

    // Get encryption key from environment
    const appSecretKey = process.env.APP_SECRET_KEY
    if (!appSecretKey) {
      return NextResponse.json(
        { error: 'Server configuration error: APP_SECRET_KEY not set' },
        { status: 500 }
      )
    }

    // Validate encryption key
    if (!validatePassword(appSecretKey)) {
      return NextResponse.json(
        { error: 'Server configuration error: Invalid APP_SECRET_KEY' },
        { status: 500 }
      )
    }

    // Encrypt the cookie
    let encryptedCookie: string
    try {
      encryptedCookie = encryptForStorage(cookie, appSecretKey)
    } catch (error) {
      console.error('Encryption error:', error)
      return NextResponse.json(
        { error: 'Failed to encrypt credentials' },
        { status: 500 }
      )
    }

    // Check if user already has a Yonote credential
    const { data: existingCredential } = await supabase
      .from('external_credentials')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'yonote')
      .eq('name', name)
      .single()

    let credential
    if (existingCredential) {
      // Update existing credential
      const { data, error } = await supabase
        .from('external_credentials')
        .update({
          cookie_encrypted: encryptedCookie,
          cookie_expires_at: expiresAt || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingCredential.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating credential:', error)
        return NextResponse.json(
          { error: 'Failed to update credential' },
          { status: 500 }
        )
      }
      credential = data
    } else {
      // Create new credential
      const { data, error } = await supabase
        .from('external_credentials')
        .insert({
          user_id: user.id,
          provider: 'yonote',
          name,
          cookie_encrypted: encryptedCookie,
          cookie_expires_at: expiresAt || null,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating credential:', error)
        return NextResponse.json(
          { error: 'Failed to save credential' },
          { status: 500 }
        )
      }
      credential = data
    }

    // Return credential info without the encrypted cookie
    return NextResponse.json({
      credential: {
        id: credential.id,
        name: credential.name,
        provider: credential.provider,
        expiresAt: credential.cookie_expires_at,
        createdAt: credential.created_at,
        updatedAt: credential.updated_at,
      },
      message: existingCredential ? 'Credential updated successfully' : 'Credential saved successfully'
    })
  } catch (error) {
    console.error('Error in POST /api/credentials/yonote:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}