import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Test endpoint accessible',
    timestamp: new Date().toISOString(),
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  })
}

export async function POST() {
  return NextResponse.json({
    status: 'ok',
    message: 'POST endpoint accessible',
    timestamp: new Date().toISOString(),
  })
}
