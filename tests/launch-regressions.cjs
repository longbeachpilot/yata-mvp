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
const { isFutureSlot, koreaToday } = load('lib/booking-time.ts')
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
  assert.equal(koreaToday(new Date('2026-09-21T15:00:00Z')), '2026-09-22')
})
test('service regions match every administrative component', () => {
  assert.equal(matchesServiceRegion('서울특별시 강남구 역삼동 1', '서울 강남구'), true)
  assert.equal(matchesServiceRegion('서울특별시 노원구', '서울 강남구'), false)
  assert.equal(matchesServiceRegion('부산광역시 강서구', '서울 강서구'), false)
  assert.equal(matchesServiceRegion('경기도 성남시 분당구', '경기도 성남시'), true)
  assert.equal(matchesServiceRegion('서울특별시 강남구', ''), false)
})
