// Map addresses use official administrative names, while instructor profiles
// commonly omit 시/구 (for example, "서울 강남"). Keep province identity so
// 광주광역시 cannot accidentally match 경기도 광주시.
const provinceAliases: Record<string, string> = {
  서울: '서울', 서울시: '서울', 서울특별시: '서울',
  부산: '부산', 부산시: '부산', 부산광역시: '부산',
  대구: '대구', 대구시: '대구', 대구광역시: '대구',
  인천: '인천', 인천시: '인천', 인천광역시: '인천',
  광주: '광주', 광주광역시: '광주',
  대전: '대전', 대전시: '대전', 대전광역시: '대전',
  울산: '울산', 울산시: '울산', 울산광역시: '울산',
  세종: '세종', 세종시: '세종', 세종특별자치시: '세종',
  경기: '경기', 경기도: '경기',
  강원: '강원', 강원도: '강원', 강원특별자치도: '강원',
  충북: '충북', 충청북도: '충북', 충남: '충남', 충청남도: '충남',
  전북: '전북', 전라북도: '전북', 전북특별자치도: '전북',
  전남: '전남', 전라남도: '전남',
  경북: '경북', 경상북도: '경북', 경남: '경남', 경상남도: '경남',
  제주: '제주', 제주도: '제주', 제주특별자치도: '제주',
}

function tokens(value: string): string[] {
  return value.normalize('NFC').trim().split(/\s+/).filter(Boolean).map((part, index) =>
    index === 0 && Object.hasOwn(provinceAliases, part) ? `province:${provinceAliases[part]}` : part
  )
}

function matchesPart(addressPart: string, regionPart: string): boolean {
  if (addressPart === regionPart) return true
  const shortName = (part: string) => /^([가-힣]{2,})(시|군|구|읍|면|동|리)$/.exec(part)?.[1]
  // Remove exactly one suffix on one side only: 강남 = 강남구, but not
  // 강남구 = 강남동. Never match arbitrary substrings (강남대로, 강, 남구).
  return shortName(addressPart) === regionPart || shortName(regionPart) === addressPart
}

export function matchesServiceRegion(address: string, region: string): boolean {
  const addressTokens = tokens(address)
  const regionTokens = tokens(region)
  // 서울 강남구 must not also match 서울 노원구.
  return regionTokens.length > 0 && regionTokens.every(part => addressTokens.some(addressPart => matchesPart(addressPart, part)))
}
