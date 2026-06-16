export const userExampleIds = ['user-a2048', 'user-a2128', 'han-demo', 'han-demo-risk']

export function signInWithDemoId(loginId: string) {
  const normalizedLoginId = normalizeDemoLoginId(loginId)
  return { mode: 'local' as const, loginId: normalizedLoginId }
}

export function normalizeDemoLoginId(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '-')
}
