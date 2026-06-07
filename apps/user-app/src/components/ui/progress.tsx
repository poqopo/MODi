import { StyleSheet, View } from 'react-native'

import { colors, radii } from '../../styles/theme'

type ProgressProps = {
  value?: number
}

export function Progress({ value = 0 }: ProgressProps) {
  const boundedValue = Math.max(0, Math.min(value, 100))

  return (
    <View style={styles.track}>
      <View style={[styles.indicator, { width: `${boundedValue}%` }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  indicator: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: '100%',
  },
  track: {
    backgroundColor: colors.background,
    borderRadius: radii.pill,
    height: 8,
    overflow: 'hidden',
    width: '100%',
  },
})
