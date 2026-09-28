const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function load(path) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports: module.exports, module, URL, Intl, Date })
  return module.exports
}
const { safeNext } = load('lib/navigation.ts')
const { isFutureSlot, koreaToday, hasLessonEnded } = load('lib/booking-time.ts')
const { matchesServiceRegion } = load('lib/regions.ts')
test('booking return paths survive login without opening another origin', () => {
  assert.equal(safeNext('/book?instructor=abc&pickup=%EC%84%9C%EC%9A%B8'), '/book?instructor=abc&pickup=%EC%84%9C%EC%9A%B8')
  for (const value of [null, {}, 123, '//evil.test', '/\\evil.test', '/\n/evil.test', 'https://evil.test', 'javascript:alert(1)']) assert.equal(safeNext(value), null)
})
test('Korean midnight and elapsed lesson times are respected', () => {
  const now = Date.parse('2026-09-22T01:00:00Z') // 10:00 Seoul
  assert.equal(isFutureSlot({ lesson_date: '2026-09-22', start_time: '09:00' }, now), false)
  assert.equal(isFutureSlot({ lesson_date: '2026-09-22', start_time: '10:00' }, now), false)
  assert.equal(isFutureSlot({ lesson_date: '2026-09-22', start_time: '10:01' }, now), true)
  assert.equal(isFutureSlot({ lesson_date: '2026-09-23', start_time: '00:00:00' }, now), true)
  assert.equal(isFutureSlot({ lesson_date: '2026-09-23', start_time: '24:30' }, now), false)
  assert.equal(isFutureSlot({ lesson_date: '2030-02-30', start_time: '10:00' }, now), false)
  assert.equal(koreaToday(new Date('2026-09-21T15:00:00Z')), '2026-09-22')
})
test('service regions match every administrative component', () => {
  assert.equal(matchesServiceRegion('서울특별시 강남구 역삼동 1', '서울 강남구'), true)
  assert.equal(matchesServiceRegion('서울특별시 노원구', '서울 강남구'), false)
  assert.equal(matchesServiceRegion('부산광역시 강서구', '서울 강서구'), false)
  assert.equal(matchesServiceRegion('경기도 성남시 분당구', '경기도 성남시'), true)
  assert.equal(matchesServiceRegion('서울특별시 강남구', ''), false)
})
test('short region names match full administrative names returned by map search', () => {
  for (const [address, region] of [
    ['서울 강남구', '서울 강남'],
    ['서울특별시 강남구 테헤란로 1', '서울 강남'],
    ['서울특별시 강남구 역삼동 1', '서울 강남 역삼'],
    ['서울 강남', '서울특별시 강남구'],
    ['경기 성남시 분당구 백현동', '경기도 성남 분당'],
    ['경기도 성남시 분당구', '성남시 분당'],
    ['부산광역시 해운대구', '부산 해운대'],
    ['강원특별자치도 춘천시', '강원도 춘천'],
    ['전북특별자치도 전주시 완산구', '전라북도 전주'],
    ['충청북도 청주시', '충북 청주'],
    ['제주특별자치도 제주시', '제주도 제주시'],
    ['경기 광주시', '광주시'],
  ]) assert.equal(matchesServiceRegion(address, region), true, `${address} / ${region}`)
})
test('short names do not broaden coverage to other districts or partial words', () => {
  for (const [address, region] of [
    ['서울 노원구', '서울 강남'],
    ['서울 서초구 강남대로 1', '서울 강남'],
    ['부산 강서구', '서울 강서'],
    ['경기 광주시', '광주광역시'],
    ['서울 강남구', '서울 강'],
    ['서울 강남구', '서울 남구'],
    ['서울 강남구', '서울 강남동'],
    ['경기 성남시 수정구', '경기 성남 분당'],
    ['경기 성남시 분당구', '경기 성남 분당동'],
    ['서울 강남구', '   '],
    ['', '서울 강남'],
  ]) assert.equal(matchesServiceRegion(address, region), false, `${address} / ${region}`)
})
test('completion waits for the full lesson duration in Seoul time', () => {
  const lesson = { lesson_date: '2026-09-27', start_time: '10:00', duration_minutes: 120 }
  const end = Date.parse('2026-09-27T03:00:00Z') // 12:00 Seoul
  assert.equal(hasLessonEnded(lesson, end - 3 * 60 * 60_000), false) // before start
  assert.equal(hasLessonEnded(lesson, end - 60 * 60_000), false) // in progress
  assert.equal(hasLessonEnded(lesson, end - 1), false)
  assert.equal(hasLessonEnded(lesson, end), true)
  assert.equal(hasLessonEnded({ ...lesson, start_time: '10:00:00' }, end + 1), true)
  assert.equal(hasLessonEnded({ ...lesson, lesson_date: '2026-09-28', start_time: '00:00' }, Date.parse('2026-09-27T17:00:00Z')), true)
  for (const invalid of [
    { duration_minutes: 0 }, { duration_minutes: -120 }, { duration_minutes: null },
    { duration_minutes: 1.5 }, { start_time: '24:00' }, { start_time: '' },
    { lesson_date: '2026-02-30' }, { lesson_date: '' },
  ]) assert.equal(hasLessonEnded({ ...lesson, ...invalid }, end), false)
})
