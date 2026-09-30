// Browser contract suite with isolated learner, instructor and operator sessions.
// Every external request is mocked or blocked. Real database rules are separately
// covered by tests/database-booking-*.sql inside rolled-back transactions.
const { chromium } = require(process.env.YATA_PLAYWRIGHT_PATH || 'playwright')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const assert = require('node:assert/strict')
const origin = 'http://127.0.0.1:3012'
const apiOrigin = process.env.YATA_TEST_SUPABASE_URL || 'https://example.supabase.co'
const teacherId = '11111111-1111-4111-8111-111111111111'
const ids = { learner: '22222222-2222-4222-8222-222222222222', instructor: '44444444-4444-4444-8444-444444444444', admin: '55555555-5555-4555-8555-555555555555' }
const testNow = new Date('2030-06-15T01:00:00Z') // 10:00 Seoul
const tomorrow = '2030-06-16'
const instructor = { id: teacherId, user_id: ids.instructor, name: '테스트 교관', area: '서울 강남구', specialties: ['주차'], licenses: ['2종 보통'], vehicle: '테스트 차량', base_price_2h: 90000, insurance_verified: true, dual_brake: true, active: true, intro: '', vehicle_year: null, transmission: null, rating: 0, reviews: 0, lessons: 0 }
const slots = [
  { id: 'past', lesson_date: '2030-06-15', start_time: '09:00', instructor_id: teacherId },
  { id: 'boundary', lesson_date: '2030-06-15', start_time: '10:00', instructor_id: teacherId },
  { id: 'future-1', lesson_date: tomorrow, start_time: '10:00', instructor_id: teacherId },
  { id: 'future-2', lesson_date: tomorrow, start_time: '12:00', instructor_id: teacherId },
]
let browser, server, booking = null, log = null, history = [], contact = {}, eventId = 0
let serviceRegions = [{ instructor_id: teacherId, region_name: '서울 강남' }]
let failMap = false, failBookings = false, staleContact = false, savePayload, bookingPayload, slotPayload, failSlotSave = false
const pageErrors = [], externalRequests = [], pages = []
// Realistic Kakao responses, deliberately different from the saved short name.
// No live map API calls or keys are used by this browser contract suite.
const kakaoFixture = `
window.kakao = { maps: {
  load: callback => callback(),
  LatLng: class { constructor(lat, lng) { this.lat = lat; this.lng = lng } },
  Map: class { relayout() {} setCenter() {} setLevel() {} },
  Marker: class { setMap() {} },
  services: {
    Status: { OK: 'OK' },
    Geocoder: class { coord2RegionCode(lng, lat, callback) {
      callback([{ region_type: 'B', region_1depth_name: lng > 127.1 ? '경기도' : '서울특별시', region_2depth_name: lng > 127.1 ? '성남시 분당구' : '강남구', region_3depth_name: lng > 127.1 ? '백현동' : '역삼동' }], 'OK');
    } addressSearch(query, callback) {
      const addresses = {
        '강남': '서울 강남구',
        '강남구': '서울 강남구',
        '경기 성남시 분당구': '경기 성남시 분당구',
        '서울특별시 강남구 역삼동': '서울 강남구 역삼동',
        '서울 노원구': '서울 노원구'
      };
      const address = addresses[query];
      callback(address ? [{ address_name: address, x: '127.0276', y: '37.4979' }] : [], address ? 'OK' : 'ZERO_RESULT');
    } },
    Places: class { keywordSearch(query, callback) {
      const addresses = { '강남역': '서울 강남구 강남대로 396', '판교역': '경기 성남시 분당구 판교역로 160' };
      const address = addresses[query];
      callback(address ? [{ road_address_name: address, ...(query === '판교역' ? {address_name: '경기 성남시 분당구 백현동 1'} : {}), x: query === '판교역' ? '127.1139' : '127.0276', y: '37.4979' }] : [], address ? 'OK' : 'ZERO_RESULT');
    } }
  }
} };
`
function record(status) {
  eventId++
  history.unshift({ id: eventId, status, event_type: eventId === 1 ? 'created' : 'status_changed', previous_status: booking?.status || null, recipient_role: null, occurred_at: testNow.toISOString() })
  if (booking) booking.status = status
  contact = {}
}
async function newSession(role) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  pages.push(page)
  page.setDefaultTimeout(10000)
  await page.clock.setFixedTime(testNow)
  page.on('pageerror', e => pageErrors.push(`${role}: ${e.message}`))
  page.on('dialog', dialog => dialog.accept())
  const user = { id: ids[role], email: `${role}@example.invalid`, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: testNow.toISOString() }
  const exp = Math.floor(Date.parse('2031-01-01T00:00:00Z') / 1000)
  const token = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ sub: user.id, exp })).toString('base64url'), 'test'].join('.')
  await context.route('**/*', async route => {
    if (route.request().url().startsWith(origin + '/')) return route.continue()
    externalRequests.push(route.request().url())
    await route.abort()
  })
  await context.route('https://dapi.kakao.com/v2/maps/sdk.js?*', route =>
    route.fulfill({ contentType: 'application/javascript', body: kakaoFixture }))
  await context.route(apiOrigin + '/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname
    let body = null, status = 200
    const rpc = path.split('/rpc/')[1]
    if (path.endsWith('/auth/v1/token')) body = { access_token: token, refresh_token: `fixture-${role}`, token_type: 'bearer', expires_in: exp - Math.floor(testNow.getTime()/1000), expires_at: exp, user }
    else if (path.endsWith('/auth/v1/user')) body = user
    else if (rpc === 'is_admin') body = role === 'admin'
    else if (rpc === 'yata_get_my_credential') body = 'PRIVATE-TEST-CREDENTIAL'
    else if (rpc === 'yata_save_my_instructor') { savePayload = req.postDataJSON(); Object.assign(instructor, savePayload.profile_data); serviceRegions = instructor.area.split(', ').map(region_name => ({ instructor_id: teacherId, region_name })); body = null }
    else if (rpc === 'create_booking_request') {
      bookingPayload = req.postDataJSON()
      const p = bookingPayload
      booking = { id: '33333333-3333-4333-8333-333333333333', learner_id: ids.learner, instructor_id: teacherId, lesson_type: p.p_lesson_type, lesson_date: p.p_lesson_date, start_time: p.p_start_time, duration_minutes: p.p_duration_minutes, pickup_text: p.p_pickup_text, amount: 90000, status: 'requested', created_at: testNow.toISOString(), instructor, reviews: [], lesson_logs: [] }
      record('requested'); body = booking.id
    } else if (rpc === 'instructor_transition_booking') {
      const p = req.postDataJSON()
      record(p.next_status)
    } else if (rpc === 'cancel_my_booking') record('cancelled')
    else if (rpc === 'get_booking_history') body = history
    else if (rpc === 'create_lesson_log') {
      const p = req.postDataJSON()
      log = { id: 'log-fixture', booking_id: booking.id, learner_id: ids.learner, instructor_id: teacherId, minutes: p.lesson_minutes, instructor_note: p.note_text, next_goal: p.next_goal_text, skills: p.skills, instructor, booking, created_at: testNow.toISOString() }
      booking.lesson_logs = [{ id: log.id }]; body = log.id
    } else if (rpc === 'submit_booking_review') {
      assert.equal(booking.status, 'completed')
      assert.equal(booking.reviews.length, 0)
      assert.ok(req.postDataJSON().review_comment.length >= 10)
      booking.reviews = [{ id: 'review-fixture' }]; body = 'review-fixture'
    } else if (rpc === 'admin_list_bookings') {
      if (role !== 'admin') { status = 403; body = { message: 'ADMIN_REQUIRED' } }
      else body = booking ? [{ ...booking, learner_name: '테스트 학습자', learner_email: 'learner@example.invalid', instructor_name: instructor.name, instructor_email: 'instructor@example.invalid', status_event_id: eventId, status_changed_at: testNow.toISOString(), learner_contacted_at: contact.learner || null, instructor_contacted_at: contact.instructor || null }] : []
    } else if (rpc === 'admin_record_booking_contact') {
      const p = req.postDataJSON()
      assert.equal(role, 'admin')
      if (staleContact) { staleContact = false; status = 409; body = { message: 'BOOKING_CHANGED' } }
      else { assert.equal(p.expected_status_event_id, eventId); contact[p.recipient] = testNow.toISOString() }
    } else if (path.endsWith('/profiles')) body = { role: role === 'instructor' ? 'instructor' : 'learner' }
    else if (path.endsWith('/instructors')) {
      if (failMap) { status = 503; body = { message: 'fixture unavailable' } }
      else body = url.searchParams.has('id') || url.searchParams.has('user_id') ? instructor : [instructor]
    } else if (path.endsWith('/instructor_availability')) {
      if (req.method() === 'POST') {
        slotPayload = req.postDataJSON()
        assert.ok(Array.isArray(slotPayload))
        if (failSlotSave) { failSlotSave = false; status = 409; body = { message: 'SLOT_CONFLICT' } }
        else { for (const slot of slotPayload) { assert.equal(slot.instructor_id, teacherId); assert.equal(slot.is_available, true); const existing = slots.find(s => s.lesson_date === slot.lesson_date && s.start_time === slot.start_time); if (existing) Object.assign(existing, slot); else slots.push({ ...slot, id: `bulk-${slots.length}` }) } body = null }
      } else body = slots
    }
    else if (path.endsWith('/bookings')) {
      if (failBookings) { status = 503; body = { message: 'fixture unavailable' } }
      else body = url.searchParams.has('id') ? booking : booking ? [booking] : []
    } else if (path.endsWith('/lesson_logs')) body = url.searchParams.has('booking_id') ? log : log ? [log] : []
    else if (path.endsWith('/instructor_service_regions')) body = serviceRegions
    else { pageErrors.push(`Unexpected mocked request: ${path}`); status = 500; body = { message: 'Unexpected fixture request' } }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  return page
}
async function login(page, role, next) {
  await page.goto(origin + `/login${next ? '?next=' + encodeURIComponent(next) : ''}`)
  await fillLogin(page, role)
}
async function fillLogin(page, role) {
  await page.getByLabel('이메일', { exact: true }).fill(`${role}@example.invalid`)
  await page.getByLabel('비밀번호', { exact: true }).fill('fixture-password-long')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
}
async function screenshot(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0))
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name} should fit mobile width`)
  await page.screenshot({ path: `test-results/${name}.png`, fullPage: true })
}
;(async () => {
  fs.mkdirSync('test-results', { recursive: true })
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '3012'], { stdio: ['ignore', 'pipe', 'pipe'] })
  server.stderr.on('data', chunk => process.stderr.write(chunk))
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('server startup timeout')), 15000)
    server.stdout.on('data', chunk => { if (chunk.toString().includes('Ready')) { clearTimeout(timeout); resolve() } })
    server.on('exit', code => reject(new Error(`server exited ${code}`)))
  })
  browser = await chromium.launch({ executablePath: process.env.YATA_CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  const learner = await newSession('learner')
  await learner.goto(origin + '/login?next=%2F%5Cevil.test')
  assert.equal(await learner.getByRole('link', { name: '회원가입', exact: true }).getAttribute('href'), '/signup')
  await learner.getByRole('link', { name: '비밀번호를 잊으셨나요?' }).waitFor()
  console.log('PASS safe login return path and recovery link')
  await learner.goto(origin + '/map')
  await learner.locator('.yataMapCard').filter({ hasText: '테스트 교관' }).waitFor()
  assert.equal(await learner.locator('.yataMapCard').count(), 1)
  console.log('PASS instructor discovery list and next available schedule')
  for (const query of ['강남', '강남구', '서울특별시 강남구 역삼동', '강남역']) {
    await learner.getByLabel('연수 지역 검색').fill(query)
    await learner.getByRole('button', { name: '지역 검색', exact: true }).click()
    await learner.locator('.yataMapSelected').getByText(/서울 강남구/).waitFor()
    await learner.locator('.yataMapCard').filter({ hasText: '테스트 교관' }).waitFor()
    assert.equal(await learner.locator('.yataMapCard').count(), 1, query)
  }
  await screenshot(learner, '00-region-search-mobile')
  for (const query of ['서울 노원구', '판교역']) {
    await learner.getByLabel('연수 지역 검색').fill(query)
    await learner.getByRole('button', { name: '지역 검색', exact: true }).click()
    await learner.getByText('조건에 맞는 등록 교관이 없습니다.', { exact: false }).waitFor()
    assert.equal(await learner.locator('.yataMapCard').count(), 0, query)
  }
  // The homepage search must automatically resolve the region on /map too.
  await learner.goto(origin)
  await learner.getByLabel('연수 지역', { exact: true }).fill('강남역')
  await learner.getByRole('button', { name: '교관 찾기', exact: true }).click()
  await learner.waitForURL('**/map?q=*')
  await learner.locator('.yataMapSelected').getByText('서울 강남구 강남대로 396', { exact: true }).waitFor()
  const regionLink = learner.locator('.yataMapCard').filter({ hasText: '테스트 교관' })
  assert.equal(new URL(await regionLink.getAttribute('href'), origin).searchParams.get('pickup'), '서울 강남구 강남대로 396')
  await learner.getByLabel('연수 목적').selectOption('야간운전')
  await learner.getByText('조건에 맞는 등록 교관이 없습니다.', { exact: false }).waitFor()
  await learner.getByLabel('연수 목적').selectOption('주차')
  await regionLink.waitFor()
  console.log('PASS short-name region search, keyword fallback, homepage auto-search, correct exclusions and purpose filter')
  await learner.getByLabel('연수 지역 검색').fill('존재하지않는테스트지역')
  await learner.getByRole('button', { name: '지역 검색', exact: true }).click()
  await learner.getByText('검색 결과가 없습니다.', { exact: false }).waitFor()
  assert.equal(await learner.locator('.yataMapCard').count(), 0)
  await learner.getByLabel('연수 지역 검색').fill('')
  await learner.getByRole('button', { name: '지역 검색', exact: true }).click()
  await learner.locator('.yataMapCard').waitFor()
  assert.equal(await learner.locator('.yataMapSelected').count(), 0)
  console.log('PASS failed region search clears old results and empty query restores all regions')
  await learner.locator('.yataMapCard').filter({ hasText: '테스트 교관' }).click()
  await learner.getByRole('link', { name: '이 교관에게 예약 요청' }).click()
  await learner.getByRole('button', { name: '예약 요청하기' }).waitFor()
  assert.deepEqual(await learner.getByLabel('가능 시간').locator('option').allTextContents(), ['10:00', '12:00'])
  assert.equal(await learner.getByLabel('가능 날짜').inputValue(), tomorrow)
  await learner.getByLabel('가능 시간').selectOption('12:00')
  await learner.locator('.reservationRecap').getByText('2030-06-16 · 12:00 · 2시간', { exact: true }).waitFor()
  assert.equal(await learner.locator('.reservationSteps [aria-current=step]').innerText(), '2 일정 확인·요청')
  await learner.getByPlaceholder('예: 서울 강남구 역삼동').fill('서울 강남구 역삼동')
  await learner.getByRole('button', { name: '예약 요청하기' }).click()
  await learner.waitForURL('**/login?next=*')
  assert.match(new URL(learner.url()).searchParams.get('next'), /time=12%3A00/)
  await fillLogin(learner, 'learner')
  await learner.waitForURL('**/book?*')
  await learner.getByRole('button', { name: '예약 요청하기' }).waitFor()
  assert.equal(await learner.getByLabel('가능 시간').inputValue(), '12:00')
  await learner.getByRole('button', { name: '예약 요청하기' }).click()
  await learner.waitForURL('**/bookings?created=1')
  await learner.locator('.bookingRow .status').getByText('예약 요청', { exact: true }).waitFor()
  assert.equal(bookingPayload.p_duration_minutes, 120)
  assert.equal(bookingPayload.p_pickup_text, '서울 강남구 역삼동')
  await learner.getByRole('button', { name: '변경 이력 보기' }).click()
  await learner.locator('.bookingHistoryContent strong').getByText('예약 요청', { exact: true }).waitFor()
  await screenshot(learner, '01-requested-mobile')
  console.log('PASS booking → login → retained date/time → request → status history')
  const teacher = await newSession('instructor')
  await login(teacher, 'instructor')
  await teacher.getByRole('heading', { name: '테스트 교관 교관 대시보드' }).waitFor()
  assert.equal(await teacher.locator('.dashStats > div').filter({ hasText: '공개 가능시간' }).locator('b').innerText(), '2')
  assert.equal(await teacher.locator('.availabilitySlot').count(), 2)
  assert.equal(await teacher.getByRole('navigation', { name: '모바일 메뉴' }).getByRole('link', { name: '교관센터' }).getAttribute('aria-current'), 'page')
  await teacher.getByRole('navigation', { name: '교관센터 바로가기' }).getByRole('link', { name: '예약 관리', exact: false }).click()
  assert.equal(new URL(teacher.url()).hash, '#instructor-bookings')
  // Multiple dates × times, duplicate/conflict exclusions, and failed batch recovery.
  await teacher.getByRole('button', { name: '10:00 시작', exact: true }).click()
  await teacher.getByRole('button', { name: '12:00 시작', exact: true }).click()
  await teacher.getByRole('button', { name: '2030-06-17', exact: true }).click()
  await teacher.getByText('예약과 겹침', { exact: true }).waitFor()
  await teacher.getByText('이미 공개 중', { exact: true }).waitFor()
  await teacher.getByRole('button', { name: '2개 가능 시간 한 번에 열기', exact: true }).click()
  await teacher.getByRole('status').getByText('2개의 가능 시간을 열었습니다.', { exact: true }).waitFor()
  assert.equal(slotPayload.length, 2)
  assert.deepEqual(slotPayload.map(s => s.lesson_date), ['2030-06-17', '2030-06-17'])
  await teacher.reload()
  await teacher.getByRole('heading', { name: '테스트 교관 교관 대시보드' }).waitFor()
  assert.equal(await teacher.locator('.availabilitySlot').count(), 4)
  await teacher.getByRole('button', { name: '오후 시간 선택', exact: true }).click()
  await teacher.getByRole('button', { name: '2030-06-17', exact: true }).click()
  await screenshot(teacher, '08-bulk-availability-mobile')
  failSlotSave = true
  await teacher.getByRole('button', { name: '4개 가능 시간 한 번에 열기', exact: true }).click()
  await teacher.getByText('새 예약과 겹치는 시간이 있어 등록하지 못했습니다.', { exact: false }).waitFor()
  assert.equal(await teacher.locator('.availabilitySlot').count(), 4)
  assert.equal(await teacher.getByRole('button', { name: '14:00 시작', exact: true }).getAttribute('aria-pressed'), 'true')
  await teacher.getByRole('button', { name: '4개 가능 시간 한 번에 열기', exact: true }).click()
  await teacher.getByRole('status').getByText('4개의 가능 시간을 열었습니다.', { exact: true }).waitFor()
  assert.equal(await teacher.locator('.availabilitySlot').count(), 8)
  console.log('PASS bulk availability date/time selection, conflict/duplicate exclusion, atomic failure retry and reload')
  await teacher.getByRole('button', { name: '확정', exact: true }).click()
  await teacher.getByRole('button', { name: '수업 종료 후 완료 가능' }).waitFor()
  assert.equal(await teacher.getByRole('button', { name: '수업 종료 후 완료 가능' }).isDisabled(), true)
  await teacher.getByRole('button', { name: '확정 예약 취소' }).waitFor()
  await learner.getByRole('button', { name: '예약 상태 새로고침' }).click()
  await learner.locator('.bookingRow .status').getByText('예약 확정', { exact: true }).waitFor()
  await screenshot(teacher, '02-confirmed-instructor-mobile')
  console.log('PASS independent instructor confirmation → learner refresh; early completion disabled')
  // The visible learner tab checks status after a focus event without reloading the page.
  failBookings = true
  await learner.getByRole('button', { name: '예약 상태 새로고침' }).click()
  await learner.getByText('최신 예약 상태를 확인하지 못했습니다.', { exact: false }).waitFor()
  assert.equal(await learner.locator('.bookingRow').count(), 1)
  assert.equal(await learner.getByText('아직 수업이 없습니다.').count(), 0)
  failBookings = false
  await learner.evaluate(() => window.dispatchEvent(new Event('focus')))
  await learner.getByText('최신 예약 상태를 확인하지 못했습니다.', { exact: false }).waitFor({ state: 'hidden' })
  console.log('PASS refresh failure preserves booking and focus refresh recovers')
  await teacher.clock.setFixedTime(new Date('2030-06-16T05:00:01Z')) // after 14:00 Seoul
  await teacher.getByRole('button', { name: '수업 완료', exact: true }).click()
  await teacher.waitForURL('**/dashboard/instructor/logbook/*')
  await teacher.getByLabel('교관 코멘트', { exact: true }).fill('주차와 차선 변경을 차근차근 연습했습니다.')
  await teacher.getByLabel('다음 수업 목표', { exact: true }).fill('다음에는 평행주차 연습')
  await teacher.getByRole('button', { name: 'Logbook 저장', exact: true }).click()
  await teacher.getByText('Logbook이 저장되었습니다.', { exact: true }).waitFor()
  await teacher.waitForURL('**/dashboard/instructor')
  await teacher.getByRole('link', { name: 'Logbook 확인', exact: true }).click()
  await teacher.getByRole('heading', { name: '저장된 수업 기록' }).waitFor()
  assert.equal(await teacher.getByRole('button', { name: 'Logbook 저장', exact: true }).count(), 0)
  await learner.getByRole('button', { name: '예약 상태 새로고침' }).click()
  await learner.locator('.bookingRow .status').getByText('수업 완료', { exact: true }).waitFor()
  await learner.getByRole('link', { name: 'Logbook 보기' }).click()
  await learner.getByText('다음에는 평행주차 연습', { exact: true }).waitFor()
  assert.equal(log.skills.length, 6)
  await screenshot(learner, '03-learner-logbook-mobile')
  await learner.goto(origin + '/bookings')
  await learner.getByRole('button', { name: '후기 작성', exact: true }).click()
  await learner.getByLabel('후기', { exact: true }).fill('친절한 설명 덕분에 주차에 자신감이 생겼습니다.')
  await learner.getByRole('button', { name: '후기 등록' }).click()
  await learner.getByText('후기 작성 완료', { exact: true }).waitFor()
  await learner.reload()
  await learner.getByText('후기 작성 완료', { exact: true }).waitFor()
  assert.equal(await learner.getByRole('button', { name: '후기 작성', exact: true }).count(), 0)
  await screenshot(learner, '04-completed-review-mobile')
  console.log('PASS lesson completion → logbook and six skills → learner record → review saved after reload')
  const admin = await newSession('admin')
  await login(admin, 'admin', '/admin/bookings')
  await admin.getByRole('heading', { name: '예약 운영 관리' }).waitFor()
  await admin.getByText('learner@example.invalid', { exact: true }).waitFor()
  const mailto = await admin.getByRole('link', { name: '메일 초안 열기' }).first().getAttribute('href')
  assert.ok(mailto.startsWith('mailto:learner%40example.invalid?'))
  assert.ok(decodeURIComponent(mailto).includes(booking.id))
  staleContact = true
  await admin.getByRole('button', { name: '안내한 뒤 기록하기' }).first().click()
  await admin.getByRole('alert').getByText('안내 도중 예약 상태가 변경되었습니다.', { exact: false }).waitFor()
  await admin.getByRole('button', { name: '안내한 뒤 기록하기' }).first().click()
  await admin.getByRole('button', { name: '안내 기록됨' }).waitFor()
  await admin.getByRole('button', { name: '안내한 뒤 기록하기' }).click()
  await admin.getByText('양쪽 안내 기록이 모두 남지 않은 예약 0건', { exact: false }).waitFor()
  assert.equal(await admin.getByRole('button', { name: '안내 기록됨' }).count(), 2)
  await screenshot(admin, '05-admin-operations-mobile')
  await admin.setViewportSize({ width: 1440, height: 1000 })
  await screenshot(admin, '06-admin-operations-desktop')
  await learner.goto(origin + '/admin/bookings')
  await learner.getByRole('alert').getByText('관리자 권한이 필요합니다.').waitFor()
  assert.equal(await learner.getByText('learner@example.invalid', { exact: true }).count(), 0)
  console.log('PASS admin mail drafts, stale-state handling, manual contact records and non-admin denial')
  await teacher.goto(origin + '/dashboard/instructor/profile')
  await teacher.getByRole('button', { name: '변경사항 저장' }).waitFor()
  assert.equal(await teacher.getByPlaceholder('자격증 또는 관련 등록번호').inputValue(), 'PRIVATE-TEST-CREDENTIAL')
  assert.equal(await teacher.getByLabel('운전연수 관련 보험 확인 (운영자 검토 후 반영)').isDisabled(), true)
  await teacher.getByRole('button', { name: '변경사항 저장' }).click()
  await teacher.getByText('교관 프로필이 저장되었습니다.', { exact: false }).waitFor()
  assert.equal(savePayload.private_license_number, 'PRIVATE-TEST-CREDENTIAL')
  assert.equal('insurance_verified' in savePayload.profile_data, false)
  console.log('PASS private credential editing preserves operator-only insurance verification')
  await teacher.getByLabel('활동지역 검색어').fill('판교역')
  await teacher.getByRole('button', { name: '지역 찾기', exact: true }).click()
  await teacher.getByRole('list', { name: '활동지역 검색 결과' }).getByRole('button').click()
  await teacher.getByLabel('시·도', { exact: true }).waitFor()
  assert.equal(await teacher.getByLabel('시·도', { exact: true }).inputValue(), '경기도')
  assert.equal(await teacher.getByLabel('시·군·구', { exact: true }).inputValue(), '성남시 분당구')
  await teacher.getByLabel('방문 가능 범위').selectOption('town')
  await teacher.getByRole('button', { name: '활동지역 추가', exact: true }).click()
  await teacher.getByRole('button', { name: '활동지역 추가', exact: true }).click()
  await teacher.getByText('이미 선택한 활동지역입니다.', { exact: true }).waitFor()
  assert.equal(await teacher.getByRole('button', { name: '경기도 성남시 분당구 백현동 삭제', exact: true }).count(), 1)
  await teacher.getByRole('button', { name: '서울 강남 삭제', exact: true }).click()
  await teacher.getByRole('button', { name: '경기도 성남시 분당구 백현동 삭제', exact: true }).click()
  await teacher.getByRole('button', { name: '변경사항 저장', exact: true }).click()
  await teacher.getByText('활동지역을 한 곳 이상 선택해주세요.', { exact: true }).waitFor()
  await teacher.getByRole('button', { name: '활동지역 추가', exact: true }).click()
  await teacher.getByRole('button', { name: '변경사항 저장', exact: true }).click()
  await teacher.getByText('교관 프로필이 저장되었습니다.', { exact: false }).waitFor()
  assert.equal(savePayload.profile_data.area, '경기도 성남시 분당구 백현동')
  await teacher.reload()
  await teacher.getByRole('button', { name: '경기도 성남시 분당구 백현동 삭제', exact: true }).waitFor()
  await screenshot(teacher, '07-instructor-region-picker-mobile')
  await learner.goto(origin + '/map?q=' + encodeURIComponent('판교역'))
  await learner.locator('.yataMapSelected').waitFor()
  await learner.locator('.yataMapCard').filter({ hasText: '테스트 교관' }).waitFor()
  console.log('PASS map-linked region fields, neighbourhood scope, duplicate/empty validation, save/reload and learner discovery')
  await learner.getByLabel('연수 지역 검색').fill('경기 성남시 분당구')
  await learner.getByRole('button', { name: '지역 검색', exact: true }).click()
  await learner.locator('.yataMapCard').filter({ hasText: '테스트 교관' }).waitFor()
  await require('./extended.cjs')({ browser, origin, apiOrigin, kakaoFixture, instructor, testNow })
  failMap = true
  await learner.goto(origin + '/map')
  await learner.getByRole('alert').filter({ hasText: '교관 정보를 불러오지 못했습니다' }).waitFor()
  assert.equal(await learner.getByText('조건에 맞는 등록 교관이 없습니다.', { exact: false }).count(), 0)
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(externalRequests, [])
  console.log('PASS failed search recovery message; no uncaught errors or live external requests')
})().catch(async error => {
  console.error(error)
  for (let i = 0; i < pages.length; i++) {
    try { await pages[i].screenshot({ path: `test-results/failure-${i}.png`, fullPage: true }); console.error(`Page ${i}: ${pages[i].url()}\n${(await pages[i].locator('main').innerText()).slice(0,5000)}`) } catch {}
  }
  process.exitCode = 1
}).finally(async () => { if (browser) await browser.close(); if (server) server.kill() })
