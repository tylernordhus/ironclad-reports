import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import type { Session } from '@supabase/supabase-js'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import { WebView } from 'react-native-webview'
import {
  buildWebUrl,
  getCachedContractorEvalDetail,
  getCachedProjectDetail,
  getCachedPourLogDetail,
  getCachedQaFormDetail,
  getCachedReportDetail,
  getCachedWeeklySummary,
  fetchContractorEvalDetail,
  fetchProjectDetail,
  fetchProjects,
  fetchPourLogDetail,
  fetchQaFormDetail,
  fetchReportDetail,
  fetchWeeklySummary,
  type ContractorEvalDetail,
  type ContractorEvalSummary,
  type MobileSettings,
  type ProjectDetail,
  type ProjectSummary,
  type PourLogDetail,
  type PourLogSummary,
  type QaFormDetail,
  type QaFormSummary,
  type ReportDetail,
  type WeeklySummaryData,
} from './src/lib/api'
import { SHOW_SUBMISSION_DASHBOARD } from './src/lib/feature-flags'
import {
  NativeContractorEvaluationScreen,
  NativeDailyReportEditScreen,
  NativeDailyReportScreen,
  NativeDrilledShaftPourLogScreen,
  NativeFlatworkPourLogScreen,
  NativeProjectPhotosScreen,
  NativePourLogTypeScreen,
  NativeQaFormScreen,
  NativeQaFormTypeScreen,
} from './src/screens/native-flows'
import { supabase, supabaseConfigError } from './src/lib/supabase'

type Route =
  | { name: 'projects' }
  | { name: 'project'; projectId: string }
  | { name: 'new-daily-report'; projectId: string; projectName: string; quickMode: boolean }
  | { name: 'report'; projectId: string; reportId: string }
  | { name: 'edit-report'; projectId: string; reportId: string }
  | { name: 'pour-log-type'; projectId: string; projectName: string }
  | { name: 'new-pour-log'; projectId: string; projectName: string; logType: 'drilled_shaft' | 'flatwork' }
  | { name: 'pour-log'; projectId: string; logId: string }
  | { name: 'qa-form-select'; projectId: string; projectName: string; enabledTypes: string[] }
  | { name: 'new-qa-form'; projectId: string; projectName: string; formType: string }
  | { name: 'qa-form'; projectId: string; formId: string }
  | { name: 'new-contractor-eval'; projectId: string; projectName: string }
  | { name: 'contractor-eval'; projectId: string; evalId: string }
  | { name: 'project-photos'; projectId: string }
  | { name: 'weekly-summary'; projectId: string; projectName: string }
  | { name: 'web'; title: string; path: string; parent: Exclude<Route, { name: 'web' }> }

const LAST_EMAIL_KEY = 'ironclad:last-email'
const BIOMETRIC_ENABLED_KEY = 'ironclad:biometric-enabled'
const BIOMETRIC_RELOCK_GRACE_MS = 30_000

function getBiometricLabel(types: LocalAuthentication.AuthenticationType[]) {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID'
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Touch ID'
  return 'Biometric Unlock'
}

async function getBiometricConfig() {
  const hasHardware = await LocalAuthentication.hasHardwareAsync()
  const isEnrolled = hasHardware ? await LocalAuthentication.isEnrolledAsync() : false
  const supportedTypes = hasHardware ? await LocalAuthentication.supportedAuthenticationTypesAsync() : []
  return {
    supported: hasHardware && isEnrolled,
    label: getBiometricLabel(supportedTypes),
  }
}

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '-'
  const [year, month, day] = dateStr.split('-')
  return month && day && year ? `${month}-${day}-${year}` : dateStr
}

