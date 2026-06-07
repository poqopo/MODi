import { Platform, type TextStyle, type ViewStyle } from 'react-native'

export const colors = {
  background: '#f6f9fc',
  surface: '#ffffff',
  text: '#0d253d',
  muted: '#64748d',
  primary: '#533afd',
  primaryDark: '#1c1e54',
  primaryPressed: '#4434d4',
  border: '#e3e8ee',
  accent: '#f5e9d4',
  accentText: '#9b6829',
  danger: '#ea2261',
  successFill: '#b9b9f9',
  successText: '#4434d4',
}

export const radii = {
  sm: 8,
  md: 10,
  lg: 14,
  pill: 999,
}

export const shadow: ViewStyle = Platform.select({
  web: {
    boxShadow: '0 8px 24px rgba(0, 55, 112, 0.08)',
  } as ViewStyle,
  default: {
    shadowColor: '#003770',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 2,
  },
}) as ViewStyle

export const font: TextStyle = {
  fontFamily: undefined,
}
