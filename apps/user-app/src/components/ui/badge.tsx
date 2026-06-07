import { StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'

import { colors, radii } from '../../styles/theme'

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'dark'

type BadgeProps = {
  label: string
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  variant?: BadgeVariant
}

export function Badge({ label, style, textStyle, variant = 'default' }: BadgeProps) {
  return <Text style={[styles.base, stylesByVariant[variant], textByVariant[variant], style, textStyle]}>{label}</Text>
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    borderWidth: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
})

const stylesByVariant = StyleSheet.create({
  dark: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  default: {
    backgroundColor: colors.successFill,
    borderColor: colors.successFill,
  },
  outline: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  secondary: {
    backgroundColor: colors.background,
    borderColor: colors.background,
  },
  success: {
    backgroundColor: colors.successFill,
    borderColor: colors.successFill,
  },
  warning: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
})

const textByVariant = StyleSheet.create({
  dark: {
    color: colors.surface,
  },
  default: {
    color: colors.successText,
  },
  outline: {
    color: colors.muted,
  },
  secondary: {
    color: colors.text,
  },
  success: {
    color: colors.successText,
  },
  warning: {
    color: colors.accentText,
  },
})