function formatTime(time: string | null | undefined) {
  if (!time) return '-'
  const [hourStr, minute] = time.split(':')
  const hour = Number(hourStr)
  if (Number.isNaN(hour) || !minute) return time
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${minute} ${ampm}`
}

function formatBoolean(value: boolean | null | undefined) {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return '-'
}

function statusTone(status: string | null | undefined) {
  return status === 'active' ? styles.statusPillActive : styles.statusPillMuted
}

function getWeekBounds(offsetWeeks: number) {
  const now = new Date()
  now.setDate(now.getDate() + offsetWeeks * 7)
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  }
}

function getPourLogEditPath(logId: string, logType: string | null | undefined) {
  return logType === 'flatwork' ? `/pour-logs/${logId}/edit-flatwork` : `/pour-logs/${logId}/edit`
}

function openPourLogTypePicker(
  projectId: string,
  projectName: string,
  onOpenWeb: (title: string, path: string) => void
) {
  const encodedProjectName = encodeURIComponent(projectName)

  Alert.alert('Pour Log Type', 'Choose the pour log type for this project.', [
    {
      text: 'Drilled Shaft',
      onPress: () =>
        onOpenWeb(
          'New Drilled Shaft Pour Log',
          `/pour-log?project_id=${projectId}&project_name=${encodedProjectName}`
        ),
    },
    {
      text: 'Flatwork',
      onPress: () =>
        onOpenWeb(
          'New Flatwork Pour Log',
          `/pour-log-flatwork?project_id=${projectId}&project_name=${encodedProjectName}`
        ),
    },
    { text: 'Cancel', style: 'cancel' },
  ])
}

function getTruckEstimatedLeftover(notes: string | null | undefined) {
  const match = asText(notes).match(/\[LEFTOVER=([^\]]+)\]/)
  return asText(match?.[1])
}

function isRejectedTruck(notes: string | null | undefined) {
  const text = asText(notes)
  return text === '[REJECTED]' || text.startsWith('[REJECTED] ')
}

function cleanTruckNotes(notes: string | null | undefined) {
  return asText(notes)
    .replace(/\[LEFTOVER=([^\]]+)\]/g, '')
    .replace('[REJECTED]', '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function getRouteTitle(route: Route) {
  switch (route.name) {
    case 'projects':
      return 'Projects'
    case 'project':
      return 'Project'
    case 'new-daily-report':
      return route.quickMode ? 'Quick Submit' : 'Daily Report'
    case 'report':
      return 'Daily Report'
    case 'edit-report':
      return 'Edit Report'
    case 'pour-log-type':
      return 'Pour Log'
    case 'new-pour-log':
      return 'Pour Log'
    case 'pour-log':
      return 'Pour Log'
    case 'qa-form-select':
      return 'QA Form'
    case 'new-qa-form':
      return 'QA Form'
    case 'qa-form':
      return 'QA Form'
    case 'new-contractor-eval':
      return 'Contractor Evaluation'
    case 'contractor-eval':
      return 'Contractor Evaluation'
    case 'project-photos':
      return 'Project Photos'
    case 'weekly-summary':
      return 'Weekly Summary'
    case 'web':
      return route.title
    default:
      return 'Inspector Gadget'
  }
}

function getQaFormMeta(formType: string | null | undefined) {
  switch (formType) {
    case 'mono_pole_framing':
      return { code: 'QA-009', label: 'Framing', title: 'Mono Pole / H-Frame / 3 Pole Framing Report' }
    case 'vibratory_caisson':
      return { code: 'QA-010', label: 'Vibratory Caisson', title: 'Vibratory Caisson Report' }
    case 'pole_setting':
      return { code: 'QA-011', label: 'Pole Setting', title: 'Pole Setting Report' }
    case 'grounding_resistance':
      return { code: 'QA-013', label: 'Grounding Resistance', title: 'Structure Grounding and Resistance Measurement Report' }
    default:
      return { code: 'QA', label: 'QA Form', title: 'QA Form' }
  }
}

function reportTypeEnabled(settings: Record<string, boolean> | null | undefined, key: string) {
  if (!settings) return true
  return settings[key] !== false
}

function getEnabledQaFormTypes(settings: Record<string, boolean> | null | undefined) {
  const types: string[] = []
  if (reportTypeEnabled(settings, 'qa_009')) types.push('mono_pole_framing')
  if (reportTypeEnabled(settings, 'qa_010')) types.push('vibratory_caisson')
  if (reportTypeEnabled(settings, 'qa_011')) types.push('pole_setting')
  if (reportTypeEnabled(settings, 'qa_013')) types.push('grounding_resistance')
  return types
}

function openPhotoSourcePath(
  path: string,
  projectId: string,
  setRoute: (route: Route) => void
) {
  const reportMatch = path.match(/^\/reports\/([^/]+)$/)
  if (reportMatch) {
    setRoute({ name: 'report', projectId, reportId: reportMatch[1] })
    return
  }

  const pourLogMatch = path.match(/^\/pour-logs\/([^/]+)$/)
  if (pourLogMatch) {
    setRoute({ name: 'pour-log', projectId, logId: pourLogMatch[1] })
    return
  }

  const qaFormMatch = path.match(/^\/qa-forms\/([^/]+)$/)
  if (qaFormMatch) {
    setRoute({ name: 'qa-form', projectId, formId: qaFormMatch[1] })
    return
  }

  setRoute({ name: 'web', title: 'Project Photo Source', path, parent: { name: 'project-photos', projectId } })
}

function qaStatus(value: unknown) {
  const text = asText(value).toLowerCase()
  if (text === 'yes') return 'Yes'
  if (text === 'no') return 'No'
  if (text === 'na') return 'N/A'
  return '-'
}

function selectedLabels(source: Record<string, any> | null | undefined) {
  return Object.entries(source || {})
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key.replace(/_/g, ' '))
    .map(value => value.replace(/\b\w/g, char => char.toUpperCase()))
    .join(', ') || '-'
}

function buildQaFormBlocks(form: QaFormDetail) {
  const data = form.form_data || {}
  const blocks: Array<{ title: string; rows: Array<{ label: string; value: unknown; multiline?: boolean }> }> = [
    {
      title: 'Project Information',
      rows: [
        { label: 'Project Number', value: data.project_number },
        { label: 'Date Work Performed', value: formatDate(form.work_date) },
        { label: 'Owner', value: data.owner },
        { label: 'Structure Number', value: data.structure_number },
        { label: 'Structure Type', value: data.structure_type },
        { label: 'Contractor/Subcontractor', value: data.contractor },
        { label: 'Time Started', value: formatTime(data.time_started) },
        { label: 'Time Ended', value: formatTime(data.time_ended) },
        { label: 'Weather', value: data.weather },
        { label: 'Wind', value: data.wind },
        { label: 'Temp', value: data.temp },
        { label: 'Drawing/Spec Number', value: data.drawing_spec_number },
      ],
    },
  ]

  if (form.form_type === 'mono_pole_framing') {
    const verification = Object.entries(data.verification_items || {}).map(([key, value]: [string, any]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
      return `${label}: ${qaStatus(value?.status)}${value?.remarks ? ` — ${value.remarks}` : ''}`
    }).join('\n')
    const joints = (data.slip_joint_dimensions || []).map((row: any, index: number) => {
      const rowLabel = ['Top Joint', 'Middle Joint', 'Bottom Joint'][index] || `Joint ${index + 1}`
      return `${rowLabel}: Min ${row?.min || '-'} | Max ${row?.max || '-'} | Act ${row?.act || '-'}`
    }).join('\n')
    blocks.push(
      { title: 'Framing Verification', rows: [{ label: 'Verification Items', value: verification, multiline: true }] },
      { title: 'Slip Joint Dimensions', rows: [{ label: 'Dimensions', value: joints, multiline: true }] },
    )
  }

  if (form.form_type === 'vibratory_caisson') {
    const checks = Object.entries(data.monitoring_checks || {}).map(([key, value]: [string, any]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
      return `${label}: ${qaStatus(value?.status)}`
    }).join('\n')
    blocks.push(
      {
        title: 'Equipment',
        rows: [
          { label: 'Crane Size & Model No.', value: data.crane_size_model },
          { label: 'Hammer Size & Model No.', value: data.hammer_size_model },
        ],
      },
      { title: 'Monitoring Checklist', rows: [{ label: 'Checks', value: checks, multiline: true }] },
    )
  }

  if (form.form_type === 'pole_setting') {
    const checks = Object.entries(data.installation_checks || {}).map(([key, value]: [string, any]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
      return `${label}: Pole A ${qaStatus(value?.pole_a)} | Pole B ${qaStatus(value?.pole_b)} | Pole C ${qaStatus(value?.pole_c)}`
    }).join('\n')
    blocks.push(
      {
        title: 'Pole Setup',
        rows: [
          { label: 'Worksite Conditions', value: selectedLabels(data.worksite_conditions), multiline: true },
          { label: 'Equipment Used to Set Pole', value: data.equipment_used_to_set_pole, multiline: true },
          { label: 'Pole A Size / Class', value: data.pole_size_class?.pole_a },
          { label: 'Pole B Size / Class', value: data.pole_size_class?.pole_b },
          { label: 'Pole C Size / Class', value: data.pole_size_class?.pole_c },
          { label: 'Transit Calibration Date', value: formatDate(data.transit_calibration_date) },
          { label: 'Transit Serial #', value: data.transit_serial_number },
        ],
      },
      { title: 'Installation Checklist', rows: [{ label: 'Checks', value: checks, multiline: true }] },
    )
  }

  if (form.form_type === 'grounding_resistance') {
    const readings = (data.grounding_rows || []).map((row: any, index: number) => (
      `Row ${index + 1}: Rods1 ${row?.rods_inst_1 || '-'} | Reading1 ${row?.reading_1 || '-'} | Rods2 ${row?.rods_inst_2 || '-'} | Reading2 ${row?.reading_2 || '-'} | Met ${qaStatus(row?.met_resistance)} | ${row?.remarks || '-'}`
    )).join('\n')
    blocks.push(
      {
        title: 'Conditions and Megger',
        rows: [
          { label: 'Soil Conditions', value: selectedLabels(data.soil_conditions), multiline: true },
          { label: 'Climate Conditions', value: selectedLabels(data.climate_conditions), multiline: true },
          { label: 'Megger Make', value: data.megger?.make },
          { label: 'Megger Model', value: data.megger?.model },
          { label: 'Megger Serial #', value: data.megger?.serial_number },
          { label: 'Megger Calibration Date', value: formatDate(data.megger?.calibration_date) },
          { label: 'Resistance Specified', value: data.resistance_specified },
        ],
      },
      { title: 'Resistance Readings', rows: [{ label: 'Readings', value: readings, multiline: true }] },
      {
        title: 'Closeout Checks',
        rows: [
          { label: 'Picture Verification Taken', value: data.picture_verification_taken ? 'Yes' : 'No' },
          { label: 'Grounding Installed per Specification', value: data.grounding_installed_per_spec ? 'Yes' : 'No' },
        ],
      },
    )
  }

  blocks.push({
    title: 'Closeout',
    rows: [
      { label: 'Remarks', value: data.remarks, multiline: true },
      { label: 'Submitted By', value: form.submitted_by },
      { label: 'Signature Date', value: formatDate(data.signature_date) },
      { label: 'Installation Witnessed', value: data.installation_witnessed ? 'Yes' : 'No' },
      { label: 'Review Document', value: data.review_document ? 'Yes' : 'No' },
    ],
  })

  return blocks
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [deviceAuthLoading, setDeviceAuthLoading] = useState(true)
  const [route, setRoute] = useState<Route>({ name: 'projects' })
  const [settings, setSettings] = useState<MobileSettings | null>(null)
  const [dashboardSummary, setDashboardSummary] = useState<{ submitted: number; missing: number; inactive: number } | null>(null)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [projectsRefreshing, setProjectsRefreshing] = useState(false)
  const [projectsError, setProjectsError] = useState('')
  const [savedEmail, setSavedEmail] = useState('')
  const [biometricSupported, setBiometricSupported] = useState(false)
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const [biometricLabel, setBiometricLabel] = useState('Face ID')
  const [unlocked, setUnlocked] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const approvalAlertShownRef = useRef(false)
  const appStateRef = useRef<AppStateStatus>(AppState.currentState)
  const backgroundedAtRef = useRef<number | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const unlockingRef = useRef(false)
  const skipNextBiometricPromptRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function loadDeviceAuthState() {
      try {
        const [storedEmail, config] = await Promise.all([
          SecureStore.getItemAsync(LAST_EMAIL_KEY),
          getBiometricConfig(),
        ])

        if (cancelled) return

        setSavedEmail(storedEmail || '')
        setBiometricSupported(config.supported)
        setBiometricLabel(config.label)

        if (!config.supported) {
          setBiometricEnabled(false)
          return
        }

        const storedEnabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY)
        if (cancelled) return

        const enabled = storedEnabled == null ? true : storedEnabled === 'true'
        setBiometricEnabled(enabled)

        if (storedEnabled == null) {
          await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true')
        }
      } catch {
        if (!cancelled) {
          setBiometricSupported(false)
          setBiometricEnabled(false)
        }
      } finally {
        if (!cancelled) setDeviceAuthLoading(false)
      }
    }

    loadDeviceAuthState()

    return () => {
      cancelled = true
    }
  }, [])

  async function unlockWithBiometrics() {
    if (!biometricSupported || !biometricEnabled) {
      setUnlocked(true)
      return true
    }

    if (unlockingRef.current) return false

    unlockingRef.current = true
    setUnlocking(true)
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Unlock with ${biometricLabel}`,
        fallbackLabel: 'Use Device Passcode',
        cancelLabel: 'Cancel',
      })

      if (result.success) {
        setUnlocked(true)
        return true
      }

      setUnlocked(false)
      return false
    } catch {
      setUnlocked(false)
      return false
    } finally {
      unlockingRef.current = false
      setUnlocking(false)
    }
  }

  useEffect(() => {
    const supabaseClient = supabase

    if (!supabaseClient) {
      setAuthLoading(false)
      return
    }

    if (AppState.currentState === 'active') {
      supabaseClient.auth.startAutoRefresh()
    }

    supabaseClient.auth.getSession().then(({ data: { session: nextSession } }) => {
      setSession(nextSession)
      sessionRef.current = nextSession
      setAuthLoading(false)
    })

    const { data: authListener } = supabaseClient.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      sessionRef.current = nextSession
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setRoute({ name: 'projects' })
      }
      if (!nextSession) {
        approvalAlertShownRef.current = false
        setUnlocked(false)
      } else if (event === 'SIGNED_IN') {
        skipNextBiometricPromptRef.current = true
        setUnlocked(true)
      }
      setAuthLoading(false)
    })

    return () => {
      supabaseClient.auth.stopAutoRefresh()
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user?.email) return

    const email = session.user.email
    setSavedEmail(email)
    SecureStore.setItemAsync(LAST_EMAIL_KEY, email).catch(() => {})
  }, [session?.user?.email])

  useEffect(() => {
    if (!session) {
      setUnlocked(false)
      return
    }

    if (!biometricSupported || !biometricEnabled) {
      setUnlocked(true)
      return
    }

    if (authLoading) return

    if (skipNextBiometricPromptRef.current) {
      skipNextBiometricPromptRef.current = false
      setUnlocked(true)
      return
    }

    setUnlocked(false)
    setTimeout(() => {
      if (sessionRef.current) {
        unlockWithBiometrics()
      }
    }, 150)
  }, [authLoading, biometricEnabled, biometricSupported, session])

  useEffect(() => {
    const supabaseClient = supabase

    const subscription = AppState.addEventListener('change', nextState => {
      const previous = appStateRef.current
      appStateRef.current = nextState

      if (!supabaseClient) return

      if (nextState === 'active') {
        supabaseClient.auth.startAutoRefresh()
      } else {
        supabaseClient.auth.stopAutoRefresh()
      }

      if (nextState === 'inactive' || nextState === 'background') {
        backgroundedAtRef.current = Date.now()
        return
      }

      if (
        (previous === 'inactive' || previous === 'background') &&
        sessionRef.current &&
        biometricSupported &&
        biometricEnabled
      ) {
        const backgroundedAt = backgroundedAtRef.current
        const wasAwayLongEnough =
          backgroundedAt == null || Date.now() - backgroundedAt >= BIOMETRIC_RELOCK_GRACE_MS

        if (!wasAwayLongEnough) {
          return
        }

        setUnlocked(false)
        setTimeout(() => {
          if (sessionRef.current) {
            unlockWithBiometrics()
          }
        }, 150)
      }
    })

    return () => {
      subscription.remove()
    }
  }, [biometricEnabled, biometricSupported, biometricLabel])

  const userEmail = useMemo(() => session?.user?.email || '', [session])

  const loadProjects = async (nextSession: Session, refreshing = false) => {
    if (refreshing) {
      setProjectsRefreshing(true)
    } else {
      setProjectsLoading(true)
    }
    setProjectsError('')

    try {
      const data = await fetchProjects(nextSession)
      setSettings(data.settings)
      setDashboardSummary(data.dashboard?.today_summary || null)
      setProjects(data.projects)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load projects.'
      if (message.toLowerCase().includes('not approved for mobile access')) {
        setProjectsError('')
        setSettings(null)
        setDashboardSummary(null)
        setProjects([])
        if (!approvalAlertShownRef.current) {
          approvalAlertShownRef.current = true
          Alert.alert('Mobile Access Pending', 'This account is not approved for the mobile app yet.')
        }
        return
      }

      setProjectsError(message)
    } finally {
      setProjectsLoading(false)
      setProjectsRefreshing(false)
    }
  }

  useEffect(() => {
    if (!session) {
      setSettings(null)
      setDashboardSummary(null)
      setProjects([])
      return
    }

    loadProjects(session)
  }, [session])

  const routeTitle = getRouteTitle(route)
  const canJumpHome = route.name !== 'projects'

  if (authLoading || deviceAuthLoading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#b44a12" />
        <Text style={styles.loadingText}>Loading mobile app…</Text>
      </SafeAreaView>
    )
  }

  if (supabaseConfigError) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <Text style={styles.authTitle}>Configuration Error</Text>
        <Text style={styles.authSubtitle}>{supabaseConfigError}</Text>
      </SafeAreaView>
    )
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.appShell}>
        <StatusBar style="dark" />
        <AuthScreen
          savedEmail={savedEmail}
          biometricSupported={biometricSupported}
          biometricLabel={biometricLabel}
        />
      </SafeAreaView>
    )
  }

  if (!unlocked) {
    return (
      <SafeAreaView style={styles.appShell}>
        <StatusBar style="dark" />
        <LockedScreen
          biometricLabel={biometricLabel}
          biometricSupported={biometricSupported}
          unlocking={unlocking}
          onUnlock={() => {
            unlockWithBiometrics().then(success => {
              if (!success) {
                Alert.alert('Unlock required', `Use ${biometricLabel} or your device passcode to continue.`)
              }
            })
          }}
          onSignOut={async () => {
            if (!supabase) return
            const { error } = await supabase.auth.signOut()
            if (error) {
              Alert.alert('Sign out failed', error.message)
            }
          }}
        />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.appShell}>
      <StatusBar style="dark" />
      <AppHeader
        title={routeTitle}
        showProjectsButton={canJumpHome}
        onProjectsPress={() => setRoute({ name: 'projects' })}
      />

      {route.name === 'projects' ? (
        <ProjectsScreen
          settings={settings}
          dashboardSummary={dashboardSummary}
          projects={projects}
          projectsLoading={projectsLoading}
          projectsRefreshing={projectsRefreshing}
          projectsError={projectsError}
          userEmail={userEmail}
          onRefresh={() => loadProjects(session, true)}
          onOpenProject={(project) => setRoute({ name: 'project', projectId: project.id })}
          onSignOut={async () => {
            if (!supabase) return
            const { error } = await supabase.auth.signOut()
            if (error) {
              Alert.alert('Sign out failed', error.message)
            }
          }}
        />
      ) : null}

      {route.name === 'project' ? (
        <ProjectDetailScreen
          session={session}
          projectId={route.projectId}
          onBack={() => setRoute({ name: 'projects' })}
          onNewDailyReport={(projectId, projectName, quickMode) => setRoute({ name: 'new-daily-report', projectId, projectName, quickMode })}
          onNewPourLog={(projectId, projectName) => setRoute({ name: 'pour-log-type', projectId, projectName })}
          onOpenReport={(reportId) => setRoute({ name: 'report', projectId: route.projectId, reportId })}
          onOpenPourLog={(logId) => setRoute({ name: 'pour-log', projectId: route.projectId, logId })}
          onOpenQaFormSelect={(projectId, projectName, enabledTypes) => setRoute({ name: 'qa-form-select', projectId, projectName, enabledTypes })}
          onOpenQaForm={(formId) => setRoute({ name: 'qa-form', projectId: route.projectId, formId })}
          onNewContractorEval={(projectId, projectName) => setRoute({ name: 'new-contractor-eval', projectId, projectName })}
          onOpenContractorEval={(evalId) => setRoute({ name: 'contractor-eval', projectId: route.projectId, evalId })}
          onOpenWeeklySummary={(projectName) => setRoute({ name: 'weekly-summary', projectId: route.projectId, projectName })}
          onOpenProjectPhotos={(projectId) => setRoute({ name: 'project-photos', projectId })}
          onOpenWeb={(title, path) => setRoute({ name: 'web', title, path, parent: { name: 'project', projectId: route.projectId } })}
        />
      ) : null}

      {route.name === 'new-daily-report' ? (
        <NativeDailyReportScreen
          session={session}
          projectId={route.projectId}
          projectName={route.projectName}
          quickMode={route.quickMode}
          onBack={() => setRoute({ name: 'project', projectId: route.projectId })}
          onCreated={(reportId) => setRoute({ name: 'report', projectId: route.projectId, reportId })}
        />
      ) : null}

      {route.name === 'report' ? (
        <ReportDetailScreen
          session={session}
          reportId={route.reportId}
          onBack={() => setRoute({ name: 'project', projectId: route.projectId })}
          onEditNative={() => setRoute({ name: 'edit-report', projectId: route.projectId, reportId: route.reportId })}
          onOpenWeb={(title, path) => setRoute({ name: 'web', title, path, parent: { name: 'report', projectId: route.projectId, reportId: route.reportId } })}
        />
      ) : null}

      {route.name === 'edit-report' ? (
        <NativeDailyReportEditScreen
          session={session}
          reportId={route.reportId}
          onBack={() => setRoute({ name: 'report', projectId: route.projectId, reportId: route.reportId })}
          onSaved={(reportId) => setRoute({ name: 'report', projectId: route.projectId, reportId })}
        />
      ) : null}

      {route.name === 'pour-log-type' ? (
        <NativePourLogTypeScreen
          projectName={route.projectName}
          onBack={() => setRoute({ name: 'project', projectId: route.projectId })}
          onSelect={(logType) => setRoute({ name: 'new-pour-log', projectId: route.projectId, projectName: route.projectName, logType })}
        />
      ) : null}

      {route.name === 'new-pour-log' ? (
        <WebScreen
          session={session}
          title={route.logType === 'flatwork' ? 'New Flatwork Pour Log' : 'New Drilled Shaft Pour Log'}
          path={
            route.logType === 'flatwork'
              ? `/pour-log-flatwork?project_id=${route.projectId}&project_name=${encodeURIComponent(route.projectName)}`
              : `/pour-log?project_id=${route.projectId}&project_name=${encodeURIComponent(route.projectName)}`
          }
          onBack={() => setRoute({ name: 'pour-log-type', projectId: route.projectId, projectName: route.projectName })}
        />
      ) : null}

      {route.name === 'pour-log' ? (
        <PourLogDetailScreen
          session={session}
          logId={route.logId}
          onBack={() => setRoute({ name: 'project', projectId: route.projectId })}
          onOpenWeb={(title, path) => setRoute({ name: 'web', title, path, parent: { name: 'pour-log', projectId: route.projectId, logId: route.logId } })}
        />
      ) : null}

      {route.name === 'qa-form-select' ? (
        <NativeQaFormTypeScreen
          projectName={route.projectName}
          enabledTypes={route.enabledTypes}
          onBack={() => setRoute({ name: 'project', projectId: route.projectId })}
          onSelect={(formType) => setRoute({ name: 'new-qa-form', projectId: route.projectId, projectName: route.projectName, formType })}
        />
      ) : null}

      {route.name === 'new-qa-form' ? (
        <NativeQaFormScreen
          session={session}
          projectId={route.projectId}
          projectName={route.projectName}
          formType={route.formType}
          onBack={() => setRoute({ name: 'project', projectId: route.projectId })}
          onCreated={(formId) => setRoute({ name: 'qa-form', projectId: route.projectId, formId })}
        />
      ) : null}

      {route.name === 'qa-form' ? (
        <QaFormDetailScreen
          session={session}
          formId={route.formId}
          onBack={() => setRoute({ name: 'project', projectId: route.projectId })}
          onOpenWeb={(title, path) => setRoute({ name: 'web', title, path, parent: { name: 'qa-form', projectId: route.projectId, formId: route.formId } })}
        />
      ) : null}

      {route.name === 'new-contractor-eval' ? (
        <NativeContractorEvaluationScreen
          session={session}
          projectId={route.projectId}
          projectName={route.projectName}
          onBack={() => setRoute({ name: 'project', projectId: route.projectId })}
          onCreated={(evalId) => setRoute({ name: 'contractor-eval', projectId: route.projectId, evalId })}
        />
      ) : null}

      {route.name === 'contractor-eval' ? (
        <ContractorEvalDetailScreen
          session={session}
          evalId={route.evalId}
          onBack={() => setRoute({ name: 'project', projectId: route.projectId })}
          onOpenWeb={(title, path) => setRoute({ name: 'web', title, path, parent: { name: 'contractor-eval', projectId: route.projectId, evalId: route.evalId } })}
        />
      ) : null}

      {route.name === 'weekly-summary' ? (
        <WeeklySummaryScreen
          session={session}
          projectId={route.projectId}
          projectName={route.projectName}
          onBack={() => setRoute({ name: 'project', projectId: route.projectId })}
          onOpenWeb={(title, path) => setRoute({ name: 'web', title, path, parent: { name: 'weekly-summary', projectId: route.projectId, projectName: route.projectName } })}
        />
      ) : null}

      {route.name === 'project-photos' ? (
        <NativeProjectPhotosScreen
          session={session}
          projectId={route.projectId}
          onBack={() => setRoute({ name: 'project', projectId: route.projectId })}
          onOpenSource={(path) => openPhotoSourcePath(path, route.projectId, setRoute)}
        />
      ) : null}

      {route.name === 'web' ? (
        <WebScreen
          session={session}
          title={route.title}
          path={route.path}
          onBack={() => setRoute(route.parent)}
        />
      ) : null}
    </SafeAreaView>
  )
}

