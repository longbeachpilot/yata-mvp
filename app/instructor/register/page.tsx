'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function InstructorRegisterPage() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [area, setArea] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')

  const [vehicle, setVehicle] = useState('')
  const [vehicleYear, setVehicleYear] = useState('')
  const [transmission, setTransmission] = useState('자동')
  const [dualBrake, setDualBrake] = useState(false)
  

  const [intro, setIntro] = useState('')
  const [specialties, setSpecialties] = useState<string[]>([])
  const [licenses, setLicenses] = useState<string[]>([])

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const specialtyOptions = [
    '장롱면허',
    '초보운전',
    '주차',
    '도심주행',
    '고속도로',
    '야간운전',
    '장거리',
    '차선변경',
  ]

  const licenseOptions = [
    '1종 보통',
    '2종 보통',
    '1종 대형',
    '원동기',
    '2종 소형',
  ]

  function toggleSpecialty(value: string) {
    setSpecialties((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    )
  }

  function toggleLicense(value: string) {
    setLicenses((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    setLoading(true)
    setMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('로그인이 필요합니다.')
      setLoading(false)
      return
    }

    if (!name.trim()) {
      setMessage('교관 이름을 입력해주세요.')
      setLoading(false)
      return
    }

    if (!area.trim()) {
      setMessage('활동지역을 입력해주세요.')
      setLoading(false)
      return
    }

    if (specialties.length === 0) {
      setMessage('전문 연수 분야를 1개 이상 선택해주세요.')
      setLoading(false)
      return
    }

    if (licenses.length === 0) {
      setMessage('자격 / 교육 가능 종별을 1개 이상 선택해주세요.')
      setLoading(false)
      return
    }

    if (!vehicle.trim()) {
      setMessage('교육차량을 입력해주세요.')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase.rpc('register_instructor', {
      instructor_name: name.trim(),
      service_area: area.trim(),
      instructor_specialties: specialties,
      instructor_licenses: licenses,
      private_license_number: licenseNumber.trim() || null,
      education_vehicle: vehicle.trim(),
      education_vehicle_year: vehicleYear ? Number(vehicleYear) : null,
      education_transmission: transmission,
      has_dual_brake: dualBrake,
      instructor_intro: intro.trim() || null,
    })

    if (insertError) {
      const code = insertError.message || ''
      setMessage(code.includes('INSTRUCTOR_EXISTS') ? '이미 교관 프로필이 연결된 계정입니다.' : '교관 등록을 완료하지 못했습니다. 입력 내용을 확인한 뒤 다시 시도해주세요.')
      setLoading(false)
      return
    }

    setMessage('교관 등록이 완료되었습니다.')

    setTimeout(() => {
      router.push('/dashboard/instructor')
    }, 800)

    setLoading(false)
  }

  const inputStyle = {
    width: '100%',
    padding: '14px',
    borderRadius: 10,
    border: '1px solid #ddd',
    fontSize: 15,
  }

  return (
    <main className="container section pageTop">
      <div
        style={{
          maxWidth: 760,
          margin: '0 auto',
        }}
      >
        <div className="pageTitle">
          <span>INSTRUCTOR REGISTER</span>

          <h1>교관 사전등록</h1>

          <p>
            학생이 안심하고 교관을 선택할 수 있도록
            자격과 교육차량 정보를 등록해주세요.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="panel"
          style={{
            marginTop: 30,
            display: 'grid',
            gap: 30,
          }}
        >
          <section>
            <h3>기본 정보</h3>

            <div
              style={{
                display: 'grid',
                gap: 18,
                marginTop: 16,
              }}
            >
              <label>이름<input value={name} onChange={(e) => setName(e.target.value)} placeholder="교관 이름" style={inputStyle} /></label>
              <label>활동지역<input value={area} onChange={(e) => setArea(e.target.value)} placeholder="예: 서울 강남구" style={inputStyle} /></label>
              <label>면허번호<input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="운영자 확인용" style={inputStyle} /></label>
              <div><strong>자격 / 교육 가능 종별</strong><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>{licenseOptions.map((item) => <label key={item}><input type="checkbox" checked={licenses.includes(item)} onChange={() => toggleLicense(item)} /> {item}</label>)}</div></div>
              <div><strong>전문 연수 분야</strong><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>{specialtyOptions.map((item) => <label key={item}><input type="checkbox" checked={specialties.includes(item)} onChange={() => toggleSpecialty(item)} /> {item}</label>)}</div></div>
              <label>교육차량<input value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="예: 현대 아반떼" style={inputStyle} /></label>
              <label>차량 연식<input type="number" min="1990" max="2100" value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} placeholder="예: 2024" style={inputStyle} /></label>
              <label>변속기<select value={transmission} onChange={(e) => setTransmission(e.target.value)} style={inputStyle}><option>자동</option><option>수동</option></select></label>
              <label><input type="checkbox" checked={dualBrake} onChange={(e) => setDualBrake(e.target.checked)} /> 보조브레이크 장착 차량입니다.</label>
            </div>
          </section>

          <section>
            <h3>교관 소개</h3>

            <textarea
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="교육 방식, 경력, 전문 분야 등을 소개해주세요."
              rows={6}
              style={{
                ...inputStyle,
                marginTop: 14,
                resize: 'vertical',
              }}
            />
          </section>

          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: '#f7f7f7',
            }}
          >
            <strong>YA TA 교관 인증</strong>

            <p
              style={{
                marginBottom: 0,
                marginTop: 6,
                color: '#666',
                lineHeight: 1.6,
              }}
            >
              등록한 자격·차량·안전장치 정보는 YA TA 확인 전까지 인증 완료로 표시되지 않습니다. 보험 확인은 제출 자료 검토 후 운영자가 반영합니다.
            </p>
          </div>

          <button
            type="submit"
            className="primaryBtn full"
            disabled={loading}
          >
            {loading ? '등록 중...' : '교관 등록하기'}
          </button>

          {message && (
            <p
              style={{
                margin: 0,
                fontWeight: 700,
              }}
            >
              {message}
            </p>
          )}
        </form>
      </div>
    </main>
  )
}

