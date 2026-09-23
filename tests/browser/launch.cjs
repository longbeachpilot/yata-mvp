// Optional browser contract suite: install playwright separately, or supply its module path.
// APIs are mocked. This never creates accounts, sends email or writes live bookings.
const { chromium } = require(process.env.YATA_PLAYWRIGHT_PATH || 'playwright')
const { spawn } = require('node:child_process')
const assert = require('node:assert/strict')
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '3012'], { stdio: ['ignore', 'pipe', 'pipe'] })
server.stderr.on('data', chunk => process.stderr.write(chunk))
const origin = 'http://127.0.0.1:3012'
const teacherId = '11111111-1111-4111-8111-111111111111'
const userId = '22222222-2222-4222-8222-222222222222'
const testNow = new Date('2030-06-15T01:00:00Z') // 10:00 in Korea
const today = '2030-06-15'
const tomorrow = '2030-06-16'
const instructor = { id: teacherId, name: '테스트 교관', area: '서울 강남구', specialties: ['주차'], licenses: ['2종 보통'], vehicle: '테스트 차량', base_price_2h: 90000, insurance_verified: true, dual_brake: true, active: true, intro: '', vehicle_year: null, transmission: null, rating: 0, reviews: 0, lessons: 0 }
const user = { id: userId, email: 'test@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
const token = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(testNow.getTime()/1000)+3600 })).toString('base64url'), 'test'].join('.')
let browser
;(async () => {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('server startup timeout')), 15000)
    server.stdout.on('data', chunk => { if (chunk.toString().includes('Ready')) { clearTimeout(timeout); resolve() } })
    server.on('exit', code => reject(new Error(`server exited ${code}`)))
  })
  browser = await chromium.launch({ executablePath: process.env.YATA_CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.clock.setFixedTime(testNow)
  const pageErrors = []
  page.on('pageerror', e => pageErrors.push(e.message))
  let role = 'learner', failMap = false, savePayload = null, bookingPayload = null
  await context.route('https://not-configured.supabase.co/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname
    let body = null, status = 200
    if (path.endsWith('/auth/v1/token')) body = { access_token: token, refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(testNow.getTime()/1000)+3600, user }
    else if (path.endsWith('/auth/v1/user')) body = user
    else if (path.endsWith('/rpc/is_admin')) body = false
    else if (path.endsWith('/rpc/yata_get_my_credential')) body = 'PRIVATE-TEST-CREDENTIAL'
    else if (path.endsWith('/rpc/yata_save_my_instructor')) { savePayload = route.request().postDataJSON(); body = null }
    else if (path.endsWith('/rpc/create_booking_request')) { bookingPayload = route.request().postDataJSON(); body = '33333333-3333-4333-8333-333333333333' }
    else if (path.endsWith('/profiles')) body = { role }
    else if (path.endsWith('/instructors')) {
      if (failMap) { status = 503; body = { message: 'fixture unavailable' } }
      else body = url.searchParams.has('id') || url.searchParams.has('user_id') ? instructor : [instructor]
    } else if (path.endsWith('/instructor_availability')) body = [
      { id: 'past', lesson_date: today, start_time: '09:00', instructor_id: teacherId },
      { id: 'boundary', lesson_date: today, start_time: '10:00', instructor_id: teacherId },
      { id: 'future-1', lesson_date: tomorrow, start_time: '10:00', instructor_id: teacherId },
      { id: 'future-2', lesson_date: tomorrow, start_time: '12:00', instructor_id: teacherId },
    ]
    else if (path.endsWith('/bookings')) body = []
    else if (path.endsWith('/instructor_service_regions')) body = [{ instructor_id: teacherId, region_name: '서울 강남구' }]
    else throw new Error(`Unexpected mocked request: ${path}`)
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(origin + '/login?next=%2F%5Cevil.test')
  assert.equal(await page.getByRole('link', { name: '회원가입', exact: true }).getAttribute('href'), '/signup')
  await page.getByRole('link', { name: '비밀번호를 잊으셨나요?' }).waitFor()
  console.log('PASS safe login return path and recovery link')
  await page.goto(origin + `/book?instructor=${teacherId}&pickup=${encodeURIComponent('서울 강남구 역삼동')}`)
  await page.getByRole('button', { name: '예약 요청하기' }).waitFor()
  assert.deepEqual(await page.getByLabel('가능 시간').locator('option').allTextContents(), ['10:00', '12:00'])
  assert.equal(await page.getByLabel('가능 날짜').inputValue(), tomorrow)
  await page.getByLabel('가능 시간').selectOption('12:00')
  await page.getByRole('button', { name: '예약 요청하기' }).click()
  await page.waitForURL('**/login?next=*')
  assert.match(new URL(page.url()).searchParams.get('next'), /time=12%3A00/)
  await page.getByLabel('이메일', { exact: true }).fill('test@example.invalid')
  await page.getByLabel('비밀번호', { exact: true }).fill('test-password-long')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await page.waitForURL('**/book?*')
  await page.getByRole('button', { name: '예약 요청하기' }).waitFor()
  assert.equal(await page.getByLabel('가능 시간').inputValue(), '12:00')
  assert.equal(await page.locator('.bottomNav').getByRole('link', { name: '예약', exact: true }).getAttribute('href'), '/bookings')
  await page.getByRole('button', { name: '예약 요청하기' }).click()
  await page.waitForURL('**/bookings?created=1')
  assert.equal(bookingPayload.p_duration_minutes, 120)
  assert.equal(bookingPayload.p_pickup_text, '서울 강남구 역삼동')
  console.log('PASS mobile booking → login → restored booking → request; exact RPC payload')
  role = 'instructor'
  await page.goto(origin + '/dashboard/instructor/profile')
  await page.getByRole('button', { name: '변경사항 저장' }).waitFor()
  assert.equal(await page.getByPlaceholder('자격증 또는 관련 등록번호').inputValue(), 'PRIVATE-TEST-CREDENTIAL')
  assert.equal(await page.getByLabel('운전연수 관련 보험 확인 (운영자 검토 후 반영)').isDisabled(), true)
  await page.getByRole('button', { name: '변경사항 저장' }).click()
  await page.getByText('교관 프로필이 저장되었습니다.', { exact: false }).waitFor()
  assert.equal(savePayload.target_instructor_id, teacherId)
  assert.equal(savePayload.private_license_number, 'PRIVATE-TEST-CREDENTIAL')
  assert.equal('insurance_verified' in savePayload.profile_data, false)
  console.log('PASS private credential load/save and read-only insurance status')
  await page.goto(origin + '/dashboard/instructor')
  await page.getByRole('heading', { name: '테스트 교관 교관 대시보드' }).waitFor()
  const publicSlots = page.locator('.dashStats > div').filter({ hasText: '공개 가능시간' })
  assert.equal(await publicSlots.locator('b').innerText(), '2')
  assert.equal(await page.locator('.availabilitySlot').count(), 2)
  assert.deepEqual(await page.locator('.availabilitySlot strong').allTextContents(), [tomorrow, tomorrow])
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  if (process.env.YATA_DASHBOARD_SCREENSHOT) await page.screenshot({ path: process.env.YATA_DASHBOARD_SCREENSHOT, fullPage: true })
  console.log('PASS instructor dashboard excludes elapsed and exact-start slots from count and schedule')
  failMap = true
  await page.goto(origin + '/map')
  await page.getByRole('alert').filter({ hasText: '교관 정보를 불러오지 못했습니다' }).waitFor()
  assert.equal(await page.getByText('조건에 맞는 등록 교관이 없습니다.', { exact: false }).count(), 0)
  console.log('PASS API failure is not presented as an empty instructor search')
  await page.goto(origin + '/login')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  const screenshot = process.env.YATA_SCREENSHOT
  if (screenshot) await page.screenshot({ path: screenshot, fullPage: true })
  assert.deepEqual(pageErrors, [])
  console.log('PASS mobile width and no uncaught browser errors')
})().catch(e => { console.error(e); process.exitCode = 1 }).finally(async () => { if (browser) await browser.close(); server.kill() })
