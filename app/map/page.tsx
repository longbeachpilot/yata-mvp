'use client'

import Link from 'next/link'
import Script from 'next/script'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LocateFixed, MapPin, Search, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'

declare global {
  interface Window { kakao: any }
}

type Instructor = {
  id: string
  name: string
  area: string
  specialties: string[]
  vehicle: string
  rating: number | string
  reviews: number
  lessons: number
  base_price_2h?: number | null
}

type Place = { address: string; lat: number; lng: number }

const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY

export default function MapPage() {
  const mapNode = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [sdkReady, setSdkReady] = useState(false)
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [query, setQuery] = useState('')
  const [place, setPlace] = useState<Place | null>(null)
  const [searching, setSearching] = useState(false)
  const [message, setMessage] = useState('주소나 동네를 검색하면 그 지역을 중심으로 교관을 확인할 수 있습니다.')

  useEffect(() => {
    supabase.from('instructors')
      .select('id,name,area,specialties,vehicle,rating,reviews,lessons,base_price_2h')
      .eq('active', true)
      .order('rating', { ascending: false })
      .then(({ data }) => setInstructors((data ?? []) as Instructor[]))
  }, [])

  useEffect(() => {
    if (!sdkReady || !mapNode.current || !window.kakao?.maps) return
    window.kakao.maps.load(() => {
      const center = new window.kakao.maps.LatLng(37.4979, 127.0276)
      mapRef.current = new window.kakao.maps.Map(mapNode.current, { center, level: 6 })
    })
  }, [sdkReady])

  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return
    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current = []
    if (!place) return
    const position = new window.kakao.maps.LatLng(place.lat, place.lng)
    const marker = new window.kakao.maps.Marker({ position })
    marker.setMap(mapRef.current)
    markersRef.current.push(marker)
    mapRef.current.setCenter(position)
    mapRef.current.setLevel(5)
  }, [place])

  const matched = useMemo(() => {
    if (!place) return instructors
    const tokens = place.address.split(' ').filter((token) => token.length > 1)
    const areaMatched = instructors.filter((i) => tokens.some((token) => i.area?.includes(token)))
    return areaMatched.length ? areaMatched : instructors
  }, [instructors, place])

  async function searchPlace(e: React.FormEvent) {
    e.preventDefault()
    const keyword = query.trim()
    if (!keyword || !window.kakao?.maps?.services) return
    setSearching(true)
    setMessage('지역을 찾고 있습니다...')
    const geocoder = new window.kakao.maps.services.Geocoder()
    geocoder.addressSearch(keyword, (result: any[], status: string) => {
      if (status === window.kakao.maps.services.Status.OK && result[0]) {
        const found = { address: result[0].address_name || keyword, lat: Number(result[0].y), lng: Number(result[0].x) }
        setPlace(found)
        setMessage(`${found.address} 중심으로 표시합니다. 교관의 정확한 개인 위치는 공개하지 않습니다.`)
        setSearching(false)
        return
      }
      const places = new window.kakao.maps.services.Places()
      places.keywordSearch(keyword, (items: any[], placeStatus: string) => {
        if (placeStatus === window.kakao.maps.services.Status.OK && items[0]) {
          const found = { address: items[0].road_address_name || items[0].address_name || items[0].place_name, lat: Number(items[0].y), lng: Number(items[0].x) }
          setPlace(found)
          setMessage(`${found.address} 중심으로 표시합니다. 교관의 정확한 개인 위치는 공개하지 않습니다.`)
        } else {
          setMessage('검색 결과가 없습니다. 도로명 주소나 동 이름으로 다시 검색해 주세요.')
        }
        setSearching(false)
      })
    })
  }

  return (
    <main className="container section pageTop">
      {KAKAO_KEY && <Script src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false&libraries=services`} strategy="afterInteractive" onLoad={() => setSdkReady(true)} />}
      <div className="pageTitle">
        <span>YA TA MAP</span>
        <h1>연수받을 지역에서 교관을 찾아보세요</h1>
        <p><MapPin size={16}/> 주소를 기준으로 방문 연수 탐색을 시작합니다.</p>
      </div>

      <form className="yataMapSearch" onSubmit={searchPlace}>
        <Search size={19}/>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="예: 강남역, 판교역, 서울 강남구 역삼동" aria-label="연수 지역 검색" />
        <button type="submit" className="primaryBtn" disabled={!sdkReady || searching}>{searching ? '검색 중' : '지역 검색'}</button>
      </form>

      {!KAKAO_KEY && <div className="bookingError">Kakao Maps 환경변수가 아직 배포에 적용되지 않았습니다.</div>}

      <div className="yataMapLayout">
        <section className="yataMapResults">
          <div className="marketMeta"><div><strong>{matched.length}명</strong>의 교관</div><span><ShieldCheck size={15}/> 활성 교관만 표시</span></div>
          <p className="yataMapMessage"><LocateFixed size={15}/>{message}</p>
          <div className="yataMapCards">
            {matched.map((i) => (
              <Link href={`/instructors/${i.id}`} className="yataMapCard" key={i.id}>
                <div><strong>{i.name} 교관</strong><span>{i.area}</span><small>{(i.specialties ?? []).slice(0, 3).join(' · ') || '운전 연수'} · {i.vehicle}</small></div>
                <div className="yataMapPrice"><b>{Number(i.base_price_2h ?? 90000).toLocaleString()}원</b><span>2시간</span></div>
              </Link>
            ))}
          </div>
        </section>
        <section className="yataMapCanvasWrap">
          <div ref={mapNode} className="yataKakaoMap" aria-label="Kakao 지도" />
          {!sdkReady && <div className="yataMapLoading">Kakao 지도를 준비하고 있습니다...</div>}
          {place && <div className="yataMapSelected"><MapPin size={15}/><span>{place.address}</span></div>}
        </section>
      </div>
    </main>
  )
}
