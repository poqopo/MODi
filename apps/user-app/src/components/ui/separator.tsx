import { StyleSheet, View } from 'react-native'

import { colors } from '../../styles/theme'

export function Separator() {
  return <View style={styles.root} />
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.border,
    height: 1,
    width: '100%',
  },
})
