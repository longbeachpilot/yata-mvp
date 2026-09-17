'use client'

import Link from 'next/link'
import Script from 'next/script'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LocateFixed, MapPin, Search, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'

declare global { interface Window { kakao: any } }

type Instructor = { id:string; name:string; area:string; specialties:string[]; vehicle:string; rating:number|string; reviews:number; lessons:number; base_price_2h?:number|null }
type ServiceRegion = { instructor_id:string; region_name:string }
type Place = { address:string; lat:number; lng:number }
type MapState = 'waiting'|'loading'|'ready'|'error'

const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY
const DEFAULT_CENTER = { lat:37.4979, lng:127.0276 }

export default function MapPage(){
 const mapNode=useRef<HTMLDivElement>(null), mapRef=useRef<any>(null), markersRef=useRef<any[]>([])
 const [sdkReady,setSdkReady]=useState(false), [mapState,setMapState]=useState<MapState>(KAKAO_KEY?'loading':'waiting'), [mapError,setMapError]=useState('')
 const [instructors,setInstructors]=useState<Instructor[]>([]), [regions,setRegions]=useState<ServiceRegion[]>([]), [query,setQuery]=useState(''), [place,setPlace]=useState<Place|null>(null), [searching,setSearching]=useState(false)
 const [message,setMessage]=useState('주소나 동네를 검색하면 해당 지역에서 활동하는 교관을 확인할 수 있습니다.')

 useEffect(()=>{ Promise.all([
  supabase.from('instructors').select('id,name,area,specialties,vehicle,rating,reviews,lessons,base_price_2h').eq('active',true).order('rating',{ascending:false}),
  supabase.from('instructor_service_regions').select('instructor_id,region_name').eq('active',true)
 ]).then(([i,r])=>{setInstructors((i.data??[]) as Instructor[]);setRegions((r.data??[]) as ServiceRegion[])}) },[])

 useEffect(()=>{ if(!sdkReady||!mapNode.current)return; const kakao=window.kakao; if(!kakao?.maps?.load){setMapState('error');setMapError('Kakao Maps SDK 객체를 찾지 못했습니다.');return} let cancelled=false; kakao.maps.load(()=>{if(cancelled||!mapNode.current)return;try{const center=new kakao.maps.LatLng(DEFAULT_CENTER.lat,DEFAULT_CENTER.lng);const map=new kakao.maps.Map(mapNode.current,{center,level:6});mapRef.current=map;requestAnimationFrame(()=>map.relayout());setMapState('ready');setMapError('')}catch(e){console.error(e);setMapState('error');setMapError('Kakao 지도 초기화에 실패했습니다.')}});return()=>{cancelled=true}},[sdkReady])

 useEffect(()=>{if(mapState!=='ready'||!mapRef.current||!window.kakao?.maps)return;markersRef.current.forEach(m=>m.setMap(null));markersRef.current=[];if(!place)return;const p=new window.kakao.maps.LatLng(place.lat,place.lng),m=new window.kakao.maps.Marker({position:p});m.setMap(mapRef.current);markersRef.current.push(m);mapRef.current.setCenter(p);mapRef.current.setLevel(5)},[place,mapState])

 const matched=useMemo(()=>{if(!place)return instructors;const normalized=place.address.replace(/특별시|광역시|특별자치시|특별자치도/g,'');const ids=new Set(regions.filter(r=>{const parts=r.region_name.split(/\s+/).filter(Boolean);return parts.some(p=>p.length>1&&normalized.includes(p))}).map(r=>r.instructor_id));return instructors.filter(i=>ids.has(i.id))},[instructors,regions,place])

 async function searchPlace(e:React.FormEvent){e.preventDefault();const keyword=query.trim();if(!keyword)return;if(mapState!=='ready'||!window.kakao?.maps?.services){setMessage('지도가 아직 준비되지 않았습니다.');return}setSearching(true);setMessage('지역을 찾고 있습니다...');const finish=(found:Place)=>{setPlace(found);setMessage(`${found.address}에서 활동 가능한 교관 ${regions.length?'목록을 확인했습니다.':'정보를 확인 중입니다.'}`);setSearching(false)};const geocoder=new window.kakao.maps.services.Geocoder();geocoder.addressSearch(keyword,(result:any[],status:string)=>{if(status===window.kakao.maps.services.Status.OK&&result[0]){finish({address:result[0].address_name||keyword,lat:Number(result[0].y),lng:Number(result[0].x)});return}const places=new window.kakao.maps.services.Places();places.keywordSearch(keyword,(items:any[],s:string)=>{if(s===window.kakao.maps.services.Status.OK&&items[0])finish({address:items[0].road_address_name||items[0].address_name||items[0].place_name,lat:Number(items[0].y),lng:Number(items[0].x)});else{setMessage('검색 결과가 없습니다. 도로명 주소나 동 이름으로 다시 검색해 주세요.');setSearching(false)}})})}

 return <main className="container section pageTop">
  {KAKAO_KEY&&<Script id="kakao-maps-sdk" src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false&libraries=services`} strategy="afterInteractive" onLoad={()=>window.kakao?.maps?.load?setSdkReady(true):(setMapState('error'),setMapError('Kakao 지도 객체를 생성하지 못했습니다.'))} onError={()=>{setMapState('error');setMapError('Kakao Maps SDK를 불러오지 못했습니다. JavaScript 키와 허용 도메인을 확인해 주세요.')}}/>}
  <div className="pageTitle"><span>YA TA MAP</span><h1>연수받을 지역에서 교관을 찾아보세요</h1><p><MapPin size={16}/> 주소를 기준으로 방문 연수 탐색을 시작합니다.</p></div>
  <form className="yataMapSearch" onSubmit={searchPlace}><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="예: 강남역, 판교역, 서울 강남구 역삼동" aria-label="연수 지역 검색"/><button type="submit" className="primaryBtn" disabled={mapState!=='ready'||searching}>{searching?'검색 중':'지역 검색'}</button></form>
  {!KAKAO_KEY&&<div className="bookingError">Kakao Maps 환경변수가 아직 배포에 적용되지 않았습니다.</div>}{mapState==='error'&&<div className="bookingError">{mapError}</div>}
  <div className="yataMapLayout"><section className="yataMapResults"><div className="marketMeta"><div><strong>{matched.length}명</strong>의 교관</div><span><ShieldCheck size={15}/> 실제 활동지역 기준</span></div><p className="yataMapMessage"><LocateFixed size={15}/>{message}</p><div className="yataMapCards">
   {matched.map(i=><Link href={`/instructors/${i.id}${place?`?pickup=${encodeURIComponent(place.address)}`:''}`} className="yataMapCard" key={i.id}><div><strong>{i.name} 교관</strong><span>{i.area}</span><small>{(i.specialties??[]).slice(0,3).join(' · ')||'운전 연수'} · {i.vehicle}</small></div><div className="yataMapPrice"><b>{Number(i.base_price_2h??90000).toLocaleString()}원</b><span>2시간</span></div></Link>)}
   {place&&matched.length===0&&<div className="yataMapMessage">현재 이 지역에 등록된 교관이 없습니다. 서비스 지역을 확대하고 있습니다.</div>}
  </div></section><section className="yataMapCanvasWrap"><div ref={mapNode} className="yataKakaoMap" aria-label="Kakao 지도"/>{mapState==='loading'&&<div className="yataMapLoading">Kakao 지도를 불러오고 있습니다...</div>}{mapState==='waiting'&&<div className="yataMapLoading">지도 환경변수를 기다리고 있습니다.</div>}{mapState==='error'&&<div className="yataMapLoading">지도 연결 실패</div>}{place&&<div className="yataMapSelected"><MapPin size={15}/><span>{place.address}</span></div>}</section></div>
 </main>
}
