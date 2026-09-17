import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY
  if (!key) {
    return NextResponse.json({ ok: false, stage: 'env', message: 'NEXT_PUBLIC_KAKAO_JS_KEY is missing at runtime.' }, { status: 500 })
  }

  const origin = request.headers.get('origin') || request.nextUrl.origin
  const sdkUrl = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false&libraries=services`

  try {
    const response = await fetch(sdkUrl, {
      cache: 'no-store',
      headers: {
        Referer: `${origin}/`,
        Origin: origin,
        'User-Agent': 'YA-TA-Kakao-Diagnostic/1.0',
      },
    })
    const body = await response.text()
    const lower = body.toLowerCase()
    let reason = 'unknown'
    if (lower.includes('domain mismatched') || lower.includes('web_site_url') || lower.includes('caller=')) reason = 'domain'
    else if (lower.includes('wrong appkey') || lower.includes('invalid app') || lower.includes('appkey')) reason = 'key'
    else if (response.ok && body.length > 1000) reason = 'sdk-response-ok'

    return NextResponse.json({
      ok: response.ok && reason === 'sdk-response-ok',
      stage: 'sdk-request',
      httpStatus: response.status,
      reason,
      origin,
      responseBytes: body.length,
      // Never return the SDK body: it may contain request details and is not needed by the UI.
    }, { status: response.ok ? 200 : 502 })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      stage: 'network',
      origin,
      message: error instanceof Error ? error.message : 'Kakao SDK request failed.',
    }, { status: 502 })
  }
}
