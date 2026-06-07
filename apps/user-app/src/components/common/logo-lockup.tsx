import { StyleSheet, Text, View } from 'react-native'

import { colors } from '../../styles/theme'

type LogoLockupProps = {
  compact?: boolean
}

export function LogoLockup({ compact = false }: LogoLockupProps) {
  return (
    <View style={styles.root}>
      <View style={[styles.mark, compact && styles.compactMark]}>
        <Text style={styles.markText}>M</Text>
      </View>
      {!compact ? (
        <View>
          <Text style={styles.name}>MODi</Text>
          <Text style={styles.caption}>User App</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  mark: {
    alignItems: 'center',
    backgroundColor: colors.primaryDark,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  compactMark: {
    borderRadius: 16,
    height: 32,
    width: 32,
  },
  markText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },
  name: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  caption: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
})
