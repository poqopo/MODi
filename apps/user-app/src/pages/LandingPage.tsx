import { DatabaseZap, ShieldCheck, Wallet } from 'lucide-react-native'
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'

import { LogoLockup } from '../components/common/logo-lockup'
import { colors, radii } from '../styles/theme'

type LandingPageProps = {
  onStart: () => void
}

export function LandingPage({ onStart }: LandingPageProps) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.appHeader}>
        <LogoLockup compact />
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>MODi</Text>
          <Text style={styles.headerSubtitle}>User App</Text>
        </View>
        <View style={styles.headerStatus}>
          <ShieldCheck color={colors.primary} size={18} strokeWidth={2.3} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.previewPanel}>
          <PreviewItem
            detail="걸음 수, 수면, 심박수 같은 개인 건강 지표를 한 곳에서 확인"
            icon={ShieldCheck}
            label="헬스케어 측정"
          />
          <PreviewItem detail="Agent가 민감정보 제거와 제공 정책을 먼저 검토" icon={DatabaseZap} label="데이터 보호" />
          <PreviewItem detail="동의, 접근, 보상 상태를 앱에서 투명하게 확인" icon={Wallet} label="보상 관리" />
        </View>
      </ScrollView>

      <View style={styles.bottomAction}>
        <GoogleSignInButton onPress={onStart} />
      </View>
    </SafeAreaView>
  )
}

function GoogleSignInButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Google로 시작하기"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.googleButton, pressed ? styles.pressed : null]}
    >
      <View style={styles.googleMark}>
        <Text style={styles.googleMarkText}>G</Text>
      </View>
      <Text style={styles.googleButtonText}>Google로 시작하기</Text>
      <View style={styles.googleSpacer} />
    </Pressable>
  )
}

function PreviewItem({
  detail,
  icon: Icon,
  label,
}: {
  detail: string
  icon: typeof ShieldCheck
  label: string
}) {
  return (
    <View style={styles.previewItem}>
      <View style={styles.previewIcon}>
        <Icon color={colors.primary} size={20} strokeWidth={2.2} />
      </View>
      <View style={styles.previewCopy}>
        <Text style={styles.previewLabel}>{label}</Text>
        <Text style={styles.previewDetail}>{detail}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  appHeader: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bottomAction: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    padding: 16,
  },
  headerCopy: {
    flex: 1,
    gap: 1,
  },
  headerStatus: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  headerSubtitle: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
  },
  googleButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 16,
    width: '100%',
  },
  googleButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  googleMark: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  googleMarkText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  googleSpacer: {
    height: 32,
    width: 32,
  },
  previewCopy: {
    flex: 1,
    gap: 3,
  },
  previewDetail: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  previewIcon: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  previewItem: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  previewLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  previewPanel: {
    gap: 10,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ translateY: 1 }],
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scrollContent: {
    gap: 18,
    padding: 18,
    paddingBottom: 24,
  },
})
