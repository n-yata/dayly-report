import { NextResponse } from 'next/server'
import { generateOpenAPIDocument } from '@/lib/openapi/registry'

export function GET() {
  const document = generateOpenAPIDocument()
  return NextResponse.json(document)
}
