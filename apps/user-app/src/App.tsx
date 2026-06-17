import { useEffect, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native'

import { Button } from './components/ui/button'
import { researchRequests } from './data/mvp'
import { DashboardPage } from './pages/DashboardPage'
import { LandingPage } from './pages/LandingPage'
import { signInWithDemoId, userExampleIds } from './services/demoAuth'
import { getStoredZkLoginSession, getZkLoginConfigStatus, signInWithGoogleZkLogin } from './services/zkLogin'
import { colors, radii } from './styles/theme'
import type { DashboardTab } from './types/dashboard'

function App() {
  const [started, setStarted] = useState(false)
  const [activeUserId, setActiveUserId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<DashboardTab>('home')
  const [isRestoringLogin, setIsRestoringLogin] = useState(true)
  const [selectedRequestId, setSelectedRequestId] = useState(researchRequests[0].id)

  useEffect(() => {
    let isMounted = true

    getStoredZkLoginSession()
      .then((session) => {
        if (!isMounted || !session?.loginId) {
          return
        }

        setActiveUserId(session.loginId)
        setActiveTab('home')
        setStarted(true)
      })
      .finally(() => {
        if (isMounted) {
          setIsRestoringLogin(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  if (isRestoringLogin) {
    return <StartupLoadingPage />
  }

  return (
    <>
      <StatusBar style="dark" />
      {!started ? (
        <LandingPage
          onStart={() => {
            setStarted(true)
            setActiveUserId(null)
          }}
        />
      ) : !activeUserId ? (
        <UserLoginPage
          onBack={() => setStarted(false)}
          onLogin={(loginId) => {
            setActiveUserId(loginId)
            setActiveTab('home')
          }}
        />
      ) : (
        <DashboardPage
          activeTab={activeTab}
          activeUserId={activeUserId}
          selectedRequestId={selectedRequestId}
          onBackToLanding={() => {
            setStarted(false)
            setActiveUserId(null)
          }}
          onSelectRequest={setSelectedRequestId}
          onTabChange={setActiveTab}
        />
      )}
    </>
  )
}

export default App

function StartupLoadingPage() {
  return (
    <SafeAreaView style={loginStyles.screen}>
      <Text style={loginStyles.configMessage}>Checking login session.</Text>
    </SafeAreaView>
  )
}

function UserLoginPage({ onBack, onLogin }: { onBack: () => void; onLogin: (loginId: string) => void }) {
  const [loginId, setLoginId] = useState(userExampleIds[0])
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isZkLoginSubmitting, setIsZkLoginSubmitting] = useState(false)
  const zkLoginConfig = getZkLoginConfigStatus()

  const handleLogin = async () => {
    setIsSubmitting(true)
    setMessage('')

    try {
      continueWithDemoLogin()
    } catch {
      setMessage(`This user ID is not registered. Example IDs: ${userExampleIds.join(', ')}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleZkLogin = async () => {
    setIsZkLoginSubmitting(true)
    setMessage('')

    try {
      const session = await signInWithGoogleZkLogin()
      onLogin(session.loginId)
    } catch {
      continueWithDemoLogin()
    } finally {
      setIsZkLoginSubmitting(false)
    }
  }

  const continueWithDemoLogin = () => {
    const fallbackLoginId = loginId.trim() ? loginId : userExampleIds[0]
    const result = signInWithDemoId(fallbackLoginId)
    onLogin(result.loginId)
  }

  return (
    <SafeAreaView style={loginStyles.screen}>
      <View style={loginStyles.panel}>
        <View>
          <Text style={loginStyles.eyebrow}>MODi User App</Text>
          <Text style={loginStyles.title}>Google zkLogin</Text>
          <Text style={loginStyles.description}>
            Create a Sui address from a Google ID token and use it as the participant ID.
          </Text>
        </View>

        <View style={loginStyles.zkLoginGroup}>
          <Button
            disabled={isSubmitting || isZkLoginSubmitting}
            label={isZkLoginSubmitting ? 'Checking' : zkLoginConfig.isConfigured ? 'Google zkLogin' : 'Start now'}
            onPress={handleZkLogin}
            size="lg"
          />
          {!zkLoginConfig.isConfigured ? (
            <Text style={loginStyles.configMessage}>If zkLogin is not configured, the app continues with a demo ID.</Text>
          ) : null}
        </View>

        <View style={loginStyles.formGroup}>
          <Text style={loginStyles.sectionTitle}>Continue with a demo ID</Text>
          <Text style={loginStyles.label}>User ID</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setLoginId}
            placeholder="user-a2048"
            placeholderTextColor={colors.muted}
            style={loginStyles.input}
            value={loginId}
          />
          <View style={loginStyles.examples}>
            {userExampleIds.map((exampleId) => (
              <Pressable
                accessibilityRole="button"
                key={exampleId}
                onPress={() => setLoginId(exampleId)}
                style={({ pressed }) => [loginStyles.exampleChip, pressed ? loginStyles.pressed : null]}
              >
                <Text style={loginStyles.exampleText}>{exampleId}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {message ? <Text style={loginStyles.message}>{message}</Text> : null}

        <View style={loginStyles.actions}>
          <Button label="Back" onPress={onBack} variant="secondary" />
          <Button
            disabled={isSubmitting || isZkLoginSubmitting}
            label={isSubmitting ? 'Checking' : 'Demo Login'}
            onPress={handleLogin}
          />
        </View>
      </View>
    </SafeAreaView>
  )
}

const loginStyles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  configMessage: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
  },
  exampleChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  exampleText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  examples: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  formGroup: {
    gap: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  message: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    padding: 12,
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 22,
    maxWidth: 520,
    padding: 24,
    width: '100%',
  },
  pressed: {
    opacity: 0.78,
  },
  screen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  sectionTitle: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 8,
  },
  zkLoginGroup: {
    gap: 10,
  },
})
