// Failure and boundary scenarios use isolated fake accounts and API responses.
// No authentication email, password change, booking or administrator action is live.
const assert = require('node:assert/strict')

module.exports = async function extended({ browser, origin, apiOrigin, kakaoFixture, instructor, testNow }) {
  const errors = [], contexts = [], external = []
  async function session(role = 'learner') {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    contexts.push(context)
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    await page.clock.setFixedTime(testNow)
    page.on('pageerror', e => errors.push(e.message))
    page.on('dialog', d => d.accept())
    const state = { role, fail: '', calls: [], profile: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', role: role === 'instructor' ? 'instructor' : 'learner', display_name: '검증 사용자', phone: null, home_area: '서울 강남' }, instructor: { ...instructor, area: '서울 강남' }, hasInstructor: true, slots: [], signupLimit: true, recoveryLimit: true, mapFailure: false }
    const user = { id: state.profile.id, email: `${role}@example.invalid`, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: testNow.toISOString() }
    const exp = Math.floor(Date.parse('2031-01-01T00:00:00Z') / 1000)
    const token = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ sub: user.id, exp })).toString('base64url'), 'fixture'].join('.')
    await context.route('**/*', async route => {
      if (route.request().url().startsWith(origin + '/')) return route.continue()
      external.push(route.request().url()); await route.abort()
    })
    await context.route('https://dapi.kakao.com/v2/maps/sdk.js?*', route => state.mapFailure ? route.abort() : route.fulfill({ contentType: 'application/javascript', body: kakaoFixture }))
    await context.route(apiOrigin + '/**', async route => {
      const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method()
      const name = path.split('/').pop(), payload = method === 'GET' || method === 'DELETE' ? null : req.postDataJSON()
      state.calls.push({ name, method, payload })
      let status = 200, body = null
      if (state.fail === name) { status = 503; body = { message: name === 'instructor_availability' ? 'SLOT_CONFLICT' : 'fixture failure' } }
      else if (name === 'signup') {
        if (state.signupLimit) { status = 429; body = { code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' } }
        else body = { ...user, identities: [{ id: user.id }] }
      } else if (name === 'recover') {
        if (state.recoveryLimit) { status = 429; body = { code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' } }
        else body = {}
      } else if (name === 'token' && url.searchParams.get('grant_type') === 'pkce') { status = 400; body = { code: 'bad_code_verifier', message: 'invalid fixture code' } }
      else if (name === 'token') body = { access_token: token, refresh_token: 'fixture-refresh', expires_in: exp - Math.floor(testNow.getTime()/1000), expires_at: exp, token_type: 'bearer', user }
      else if (name === 'user') body = user
      else if (name === 'logout') body = {}
      else if (name === 'profiles') { if (method === 'PATCH') Object.assign(state.profile, payload); body = state.profile }
      else if (name === 'is_admin') body = state.role === 'admin'
      else if (name === 'instructors') body = url.searchParams.has('id') || url.searchParams.has('user_id') ? (state.hasInstructor ? state.instructor : null) : [state.instructor]
      else if (name === 'instructor_service_regions') body = [{ instructor_id: instructor.id, region_name: '서울 강남' }]
      else if (name === 'instructor_availability') {
        if (method === 'POST') state.slots = [{ ...payload, id: 'fixture-slot' }]
        if (method === 'DELETE') state.slots = []
        body = state.slots
      } else if (name === 'register_instructor') { state.hasInstructor = true; state.profile.role = 'instructor'; body = instructor.id }
      else if (name === 'admin_list_instructors') body = state.role === 'admin' ? [state.instructor] : []
      else if (name === 'admin_review_instructor') { state.instructor.insurance_verified = payload.verified_insurance; state.instructor.active = payload.publish; body = null }
      else if (['bookings', 'lesson_logs', 'admin_list_bookings', 'get_booking_history'].includes(name)) body = []
      else if (name === 'yata_get_my_credential') body = null
      else { errors.push(`Unhandled API ${method} ${path}`); status = 500; body = { message: 'unknown fixture' } }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    })
    return { page, state }
  }
  async function login(page) {
    await page.goto(origin + '/login')
    await page.getByLabel('이메일', { exact: true }).fill('fixture@example.invalid')
    await page.getByLabel('비밀번호', { exact: true }).fill('fixture-password-long')
    await page.getByRole('button', { name: '로그인', exact: true }).click()
  }
  try {
    const { page: guest, state: guestState } = await session()
    for (const path of ['/bookings', '/logbook', '/dashboard/instructor', '/admin/bookings', '/admin/instructors']) {
      await guest.goto(origin + path)
      await guest.waitForURL('**/login*')
    }
    for (const path of ['/support', '/terms', '/privacy', '/instructor', '/signup', '/login', '/reset-password']) {
      const response = await guest.goto(origin + path)
      assert.equal(response.status(), 200, path)
      await guest.locator('h1').first().waitFor()
      assert.equal(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, path)
    }
    await guest.goto(origin + '/book')
    await guest.getByText('예약을 시작할 수 없습니다.', { exact: true }).waitFor()
    guestState.hasInstructor = false
    await guest.goto(origin + '/instructors/00000000-0000-4000-8000-000000000000')
    await guest.getByText('해당 교관을 찾을 수 없습니다.', { exact: true }).waitFor()
    guestState.hasInstructor = true
    console.log('PASS public pages, mobile width, missing instructor/booking parameters and anonymous route guards')

    const next = '/book?instructor=' + instructor.id + '&pickup=' + encodeURIComponent('서울')
    await guest.goto(origin + '/signup?next=' + encodeURIComponent(next))
    assert.equal(await guest.getByRole('button', { name: '소비자로 가입하기' }).isDisabled(), true)
    await guest.getByLabel('이름', { exact: true }).fill('검증 사용자')
    await guest.getByLabel('이메일', { exact: true }).fill('fixture@example.invalid')
    await guest.getByLabel('비밀번호', { exact: true }).fill('fixture-password-long')
    await guest.getByRole('checkbox').check()
    await guest.getByRole('button', { name: '소비자로 가입하기' }).click()
    await guest.getByRole('status').filter({ hasText: '발송 한도' }).waitFor()
    guestState.signupLimit = false
    await guest.getByRole('button', { name: '소비자로 가입하기' }).click()
    await guest.getByRole('status').filter({ hasText: '회원가입이 완료' }).waitFor()
    const signup = guestState.calls.filter(c => c.name === 'signup').at(-1)
    assert.equal(signup.payload.data.post_auth_next, next)
    assert.equal(await guest.locator('main').getByRole('link', { name: '로그인', exact: true }).getAttribute('href'), '/login?next=' + encodeURIComponent(next))
    await guest.goto(origin + '/auth/callback?code=invalid-code')
    await guest.getByRole('heading', { name: '인증 확인이 필요합니다' }).waitFor()
    console.log('PASS signup consent, email limit and retry, reservation continuation, invalid callback')

    await guest.goto(origin + '/reset-password#error=access_denied&error_code=otp_expired')
    await guest.getByText('복구 링크가 만료되었거나 유효하지 않습니다.', { exact: false }).waitFor()
    assert.equal(new URL(guest.url()).hash, '')
    await guest.getByLabel('가입 이메일').fill('fixture@example.invalid')
    await guest.getByRole('button', { name: '복구 메일 보내기', exact: true }).click()
    await guest.getByText('메일 발송 요청이 많아', { exact: false }).waitFor()
    guestState.recoveryLimit = false
    await guest.getByRole('button', { name: '복구 메일 보내기', exact: true }).click()
    await guest.getByText('가입된 이메일이면 복구 메일이 발송됩니다.', { exact: false }).waitFor()
    assert.equal(await guest.getByRole('button', { name: /초 후 재전송 가능/ }).isDisabled(), true)
    console.log('PASS recovery expired link, safe errors, successful request and resend cooldown')

    guestState.fail = 'token'
    await login(guest)
    await guest.getByText('로그인하지 못했습니다.', { exact: false }).waitFor()
    guestState.fail = ''
    await guest.getByRole('button', { name: '로그인', exact: true }).click()
    await guest.waitForURL('**/map')
    await guest.goto(origin + '/profile')
    await guest.getByRole('button', { name: '수정', exact: true }).click()
    await guest.getByLabel('이름', { exact: true }).fill('수정한 사용자')
    guestState.fail = 'profiles'
    await guest.getByRole('button', { name: '저장', exact: true }).click()
    await guest.getByText('입력 내용은 유지됩니다.', { exact: false }).waitFor()
    assert.equal(await guest.getByLabel('이름', { exact: true }).inputValue(), '수정한 사용자')
    guestState.fail = ''
    await guest.getByRole('button', { name: '저장', exact: true }).click()
    await guest.getByText('프로필이 저장되었습니다.', { exact: true }).waitFor()
    await guest.reload()
    await guest.getByRole('heading', { name: '수정한 사용자' }).waitFor()
    await guest.goto(origin + '/admin/instructors')
    await guest.getByRole('alert').getByText('관리자 권한이 필요합니다.').waitFor()
    assert.equal(await guest.getByText('등록된 교관이 없습니다.', { exact: true }).count(), 0)
    await guest.goto(origin + '/auth/callback?next=' + encodeURIComponent('/profile'))
    await guest.waitForURL('**/profile')
    console.log('PASS login retry, persistent profile edit with save failure, non-admin denial and callback return')

    await guest.goto(origin + '/reset-password')
    await guest.getByLabel('새 비밀번호', { exact: true }).fill('new-fixture-password')
    await guest.getByLabel('새 비밀번호 확인').fill('different-password')
    await guest.getByRole('button', { name: '비밀번호 변경', exact: true }).click()
    await guest.getByText('두 비밀번호가 일치하지 않습니다.', { exact: true }).waitFor()
    assert.equal(guestState.calls.filter(c => c.name === 'user' && c.method === 'PUT').length, 0)
    await guest.getByLabel('새 비밀번호 확인').fill('new-fixture-password')
    await guest.getByRole('button', { name: '비밀번호 변경', exact: true }).click()
    await guest.getByRole('link', { name: '로그인으로 이동', exact: true }).waitFor()
    assert.equal(guestState.calls.filter(c => c.name === 'user' && c.method === 'PUT').length, 1)
    console.log('PASS password confirmation validation and isolated password-update/logout contract')

    const { page: teacher, state: teacherState } = await session('instructor')
    teacherState.hasInstructor = false
    await login(teacher)
    await teacher.waitForURL('**/instructor/register')
    await teacher.getByRole('button', { name: '교관 등록하기' }).click()
    await teacher.getByText('교관 이름을 입력해주세요.', { exact: true }).waitFor()
    await teacher.getByLabel('이름', { exact: true }).fill('신규 교관')
    await teacher.getByLabel('활동지역', { exact: true }).fill('서울 강남구')
    await teacher.getByLabel('교육차량', { exact: true }).fill('테스트 차량')
    await teacher.getByRole('checkbox', { name: '2종 보통', exact: true }).check()
    await teacher.getByRole('checkbox', { name: '주차', exact: true }).check()
    teacherState.fail = 'register_instructor'
    await teacher.getByRole('button', { name: '교관 등록하기' }).click()
    await teacher.getByText('교관 등록을 완료하지 못했습니다.', { exact: false }).waitFor()
    teacherState.fail = ''
    await teacher.getByRole('button', { name: '교관 등록하기' }).click()
    await teacher.waitForURL('**/dashboard/instructor')
    await teacher.getByLabel('날짜', { exact: true }).fill('2030-06-14')
    await teacher.getByRole('button', { name: '가능 시간 열기' }).click()
    await teacher.getByText('아직 지나지 않은 날짜와 시간을 선택해주세요.', { exact: true }).waitFor()
    assert.equal(teacherState.calls.filter(c => c.name === 'instructor_availability' && c.method === 'POST').length, 0)
    await teacher.getByLabel('날짜', { exact: true }).fill('2030-06-16')
    teacherState.fail = 'instructor_availability'
    await teacher.getByRole('button', { name: '가능 시간 열기' }).click()
    await teacher.getByText('이미 예약된 수업과 겹치는 시간입니다.', { exact: false }).waitFor()
    teacherState.fail = ''
    await teacher.getByRole('button', { name: '가능 시간 열기' }).click()
    await teacher.getByRole('button', { name: '시간 닫기' }).waitFor()
    await teacher.getByRole('button', { name: '시간 닫기' }).click()
    await teacher.getByText('아직 공개한 시간이 없습니다.', { exact: true }).waitFor()
    await teacher.goto(origin + '/auth/callback')
    await teacher.waitForURL('**/dashboard/instructor')
    console.log('PASS instructor registration validation/retry, past and overlapping slots, slot open/close and instructor callback')

    const { page: admin, state: adminState } = await session('admin')
    await login(admin)
    await admin.waitForURL('**/admin/bookings')
    adminState.fail = 'admin_list_instructors'
    await admin.goto(origin + '/admin/instructors')
    await admin.getByRole('alert').filter({ hasText: '불러오지 못했습니다' }).waitFor()
    assert.equal(await admin.getByText('등록된 교관이 없습니다.', { exact: true }).count(), 0)
    adminState.fail = ''
    await admin.getByRole('button', { name: '목록 새로고침' }).click()
    await admin.getByRole('button', { name: '보험 확인 완료' }).click()
    await admin.getByText('공개 중', { exact: true }).waitFor()
    assert.equal(adminState.calls.filter(c => c.name === 'admin_review_instructor').at(-1).payload.publish, true)
    await admin.getByRole('button', { name: '보류·비공개' }).click()
    await admin.getByText('검토 필요', { exact: true }).waitFor()
    assert.equal(adminState.instructor.active, false)
    await admin.getByRole('button', { name: '보험 확인 완료' }).click()
    await admin.getByText('공개 가능', { exact: true }).waitFor()
    await admin.getByRole('button', { name: '확인 후 공개' }).click()
    await admin.getByText('공개 중', { exact: true }).waitFor()
    await admin.goto(origin + '/auth/callback')
    await admin.waitForURL('**/admin/bookings')
    console.log('PASS admin load failure/recovery, approval states, preserving active status and admin callback')

    guestState.fail = 'instructors'
    await guest.goto(origin)
    await guest.getByRole('alert').filter({ hasText: '불러오지 못했습니다' }).waitFor()
    assert.equal(await guest.getByText('아직 공개된 교관이 없습니다.', { exact: true }).count(), 0)
    guestState.fail = ''
    await guest.goto(origin + '/instructors')
    await guest.getByLabel('교관 검색어').fill('강남구')
    await guest.locator('.instructorCard').waitFor()
    await guest.getByLabel('교관 검색어').fill('부산 강서구')
    await guest.getByText('조건에 맞는 교관이 없습니다.', { exact: true }).waitFor()
    guestState.mapFailure = true
    await guest.goto(origin + '/map')
    await guest.getByText('지도를 불러오지 못했습니다.', { exact: false }).waitFor()
    await guest.locator('.yataMapCard').waitFor()
    assert.equal(await guest.getByRole('button', { name: '지역 검색', exact: true }).isDisabled(), true)
    console.log('PASS homepage API failure, list region matching and map SDK failure fallback')
    assert.deepEqual(errors, [])
    assert.deepEqual(external, [])
  } catch (error) {
    for (let i=0; i<contexts.length; i++) for (const page of contexts[i].pages()) {
      await page.screenshot({ path: `test-results/extended-failure-${i}.png`, fullPage: true }).catch(() => {})
      console.error(`Extended page ${i}: ${page.url()}\n${(await page.locator('body').innerText()).slice(0,4000)}`)
    }
    throw error
  } finally { for (const context of contexts) await context.close() }
}
