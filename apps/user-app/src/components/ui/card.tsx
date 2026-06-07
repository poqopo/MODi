import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'

import { colors, radii, shadow } from '../../styles/theme'

type ViewSlotProps = {
  children: ReactNode
  style?: StyleProp<ViewStyle>
}

type TextSlotProps = {
  children: ReactNode
  style?: StyleProp<TextStyle>
}

export function Card({ children, style }: ViewSlotProps) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function CardHeader({ children, style }: ViewSlotProps) {
  return <View style={[styles.header, style]}>{children}</View>
}

export function CardContent({ children, style }: ViewSlotProps) {
  return <View style={[styles.content, style]}>{children}</View>
}

export function CardFooter({ children, style }: ViewSlotProps) {
  return <View style={[styles.footer, style]}>{children}</View>
}

export function CardTitle({ children, style }: TextSlotProps) {
  return <Text style={[styles.title, style]}>{children}</Text>
}

export function CardDescription({ children, style }: TextSlotProps) {
  return <Text style={[styles.description, style]}>{children}</Text>
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadow,
  },
  content: {
    gap: 16,
    padding: 18,
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    padding: 18,
    paddingTop: 0,
  },
  header: {
    gap: 8,
    padding: 18,
    paddingBottom: 12,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '300',
    lineHeight: 26,
  },
})
