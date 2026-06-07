import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'

import { colors, radii } from '../../styles/theme'

type ButtonVariant = 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive'
type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonProps = Omit<PressableProps, 'children'> & {
  children?: ReactNode
  icon?: LucideIcon
  trailingIcon?: LucideIcon
  label?: string
  size?: ButtonSize
  style?: StyleProp<ViewStyle>
  variant?: ButtonVariant
}

export function Button({
  children,
  disabled,
  icon: Icon,
  label,
  size = 'md',
  style,
  trailingIcon: TrailingIcon,
  variant = 'default',
  ...props
}: ButtonProps) {
  const textColor = getTextColor(variant)
  const iconSize = size === 'lg' ? 18 : 16

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        stylesByVariant[variant],
        stylesBySize[size],
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
      {...props}
    >
      {Icon ? <Icon color={textColor} size={iconSize} strokeWidth={2.2} /> : null}
      {label ? <Text style={[styles.label, { color: textColor }, textBySize[size]]}>{label}</Text> : children}
      {TrailingIcon ? <TrailingIcon color={textColor} size={iconSize} strokeWidth={2.2} /> : null}
    </Pressable>
  )
}

function getTextColor(variant: ButtonVariant) {
  if (variant === 'default') return colors.surface
  if (variant === 'destructive') return colors.danger
  return colors.primary
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ translateY: 1 }],
  },
})

const stylesByVariant = StyleSheet.create({
  default: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  destructive: {
    backgroundColor: '#fff1f5',
    borderColor: '#ffd3df',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  outline: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
})

const stylesBySize = StyleSheet.create({
  lg: {
    minHeight: 48,
    paddingHorizontal: 20,
  },
  md: {
    minHeight: 42,
    paddingHorizontal: 16,
  },
  sm: {
    minHeight: 36,
    paddingHorizontal: 12,
  },
})

const textBySize = StyleSheet.create({
  lg: {
    fontSize: 16,
  },
  md: {
    fontSize: 14,
  },
  sm: {
    fontSize: 12,
  },
})
