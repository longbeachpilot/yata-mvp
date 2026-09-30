'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'
import { matchesServiceRegion } from '@/lib/regions'

type Result = { label: string; address: string; lat: number; lng: number }
type Region = { region_type: string; region_1depth_name: string; region_2depth_name: string; region_3depth_name: string }
const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY

export function ServiceRegionPicker({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const node = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const marker = useRef<any>(null)
  const generation = useRef(0)
  const [ready, setReady] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [region, setRegion] = useState<Region | null>(null)
  const [scope, setScope] = useState('district')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const selected = value.split(/[,·/;\n]+/).map(v => v.trim()).filter(Boolean)

  useEffect(() => {
    if (ready || !key) return
    const timer = setTimeout(() => setMessage('지도 연결이 지연되고 있습니다. 새로고침 후 다시 시도해주세요. 기존 활동지역은 유지됩니다.'), 15000)
    return () => clearTimeout(timer)
  }, [ready])
  useEffect(() => () => { generation.current++; marker.current?.setMap(null) }, [])

  function initialize() {
    window.kakao?.maps?.load(() => {
      if (!node.current || map.current) return
      try {
        map.current = new window.kakao.maps.Map(node.current, { center: new window.kakao.maps.LatLng(37.4979, 127.0276), level: 7 })
        setReady(true); setMessage('')
      } catch { setMessage('지도를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.') }
    })
  }

  async function search() {
    if (!ready || busy || disabled) return
    const term = query.trim()
    if (!term) { setMessage('지역명이나 역 이름을 입력해주세요.'); return }
    const request = ++generation.current
    setBusy(true); setRegion(null); setResults([]); setMessage('지역을 검색하고 있습니다.')
    marker.current?.setMap(null)
    const timer = setTimeout(() => {
      if (request === generation.current) { generation.current++; setBusy(false); setMessage('검색 응답이 늦어지고 있습니다. 다시 검색해주세요.') }
    }, 10000)
    const finish = (items: any[], status: string) => {
      clearTimeout(timer)
      if (request !== generation.current) return
      setBusy(false)
      const found = status === window.kakao.maps.services.Status.OK ? items.map(item => ({ label: item.place_name || item.address_name, address: item.address_name || item.road_address_name, lat: Number(item.y), lng: Number(item.x) })).filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng)) : []
      setResults(found)
      setMessage(found.length ? '검색 결과에서 활동할 위치를 선택해주세요.' : '검색 결과가 없습니다. 동 이름이나 도로명 주소로 다시 검색해주세요.')
    }
    try {
      new window.kakao.maps.services.Geocoder().addressSearch(term, (items: any[], status: string) => {
        if (request !== generation.current) return
        if (status === window.kakao.maps.services.Status.OK && items.length) finish(items, status)
        else new window.kakao.maps.services.Places().keywordSearch(term, finish)
      })
    } catch { clearTimeout(timer); setBusy(false); setMessage('지역 검색에 실패했습니다. 다시 시도해주세요.') }
  }

  function choose(result: Result) {
    if (busy || disabled) return
    const request = ++generation.current
    setBusy(true); setRegion(null); setMessage('활동지역 항목을 확인하고 있습니다.')
    const position = new window.kakao.maps.LatLng(result.lat, result.lng)
    marker.current?.setMap(null)
    marker.current = new window.kakao.maps.Marker({ position })
    marker.current.setMap(map.current); map.current.setCenter(position); map.current.setLevel(5)
    const timer = setTimeout(() => {
      if (request === generation.current) { generation.current++; setBusy(false); setMessage('지역 정보를 확인하지 못했습니다. 다시 선택해주세요.') }
    }, 10000)
    new window.kakao.maps.services.Geocoder().coord2RegionCode(result.lng, result.lat, (items: Region[], status: string) => {
      clearTimeout(timer)
      if (request !== generation.current) return
      setBusy(false)
      // Legal neighbourhood names match the address names used in learner search.
      const found = status === window.kakao.maps.services.Status.OK ? items.find(item => item.region_type === 'B' && item.region_1depth_name) : null
      if (!found) { setMessage('활동지역을 확인하지 못했습니다. 다른 검색 결과를 선택해주세요.'); return }
      setRegion(found); setScope(found.region_2depth_name ? 'district' : 'town')
      setMessage('지도 위치를 확인하고 실제 방문 가능한 범위를 선택해주세요.')
    })
  }

  const candidate = region ? [region.region_1depth_name, region.region_2depth_name, scope === 'town' ? region.region_3depth_name : ''].filter(Boolean).join(' ') : ''
  function add() {
    if (!candidate || busy || disabled) return
    if (selected.some(item => matchesServiceRegion(candidate, item) && matchesServiceRegion(item, candidate))) { setMessage('이미 선택한 활동지역입니다.'); return }
    onChange([...selected, candidate].join(', ')); setMessage(`${candidate}을 선택했습니다. 변경사항 저장을 눌러 반영해주세요.`)
  }

  return <section aria-label="활동지역 선택" className="serviceRegionPicker">
    {key && <Script id="kakao-maps-sdk" src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=services`} strategy="afterInteractive" onReady={initialize} onError={() => setMessage('지도를 불러오지 못했습니다. 기존 활동지역은 유지됩니다. 새로고침 후 다시 시도해주세요.')} />}
    <h4>활동지역</h4>
    <p>지역이나 역을 검색한 뒤, 시·군·구 전체 또는 특정 읍·면·동을 선택하세요. 여러 지역을 추가할 수 있습니다.</p>
    <div className="regionSearchRow">
      <input aria-label="활동지역 검색어" placeholder="예: 강남역, 판교역, 역삼동" value={query} disabled={disabled} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void search() } }} />
      <button type="button" disabled={!ready || busy || disabled} onClick={() => void search()}>지역 찾기</button>
    </div>
    {!key && <p role="alert">지도 연결을 준비 중입니다. 기존 활동지역은 유지됩니다.</p>}
    <p role="status">{message || (ready ? '검색 결과를 선택하면 지도가 이동합니다.' : '지도를 불러오는 중...')}</p>
    {results.length > 0 && <ul className="regionSearchResults" aria-label="활동지역 검색 결과">{results.map((result, index) => <li key={`${result.address}-${index}`}><button type="button" disabled={busy || disabled} onClick={() => choose(result)}><strong>{result.label}</strong><small>{result.address}</small></button></li>)}</ul>}
    <div ref={node} className="regionPreviewMap" aria-label="활동지역 확인 지도" />
    <small>지도 핀은 선택한 위치입니다. 활동범위는 아래 선택 항목을 기준으로 저장됩니다.</small>
    {region && <div className="regionSelectionFields">
      <label>시·도<input value={region.region_1depth_name} readOnly /></label>
      <label>시·군·구<input value={region.region_2depth_name || '해당 없음'} readOnly /></label>
      <label>방문 가능 범위<select aria-label="방문 가능 범위" value={scope} disabled={disabled} onChange={e => setScope(e.target.value)}>
        {region.region_2depth_name && <option value="district">{region.region_2depth_name} 전체</option>}
        {region.region_3depth_name && <option value="town">{region.region_3depth_name}만</option>}
      </select></label>
      <button type="button" disabled={disabled || busy || !candidate || (!region.region_2depth_name && !region.region_3depth_name)} onClick={add}>활동지역 추가</button>
    </div>}
    <div aria-label="선택한 활동지역" className="selectedRegions">{selected.map((item, index) => <span key={`${item}-${index}`}>{item}<button type="button" aria-label={`${item} 삭제`} disabled={disabled} onClick={() => onChange(selected.filter((_, i) => i !== index).join(', '))}>×</button></span>)}</div>
    {selected.length === 0 && <p>선택한 활동지역이 없습니다. 한 곳 이상 추가해주세요.</p>}
    <small>추가·삭제한 지역은 상단의 ‘변경사항 저장’을 눌러야 적용됩니다.</small>
  </section>
}
