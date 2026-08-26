'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type InstructorProfile = {
  id: string
  name: string
  area: string
  specialties: string[]
  licenses: string[]
  license_number: string | null
  vehicle: string
  vehicle_year: number | null
  transmission: string | null
  dual_brake: boolean
  insurance_verified: boolean
  intro: string | null
  active: boolean
}

export default function InstructorProfilePage() {
  const [profile, setProfile] = useState<InstructorProfile | null>(null)

  const [name, setName] = useState('')
  const [area, setArea] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [vehicleYear, setVehicleYear] = useState('')
  const [transmission, setTransmission] = useState('자동')
  const [dualBrake, setDualBrake] = useState(false)
  const [insuranceVerified, setInsuranceVerified] = useState(false)
  const [intro, setIntro] = useState('')

  const [specialties, setSpecialties] = useState<string[]>([])
  const [licenses, setLicenses] = useState<string[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
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

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true)
        setError('')

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          setError('로그인이 필요합니다.')
          return
        }

        const { data, error } = await supabase
          .from('instructors')
          .select(`
            id,
            name,
            area,
            specialties,
            licenses,
            license_number,
            vehicle,
            vehicle_year,
            transmission,
            dual_brake,
            insurance_verified,
            intro,
            active
          `)
          .eq('user_id', user.id)
          .maybeSingle()

        if (error) {
          setError(`교관 프로필을 불러오지 못했습니다: ${error.message}`)
          return
        }

        if (!data) {
          setError('현재 계정에 연결된 교관 프로필이 없습니다.')
          return
        }

        const instructor = data as InstructorProfile

        setProfile(instructor)

        setName(instructor.name || '')
        setArea(instructor.area || '')
        setSpecialties(instructor.specialties || [])
        setLicenses(instructor.licenses || [])
        setLicenseNumber(instructor.license_number || '')
        setVehicle(instructor.vehicle || '')
        setVehicleYear(
          instructor.vehicle_year
            ? String(instructor.vehicle_year)
            : ''
        )
        setTransmission(instructor.transmission || '자동')
        setDualBrake(instructor.dual_brake || false)
        setInsuranceVerified(instructor.insurance_verified || false)
        setIntro(instructor.intro || '')
      } catch (err) {
        console.error(err)
        setError('교관 프로필을 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [])

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

  async function handleSave() {
    if (!profile) return

    if (!name.trim()) {
      setMessage('교관 이름을 입력해주세요.')
      return
    }

    if (!area.trim()) {
      setMessage('활동지역을 입력해주세요.')
      return
    }

    if (!vehicle.trim()) {
      setMessage('교육차량을 입력해주세요.')
      return
    }

    if (specialties.length === 0) {
      setMessage('전문 연수 분야를 1개 이상 선택해주세요.')
      return
    }

    if (licenses.length === 0) {
      setMessage('자격 / 교육 가능 종별을 1개 이상 선택해주세요.')
      return
    }

    try {
      setSaving(true)
      setMessage('')

      const { error } = await supabase
        .from('instructors')
        .update({
          name: name.trim(),
          area: area.trim(),

          specialties,
          licenses,

          license_number: licenseNumber.trim() || null,

          vehicle: vehicle.trim(),

          vehicle_year: vehicleYear
            ? Number(vehicleYear)
            : null,

          transmission,

          dual_brake: dualBrake,

          insurance_verified: insuranceVerified,

          intro: intro.trim() || null,
        })
        .eq('id', profile.id)

      if (error) {
        setMessage(`저장 실패: ${error.message}`)
        return
      }

      setMessage('교관 프로필이 저장되었습니다.')
    } catch (err) {
      console.error(err)
      setMessage('교관 프로필 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '14px',
    borderRadius: 10,
    border: '1px solid #ddd',
    fontSize: 15,
  }

  if (loading) {
    return (
      <main className="container section">
        <div className="panel">
          교관 프로필을 불러오는 중...
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="container section">
        <div className="panel">
          <strong>교관 프로필 오류</strong>
          <p>{error}</p>
        </div>
      </main>
    )
  }

  if (!profile) {
    return null
  }

  return (
    <main className="container section">
      <div
        style={{
          maxWidth: 780,
          margin: '0 auto',
        }}
      >
        <div className="pageHead">
          <div>
            <span>INSTRUCTOR PROFILE</span>
            <h1>교관 프로필 관리</h1>
          </div>

          <button
            className="primaryBtn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '저장 중...' : '변경사항 저장'}
          </button>
        </div>

        <div
          className="panel"
          style={{
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
              <label>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>
                  교관 이름
                </div>

                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={inputStyle}
                />
              </label>

              <label>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>
                  활동지역
                </div>

                <input
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  style={inputStyle}
                />
              </label>
            </div>
          </section>

          <section>
            <h3>전문 연수 분야</h3>

            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                marginTop: 14,
              }}
            >
              {specialtyOptions.map((item) => {
                const selected = specialties.includes(item)

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleSpecialty(item)}
                    style={{
                      padding: '9px 13px',
                      borderRadius: 20,

                      border: selected
                        ? '1px solid #ff4b12'
                        : '1px solid #ddd',

                      background: selected
                        ? '#fff0e9'
                        : '#fff',

                      cursor: 'pointer',
                    }}
                  >
                    {item}
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            <h3>자격 정보</h3>

            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                marginTop: 14,
              }}
            >
              {licenseOptions.map((item) => {
                const selected = licenses.includes(item)

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleLicense(item)}
                    style={{
                      padding: '9px 13px',
                      borderRadius: 20,

                      border: selected
                        ? '1px solid #ff4b12'
                        : '1px solid #ddd',

                      background: selected
                        ? '#fff0e9'
                        : '#fff',

                      cursor: 'pointer',
                    }}
                  >
                    {item}
                  </button>
                )
              })}
            </div>

            <label
              style={{
                display: 'block',
                marginTop: 18,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                자격증 번호
              </div>

              <input
                value={licenseNumber}
                onChange={(e) =>
                  setLicenseNumber(e.target.value)
                }
                placeholder="자격증 또는 관련 등록번호"
                style={inputStyle}
              />
            </label>
          </section>

          <section>
            <h3>교육차량</h3>

            <div
              style={{
                display: 'grid',
                gap: 18,
                marginTop: 16,
              }}
            >
              <label>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>
                  차량
                </div>

                <input
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                  style={inputStyle}
                />
              </label>

              <label>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>
                  차량 연식
                </div>

                <input
                  type="number"
                  value={vehicleYear}
                  onChange={(e) =>
                    setVehicleYear(e.target.value)
                  }
                  style={inputStyle}
                />
              </label>

              <label>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>
                  변속기
                </div>

                <select
                  value={transmission}
                  onChange={(e) =>
                    setTransmission(e.target.value)
                  }
                  style={inputStyle}
                >
                  <option value="자동">자동</option>
                  <option value="수동">수동</option>
                </select>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <input
                  type="checkbox"
                  checked={dualBrake}
                  onChange={(e) =>
                    setDualBrake(e.target.checked)
                  }
                />

                교육용 보조브레이크 장착
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <input
                  type="checkbox"
                  checked={insuranceVerified}
                  onChange={(e) =>
                    setInsuranceVerified(e.target.checked)
                  }
                />

                운전연수 관련 보험 확인
              </label>
            </div>
          </section>

          <section>
            <h3>교관 소개</h3>

            <textarea
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              rows={6}
              style={{
                ...inputStyle,
                marginTop: 14,
                resize: 'vertical',
              }}
            />
          </section>

          {message && (
            <div
              style={{
                padding: 14,
                borderRadius: 10,
                background: '#f7f7f7',
                fontWeight: 700,
              }}
            >
              {message}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}