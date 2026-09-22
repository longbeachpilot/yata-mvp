function tokens(value: string): string[] {
  return value.replace(/특별자치도|특별자치시|특별시|광역시/g, '').trim().split(/\s+/).filter(Boolean)
}

export function matchesServiceRegion(address: string, region: string): boolean {
  const addressTokens = tokens(address)
  const regionTokens = tokens(region)
  // 서울 강남구 must not also match 서울 노원구.
  return regionTokens.length > 0 && regionTokens.every(part => addressTokens.includes(part))
}