function AuthScreen({
  savedEmail,
  biometricSupported,
  biometricLabel,
}: {
  savedEmail: string
  biometricSupported: boolean
  biometricLabel: string
}) {
  const [email, setEmail] = useState(savedEmail)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setEmail(savedEmail)
  }, [savedEmail])

  const handleSignIn = async () => {
    if (!supabase) {
      Alert.alert('Configuration error', 'Supabase is not configured in this build.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    setLoading(false)

    if (error) {
      Alert.alert('Sign in failed', error.message)
    }
  }

  return (
    <View style={styles.authWrap}>
      <View style={styles.authCard}>
        <Text style={styles.brand}>Ironclad Reports</Text>
        <Text style={styles.authTitle}>Inspector Gadget</Text>
        <Text style={styles.authSubtitle}>Sign in with the same account you use on the website. Mobile access can be limited to approved accounts.</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          importantForAutofill="yes"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor="#999"
          returnKeyType="next"
          style={styles.input}
          textContentType="username"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          autoCorrect={false}
          importantForAutofill="yes"
          placeholder="Password"
          placeholderTextColor="#999"
          returnKeyType="done"
          style={styles.input}
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={handleSignIn}
        />

        <Pressable
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          disabled={loading}
          onPress={handleSignIn}
        >
          <Text style={styles.primaryButtonText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
        </Pressable>

        <Text style={styles.helperText}>
          {biometricSupported
            ? `${biometricLabel} will unlock the app after you sign in on this device.`
            : 'This app now supports projects, daily report detail, pour log detail, contractor evaluation detail, and weekly summaries.'}
        </Text>
      </View>
    </View>
  )
}

function LockedScreen({
  biometricLabel,
  biometricSupported,
  unlocking,
  onUnlock,
  onSignOut,
}: {
  biometricLabel: string
  biometricSupported: boolean
  unlocking: boolean
  onUnlock: () => void
  onSignOut: () => void
}) {
  return (
    <View style={styles.authWrap}>
      <View style={styles.authCard}>
        <Text style={styles.brand}>Ironclad Reports</Text>
        <Text style={styles.authTitle}>Welcome Back</Text>
        <Text style={styles.authSubtitle}>
          {biometricSupported
            ? `Use ${biometricLabel} or your device passcode to unlock the app.`
            : 'Unlock the app to continue.'}
        </Text>

        <Pressable
          style={[styles.primaryButton, unlocking && styles.buttonDisabled]}
          disabled={unlocking}
          onPress={onUnlock}
        >
          <Text style={styles.primaryButtonText}>{unlocking ? 'Unlocking…' : `Unlock with ${biometricLabel}`}</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={onSignOut}>
          <Text style={styles.secondaryButtonText}>Sign Out</Text>
        </Pressable>
      </View>
    </View>
  )
}

type ProjectsScreenProps = {
  settings: MobileSettings | null
  dashboardSummary?: {
    submitted: number
    missing: number
    inactive: number
  } | null
  projects: ProjectSummary[]
  projectsLoading: boolean
  projectsRefreshing: boolean
  projectsError: string
  userEmail: string
  onRefresh: () => void
  onOpenProject: (project: ProjectSummary) => void
  onSignOut: () => void
}

function ProjectsScreen({
  settings,
  dashboardSummary,
  projects,
  projectsLoading,
  projectsRefreshing,
  projectsError,
  userEmail,
  onRefresh,
  onOpenProject,
  onSignOut,
}: ProjectsScreenProps) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      refreshControl={<RefreshControl refreshing={projectsRefreshing} onRefresh={onRefresh} tintColor="#b44a12" />}
    >
      <View style={styles.heroCard}>
        {settings?.logo_url ? (
          <Image source={{ uri: settings.logo_url }} style={styles.heroLogo} resizeMode="contain" />
        ) : null}
        <Text style={styles.heroTitle}>Field Reports</Text>
        <Text style={styles.heroSubtitle}>{settings?.company_name || 'Ironclad Construction LLC'}</Text>
        <Text style={styles.heroMeta}>{userEmail}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Projects</Text>
        <Text style={styles.sectionHint}>Tap a project to view daily reports, pour logs, contractor evaluations, and weekly summaries.</Text>
      </View>

      {SHOW_SUBMISSION_DASHBOARD ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Today&apos;s Daily Reports</Text>
          <Text style={styles.infoCardText}>
            {dashboardSummary
              ? `${dashboardSummary.submitted} submitted · ${dashboardSummary.missing} missing`
              : 'Daily report status will appear here.'}
          </Text>
        </View>
      ) : null}

      {projectsLoading && projects.length === 0 ? (
        <View style={styles.emptyCard}>
          <ActivityIndicator size="small" color="#b44a12" />
          <Text style={styles.emptyText}>Loading projects…</Text>
        </View>
      ) : null}

      {projectsError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{projectsError}</Text>
        </View>
      ) : null}

      {!projectsLoading && projects.length === 0 && !projectsError ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No projects yet.</Text>
        </View>
      ) : null}

      {projects.map((project) => (
        <Pressable key={project.id} style={styles.projectCard} onPress={() => onOpenProject(project)}>
          <View style={styles.projectCardBody}>
            <Text style={styles.projectTitle}>{project.project_name}</Text>
            <Text style={styles.projectMeta}>
              {[project.location, project.client_name ? `Owner/Client: ${project.client_name}` : null]
                .filter(Boolean)
                .join(' · ') || 'No project details yet'}
            </Text>
            {SHOW_SUBMISSION_DASHBOARD && project.today_daily_report_status ? (
              <Text
                style={[
                  styles.projectMeta,
                  project.today_daily_report_status === 'submitted'
                    ? styles.submissionStatusGood
                    : project.today_daily_report_status === 'missing'
                      ? styles.submissionStatusBad
                      : styles.submissionStatusMuted,
                ]}
              >
                Today: {project.today_daily_report_status === 'submitted'
                  ? 'Submitted'
                  : project.today_daily_report_status === 'missing'
                    ? 'Missing'
                    : 'Inactive / Not Required'}
              </Text>
            ) : null}
          </View>
          <View style={styles.projectCardSide}>
            <Text style={[styles.statusPill, statusTone(project.status)]}>{project.status || 'unknown'}</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Pressable>
      ))}

      <Pressable style={styles.secondaryButton} onPress={onSignOut}>
        <Text style={styles.secondaryButtonText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  )
}

type ProjectDetailScreenProps = {
  session: Session
  projectId: string
  onBack: () => void
  onNewDailyReport: (projectId: string, projectName: string, quickMode: boolean) => void
  onOpenReport: (reportId: string) => void
  onNewPourLog: (projectId: string, projectName: string) => void
  onOpenPourLog: (logId: string) => void
  onOpenQaFormSelect: (projectId: string, projectName: string, enabledTypes: string[]) => void
  onOpenQaForm: (formId: string) => void
  onNewContractorEval: (projectId: string, projectName: string) => void
  onOpenContractorEval: (evalId: string) => void
  onOpenWeeklySummary: (projectName: string) => void
  onOpenProjectPhotos: (projectId: string) => void
  onOpenWeb: (title: string, path: string) => void
}

function ProjectDetailScreen({
  session,
  projectId,
  onBack,
  onNewDailyReport,
  onNewPourLog,
  onOpenReport,
  onOpenPourLog,
  onOpenQaFormSelect,
  onOpenQaForm,
  onNewContractorEval,
  onOpenContractorEval,
  onOpenWeeklySummary,
  onOpenProjectPhotos,
  onOpenWeb,
}: ProjectDetailScreenProps) {
  const [data, setData] = useState<ProjectDetail | null>(() => getCachedProjectDetail(projectId))
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = async (refresh = false) => {
    const cachedData = refresh ? null : getCachedProjectDetail(projectId)
    if (refresh) {
      setRefreshing(true)
    } else {
      setLoading(!cachedData)
    }
    if (cachedData) {
      setData(cachedData)
    }
    setError('')

    try {
      const nextData = await fetchProjectDetail(projectId, session)
      setData(nextData)
    } catch (nextError) {
      if (!cachedData) {
        setError(nextError instanceof Error ? nextError.message : 'Failed to load project.')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [projectId, session.access_token])

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#b44a12" />}
    >
      <Pressable style={styles.backLink} onPress={onBack}>
        <Text style={styles.backLinkText}>‹ Back to Projects</Text>
      </Pressable>

      {loading && !data ? (
        <View style={styles.emptyCard}>
          <ActivityIndicator size="small" color="#b44a12" />
          <Text style={styles.emptyText}>Loading project…</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {data ? (
        <>
          {(() => {
            const reportSettings = data.report_type_settings || {}
            const showDailyReports = reportTypeEnabled(reportSettings, 'daily_report')
            const showPourLogs = reportTypeEnabled(reportSettings, 'pour_log')
            const showContractorEvaluations = reportTypeEnabled(reportSettings, 'contractor_evaluation')
            const showQaForms =
              reportTypeEnabled(reportSettings, 'qa_009') ||
              reportTypeEnabled(reportSettings, 'qa_010') ||
              reportTypeEnabled(reportSettings, 'qa_011') ||
              reportTypeEnabled(reportSettings, 'qa_013')

            return (
              <>
          <View style={styles.detailHero}>
            <View style={styles.detailHeaderRow}>
              <Text style={styles.detailTitle}>{data.project.project_name}</Text>
              <Text style={[styles.statusPill, statusTone(data.project.status)]}>{data.project.status || 'unknown'}</Text>
            </View>
            <Text style={styles.detailMeta}>
              {[data.project.location, data.project.address].filter(Boolean).join(' · ') || 'No location set'}
            </Text>
            <Text style={styles.detailMeta}>
              {data.project.client_name ? `Owner/Client: ${data.project.client_name}` : 'No client set'}
            </Text>
            {data.project.client_email ? <Text style={styles.detailMeta}>{data.project.client_email}</Text> : null}
            {data.project.notes ? <Text style={styles.detailNotes}>{data.project.notes}</Text> : null}
          </View>

          <View style={styles.quickActionRow}>
            {showDailyReports ? <QuickAction
              label="+ Daily Report"
              tone="orange"
              onPress={() => onNewDailyReport(data.project.id, data.project.project_name, false)}
            /> : null}
            {showDailyReports ? <QuickAction
              label="Quick Submit"
              tone="light"
              onPress={() => onNewDailyReport(data.project.id, data.project.project_name, true)}
            /> : null}
            {showPourLogs ? <QuickAction
              label="+ Pour Log"
              tone="dark"
              onPress={() => onNewPourLog(data.project.id, data.project.project_name)}
            /> : null}
            {showContractorEvaluations ? <QuickAction
              label="+ Contractor Eval"
              tone="green"
              onPress={() => onNewContractorEval(data.project.id, data.project.project_name)}
            /> : null}
            {showQaForms ? <QuickAction
              label="+ QA Form"
              tone="blue"
              onPress={() => onOpenQaFormSelect(data.project.id, data.project.project_name, getEnabledQaFormTypes(reportSettings))}
            /> : null}
            <QuickAction
              label="Weekly Summary"
              tone="blue"
              onPress={() => onOpenWeeklySummary(data.project.project_name)}
            />
            <QuickAction
              label="Project Photos"
              tone="light"
              onPress={() => onOpenProjectPhotos(data.project.id)}
            />
          </View>

          {showDailyReports ? <SectionBlock title="Daily Reports">
            {data.reports.length === 0 ? (
              <EmptyInline text="No daily reports yet." />
            ) : (
              data.reports.map((report) => (
                <Pressable key={report.id} style={styles.summaryRow} onPress={() => onOpenReport(report.id)}>
                  <Text style={styles.summaryTitle}>{formatDate(report.report_date)}</Text>
                  <Text style={styles.summarySubtitle}>
                    {[report.submitted_by, report.crew_count != null ? `${report.crew_count} crew` : null].filter(Boolean).join(' · ')}
                  </Text>
                </Pressable>
              ))
            )}
          </SectionBlock> : null}

          {showPourLogs ? <SectionBlock title="Pour Logs">
            {data.pour_logs.length === 0 ? (
              <EmptyInline text="No pour logs yet." />
            ) : (
              data.pour_logs.map((log) => (
                <Pressable key={log.id} style={styles.summaryRow} onPress={() => onOpenPourLog(log.id)}>
                  <Text style={styles.summaryTitle}>{formatDate(log.log_date)}</Text>
                  <Text style={styles.summarySubtitle}>
                    {[log.log_type === 'flatwork' ? 'Flatwork' : 'Drilled Shaft', log.submitted_by].filter(Boolean).join(' · ')}
                  </Text>
                </Pressable>
              ))
            )}
          </SectionBlock> : null}

          {showContractorEvaluations ? <SectionBlock title="Contractor Evaluations">
            {data.contractor_evaluations.length === 0 ? (
              <EmptyInline text="No contractor evaluations yet." />
            ) : (
              data.contractor_evaluations.map((evaluation) => (
                <Pressable key={evaluation.id} style={styles.summaryRow} onPress={() => onOpenContractorEval(evaluation.id)}>
                  <Text style={styles.summaryTitle}>{formatDate(evaluation.inspection_date)}</Text>
                  <Text style={styles.summarySubtitle}>
                    {[evaluation.contractor_name || evaluation.inspector_name, evaluation.overall_rating].filter(Boolean).join(' · ')}
                  </Text>
                </Pressable>
              ))
            )}
          </SectionBlock> : null}

          {showQaForms ? <SectionBlock title="QA Forms">
            {data.qa_forms.length === 0 ? (
              <EmptyInline text="No QA forms yet." />
            ) : (
              data.qa_forms.map((form) => {
                const meta = getQaFormMeta(form.form_type)
                return (
                  <Pressable key={form.id} style={styles.summaryRow} onPress={() => onOpenQaForm(form.id)}>
                    <Text style={styles.summaryTitle}>{formatDate(form.work_date)}</Text>
                    <Text style={styles.summarySubtitle}>
                      {[meta.code, meta.label, form.submitted_by].filter(Boolean).join(' · ')}
                    </Text>
                  </Pressable>
                )
              })
            )}
          </SectionBlock> : null}
              </>
            )
          })()}
        </>
      ) : null}
    </ScrollView>
  )
}

function ReportDetailScreen({
  session,
  reportId,
  onBack,
  onEditNative,
  onOpenWeb,
}: {
  session: Session
  reportId: string
  onBack: () => void
  onEditNative: () => void
  onOpenWeb: (title: string, path: string) => void
}) {
  const [report, setReport] = useState<ReportDetail | null>(() => getCachedReportDetail(reportId))
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = async (refresh = false) => {
    const cachedReport = refresh ? null : getCachedReportDetail(reportId)
    if (refresh) {
      setRefreshing(true)
    } else {
      setLoading(!cachedReport)
    }
    if (cachedReport) {
      setReport(cachedReport)
    }
    setError('')

    try {
      const nextReport = await fetchReportDetail(reportId, session)
      setReport(nextReport)
    } catch (nextError) {
      if (!cachedReport) {
        setError(nextError instanceof Error ? nextError.message : 'Failed to load report.')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [reportId, session.access_token])

  return (
    <DetailScrollShell title="Daily Report" loading={loading} hasData={!!report} error={error} onRefresh={() => load(true)} refreshing={refreshing} onBack={onBack}>
      {report ? (
        <>
          <View style={styles.detailHero}>
            <Text style={styles.detailTitle}>{report.project_name || 'Daily Report'}</Text>
            <Text style={styles.detailMeta}>{formatDate(report.report_date)} · Submitted by {report.submitted_by || '-'}</Text>
          </View>

          <DetailCard>
            <DetailField label="Crew Count on Site" value={report.crew_count} />
            <DetailField label="Weather Conditions" value={report.weather} />
            <DetailField label="Weather Delay" value={report.weather_delay ? (report.weather_delay_hours ? `${report.weather_delay_hours} hrs lost` : 'Yes') : 'No'} />
            <DetailField label="Schedule Status" value={report.on_schedule === false ? 'Behind Schedule' : 'On Schedule'} />
            <DetailField label="Work Completed Today" value={report.work_completed} multiline />
            <DetailField label="Equipment Used" value={report.equipment_used} multiline />
            <DetailField label="Safety / Issues" value={report.safety_issues} multiline />
          </DetailCard>

          {report.photo_urls?.length ? (
            <SectionBlock title="Photos">
              <PhotoGrid photoUrls={report.photo_urls} photoLabels={report.photo_labels} />
            </SectionBlock>
          ) : null}

          <View style={styles.quickActionRow}>
            <QuickAction label="View PDF" tone="dark" onPress={() => onOpenWeb('Daily Report PDF', `/api/pdf/${report.id}`)} />
            <QuickAction label="Edit Report" tone="orange" onPress={onEditNative} />
          </View>
        </>
      ) : null}
    </DetailScrollShell>
  )
}

function PourLogDetailScreen({
  session,
  logId,
  onBack,
  onOpenWeb,
}: {
  session: Session
  logId: string
  onBack: () => void
  onOpenWeb: (title: string, path: string) => void
}) {
  const [data, setData] = useState<PourLogDetail | null>(() => getCachedPourLogDetail(logId))
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = async (refresh = false) => {
    const cachedData = refresh ? null : getCachedPourLogDetail(logId)
    if (refresh) {
      setRefreshing(true)
    } else {
      setLoading(!cachedData)
    }
    if (cachedData) {
      setData(cachedData)
    }
    setError('')

    try {
      const nextData = await fetchPourLogDetail(logId, session)
      setData(nextData)
    } catch (nextError) {
      if (!cachedData) {
        setError(nextError instanceof Error ? nextError.message : 'Failed to load pour log.')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [logId, session.access_token])

  return (
    <DetailScrollShell title="Pour Log" loading={loading} hasData={!!data} error={error} onRefresh={() => load(true)} refreshing={refreshing} onBack={onBack}>
      {data ? (
        <>
          <View style={styles.detailHero}>
            <Text style={styles.detailTitle}>{data.log.log_type === 'flatwork' ? 'Flatwork Pour Log' : 'Drilled Shaft Pour Log'}</Text>
            <Text style={styles.detailMeta}>{data.log.project_name || '-'}</Text>
            <Text style={styles.detailMeta}>{formatDate(data.log.log_date)} · Submitted by {data.log.submitted_by || '-'}</Text>
          </View>

          <View style={styles.quickActionRow}>
            <QuickAction
              label="Edit Pour Log"
              tone="orange"
              onPress={() => onOpenWeb('Edit Pour Log', getPourLogEditPath(data.log.id, data.log.log_type))}
            />
          </View>

          <DetailCard>
            <DetailField label="Concrete Supplier" value={data.log.concrete_supplier} />
            <DetailField label="Weather" value={data.log.weather} />
            <DetailField label="Ambient Temp" value={data.log.ambient_temp} />
          </DetailCard>

          <SectionBlock title="Foundations Poured">
            {data.foundations.length === 0 ? (
              <EmptyInline text="No foundations recorded." />
            ) : (
              data.foundations.map((foundation, index) => (
                <View key={index} style={styles.sectionCard}>
                  <Text style={styles.cardTitle}>{foundation.foundation_id || `Foundation ${index + 1}`}</Text>
                  <DetailField label="Design Depth" value={foundation.total_depth} compact />
                  <DetailField label="Actual Depth" value={foundation.actual_hole_depth} compact />
                  <DetailField label="Estimated Yards" value={foundation.estimated_yards} compact />
                  <DetailField label="Shaft Diameter" value={foundation.shaft_diameter} compact />
                  <DetailField label="Anchor Bolt Projection" value={foundation.anchor_bolt_projection} compact />
                  {foundation.notes ? <DetailField label="Notes" value={foundation.notes} compact multiline /> : null}
                </View>
              ))
            )}
          </SectionBlock>

          <SectionBlock title="Concrete Trucks">
            {data.trucks.length === 0 ? (
              <EmptyInline text="No trucks recorded." />
            ) : (
              data.trucks.map((truck, index) => {
                const rejected = isRejectedTruck(truck.notes)
                const leftover = getTruckEstimatedLeftover(truck.notes)
                const notes = cleanTruckNotes(truck.notes)

                return (
                  <View key={index} style={styles.sectionCard}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.cardTitle}>Truck {truck.truck_number || index + 1}</Text>
                      {rejected ? <Text style={styles.rejectedPill}>REJECTED</Text> : null}
                    </View>
                    <DetailField label="Batch Time" value={formatTime(truck.batch_time)} compact />
                    <DetailField label="Arrival Time" value={formatTime(truck.arrival_time)} compact />
                    <DetailField label="Pour Start" value={formatTime(truck.pour_start)} compact />
                    <DetailField label="Pour Complete" value={formatTime(truck.pour_complete)} compact />
                    <DetailField label="Yards" value={truck.yards} compact />
                    <DetailField label="Concrete Temp" value={truck.concrete_temp} compact />
                    <DetailField label="Slump" value={truck.slump} compact />
                    <DetailField label="Air Content" value={truck.air_content} compact />
                    <DetailField label="Water Added" value={truck.water_added} compact />
                    <DetailField label="Cylinders Cast" value={truck.cylinders_cast} compact />
                    <DetailField label="Foundations Served" value={rejected ? 'Rejected load' : truck.foundations_served} compact multiline />
                    {leftover ? <DetailField label="Estimated CY Left On Truck" value={leftover} compact /> : null}
                    {notes ? <DetailField label="Notes" value={notes} compact multiline /> : null}
                  </View>
                )
              })
            )}
          </SectionBlock>

          {data.log.photo_urls?.length ? (
            <SectionBlock title="Photos">
              <PhotoGrid photoUrls={data.log.photo_urls} photoLabels={data.log.photo_labels} />
            </SectionBlock>
          ) : null}

          <View style={styles.quickActionRow}>
            <QuickAction label="View PDF" tone="dark" onPress={() => onOpenWeb('Pour Log PDF', `/api/pour-log/pdf/${data.log.id}`)} />
            {data.log.log_type !== 'flatwork' ? (
              <QuickAction label="Volume Plot" tone="blue" onPress={() => onOpenWeb('Concrete Volume Plot', `/pour-logs/${data.log.id}/volume-plot`)} />
            ) : null}
            <QuickAction
              label="Edit Log"
              tone="orange"
              onPress={() => onOpenWeb('Edit Pour Log', getPourLogEditPath(data.log.id, data.log.log_type))}
            />
          </View>
        </>
      ) : null}
    </DetailScrollShell>
  )
}

function QaFormDetailScreen({
  session,
  formId,
  onBack,
  onOpenWeb,
}: {
  session: Session
  formId: string
  onBack: () => void
  onOpenWeb: (title: string, path: string) => void
}) {
  const [form, setForm] = useState<QaFormDetail | null>(() => getCachedQaFormDetail(formId))
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = async (refresh = false) => {
    const cachedForm = refresh ? null : getCachedQaFormDetail(formId)
    if (refresh) {
      setRefreshing(true)
    } else {
      setLoading(!cachedForm)
    }
    if (cachedForm) {
      setForm(cachedForm)
    }
    setError('')

    try {
      const nextForm = await fetchQaFormDetail(formId, session)
      setForm(nextForm)
    } catch (nextError) {
      if (!cachedForm) {
        setError(nextError instanceof Error ? nextError.message : 'Failed to load QA form.')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [formId, session.access_token])

  return (
    <DetailScrollShell title="QA Form" loading={loading} hasData={!!form} error={error} onRefresh={() => load(true)} refreshing={refreshing} onBack={onBack}>
      {form ? (
        <>
          <View style={styles.detailHero}>
            <Text style={styles.detailTitle}>{getQaFormMeta(form.form_type).title}</Text>
            <Text style={styles.detailMeta}>{form.project_name || '-'}</Text>
            <Text style={styles.detailMeta}>{formatDate(form.work_date)} · Submitted by {form.submitted_by || '-'}</Text>
          </View>

          {buildQaFormBlocks(form).map(block => (
            <SectionBlock key={block.title} title={block.title}>
              {block.rows.map(row => (
                <DetailField
                  key={row.label}
                  label={row.label}
                  value={row.value}
                  multiline={row.multiline}
                />
              ))}
            </SectionBlock>
          ))}

          {form.photo_urls?.length ? (
            <SectionBlock title="Photos">
              <PhotoGrid photoUrls={form.photo_urls} photoLabels={form.photo_labels} />
            </SectionBlock>
          ) : null}

          <View style={styles.quickActionRow}>
            <QuickAction label="View PDF" tone="dark" onPress={() => onOpenWeb('QA Form PDF', `/api/qa-form/pdf/${form.id}`)} />
            <QuickAction label="Edit QA Form" tone="orange" onPress={() => onOpenWeb('Edit QA Form', `/qa-forms/${form.id}/edit`)} />
          </View>
        </>
      ) : null}
    </DetailScrollShell>
  )
}

function ContractorEvalDetailScreen({
  session,
  evalId,
  onBack,
  onOpenWeb,
}: {
  session: Session
  evalId: string
  onBack: () => void
  onOpenWeb: (title: string, path: string) => void
}) {
  const [evaluation, setEvaluation] = useState<ContractorEvalDetail | null>(() => getCachedContractorEvalDetail(evalId))
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = async (refresh = false) => {
    const cachedEvaluation = refresh ? null : getCachedContractorEvalDetail(evalId)
    if (refresh) {
      setRefreshing(true)
    } else {
      setLoading(!cachedEvaluation)
    }
    if (cachedEvaluation) {
      setEvaluation(cachedEvaluation)
    }
    setError('')

    try {
      const nextEval = await fetchContractorEvalDetail(evalId, session)
      setEvaluation(nextEval)
    } catch (nextError) {
      if (!cachedEvaluation) {
        setError(nextError instanceof Error ? nextError.message : 'Failed to load contractor evaluation.')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [evalId, session.access_token])

  return (
    <DetailScrollShell title="Contractor Evaluation" loading={loading} hasData={!!evaluation} error={error} onRefresh={() => load(true)} refreshing={refreshing} onBack={onBack}>
      {evaluation ? (
        <>
          <View style={styles.detailHero}>
            <Text style={styles.detailTitle}>Contractor Evaluation</Text>
            <Text style={styles.detailMeta}>{evaluation.project_name || '-'}</Text>
            <Text style={styles.detailMeta}>{formatDate(evaluation.inspection_date)}</Text>
          </View>

          <DetailCard>
            <DetailField label="Inspector" value={evaluation.inspector_name} />
            <DetailField label="Inspection Location" value={evaluation.inspection_location} />
            <DetailField label="Contractor" value={evaluation.contractor_name} />
            <DetailField label="Supervisor" value={evaluation.supervisor_name} />
          </DetailCard>

          <EvaluationSection title="Safety Compliance">
            <DetailField label="Workers wearing appropriate PPE?" value={formatBoolean(evaluation.ppe_compliant)} compact />
            <DetailField label="Safety signs and barriers in place?" value={formatBoolean(evaluation.safety_signs)} compact />
            <DetailField label="Emergency procedures communicated?" value={formatBoolean(evaluation.emergency_procedures)} compact />
            {evaluation.safety_comments ? <DetailField label="Comments" value={evaluation.safety_comments} compact multiline /> : null}
          </EvaluationSection>

          <EvaluationSection title="Work Quality">
            <DetailField label="Work performed to project specifications?" value={formatBoolean(evaluation.work_specs)} compact />
            <DetailField label="Materials and equipment acceptable quality?" value={formatBoolean(evaluation.materials_quality)} compact />
            <DetailField label="Workmanship neat and professional?" value={formatBoolean(evaluation.workmanship)} compact />
            {evaluation.work_quality_comments ? <DetailField label="Comments" value={evaluation.work_quality_comments} compact multiline /> : null}
          </EvaluationSection>

          <EvaluationSection title="Timeliness">
            <DetailField label="Project on schedule?" value={formatBoolean(evaluation.on_schedule)} compact />
            <DetailField label="Milestones being met?" value={formatBoolean(evaluation.milestones_met)} compact />
            {evaluation.timeliness_comments ? <DetailField label="Comments" value={evaluation.timeliness_comments} compact multiline /> : null}
          </EvaluationSection>

          <EvaluationSection title="Communication">
            <DetailField label="Contractor responsive to inquiries?" value={formatBoolean(evaluation.contractor_responsive)} compact />
            <DetailField label="Progress reports provided regularly?" value={formatBoolean(evaluation.progress_reports)} compact />
            {evaluation.communication_comments ? <DetailField label="Comments" value={evaluation.communication_comments} compact multiline /> : null}
          </EvaluationSection>

          <EvaluationSection title="Compliance with Regulations">
            <DetailField label="Adhering to regulations?" value={formatBoolean(evaluation.regulations_compliant)} compact />
            <DetailField label="Permits and licenses current?" value={formatBoolean(evaluation.permits_current)} compact />
            {evaluation.compliance_comments ? <DetailField label="Comments" value={evaluation.compliance_comments} compact multiline /> : null}
          </EvaluationSection>

          <EvaluationSection title="Environmental Considerations">
            <DetailField label="Minimizing environmental impact?" value={formatBoolean(evaluation.env_impact_minimized)} compact />
            <DetailField label="Waste disposed of properly?" value={formatBoolean(evaluation.waste_disposal)} compact />
            {evaluation.environmental_comments ? <DetailField label="Comments" value={evaluation.environmental_comments} compact multiline /> : null}
          </EvaluationSection>

          <EvaluationSection title="Overall Evaluation">
            <DetailField label="Overall Rating" value={evaluation.overall_rating} compact />
            {evaluation.overall_comments ? <DetailField label="Comments" value={evaluation.overall_comments} compact multiline /> : null}
            {(evaluation.inspector_signature || evaluation.signature_date) ? (
              <>
                <DetailField label="Inspector Signature" value={evaluation.inspector_signature} compact />
                <DetailField label="Signature Date" value={formatDate(evaluation.signature_date)} compact />
              </>
            ) : null}
          </EvaluationSection>

          <View style={styles.quickActionRow}>
            <QuickAction label="View PDF" tone="dark" onPress={() => onOpenWeb('Contractor Eval PDF', `/api/contractor-eval/pdf/${evaluation.id}`)} />
            <QuickAction label="Edit Evaluation" tone="green" onPress={() => onOpenWeb('Edit Contractor Evaluation', `/contractor-evals/${evaluation.id}/edit`)} />
          </View>
        </>
      ) : null}
    </DetailScrollShell>
  )
}

function WeeklySummaryScreen({
  session,
  projectId,
  projectName,
  onBack,
  onOpenWeb,
}: {
  session: Session
  projectId: string
  projectName: string
  onBack: () => void
  onOpenWeb: (title: string, path: string) => void
}) {
  const [weekOffset, setWeekOffset] = useState(0)
  const bounds = getWeekBounds(weekOffset)
  const [data, setData] = useState<WeeklySummaryData | null>(() =>
    getCachedWeeklySummary(projectId, bounds.start, bounds.end)
  )
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = async (refresh = false) => {
    const cachedData = refresh ? null : getCachedWeeklySummary(projectId, bounds.start, bounds.end)
    if (refresh) {
      setRefreshing(true)
    } else {
      setLoading(!cachedData)
    }
    if (cachedData) {
      setData(cachedData)
    }
    setError('')

    try {
      const nextData = await fetchWeeklySummary(projectId, bounds.start, bounds.end, session)
      setData(nextData)
    } catch (nextError) {
      if (!cachedData) {
        setError(nextError instanceof Error ? nextError.message : 'Failed to generate weekly summary.')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [projectId, session.access_token, weekOffset])

  return (
    <DetailScrollShell title="Weekly Summary" loading={loading} hasData={!!data} error={error} onRefresh={() => load(true)} refreshing={refreshing} onBack={onBack}>
      <View style={styles.detailHero}>
        <Text style={styles.detailTitle}>Weekly Summary</Text>
        <Text style={styles.detailMeta}>{projectName}</Text>
        <Text style={styles.detailMeta}>{formatDate(bounds.start)} to {formatDate(bounds.end)}</Text>
      </View>

      <View style={styles.weekNavCard}>
        <Pressable style={[styles.weekNavButton, weekOffset >= 0 && styles.buttonDisabled]} disabled={weekOffset >= 0} onPress={() => setWeekOffset((value) => value + 1)}>
          <Text style={styles.weekNavButtonText}>Newer</Text>
        </Pressable>
        <Text style={styles.weekNavRange}>{formatDate(bounds.start)} - {formatDate(bounds.end)}</Text>
        <Pressable style={styles.weekNavButton} onPress={() => setWeekOffset((value) => value - 1)}>
          <Text style={styles.weekNavButtonText}>Older</Text>
        </Pressable>
      </View>

      {data ? (
        <>
          <DetailCard>
            <DetailField
              label="Status"
              value={
                data.source === 'saved'
                  ? 'Saved weekly report'
                  : data.source === 'generated'
                    ? 'Auto-filled from daily reports'
                    : 'Blank weekly report'
              }
              compact
            />
            <DetailField
              label="Source Reports"
              value={`${data.reports.length} daily report${data.reports.length === 1 ? '' : 's'}`}
              compact
            />
            {data.summary ? (
              <DetailField label="Summary" value={data.summary} multiline />
            ) : (
              <DetailField
                label="Summary"
                value="This weekly report is currently blank. Open the website tools to auto-fill from daily reports or write and save it manually."
                multiline
              />
            )}
          </DetailCard>

          {data.reports.length > 0 ? (
            <SectionBlock title="Included Reports">
              {data.reports.map((report, index) => (
                <View key={index} style={styles.summaryRow}>
                  <Text style={styles.summaryTitle}>{formatDate(report.report_date)}</Text>
                  <Text style={styles.summarySubtitle}>
                    {[report.submitted_by, report.crew_count != null ? `${report.crew_count} crew` : null, report.weather].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              ))}
            </SectionBlock>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No daily reports are attached to this week yet. You can still create a manual weekly report.</Text>
            </View>
          )}
        </>
      ) : null}

      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>PDF Export</Text>
        <Text style={styles.infoCardText}>
          The native app can review the weekly report here. If you need the manual editing, auto-fill, save, and PDF tools, open the website version below.
        </Text>
      </View>

      <View style={styles.quickActionRow}>
        <QuickAction label="Open Website Weekly Report" tone="blue" onPress={() => onOpenWeb('Weekly Summary Tools', `/projects/${projectId}/weekly-summary`)} />
      </View>
    </DetailScrollShell>
  )
}

function AppHeader({
  title,
  showProjectsButton,
  onProjectsPress,
}: {
  title: string
  showProjectsButton: boolean
  onProjectsPress: () => void
}) {
  return (
    <View style={styles.appHeader}>
      <View style={styles.appHeaderBrandBlock}>
        <Text style={styles.appHeaderBrand}>Inspector Gadget</Text>
        <Text style={styles.appHeaderTitle}>{title}</Text>
      </View>
      {showProjectsButton ? (
        <Pressable style={styles.appHeaderButton} onPress={onProjectsPress}>
          <Text style={styles.appHeaderButtonText}>Projects</Text>
        </Pressable>
      ) : (
        <View style={styles.appHeaderSpacer} />
      )}
    </View>
  )
}

function WebScreen({
  session,
  title,
  path,
  onBack,
}: {
  session: Session
  title: string
  path: string
  onBack: () => void
}) {
  const cacheBustRef = useRef(`${Date.now()}`)
  const pathWithVersion = useMemo(() => {
    const separator = path.includes('?') ? '&' : '?'
    return `${path}${separator}mobile_v=${cacheBustRef.current}`
  }, [path])
  const bridgeUrl = buildWebUrl(`/api/mobile/web-auth-bridge?redirect=${encodeURIComponent(pathWithVersion)}`)

  return (
    <View style={styles.webScreenWrap}>
      <View style={styles.webScreenBar}>
        <Pressable style={styles.webScreenBack} onPress={onBack}>
          <Text style={styles.webScreenBackText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.webScreenTitle}>{title}</Text>
        <View style={styles.webScreenBack} />
      </View>
      <WebView
        key={bridgeUrl}
        source={{
          uri: bridgeUrl,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'x-refresh-token': session.refresh_token || '',
          },
        }}
        style={styles.webView}
      />
    </View>
  )
}

function DetailScrollShell({
  title,
  loading,
  hasData,
  error,
  onRefresh,
  refreshing,
  onBack,
  children,
}: {
  title: string
  loading: boolean
  hasData: boolean
  error: string
  onRefresh: () => void
  refreshing: boolean
  onBack: () => void
  children: React.ReactNode
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#b44a12" />}
    >
      <Pressable style={styles.backLink} onPress={onBack}>
        <Text style={styles.backLinkText}>‹ Back</Text>
      </Pressable>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>

      {loading && !hasData ? (
        <View style={styles.emptyCard}>
          <ActivityIndicator size="small" color="#b44a12" />
          <Text style={styles.emptyText}>Loading…</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {children}
    </ScrollView>
  )
}

function QuickAction({
  label,
  onPress,
  tone = 'orange',
}: {
  label: string
  onPress: () => void
  tone?: 'orange' | 'dark' | 'green' | 'blue' | 'light'
}) {
  return (
    <Pressable style={[styles.quickActionButton, quickActionToneStyles[tone].button]} onPress={onPress}>
      <Text style={[styles.quickActionText, quickActionToneStyles[tone].text]}>{label}</Text>
    </Pressable>
  )
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionBlockTitle}>{title}</Text>
      {children}
    </View>
  )
}

function EvaluationSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  )
}

function DetailCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.sectionCard}>{children}</View>
}

function DetailField({
  label,
  value,
  multiline = false,
  compact = false,
}: {
  label: string
  value: unknown
  multiline?: boolean
  compact?: boolean
}) {
  return (
    <View style={[styles.fieldRow, compact && styles.fieldRowCompact]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={[styles.fieldValue, multiline && styles.fieldValueMultiline]}>{asText(value) || '-'}</Text>
    </View>
  )
}

function PhotoGrid({
  photoUrls,
  photoLabels,
}: {
  photoUrls: string[]
  photoLabels?: string[] | null
}) {
  return (
    <View style={styles.photoGrid}>
      {photoUrls.map((url, index) => (
        <View key={`${url}-${index}`} style={styles.photoCard}>
          <Image source={{ uri: url }} style={styles.photoImage} resizeMode="cover" />
          {photoLabels?.[index] ? <Text style={styles.photoLabel}>{photoLabels[index]}</Text> : null}
        </View>
      ))}
    </View>
  )
}

function EmptyInline({ text }: { text: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summarySubtitle}>{text}</Text>
    </View>
  )
}

const quickActionToneStyles = {
  orange: {
    button: { backgroundColor: '#cc3300' },
    text: { color: '#fff' },
  },
  dark: {
    button: { backgroundColor: '#1a1a1a' },
    text: { color: '#fff' },
  },
  green: {
    button: { backgroundColor: '#2a7a2a' },
    text: { color: '#fff' },
  },
  blue: {
    button: { backgroundColor: '#1a4a7a' },
    text: { color: '#fff' },
  },
  light: {
    button: {
      backgroundColor: '#fff',
      borderWidth: 2,
      borderColor: '#e2ddd6',
    },
    text: { color: '#1a1a1a' },
  },
} as const

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: '#f3efe8',
  },
  appHeader: {
    backgroundColor: '#143a52',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#0f2d40',
  },
  appHeaderBrandBlock: {
    flex: 1,
    paddingRight: 12,
  },
  appHeaderBrand: {
    color: '#cfe0eb',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  appHeaderTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  appHeaderButton: {
    backgroundColor: '#cc3300',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  appHeaderButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  appHeaderSpacer: {
    width: 40,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3efe8',
    gap: 12,
  },
  loadingText: {
    color: '#4a4a4a',
    fontSize: 16,
  },
  authWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#efe8df',
  },
  authCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  brand: {
    color: '#b44a12',
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  authTitle: {
    color: '#181716',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 6,
  },
  authSubtitle: {
    color: '#6d6862',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  label: {
    color: '#383431',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d8d0c7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#faf8f5',
    fontSize: 16,
    color: '#1a1a1a',
  },
  primaryButton: {
    marginTop: 18,
    backgroundColor: '#b44a12',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d9cfc4',
    backgroundColor: '#fff',
  },
  secondaryButtonText: {
    color: '#5e554d',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  helperText: {
    marginTop: 16,
    fontSize: 13,
    lineHeight: 19,
    color: '#756d65',
  },
  screen: {
    flex: 1,
  },
  screenContent: {
    padding: 18,
    paddingBottom: 36,
  },
  heroCard: {
    backgroundColor: '#143a52',
    borderRadius: 24,
    padding: 22,
    marginBottom: 18,
  },
  heroLogo: {
    width: 120,
    height: 48,
    marginBottom: 12,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 6,
  },
  heroSubtitle: {
    color: '#d7e5ef',
    fontSize: 15,
    marginBottom: 6,
  },
  heroMeta: {
    color: '#abc4d4',
    fontSize: 13,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#1d1c1b',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionHint: {
    color: '#6e675f',
    fontSize: 14,
    lineHeight: 20,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 10,
  },
  emptyText: {
    color: '#6b655d',
    fontSize: 15,
  },
  errorCard: {
    backgroundColor: '#fff0ee',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },
  errorText: {
    color: '#a12400',
    fontSize: 14,
    lineHeight: 20,
  },
  projectCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  projectCardBody: {
    flex: 1,
    paddingRight: 12,
  },
  projectTitle: {
    color: '#1d1c1b',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  projectMeta: {
    color: '#6d665f',
    fontSize: 14,
    lineHeight: 20,
  },
  submissionStatusGood: {
    color: '#286a33',
    fontWeight: '700',
    marginTop: 8,
  },
  submissionStatusBad: {
    color: '#b42318',
    fontWeight: '700',
    marginTop: 8,
  },
  submissionStatusMuted: {
    color: '#7a726a',
    fontWeight: '700',
    marginTop: 8,
  },
  projectCardSide: {
    alignItems: 'flex-end',
    gap: 10,
  },
  statusPill: {
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusPillActive: {
    backgroundColor: '#e4f5e5',
    color: '#286a33',
  },
  statusPillMuted: {
    backgroundColor: '#ece7e1',
    color: '#625a52',
  },
  chevron: {
    color: '#b44a12',
    fontSize: 26,
    fontWeight: '400',
  },
  backLink: {
    marginBottom: 12,
    paddingVertical: 6,
  },
  backLinkText: {
    color: '#b44a12',
    fontSize: 15,
    fontWeight: '700',
  },
  detailHero: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  detailTitle: {
    flex: 1,
    color: '#1c1b19',
    fontSize: 24,
    fontWeight: '800',
  },
  detailMeta: {
    color: '#6d665f',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  detailNotes: {
    marginTop: 10,
    color: '#3e3935',
    fontSize: 14,
    lineHeight: 22,
  },
  infoCard: {
    backgroundColor: '#fff8ee',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#f0dcc0',
  },
  infoCardTitle: {
    color: '#8a4a00',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoCardText: {
    color: '#72583b',
    fontSize: 14,
    lineHeight: 20,
  },
  quickActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  quickActionButton: {
    flexGrow: 1,
    minWidth: 140,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '800',
  },
  webScreenWrap: {
    flex: 1,
    backgroundColor: '#f3efe8',
  },
  webScreenBar: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  webScreenBack: {
    minWidth: 64,
  },
  webScreenBackText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  webScreenTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    paddingHorizontal: 8,
  },
  webView: {
    flex: 1,
    backgroundColor: '#fff',
  },
  sectionBlock: {
    marginBottom: 18,
  },
  sectionBlockTitle: {
    color: '#1d1c1b',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  summaryRow: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  summaryTitle: {
    color: '#1d1c1b',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  summarySubtitle: {
    color: '#6b655d',
    fontSize: 14,
    lineHeight: 20,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  cardTitle: {
    color: '#1d1c1b',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  rejectedPill: {
    backgroundColor: '#7a1212',
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  fieldRow: {
    marginBottom: 12,
  },
  fieldRowCompact: {
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#897e73',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  fieldValue: {
    fontSize: 15,
    color: '#1d1c1b',
    lineHeight: 21,
  },
  fieldValueMultiline: {
    lineHeight: 23,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#ddd',
  },
  photoLabel: {
    fontSize: 12,
    color: '#5b554f',
    lineHeight: 18,
    padding: 10,
  },
  weekNavCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  weekNavButton: {
    backgroundColor: '#143a52',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  weekNavButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  weekNavRange: {
    flex: 1,
    textAlign: 'center',
    color: '#1d1c1b',
    fontWeight: '700',
    fontSize: 14,
  },
})
