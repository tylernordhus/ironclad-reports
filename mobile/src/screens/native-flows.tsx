import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import * as ImagePicker from 'expo-image-picker'
import type { Session } from '@supabase/supabase-js'
import {
  buildWebUrl,
  createContractorEvaluation,
  createDailyReport,
  createPourLog,
  createQaForm,
  fetchLatestReportSummary,
  fetchProjectPhotoGallery,
  fetchQaFormDefinition,
  fetchReportDetail,
  type ProjectPhotoGallery,
  type QaFormDefinition,
  type ReportDetail,
  type UploadPhotoFile,
  updateDailyReport,
  uploadPhotos,
} from '../lib/api'

function asText(value: unknown) {
  return value == null ? '' : String(value)
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '-'
  const [year, month, day] = dateStr.split('-')
  return month && day && year ? `${month}-${day}-${year}` : dateStr
}

function optionKey(label: string) {
  return String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function getByPath(source: any, path: string, fallback: any = '') {
  const parts = String(path || '').split('.').filter(Boolean)
  let cursor = source

  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object' || !(part in cursor)) {
      return fallback
    }
    cursor = cursor[part]
  }

  return cursor == null ? fallback : cursor
}

function cloneWithPath(source: any, path: string, value: any) {
  const next = Array.isArray(source) ? [...source] : { ...source }
  const parts = String(path || '').split('.').filter(Boolean)
  if (!parts.length) return next

  let cursor = next
  let original = source
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index]
    const originalChild = original && typeof original === 'object' ? original[part] : undefined
    const child = Array.isArray(originalChild)
      ? [...originalChild]
      : (originalChild && typeof originalChild === 'object')
        ? { ...originalChild }
        : {}
    cursor[part] = child
    cursor = child
    original = originalChild
  }

  cursor[parts[parts.length - 1]] = value
  return next
}

function createInitialQaFormData(definition: QaFormDefinition) {
  const data: Record<string, any> = {}

  for (const section of definition.sections) {
    if (section.kind === 'fields') {
      section.fields.forEach((field) => {
        cloneAssign(data, field.path, field.type === 'checkbox' ? false : '')
      })
      continue
    }

    if (section.kind === 'checkbox_group') {
      const group: Record<string, boolean> = {}
      section.options.forEach((label) => {
        group[optionKey(label)] = false
      })
      cloneAssign(data, section.path, group)
      continue
    }

    if (section.kind === 'tri_state_list') {
      const group: Record<string, { status: string; remarks?: string }> = {}
      section.items.forEach((label) => {
        group[optionKey(label)] = section.includeRemarks ? { status: '', remarks: '' } : { status: '' }
      })
      cloneAssign(data, section.path, group)
      continue
    }

    if (section.kind === 'tri_state_matrix') {
      const matrix: Record<string, Record<string, string>> = {}
      section.rows.forEach((rowLabel) => {
        matrix[optionKey(rowLabel)] = {}
        section.columns.forEach((columnLabel) => {
          matrix[optionKey(rowLabel)][optionKey(columnLabel)] = ''
        })
      })
      cloneAssign(data, section.path, matrix)
      continue
    }

    if (section.kind === 'table') {
      const rows: Array<Record<string, any>> = []
      const rowCount = section.rowLabels?.length || section.rowCount || 0
      for (let index = 0; index < rowCount; index += 1) {
        const row: Record<string, any> = {}
        section.columns.forEach((column) => {
          row[column.key] = column.type === 'checkbox' ? false : ''
        })
        rows.push(row)
      }
      cloneAssign(data, section.path, rows)
    }
  }

  return data
}

function cloneAssign(target: Record<string, any>, path: string, value: any) {
  const parts = String(path || '').split('.').filter(Boolean)
  if (!parts.length) return

  let cursor = target
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index]
    if (typeof cursor[part] !== 'object' || cursor[part] === null || Array.isArray(cursor[part])) {
      cursor[part] = {}
    }
    cursor = cursor[part]
  }
  cursor[parts[parts.length - 1]] = value
}

function buildTruckNotes(notes: string, rejected: boolean, estimatedLeftover = '') {
  const markers = []
  if (rejected) markers.push('[REJECTED]')
  if (estimatedLeftover) markers.push(`[LEFTOVER=${estimatedLeftover}]`)
  const clean = asText(notes).replace(/\[LEFTOVER=([^\]]+)\]/g, '').replace('[REJECTED]', '').trim()
  return [...markers, clean].filter(Boolean).join(' ').trim()
}

function formatTruckFoundations(foundationsServed: string[] = [], shaftDepths: Record<string, string> = {}, rejected = false) {
  if (rejected) return ''
  return foundationsServed.map((foundationId) => {
    const depth = shaftDepths[foundationId]
    return depth ? `${foundationId} (${depth})` : foundationId
  }).join(', ')
}

function getToday() {
  return new Date().toISOString().split('T')[0]
}

function createInitialDrilledShaftFoundation() {
  return {
    foundation_id: '',
    total_depth: '',
    actual_hole_depth: '',
    estimated_yards: '',
    shaft_diameter: '',
    anchor_bolt_projection: '',
    notes: '',
  }
}

function createInitialDrilledShaftTruck(truckNumber = '') {
  return {
    truck_number: truckNumber,
    batch_time: '',
    arrival_time: '',
    pour_start: '',
    pour_complete: '',
    yards: '',
    concrete_temp: '',
    slump: '',
    air_content: '',
    water_added: '',
    cylinders_cast: '',
    notes: '',
    foundations_served: [] as string[],
    shaft_depths: {} as Record<string, string>,
    rejected: false,
    estimated_leftover_yards: '',
  }
}

function createInitialFlatworkSection() {
  return { section_type: 'Slab', foundation_id: '', square_footage: '', total_depth: '', estimated_yards: '', notes: '' }
}

function createInitialFlatworkTruck(truckNumber = '') {
  return {
    truck_number: truckNumber,
    batch_time: '',
    arrival_time: '',
    pour_start: '',
    pour_complete: '',
    yards: '',
    concrete_temp: '',
    slump: '',
    air_content: '',
    water_added: '',
    cylinders_cast: '',
    notes: '',
  }
}

type DraftStatus = 'Saved' | 'Saving' | 'Draft saved' | 'Unsaved changes'

function getLocalDraft(key: string) {
  try {
    const storage = globalThis.localStorage
    if (!storage) return null
    const raw = storage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function setLocalDraft(key: string, value: unknown) {
  try {
    const storage = globalThis.localStorage
    if (!storage) return false
    const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    storage.setItem(key, JSON.stringify({ ...record, savedAt: Date.now() }))
    return true
  } catch {
    return false
  }
}

function clearLocalDraft(key: string) {
  try {
    globalThis.localStorage?.removeItem(key)
  } catch {}
}

function restoreUploadPhotos(value: unknown): UploadPhotoFile[] {
  return Array.isArray(value)
    ? value
      .filter((photo) => photo && typeof photo === 'object' && typeof photo.uri === 'string' && photo.uri)
      .map((photo: any) => ({
        uri: photo.uri,
        name: asText(photo.name) || 'pour-log-photo.jpg',
        type: asText(photo.type) || 'image/jpeg',
      }))
    : []
}

function GuardedBackLink({
  hasUnsavedChanges,
  onBack,
}: {
  hasUnsavedChanges: boolean
  onBack: () => void
}) {
  function handleBack() {
    if (!hasUnsavedChanges) {
      onBack()
      return
    }

    Alert.alert(
      'Unsaved changes',
      'Your latest changes have not finished saving as a local draft yet.',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: onBack },
      ]
    )
  }

  return (
    <Pressable style={flowStyles.backLink} onPress={handleBack}>
      <Text style={flowStyles.backLinkText}>‹ Back</Text>
    </Pressable>
  )
}

function DraftStatusPill({ status }: { status: DraftStatus }) {
  return (
    <View style={flowStyles.draftStatusPill}>
      <Text style={flowStyles.draftStatusText}>{status}</Text>
    </View>
  )
}

function getTruckSummary(truck: Record<string, any>, index: number) {
  const label = `Truck ${index + 1}`
  const details = [
    truck.truck_number ? `ID ${truck.truck_number}` : 'No truck ID',
    truck.yards ? `${truck.yards} yd` : '',
    truck.arrival_time ? `Arr ${formatTimeLabel(truck.arrival_time)}` : '',
    truck.pour_complete ? `Done ${formatTimeLabel(truck.pour_complete)}` : '',
    truck.rejected ? 'Rejected' : '',
  ].filter(Boolean)
  return { label, details: details.join(' · ') || 'No truck data entered yet' }
}

function TruckSummaryCard({
  truck,
  index,
  onPress,
}: {
  truck: Record<string, any>
  index: number
  onPress: () => void
}) {
  const summary = getTruckSummary(truck, index)
  return (
    <Pressable style={flowStyles.truckSummaryCard} onPress={onPress}>
      <View style={flowStyles.truckSummaryMain}>
        <Text style={flowStyles.truckSummaryTitle}>{summary.label}</Text>
        <Text style={flowStyles.truckSummaryText}>{summary.details}</Text>
      </View>
      <Text style={flowStyles.truckSummaryAction}>Edit</Text>
    </Pressable>
  )
}

function FoundationSummaryCard({
  foundation,
  index,
  onPress,
}: {
  foundation: Record<string, any>
  index: number
  onPress: () => void
}) {
  const details = [
    foundation.foundation_id || 'No shaft ID',
    foundation.actual_hole_depth ? `Actual ${foundation.actual_hole_depth}` : '',
    foundation.total_depth ? `Design ${foundation.total_depth}` : '',
    foundation.estimated_yards ? `${foundation.estimated_yards} yd` : '',
  ].filter(Boolean)

  return (
    <Pressable style={flowStyles.truckSummaryCard} onPress={onPress}>
      <View style={flowStyles.truckSummaryMain}>
        <Text style={flowStyles.truckSummaryTitle}>Foundation {index + 1}</Text>
        <Text style={flowStyles.truckSummaryText}>{details.join(' · ') || 'No foundation data entered yet'}</Text>
      </View>
      <Text style={flowStyles.truckSummaryAction}>Edit</Text>
    </Pressable>
  )
}

function FlatworkSectionSummaryCard({
  section,
  index,
  onPress,
}: {
  section: Record<string, any>
  index: number
  onPress: () => void
}) {
  const details = [
    section.foundation_id || 'No area name',
    section.section_type || '',
    section.total_depth ? `Depth ${section.total_depth}` : '',
    section.estimated_yards ? `${section.estimated_yards} yd` : '',
  ].filter(Boolean)

  return (
    <Pressable style={flowStyles.truckSummaryCard} onPress={onPress}>
      <View style={flowStyles.truckSummaryMain}>
        <Text style={flowStyles.truckSummaryTitle}>Section {index + 1}</Text>
        <Text style={flowStyles.truckSummaryText}>{details.join(' · ') || 'No section data entered yet'}</Text>
      </View>
      <Text style={flowStyles.truckSummaryAction}>Edit</Text>
    </Pressable>
  )
}

function getNowTimeValue() {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function timeValueToDate(value: string | null | undefined) {
  const date = new Date()
  const text = asText(value)
  if (!text.includes(':')) return date
  const [hourText, minuteText] = text.split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return date
  date.setHours(hour, minute, 0, 0)
  return date
}

function dateToTimeValue(date: Date) {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function formatTimeLabel(value: string | null | undefined) {
  const text = asText(value)
  if (!text.includes(':')) return 'Select Time'
  const [hourText, minute] = text.split(':')
  const hour = Number(hourText)
  if (Number.isNaN(hour) || !minute) return text
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${minute} ${suffix}`
}

function createPhotoName(asset: ImagePicker.ImagePickerAsset, prefix: string) {
  if (asset.fileName) return asset.fileName
  const extension = asset.mimeType?.split('/')[1] || 'jpg'
  return `${prefix}-${Date.now()}.${extension}`
}

function mapPickedAssets(assets: ImagePicker.ImagePickerAsset[], prefix: string): UploadPhotoFile[] {
  return assets
    .filter((asset) => typeof asset.uri === 'string' && asset.uri)
    .map((asset) => ({
      uri: asset.uri,
      name: createPhotoName(asset, prefix),
      type: asset.mimeType || 'image/jpeg',
    }))
}

function PhotoAttachmentsSection({
  photos,
  onPickLibrary,
  onPickCamera,
  onRemove,
  busy = false,
}: {
  photos: UploadPhotoFile[]
  onPickLibrary: () => void
  onPickCamera: () => void
  onRemove: (index: number) => void
  busy?: boolean
}) {
  return (
    <Section title="Photos">
      <Text style={flowStyles.mutedText}>Add jobsite photos now and they will save with the pour log.</Text>
      <View style={flowStyles.choiceRow}>
        <Pressable style={[flowStyles.secondaryButton, flowStyles.actionButton, busy && flowStyles.buttonDisabled]} onPress={onPickCamera} disabled={busy}>
          <Text style={flowStyles.secondaryButtonText}>Take Photo</Text>
        </Pressable>
        <Pressable style={[flowStyles.secondaryButton, flowStyles.actionButton, busy && flowStyles.buttonDisabled]} onPress={onPickLibrary} disabled={busy}>
          <Text style={flowStyles.secondaryButtonText}>Choose Photos</Text>
        </Pressable>
      </View>

      {photos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={flowStyles.photoPickerRow}>
          {photos.map((photo, index) => (
            <View key={`${photo.uri}-${index}`} style={flowStyles.selectedPhotoCard}>
              <Image source={{ uri: photo.uri }} style={flowStyles.selectedPhotoImage} resizeMode="cover" />
              <Text style={flowStyles.selectedPhotoName} numberOfLines={1}>{photo.name}</Text>
              <Pressable style={flowStyles.removeChip} onPress={() => onRemove(index)}>
                <Text style={flowStyles.removeChipText}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={flowStyles.infoCardMuted}>
          <Text style={flowStyles.infoCardText}>No photos attached yet.</Text>
        </View>
      )}
    </Section>
  )
}

function TimeSelectorField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [showPicker, setShowPicker] = useState(false)

  function handlePickerChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS !== 'ios') {
      setShowPicker(false)
    }
    if (event.type === 'dismissed' || !selectedDate) return
    onChange(dateToTimeValue(selectedDate))
  }

  return (
    <View>
      <View style={flowStyles.timeControlRow}>
        <Pressable style={[flowStyles.input, flowStyles.timeValueButton]} onPress={() => setShowPicker(true)}>
          <Text style={[flowStyles.timeValueText, !value && flowStyles.timeValuePlaceholder]}>
            {formatTimeLabel(value)}
          </Text>
        </Pressable>
        <Pressable style={flowStyles.secondaryButton} onPress={() => onChange(getNowTimeValue())}>
          <Text style={flowStyles.secondaryButtonText}>Now</Text>
        </Pressable>
        <Pressable style={flowStyles.secondaryButton} onPress={() => onChange('')}>
          <Text style={flowStyles.secondaryButtonText}>Clear</Text>
        </Pressable>
      </View>

      {showPicker ? (
        <View style={flowStyles.timePickerWrap}>
          <DateTimePicker
            value={timeValueToDate(value)}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handlePickerChange}
          />
          {Platform.OS === 'ios' ? (
            <Pressable style={flowStyles.secondaryButton} onPress={() => setShowPicker(false)}>
              <Text style={flowStyles.secondaryButtonText}>Done</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function BooleanChoice({
  value,
  onChange,
  options = [
    { label: 'Yes', value: true },
    { label: 'No', value: false },
  ],
}: {
  value: boolean | string | null
  onChange: (value: any) => void
  options?: Array<{ label: string; value: any }>
}) {
  return (
    <View style={flowStyles.choiceRow}>
      {options.map((option) => {
        const active = value === option.value
        return (
          <Pressable
            key={option.label}
            style={[flowStyles.choiceButton, active && flowStyles.choiceButtonActive]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[flowStyles.choiceButtonText, active && flowStyles.choiceButtonTextActive]}>{option.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <View style={flowStyles.field}>
      <Text style={flowStyles.label}>{label}</Text>
      {children}
    </View>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <View style={flowStyles.sectionCard}>
      <Text style={flowStyles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

export function NativeDailyReportScreen({
  session,
  projectId,
  projectName,
  quickMode,
  onBack,
  onCreated,
}: {
  session: Session
  projectId: string
  projectName: string
  quickMode: boolean
  onBack: () => void
  onCreated: (reportId: string) => void
}) {
  const [reportDate, setReportDate] = useState(getToday())
  const [crewCount, setCrewCount] = useState('')
  const [workCompleted, setWorkCompleted] = useState('')
  const [equipmentUsed, setEquipmentUsed] = useState('')
  const [safetyIssues, setSafetyIssues] = useState(quickMode ? 'None reported.' : '')
  const [weather, setWeather] = useState('')
  const [submittedBy, setSubmittedBy] = useState('')
  const [weatherDelay, setWeatherDelay] = useState(false)
  const [weatherDelayHours, setWeatherDelayHours] = useState('')
  const [onSchedule, setOnSchedule] = useState(true)
  const [loadingPrefill, setLoadingPrefill] = useState(false)
  const [prefillNote, setPrefillNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadPrefill() {
    setLoadingPrefill(true)
    setPrefillNote('')
    try {
      const [latest, weatherResponse] = await Promise.all([
        fetchLatestReportSummary(projectId, reportDate, session),
        fetch(buildWebUrl(`/api/weather/${projectId}?date=${reportDate}`)).then((response) => response.json()).catch(() => ({ weather: null, source: null })),
      ])

      const previous = latest.report
      if (previous?.crew_count != null && !crewCount) setCrewCount(String(previous.crew_count))
      if (previous?.equipment_used && !equipmentUsed) setEquipmentUsed(previous.equipment_used)
      if (previous?.submitted_by && !submittedBy) setSubmittedBy(previous.submitted_by)
      if (weatherResponse?.weather && !weather) setWeather(weatherResponse.weather)

      const parts = []
      if (previous?.report_date) parts.push(`Crew pulled from ${previous.report_date}`)
      if (weatherResponse?.weather) parts.push('Weather loaded from project location')
      setPrefillNote(parts.join(' · ') || 'No prefill available.')
    } catch {
      setPrefillNote('No prefill available.')
    } finally {
      setLoadingPrefill(false)
    }
  }

  useEffect(() => {
    loadPrefill()
  }, [projectId, reportDate])

  async function handleSubmit() {
    if (saving) return
    if (!reportDate) {
      Alert.alert('Missing date', 'Report date is required.')
      return
    }

    setSaving(true)
    try {
      const result = await createDailyReport({
        project_id: projectId,
        project_name: projectName,
        report_date: reportDate,
        crew_count: crewCount,
        work_completed: workCompleted,
        equipment_used: equipmentUsed,
        safety_issues: safetyIssues,
        weather,
        submitted_by: submittedBy,
        weather_delay: weatherDelay,
        weather_delay_hours: weatherDelayHours,
        on_schedule: onSchedule,
      }, session)
      onCreated(result.id)
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Could not save the report.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView style={flowStyles.screen} contentContainerStyle={flowStyles.content}>
      <Pressable style={flowStyles.backLink} onPress={onBack}>
        <Text style={flowStyles.backLinkText}>‹ Back to Project</Text>
      </Pressable>

      <View style={flowStyles.hero}>
        <Text style={flowStyles.heroEyebrow}>{quickMode ? 'Quick Submit' : 'Daily Report'}</Text>
        <Text style={flowStyles.heroTitle}>{projectName}</Text>
        <Text style={flowStyles.heroSubtitle}>
          {quickMode
            ? 'Fast field submission. Fill the essentials and send it.'
            : 'Create a daily report without leaving the app.'}
        </Text>
      </View>

      <View style={flowStyles.infoCard}>
        <Text style={flowStyles.infoCardTitle}>{loadingPrefill ? 'Loading smart prefill…' : 'Smart Prefill'}</Text>
        <Text style={flowStyles.infoCardText}>{prefillNote || 'Recent crew info and project weather will load here.'}</Text>
      </View>

      <Section title="Core Details">
        <Field label="Report Date">
          <TextInput value={reportDate} onChangeText={setReportDate} style={flowStyles.input} placeholder="YYYY-MM-DD" />
        </Field>
        <Field label="Submitted By">
          <TextInput value={submittedBy} onChangeText={setSubmittedBy} style={flowStyles.input} placeholder="Your name" />
        </Field>
        <Field label="Crew Count">
          <TextInput value={crewCount} onChangeText={setCrewCount} style={flowStyles.input} keyboardType="number-pad" placeholder="0" />
        </Field>
        <Field label="Weather">
          <TextInput value={weather} onChangeText={setWeather} style={flowStyles.input} placeholder="Weather conditions" />
        </Field>
        <Field label="Work Completed">
          <TextInput value={workCompleted} onChangeText={setWorkCompleted} style={[flowStyles.input, flowStyles.textArea]} multiline placeholder="Describe today’s work" />
        </Field>
      </Section>

      {!quickMode ? (
        <Section title="Additional Details">
          <Field label="Equipment Used">
            <TextInput value={equipmentUsed} onChangeText={setEquipmentUsed} style={[flowStyles.input, flowStyles.textArea]} multiline placeholder="Equipment used today" />
          </Field>
          <Field label="Safety / Issues">
            <TextInput value={safetyIssues} onChangeText={setSafetyIssues} style={[flowStyles.input, flowStyles.textArea]} multiline placeholder="Safety items or issues" />
          </Field>
          <Field label="Weather Delay">
            <BooleanChoice value={weatherDelay} onChange={setWeatherDelay} />
          </Field>
          {weatherDelay ? (
            <Field label="Weather Delay Hours">
              <TextInput value={weatherDelayHours} onChangeText={setWeatherDelayHours} style={flowStyles.input} keyboardType="decimal-pad" placeholder="0" />
            </Field>
          ) : null}
          <Field label="On Schedule">
            <BooleanChoice value={onSchedule} onChange={setOnSchedule} />
          </Field>
        </Section>
      ) : null}

      <View style={flowStyles.infoCardMuted}>
        <Text style={flowStyles.infoCardText}>
          Native create is optimized for speed. Photo attachments can still be added later through the website edit flow if needed.
        </Text>
      </View>

      <Pressable style={[flowStyles.primaryButton, saving && flowStyles.buttonDisabled]} onPress={handleSubmit} disabled={saving}>
        <Text style={flowStyles.primaryButtonText}>{saving ? 'Saving…' : 'Submit Daily Report'}</Text>
      </Pressable>
    </ScrollView>
  )
}

export function NativeDailyReportEditScreen({
  session,
  reportId,
  onBack,
  onSaved,
}: {
  session: Session
  reportId: string
  onBack: () => void
  onSaved: (reportId: string) => void
}) {
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [reportDate, setReportDate] = useState('')
  const [crewCount, setCrewCount] = useState('')
  const [workCompleted, setWorkCompleted] = useState('')
  const [equipmentUsed, setEquipmentUsed] = useState('')
  const [safetyIssues, setSafetyIssues] = useState('')
  const [weather, setWeather] = useState('')
  const [submittedBy, setSubmittedBy] = useState('')
  const [weatherDelay, setWeatherDelay] = useState(false)
  const [weatherDelayHours, setWeatherDelayHours] = useState('')
  const [onSchedule, setOnSchedule] = useState(true)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadReport() {
      setLoading(true)
      try {
        const nextReport = await fetchReportDetail(reportId, session)
        if (cancelled) return

        setReport(nextReport)
        setReportDate(nextReport.report_date || '')
        setCrewCount(nextReport.crew_count == null ? '' : String(nextReport.crew_count))
        setWorkCompleted(asText(nextReport.work_completed))
        setEquipmentUsed(asText(nextReport.equipment_used))
        setSafetyIssues(asText(nextReport.safety_issues))
        setWeather(asText(nextReport.weather))
        setSubmittedBy(asText(nextReport.submitted_by))
        setWeatherDelay(Boolean(nextReport.weather_delay))
        setWeatherDelayHours(nextReport.weather_delay_hours == null ? '' : String(nextReport.weather_delay_hours))
        setOnSchedule(nextReport.on_schedule !== false)
      } catch (error) {
        if (!cancelled) {
          Alert.alert('Load failed', error instanceof Error ? error.message : 'Could not load the report.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadReport()
    return () => {
      cancelled = true
    }
  }, [reportId, session])

  async function handleSave() {
    if (saving) return
    if (!reportDate) {
      Alert.alert('Missing date', 'Report date is required.')
      return
    }

    setSaving(true)
    try {
      const updatedReport = await updateDailyReport(reportId, {
        project_id: report?.project_id || null,
        project_name: report?.project_name || '',
        report_date: reportDate,
        crew_count: crewCount,
        work_completed: workCompleted,
        equipment_used: equipmentUsed,
        safety_issues: safetyIssues,
        weather,
        submitted_by: submittedBy,
        weather_delay: weatherDelay,
        weather_delay_hours: weatherDelayHours,
        on_schedule: onSchedule,
      }, session)
      setReport(updatedReport)
      onSaved(updatedReport.id)
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Could not save the report.')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !report) {
    return (
      <View style={[flowStyles.screen, flowStyles.centeredState]}>
        <ActivityIndicator color="#cc3300" />
        <Text style={flowStyles.infoCardText}>Loading report...</Text>
      </View>
    )
  }

  return (
    <ScrollView style={flowStyles.screen} contentContainerStyle={flowStyles.content}>
      <Pressable style={flowStyles.backLink} onPress={onBack}>
        <Text style={flowStyles.backLinkText}>‹ Back to Report</Text>
      </Pressable>

      <View style={flowStyles.hero}>
        <Text style={flowStyles.heroEyebrow}>Edit Daily Report</Text>
        <Text style={flowStyles.heroTitle}>{report?.project_name || 'Daily Report'}</Text>
        <Text style={flowStyles.heroSubtitle}>
          Update the saved report without leaving the app.
        </Text>
      </View>

      <Section title="Core Details">
        <Field label="Report Date">
          <TextInput value={reportDate} onChangeText={setReportDate} style={flowStyles.input} placeholder="YYYY-MM-DD" />
        </Field>
        <Field label="Submitted By">
          <TextInput value={submittedBy} onChangeText={setSubmittedBy} style={flowStyles.input} placeholder="Your name" />
        </Field>
        <Field label="Crew Count">
          <TextInput value={crewCount} onChangeText={setCrewCount} style={flowStyles.input} keyboardType="number-pad" placeholder="0" />
        </Field>
        <Field label="Weather">
          <TextInput value={weather} onChangeText={setWeather} style={flowStyles.input} placeholder="Weather conditions" />
        </Field>
        <Field label="Work Completed">
          <TextInput value={workCompleted} onChangeText={setWorkCompleted} style={[flowStyles.input, flowStyles.textArea]} multiline placeholder="Describe today’s work" />
        </Field>
      </Section>

      <Section title="Additional Details">
        <Field label="Equipment Used">
          <TextInput value={equipmentUsed} onChangeText={setEquipmentUsed} style={[flowStyles.input, flowStyles.textArea]} multiline placeholder="Equipment used today" />
        </Field>
        <Field label="Safety / Issues">
          <TextInput value={safetyIssues} onChangeText={setSafetyIssues} style={[flowStyles.input, flowStyles.textArea]} multiline placeholder="Safety items or issues" />
        </Field>
        <Field label="Weather Delay">
          <BooleanChoice value={weatherDelay} onChange={setWeatherDelay} />
        </Field>
        {weatherDelay ? (
          <Field label="Weather Delay Hours">
            <TextInput value={weatherDelayHours} onChangeText={setWeatherDelayHours} style={flowStyles.input} keyboardType="decimal-pad" placeholder="0" />
          </Field>
        ) : null}
        <Field label="On Schedule">
          <BooleanChoice value={onSchedule} onChange={setOnSchedule} />
        </Field>
      </Section>

      <View style={flowStyles.infoCardMuted}>
        <Text style={flowStyles.infoCardText}>
          Existing photos stay attached. Use the web edit page only when you need to add photos.
        </Text>
      </View>

      <Pressable style={[flowStyles.primaryButton, saving && flowStyles.buttonDisabled]} onPress={handleSave} disabled={saving}>
        <Text style={flowStyles.primaryButtonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
      </Pressable>
    </ScrollView>
  )
}

export function NativeContractorEvaluationScreen({
  session,
  projectId,
  projectName,
  onBack,
  onCreated,
}: {
  session: Session
  projectId: string
  projectName: string
  onBack: () => void
  onCreated: (id: string) => void
}) {
  const [form, setForm] = useState({
    inspector_name: '',
    inspection_date: getToday(),
    inspection_location: '',
    contractor_name: '',
    supervisor_name: '',
    ppe_compliant: null as boolean | null,
    safety_signs: null as boolean | null,
    emergency_procedures: null as boolean | null,
    safety_comments: '',
    work_specs: null as boolean | null,
    materials_quality: null as boolean | null,
    workmanship: null as boolean | null,
    work_quality_comments: '',
    on_schedule: null as boolean | null,
    milestones_met: null as boolean | null,
    timeliness_comments: '',
    contractor_responsive: null as boolean | null,
    progress_reports: null as boolean | null,
    communication_comments: '',
    regulations_compliant: null as boolean | null,
    permits_current: null as boolean | null,
    compliance_comments: '',
    env_impact_minimized: null as boolean | null,
    waste_disposal: null as boolean | null,
    environmental_comments: '',
    overall_rating: '',
    overall_comments: '',
    inspector_signature: '',
    signature_date: getToday(),
  })
  const [saving, setSaving] = useState(false)

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(current => ({ ...current, [key]: value }))
  }

  async function handleSubmit() {
    if (saving) return
    setSaving(true)
    try {
      const result = await createContractorEvaluation({
        project_id: projectId,
        project_name: projectName,
        ...form,
      }, session)
      onCreated(result.id)
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Could not save the evaluation.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView style={flowStyles.screen} contentContainerStyle={flowStyles.content}>
      <Pressable style={flowStyles.backLink} onPress={onBack}>
        <Text style={flowStyles.backLinkText}>‹ Back to Project</Text>
      </Pressable>

      <View style={flowStyles.hero}>
        <Text style={flowStyles.heroEyebrow}>Contractor Evaluation</Text>
        <Text style={flowStyles.heroTitle}>{projectName}</Text>
        <Text style={flowStyles.heroSubtitle}>Create a contractor evaluation without leaving the app.</Text>
      </View>

      <Section title="Inspector Information">
        <Field label="Inspector Name">
          <TextInput value={form.inspector_name} onChangeText={(value) => update('inspector_name', value)} style={flowStyles.input} />
        </Field>
        <Field label="Inspection Date">
          <TextInput value={form.inspection_date} onChangeText={(value) => update('inspection_date', value)} style={flowStyles.input} placeholder="YYYY-MM-DD" />
        </Field>
        <Field label="Inspection Location">
          <TextInput value={form.inspection_location} onChangeText={(value) => update('inspection_location', value)} style={flowStyles.input} />
        </Field>
      </Section>

      <Section title="Contractor Information">
        <Field label="Contractor Name">
          <TextInput value={form.contractor_name} onChangeText={(value) => update('contractor_name', value)} style={flowStyles.input} />
        </Field>
        <Field label="Supervisor Name">
          <TextInput value={form.supervisor_name} onChangeText={(value) => update('supervisor_name', value)} style={flowStyles.input} />
        </Field>
      </Section>

      <EvalChoiceSection title="Safety Compliance" form={form} update={update} items={[
        ['ppe_compliant', 'Workers wearing PPE'],
        ['safety_signs', 'Safety signs and barriers in place'],
        ['emergency_procedures', 'Emergency procedures communicated'],
      ]} commentsKey="safety_comments" />

      <EvalChoiceSection title="Work Quality" form={form} update={update} items={[
        ['work_specs', 'Work performed to spec'],
        ['materials_quality', 'Materials quality acceptable'],
        ['workmanship', 'Workmanship professional'],
      ]} commentsKey="work_quality_comments" />

      <EvalChoiceSection title="Timeliness" form={form} update={update} items={[
        ['on_schedule', 'Project on schedule'],
        ['milestones_met', 'Milestones met'],
      ]} commentsKey="timeliness_comments" />

      <EvalChoiceSection title="Communication" form={form} update={update} items={[
        ['contractor_responsive', 'Contractor responsive'],
        ['progress_reports', 'Progress reports provided'],
      ]} commentsKey="communication_comments" />

      <EvalChoiceSection title="Compliance" form={form} update={update} items={[
        ['regulations_compliant', 'Regulations compliant'],
        ['permits_current', 'Permits current'],
      ]} commentsKey="compliance_comments" />

      <EvalChoiceSection title="Environmental" form={form} update={update} items={[
        ['env_impact_minimized', 'Environmental impact minimized'],
        ['waste_disposal', 'Waste disposed properly'],
      ]} commentsKey="environmental_comments" />

      <Section title="Overall Evaluation">
        <Field label="Overall Rating">
          <View style={flowStyles.choiceRow}>
            {['Excellent', 'Good', 'Satisfactory', 'Needs Improvement', 'Unsatisfactory'].map((rating) => {
              const active = form.overall_rating === rating
              return (
                <Pressable
                  key={rating}
                  style={[flowStyles.choiceButton, active && flowStyles.choiceButtonActive]}
                  onPress={() => update('overall_rating', rating)}
                >
                  <Text style={[flowStyles.choiceButtonText, active && flowStyles.choiceButtonTextActive]}>{rating}</Text>
                </Pressable>
              )
            })}
          </View>
        </Field>
        <Field label="Comments">
          <TextInput value={form.overall_comments} onChangeText={(value) => update('overall_comments', value)} style={[flowStyles.input, flowStyles.textArea]} multiline />
        </Field>
      </Section>

      <Section title="Signature">
        <Field label="Inspector Signature">
          <TextInput value={form.inspector_signature} onChangeText={(value) => update('inspector_signature', value)} style={flowStyles.input} />
        </Field>
        <Field label="Signature Date">
          <TextInput value={form.signature_date} onChangeText={(value) => update('signature_date', value)} style={flowStyles.input} placeholder="YYYY-MM-DD" />
        </Field>
      </Section>

      <Pressable style={[flowStyles.primaryButton, saving && flowStyles.buttonDisabled]} onPress={handleSubmit} disabled={saving}>
        <Text style={flowStyles.primaryButtonText}>{saving ? 'Saving…' : 'Submit Evaluation'}</Text>
      </Pressable>
    </ScrollView>
  )
}

function EvalChoiceSection({
  title,
  form,
  update,
  items,
  commentsKey,
}: {
  title: string
  form: Record<string, any>
  update: (key: any, value: any) => void
  items: Array<[string, string]>
  commentsKey: string
}) {
  return (
    <Section title={title}>
      {items.map(([key, label]) => (
        <Field key={key} label={label}>
          <BooleanChoice value={form[key]} onChange={(value) => update(key, value)} />
        </Field>
      ))}
      <Field label="Comments">
        <TextInput value={form[commentsKey]} onChangeText={(value) => update(commentsKey, value)} style={[flowStyles.input, flowStyles.textArea]} multiline />
      </Field>
    </Section>
  )
}

const QA_FORM_OPTIONS = [
  { key: 'mono_pole_framing', code: 'QA-009', title: 'Mono Pole / H-Frame / 3 Pole Framing Report' },
  { key: 'vibratory_caisson', code: 'QA-010', title: 'Vibratory Caisson Report' },
  { key: 'pole_setting', code: 'QA-011', title: 'Pole Setting Report' },
  { key: 'grounding_resistance', code: 'QA-013', title: 'Structure Grounding and Resistance Measurement Report' },
]

export function NativeQaFormTypeScreen({
  projectName,
  enabledTypes,
  onBack,
  onSelect,
}: {
  projectName: string
  enabledTypes: string[]
  onBack: () => void
  onSelect: (formType: string) => void
}) {
  const options = QA_FORM_OPTIONS.filter((option) => enabledTypes.includes(option.key))

  return (
    <ScrollView style={flowStyles.screen} contentContainerStyle={flowStyles.content}>
      <Pressable style={flowStyles.backLink} onPress={onBack}>
        <Text style={flowStyles.backLinkText}>‹ Back to Project</Text>
      </Pressable>

      <View style={flowStyles.hero}>
        <Text style={flowStyles.heroEyebrow}>QA Forms</Text>
        <Text style={flowStyles.heroTitle}>{projectName}</Text>
        <Text style={flowStyles.heroSubtitle}>Choose the QA form type for this project.</Text>
      </View>

      {options.length === 0 ? (
        <View style={flowStyles.emptyCard}>
          <Text style={flowStyles.emptyText}>QA forms are disabled for this project.</Text>
        </View>
      ) : (
        options.map((option) => (
          <Pressable key={option.key} style={flowStyles.listCard} onPress={() => onSelect(option.key)}>
            <Text style={flowStyles.listCode}>{option.code}</Text>
            <Text style={flowStyles.listTitle}>{option.title}</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  )
}

export function NativeQaFormScreen({
  session,
  projectId,
  projectName,
  formType,
  onBack,
  onCreated,
}: {
  session: Session
  projectId: string
  projectName: string
  formType: string
  onBack: () => void
  onCreated: (id: string) => void
}) {
  const [definition, setDefinition] = useState<QaFormDefinition | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState<Record<string, any>>({})

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await fetchQaFormDefinition(formType, session)
        if (cancelled) return
        setDefinition(result.definition)
        setFormData(createInitialQaFormData(result.definition))
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Could not load the QA form.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [formType, session.access_token])

  function updateField(path: string, value: any) {
    setFormData((current) => cloneWithPath(current, path, value))
  }

  async function handleSubmit() {
    if (!definition || saving) return
    setSaving(true)
    try {
      const result = await createQaForm({
        project_id: projectId,
        project_name: projectName,
        form_type: formType,
        form_data: formData,
        work_date: getByPath(formData, 'work_date', '') || null,
        submitted_by: getByPath(formData, 'submitted_by', '') || null,
      }, session)
      onCreated(result.id)
    } catch (nextError) {
      Alert.alert('Save failed', nextError instanceof Error ? nextError.message : 'Could not save the QA form.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView style={flowStyles.screen} contentContainerStyle={flowStyles.content}>
      <Pressable style={flowStyles.backLink} onPress={onBack}>
        <Text style={flowStyles.backLinkText}>‹ Back</Text>
      </Pressable>

      {loading ? (
        <View style={flowStyles.emptyCard}>
          <ActivityIndicator size="small" color="#b44a12" />
          <Text style={flowStyles.emptyText}>Loading QA form…</Text>
        </View>
      ) : null}

      {error ? (
        <View style={flowStyles.errorCard}>
          <Text style={flowStyles.errorText}>{error}</Text>
        </View>
      ) : null}

      {definition ? (
        <>
          <View style={flowStyles.hero}>
            <Text style={flowStyles.heroEyebrow}>{definition.code}</Text>
            <Text style={flowStyles.heroTitle}>{projectName}</Text>
            <Text style={flowStyles.heroSubtitle}>{definition.title}</Text>
          </View>

          {definition.sections.map((section) => (
            <Section key={section.title} title={section.title}>
              {section.kind === 'fields' ? section.fields.map((field) => (
                <Field key={field.path} label={field.label}>
                  {field.type === 'checkbox' ? (
                    <BooleanChoice
                      value={Boolean(getByPath(formData, field.path, false))}
                      onChange={(value) => updateField(field.path, value)}
                      options={[
                        { label: 'Checked', value: true },
                        { label: 'Not Checked', value: false },
                      ]}
                    />
                  ) : (
                    <TextInput
                      value={asText(getByPath(formData, field.path, ''))}
                      onChangeText={(value) => updateField(field.path, value)}
                      style={[flowStyles.input, field.type === 'textarea' && flowStyles.textArea]}
                      multiline={field.type === 'textarea'}
                      placeholder={field.type === 'date' ? 'YYYY-MM-DD' : field.type === 'time' ? 'HH:MM' : ''}
                    />
                  )}
                </Field>
              )) : null}

              {section.kind === 'checkbox_group' ? section.options.map((label) => {
                const path = `${section.path}.${optionKey(label)}`
                const checked = Boolean(getByPath(formData, path, false))
                return (
                  <Field key={path} label={label}>
                    <BooleanChoice
                      value={checked}
                      onChange={(value) => updateField(path, value)}
                      options={[
                        { label: 'On', value: true },
                        { label: 'Off', value: false },
                      ]}
                    />
                  </Field>
                )
              }) : null}

              {section.kind === 'tri_state_list' ? section.items.map((label) => {
                const basePath = `${section.path}.${optionKey(label)}`
                return (
                  <View key={basePath} style={flowStyles.subCard}>
                    <Text style={flowStyles.subCardTitle}>{label}</Text>
                    <BooleanChoice
                      value={getByPath(formData, `${basePath}.status`, '')}
                      onChange={(value) => updateField(`${basePath}.status`, value)}
                      options={[
                        { label: 'Yes', value: 'yes' },
                        { label: 'No', value: 'no' },
                        { label: 'N/A', value: 'na' },
                      ]}
                    />
                    {section.includeRemarks ? (
                      <TextInput
                        value={asText(getByPath(formData, `${basePath}.remarks`, ''))}
                        onChangeText={(value) => updateField(`${basePath}.remarks`, value)}
                        style={[flowStyles.input, flowStyles.textArea]}
                        multiline
                        placeholder="Remarks"
                      />
                    ) : null}
                  </View>
                )
              }) : null}

              {section.kind === 'tri_state_matrix' ? section.rows.map((rowLabel) => (
                <View key={rowLabel} style={flowStyles.subCard}>
                  <Text style={flowStyles.subCardTitle}>{rowLabel}</Text>
                  {section.columns.map((columnLabel) => {
                    const path = `${section.path}.${optionKey(rowLabel)}.${optionKey(columnLabel)}`
                    return (
                      <Field key={path} label={columnLabel}>
                        <BooleanChoice
                          value={getByPath(formData, path, '')}
                          onChange={(value) => updateField(path, value)}
                          options={[
                            { label: 'Yes', value: 'yes' },
                            { label: 'No', value: 'no' },
                            { label: 'N/A', value: 'na' },
                          ]}
                        />
                      </Field>
                    )
                  })}
                </View>
              )) : null}

              {section.kind === 'table' ? (section.rowLabels || Array.from({ length: section.rowCount || 0 }, (_, index) => `Row ${index + 1}`)).map((rowLabel, rowIndex) => (
                <View key={`${section.path}-${rowIndex}`} style={flowStyles.subCard}>
                  <Text style={flowStyles.subCardTitle}>{rowLabel}</Text>
                  {section.columns.map((column) => {
                    const path = `${section.path}.${rowIndex}.${column.key}`
                    return (
                      <Field key={path} label={column.label}>
                        {column.type === 'tri_state_simple' ? (
                          <BooleanChoice
                            value={getByPath(formData, path, '')}
                            onChange={(value) => updateField(path, value)}
                            options={[
                              { label: 'Yes', value: 'yes' },
                              { label: 'No', value: 'no' },
                              { label: 'N/A', value: 'na' },
                            ]}
                          />
                        ) : (
                          <TextInput
                            value={asText(getByPath(formData, path, ''))}
                            onChangeText={(value) => updateField(path, value)}
                            style={flowStyles.input}
                          />
                        )}
                      </Field>
                    )
                  })}
                </View>
              )) : null}
            </Section>
          ))}

          <View style={flowStyles.infoCardMuted}>
            <Text style={flowStyles.infoCardText}>
              Native QA create is optimized for speed. Photo attachments can still be added from the web edit flow if needed.
            </Text>
          </View>

          <Pressable style={[flowStyles.primaryButton, saving && flowStyles.buttonDisabled]} onPress={handleSubmit} disabled={saving}>
            <Text style={flowStyles.primaryButtonText}>{saving ? 'Saving…' : 'Submit QA Form'}</Text>
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  )
}

export function NativeProjectPhotosScreen({
  session,
  projectId,
  onBack,
  onOpenSource,
}: {
  session: Session
  projectId: string
  onBack: () => void
  onOpenSource: (path: string) => void
}) {
  const [gallery, setGallery] = useState<ProjectPhotoGallery | null>(null)
  const [projectName, setProjectName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await fetchProjectPhotoGallery(projectId, session)
        if (cancelled) return
        setProjectName(result.project.project_name)
        setGallery(result.gallery)
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Could not load project photos.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [projectId, session.access_token])

  return (
    <ScrollView style={flowStyles.screen} contentContainerStyle={flowStyles.content}>
      <Pressable style={flowStyles.backLink} onPress={onBack}>
        <Text style={flowStyles.backLinkText}>‹ Back to Project</Text>
      </Pressable>

      <View style={flowStyles.hero}>
        <Text style={flowStyles.heroEyebrow}>Project Photos</Text>
        <Text style={flowStyles.heroTitle}>{projectName || 'Project'}</Text>
        <Text style={flowStyles.heroSubtitle}>Photos attached to daily reports, pour logs, and QA forms.</Text>
      </View>

      {loading ? (
        <View style={flowStyles.emptyCard}>
          <ActivityIndicator size="small" color="#b44a12" />
          <Text style={flowStyles.emptyText}>Loading photos…</Text>
        </View>
      ) : null}

      {error ? (
        <View style={flowStyles.errorCard}>
          <Text style={flowStyles.errorText}>{error}</Text>
        </View>
      ) : null}

      {gallery ? (
        <>
          <View style={flowStyles.statsRow}>
            <View style={flowStyles.statCard}>
              <Text style={flowStyles.statLabel}>Total</Text>
              <Text style={flowStyles.statValue}>{gallery.counts.total}</Text>
            </View>
            <View style={flowStyles.statCard}>
              <Text style={flowStyles.statLabel}>Daily</Text>
              <Text style={flowStyles.statValue}>{gallery.counts.daily_reports}</Text>
            </View>
            <View style={flowStyles.statCard}>
              <Text style={flowStyles.statLabel}>Pour</Text>
              <Text style={flowStyles.statValue}>{gallery.counts.pour_logs}</Text>
            </View>
            <View style={flowStyles.statCard}>
              <Text style={flowStyles.statLabel}>QA</Text>
              <Text style={flowStyles.statValue}>{gallery.counts.qa_forms}</Text>
            </View>
          </View>

          {gallery.photos.length === 0 ? (
            <View style={flowStyles.emptyCard}>
              <Text style={flowStyles.emptyText}>No project photos yet.</Text>
            </View>
          ) : (
            gallery.photos.map((photo) => (
              <Pressable key={photo.id} style={flowStyles.photoCard} onPress={() => onOpenSource(photo.detail_path)}>
                <Image source={{ uri: photo.url }} style={flowStyles.galleryImage} resizeMode="cover" />
                <View style={flowStyles.photoCardBody}>
                  <Text style={flowStyles.photoBadge}>{photo.source_label}</Text>
                  <Text style={flowStyles.photoCardTitle}>{photo.label || 'No label'}</Text>
                  <Text style={flowStyles.photoMeta}>{[formatDate(photo.source_date), photo.submitted_by].filter(Boolean).join(' · ')}</Text>
                </View>
              </Pressable>
            ))
          )}
        </>
      ) : null}
    </ScrollView>
  )
}

export function NativePourLogTypeScreen({
  projectName,
  onBack,
  onSelect,
}: {
  projectName: string
  onBack: () => void
  onSelect: (type: 'drilled_shaft' | 'flatwork') => void
}) {
  return (
    <ScrollView style={flowStyles.screen} contentContainerStyle={flowStyles.content}>
      <Pressable style={flowStyles.backLink} onPress={onBack}>
        <Text style={flowStyles.backLinkText}>‹ Back to Project</Text>
      </Pressable>

      <View style={flowStyles.hero}>
        <Text style={flowStyles.heroEyebrow}>Pour Log</Text>
        <Text style={flowStyles.heroTitle}>{projectName}</Text>
        <Text style={flowStyles.heroSubtitle}>Choose the pour log type without leaving the app.</Text>
      </View>

      <Pressable style={flowStyles.listCard} onPress={() => onSelect('drilled_shaft')}>
        <Text style={flowStyles.listCode}>DRILLED SHAFT</Text>
        <Text style={flowStyles.listTitle}>Track shafts, trucks, depths, and concrete data.</Text>
      </Pressable>

      <Pressable style={flowStyles.listCard} onPress={() => onSelect('flatwork')}>
        <Text style={flowStyles.listCode}>FLATWORK</Text>
        <Text style={flowStyles.listTitle}>Track slabs or spread footers, sections, and truck data.</Text>
      </Pressable>
    </ScrollView>
  )
}

export function NativeDrilledShaftPourLogScreen({
  session,
  projectId,
  projectName,
  onBack,
  onCreated,
}: {
  session: Session
  projectId: string
  projectName: string
  onBack: () => void
  onCreated: (id: string) => void
}) {
  const [logDate, setLogDate] = useState(getToday())
  const [weather, setWeather] = useState('')
  const [ambientTemp, setAmbientTemp] = useState('')
  const [concreteSupplier, setConcreteSupplier] = useState('')
  const [submittedBy, setSubmittedBy] = useState('')
  const [photos, setPhotos] = useState<UploadPhotoFile[]>([])
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [foundations, setFoundations] = useState([createInitialDrilledShaftFoundation()])
  const [trucks, setTrucks] = useState([createInitialDrilledShaftTruck('')])
  const [saving, setSaving] = useState(false)
  const [draftReady, setDraftReady] = useState(false)
  const [draftStatus, setDraftStatus] = useState<DraftStatus>('Saved')
  const [activeFoundationIndex, setActiveFoundationIndex] = useState<number | null>(null)
  const [activeTruckIndex, setActiveTruckIndex] = useState<number | null>(null)
  const draftKey = `mobile:pour-log:draft:${projectId}:drilled_shaft`
  const skipNextDraftSave = useRef(false)

  useEffect(() => {
    const draft = getLocalDraft(draftKey)
    if (draft) {
      setLogDate(asText(draft.logDate) || getToday())
      setWeather(asText(draft.weather))
      setAmbientTemp(asText(draft.ambientTemp))
      setConcreteSupplier(asText(draft.concreteSupplier))
      setSubmittedBy(asText(draft.submittedBy))
      setPhotos(restoreUploadPhotos(draft.photos))
      setFoundations(Array.isArray(draft.foundations) && draft.foundations.length ? draft.foundations : [createInitialDrilledShaftFoundation()])
      setTrucks(Array.isArray(draft.trucks) && draft.trucks.length ? draft.trucks : [createInitialDrilledShaftTruck('')])
      setActiveFoundationIndex(draft.activeFoundationIndex == null ? null : Number.isFinite(Number(draft.activeFoundationIndex)) ? Number(draft.activeFoundationIndex) : null)
      setActiveTruckIndex(draft.activeTruckIndex == null ? null : Number.isFinite(Number(draft.activeTruckIndex)) ? Number(draft.activeTruckIndex) : null)
      setDraftStatus('Draft saved')
      skipNextDraftSave.current = true
    }
    setDraftReady(true)
  }, [draftKey])

  const saveDraftNow = useCallback(() => {
    if (!draftReady || saving) return false

    const saved = setLocalDraft(draftKey, {
        logDate,
        weather,
        ambientTemp,
        concreteSupplier,
        submittedBy,
        photos,
        foundations,
        trucks,
        activeFoundationIndex,
        activeTruckIndex,
      })
    setDraftStatus(saved ? 'Draft saved' : 'Unsaved changes')
    return saved
  }, [activeFoundationIndex, activeTruckIndex, ambientTemp, concreteSupplier, draftKey, draftReady, foundations, logDate, photos, saving, submittedBy, trucks, weather])

  useEffect(() => {
    if (!draftReady || saving) return
    if (skipNextDraftSave.current) {
      skipNextDraftSave.current = false
      return
    }

    setDraftStatus('Unsaved changes')
    const timeoutId = setTimeout(() => {
      setDraftStatus('Saving')
      saveDraftNow()
    }, 350)

    return () => clearTimeout(timeoutId)
  }, [activeFoundationIndex, activeTruckIndex, ambientTemp, concreteSupplier, draftKey, draftReady, foundations, logDate, photos, saveDraftNow, saving, submittedBy, trucks, weather])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') saveDraftNow()
    })

    return () => subscription.remove()
  }, [saveDraftNow])

  useEffect(() => {
    setActiveFoundationIndex((current) => {
      if (current == null || foundations.length === 0) return null
      return Math.max(0, Math.min(current, foundations.length - 1))
    })
  }, [foundations.length])

  useEffect(() => {
    setActiveTruckIndex((current) => {
      if (current == null || trucks.length === 0) return null
      return Math.max(0, Math.min(current, trucks.length - 1))
    })
  }, [trucks.length])

  useEffect(() => {
    let cancelled = false
    async function loadWeather() {
      setWeatherLoading(true)
      try {
        const result = await fetch(buildWebUrl(`/api/weather/${projectId}?date=${logDate}`)).then((response) => response.json())
        if (!cancelled && result?.weather && !weather) setWeather(result.weather)
      } catch {}
      if (!cancelled) setWeatherLoading(false)
    }
    if (projectId && logDate) loadWeather()
    return () => {
      cancelled = true
    }
  }, [projectId, logDate])

  function updateFoundation(index: number, key: string, value: string) {
    setFoundations((current) => current.map((foundation, foundationIndex) => foundationIndex === index ? { ...foundation, [key]: value } : foundation))
  }

  function addFoundation() {
    setFoundations((current) => {
      setActiveFoundationIndex(current.length)
      return [...current, createInitialDrilledShaftFoundation()]
    })
  }

  function removeFoundation(index: number) {
    const removedId = foundations[index]?.foundation_id
    setFoundations((current) => current.filter((_, foundationIndex) => foundationIndex !== index))
    setActiveFoundationIndex((current) => {
      if (current == null || current === index) return null
      return current > index ? current - 1 : current
    })
    if (!removedId) return
    setTrucks((current) => current.map((truck) => {
      const nextServed = (truck.foundations_served || []).filter((id) => id !== removedId)
      const nextDepths = { ...truck.shaft_depths }
      delete nextDepths[removedId]
      return { ...truck, foundations_served: nextServed, shaft_depths: nextDepths, estimated_leftover_yards: '' }
    }))
  }

  function updateTruck(index: number, key: string, value: any) {
    setTrucks((current) => current.map((truck, truckIndex) => truckIndex === index ? { ...truck, [key]: value } : truck))
  }

  function addTruck() {
    setTrucks((current) => {
      const nextTruck = createInitialDrilledShaftTruck('')
      setActiveTruckIndex(current.length)
      return [...current, nextTruck]
    })
  }

  function duplicateActiveTruck() {
    setTrucks((current) => {
      const sourceTruck = activeTruckIndex == null ? current[current.length - 1] : current[activeTruckIndex] || current[current.length - 1]
      const nextTruck = {
        ...createInitialDrilledShaftTruck(''),
        concrete_temp: sourceTruck?.concrete_temp || '',
        slump: sourceTruck?.slump || '',
        air_content: sourceTruck?.air_content || '',
        water_added: sourceTruck?.water_added || '',
        cylinders_cast: sourceTruck?.cylinders_cast || '',
      }
      setActiveTruckIndex(current.length)
      return [...current, nextTruck]
    })
  }

  function removeTruck(index: number) {
    setTrucks((current) => current.filter((_, truckIndex) => truckIndex !== index))
    setActiveTruckIndex((current) => {
      if (current == null || current === index) return null
      return current > index ? current - 1 : current
    })
  }

  function toggleTruckFoundation(truckIndex: number, foundationId: string) {
    setTrucks((current) => current.map((truck, index) => {
      if (index !== truckIndex) return truck
      const served = truck.foundations_served || []
      const nextServed = served.includes(foundationId)
        ? served.filter((id) => id !== foundationId)
        : [...served, foundationId]
      const nextDepths = { ...truck.shaft_depths }
      if (!nextServed.includes(foundationId)) delete nextDepths[foundationId]
      if (nextServed.includes(foundationId) && !(foundationId in nextDepths)) nextDepths[foundationId] = ''
      return { ...truck, foundations_served: nextServed, shaft_depths: nextDepths, estimated_leftover_yards: '' }
    }))
  }

  function setTruckFoundationDepth(truckIndex: number, foundationId: string, value: string) {
    setTrucks((current) => current.map((truck, index) => index === truckIndex ? {
      ...truck,
      shaft_depths: { ...truck.shaft_depths, [foundationId]: value },
    } : truck))
  }

  async function pickFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access to attach pour log photos.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10,
    })

    if (!result.canceled) {
      setPhotos((current) => [...current, ...mapPickedAssets(result.assets, 'pour-log-photo')])
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access to attach pour log photos.')
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    })

    if (!result.canceled) {
      setPhotos((current) => [...current, ...mapPickedAssets(result.assets, 'pour-log-photo')])
    }
  }

  function removePhoto(index: number) {
    setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))
  }

  async function handleSubmit() {
    if (saving) return
    setSaving(true)
    try {
      let photoUrls: string[] = []
      if (photos.length > 0) {
        setUploadingPhotos(true)
        const uploaded = await uploadPhotos('pour-logs', photos, session, projectId)
        photoUrls = uploaded.urls
      }

      const result = await createPourLog({
        project_id: projectId,
        project_name: projectName,
        log_type: 'drilled_shaft',
        log_date: logDate,
        weather,
        ambient_temp: ambientTemp,
        concrete_supplier: concreteSupplier,
        submitted_by: submittedBy,
        photo_urls: photoUrls,
        foundations,
        trucks: trucks.map((truck) => ({
          ...truck,
          foundations_served: formatTruckFoundations(truck.foundations_served, truck.shaft_depths, truck.rejected),
          notes: buildTruckNotes(truck.notes, truck.rejected, truck.estimated_leftover_yards),
        })),
      }, session)
      clearLocalDraft(draftKey)
      setDraftStatus('Saved')
      onCreated(result.id)
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Could not create the pour log.')
    } finally {
      setUploadingPhotos(false)
      setSaving(false)
    }
  }

  return (
    <ScrollView style={flowStyles.screen} contentContainerStyle={flowStyles.content}>
      <GuardedBackLink hasUnsavedChanges={draftStatus === 'Unsaved changes' || draftStatus === 'Saving'} onBack={onBack} />

      <View style={flowStyles.hero}>
        <Text style={flowStyles.heroEyebrow}>Pour Log</Text>
        <Text style={flowStyles.heroTitle}>{projectName}</Text>
        <Text style={flowStyles.heroSubtitle}>Native drilled shaft create flow. Photo attachments can still be added later on the web.</Text>
      </View>

      <DraftStatusPill status={draftStatus} />

      <Section title="Job Info">
        <Field label="Date">
          <TextInput value={logDate} onChangeText={setLogDate} style={flowStyles.input} placeholder="YYYY-MM-DD" />
        </Field>
        <Field label={`Weather${weatherLoading ? ' (loading...)' : ''}`}>
          <TextInput value={weather} onChangeText={setWeather} style={flowStyles.input} />
        </Field>
        <Field label="Ambient Temp">
          <TextInput value={ambientTemp} onChangeText={setAmbientTemp} style={flowStyles.input} />
        </Field>
        <Field label="Concrete Supplier">
          <TextInput value={concreteSupplier} onChangeText={setConcreteSupplier} style={flowStyles.input} />
        </Field>
        <Field label="Submitted By">
          <TextInput value={submittedBy} onChangeText={setSubmittedBy} style={flowStyles.input} />
        </Field>
      </Section>

      <Section title="Shafts / Foundations">
        {foundations.map((foundation, index) => (
          activeFoundationIndex !== index ? (
            <FoundationSummaryCard
              key={`foundation-summary-${index}`}
              foundation={foundation}
              index={index}
              onPress={() => setActiveFoundationIndex((current) => current === index ? null : index)}
            />
          ) : (
          <View key={`foundation-${index}`} style={[flowStyles.subCard, flowStyles.activeTruckCard]}>
            <Text style={flowStyles.subCardTitle}>Shaft {index + 1}</Text>
            <Field label="Foundation ID">
              <TextInput value={foundation.foundation_id} onChangeText={(value) => updateFoundation(index, 'foundation_id', value)} style={flowStyles.input} />
            </Field>
            <Field label="Design Depth">
              <TextInput value={foundation.total_depth} onChangeText={(value) => updateFoundation(index, 'total_depth', value)} style={flowStyles.input} />
            </Field>
            <Field label="Actual Hole Depth">
              <TextInput value={foundation.actual_hole_depth} onChangeText={(value) => updateFoundation(index, 'actual_hole_depth', value)} style={flowStyles.input} />
            </Field>
            <Field label="Estimated Yards">
              <TextInput value={foundation.estimated_yards} onChangeText={(value) => updateFoundation(index, 'estimated_yards', value)} style={flowStyles.input} />
            </Field>
            <Field label="Shaft Diameter">
              <TextInput value={foundation.shaft_diameter} onChangeText={(value) => updateFoundation(index, 'shaft_diameter', value)} style={flowStyles.input} />
            </Field>
            <Field label="Anchor Bolt Projection">
              <TextInput value={foundation.anchor_bolt_projection} onChangeText={(value) => updateFoundation(index, 'anchor_bolt_projection', value)} style={flowStyles.input} />
            </Field>
            <Field label="Notes">
              <TextInput value={foundation.notes} onChangeText={(value) => updateFoundation(index, 'notes', value)} style={[flowStyles.input, flowStyles.textArea]} multiline />
            </Field>
            {foundations.length > 1 ? (
              <Pressable style={flowStyles.secondaryButton} onPress={() => removeFoundation(index)}>
                <Text style={flowStyles.secondaryButtonText}>Remove Shaft</Text>
              </Pressable>
            ) : null}
          </View>
          )
        ))}
        <Pressable style={flowStyles.secondaryButton} onPress={addFoundation}>
          <Text style={flowStyles.secondaryButtonText}>Add Shaft</Text>
        </Pressable>
      </Section>

      <Section title="Concrete Trucks">
        {trucks.map((truck, index) => (
          activeTruckIndex !== index ? (
            <TruckSummaryCard
              key={`truck-summary-${index}`}
              truck={truck}
              index={index}
              onPress={() => setActiveTruckIndex((current) => current === index ? null : index)}
            />
          ) : (
          <View key={`truck-${index}`} style={[flowStyles.subCard, flowStyles.activeTruckCard]}>
            <View style={flowStyles.truckEditHeader}>
              <Text style={flowStyles.subCardTitle}>Truck {index + 1}</Text>
              <Text style={flowStyles.activeTruckBadge}>Active</Text>
            </View>
            <Field label="Truck ID / Unit #">
              <TextInput value={truck.truck_number} onChangeText={(value) => updateTruck(index, 'truck_number', value)} style={flowStyles.input} />
            </Field>
            <Field label="Batch Time">
              <TimeSelectorField value={truck.batch_time} onChange={(value) => updateTruck(index, 'batch_time', value)} />
            </Field>
            <Field label="Arrival Time">
              <TimeSelectorField value={truck.arrival_time} onChange={(value) => updateTruck(index, 'arrival_time', value)} />
            </Field>
            <Field label="Pour Start">
              <TimeSelectorField value={truck.pour_start} onChange={(value) => updateTruck(index, 'pour_start', value)} />
            </Field>
            <Field label="Pour Complete">
              <TimeSelectorField value={truck.pour_complete} onChange={(value) => updateTruck(index, 'pour_complete', value)} />
            </Field>
            <Field label="Yards">
              <TextInput value={truck.yards} onChangeText={(value) => updateTruck(index, 'yards', value)} style={flowStyles.input} />
            </Field>
            <Field label="Concrete Temp">
              <TextInput value={truck.concrete_temp} onChangeText={(value) => updateTruck(index, 'concrete_temp', value)} style={flowStyles.input} />
            </Field>
            <Field label="Slump">
              <TextInput value={truck.slump} onChangeText={(value) => updateTruck(index, 'slump', value)} style={flowStyles.input} />
            </Field>
            <Field label="Air Content">
              <TextInput value={truck.air_content} onChangeText={(value) => updateTruck(index, 'air_content', value)} style={flowStyles.input} />
            </Field>
            <Field label="Water Added">
              <TextInput value={truck.water_added} onChangeText={(value) => updateTruck(index, 'water_added', value)} style={flowStyles.input} />
            </Field>
            <Field label="Cylinders Cast">
              <TextInput value={truck.cylinders_cast} onChangeText={(value) => updateTruck(index, 'cylinders_cast', value)} style={flowStyles.input} />
            </Field>
            <Field label="Rejected Truck">
              <BooleanChoice value={truck.rejected} onChange={(value) => updateTruck(index, 'rejected', value)} />
            </Field>
            {!truck.rejected && foundations.filter((foundation) => foundation.foundation_id.trim()).length > 0 ? (
              <>
                <Field label="Foundations Served">
                  <View style={flowStyles.choiceRow}>
                    {foundations.filter((foundation) => foundation.foundation_id.trim()).map((foundation) => {
                      const selected = truck.foundations_served.includes(foundation.foundation_id)
                      return (
                        <Pressable
                          key={`${index}-${foundation.foundation_id}`}
                          style={[flowStyles.choiceButton, selected && flowStyles.choiceButtonActive]}
                          onPress={() => toggleTruckFoundation(index, foundation.foundation_id)}
                        >
                          <Text style={[flowStyles.choiceButtonText, selected && flowStyles.choiceButtonTextActive]}>{foundation.foundation_id}</Text>
                        </Pressable>
                      )
                    })}
                  </View>
                </Field>
                {truck.foundations_served.map((foundationId) => (
                  <Field key={`${index}-${foundationId}-depth`} label={`${foundationId} Finish Depth`}>
                    <TextInput
                      value={truck.shaft_depths[foundationId] || ''}
                      onChangeText={(value) => setTruckFoundationDepth(index, foundationId, value)}
                      style={flowStyles.input}
                      placeholder='e.g. 0"'
                    />
                  </Field>
                ))}
                <Field label="Estimated Leftover Yards">
                  <TextInput value={truck.estimated_leftover_yards} onChangeText={(value) => updateTruck(index, 'estimated_leftover_yards', value)} style={flowStyles.input} />
                </Field>
              </>
            ) : null}
            <Field label="Notes">
              <TextInput value={truck.notes} onChangeText={(value) => updateTruck(index, 'notes', value)} style={[flowStyles.input, flowStyles.textArea]} multiline />
            </Field>
            {trucks.length > 1 ? (
              <Pressable style={flowStyles.secondaryButton} onPress={() => removeTruck(index)}>
                <Text style={flowStyles.secondaryButtonText}>Remove Truck</Text>
              </Pressable>
            ) : null}
          </View>
          )
        ))}
        <Pressable style={flowStyles.secondaryButton} onPress={addTruck}>
          <Text style={flowStyles.secondaryButtonText}>Add Truck</Text>
        </Pressable>
        <Pressable style={flowStyles.secondaryButton} onPress={duplicateActiveTruck}>
          <Text style={flowStyles.secondaryButtonText}>Duplicate Test Fields</Text>
        </Pressable>
      </Section>

      <PhotoAttachmentsSection
        photos={photos}
        onPickLibrary={pickFromLibrary}
        onPickCamera={takePhoto}
        onRemove={removePhoto}
        busy={saving || uploadingPhotos}
      />

      <View style={flowStyles.infoCardMuted}>
        <Text style={flowStyles.infoCardText}>
          Native pour log create is optimized for speed. Advanced edits can still be handled later through the website.
        </Text>
      </View>

      <Pressable style={[flowStyles.primaryButton, saving && flowStyles.buttonDisabled]} onPress={handleSubmit} disabled={saving}>
        <Text style={flowStyles.primaryButtonText}>{saving ? (uploadingPhotos ? 'Uploading Photos…' : 'Saving…') : 'Submit Pour Log'}</Text>
      </Pressable>
    </ScrollView>
  )
}

export function NativeFlatworkPourLogScreen({
  session,
  projectId,
  projectName,
  onBack,
  onCreated,
}: {
  session: Session
  projectId: string
  projectName: string
  onBack: () => void
  onCreated: (id: string) => void
}) {
  const [logDate, setLogDate] = useState(getToday())
  const [weather, setWeather] = useState('')
  const [ambientTemp, setAmbientTemp] = useState('')
  const [concreteSupplier, setConcreteSupplier] = useState('')
  const [submittedBy, setSubmittedBy] = useState('')
  const [photos, setPhotos] = useState<UploadPhotoFile[]>([])
  const [sections, setSections] = useState([createInitialFlatworkSection()])
  const [trucks, setTrucks] = useState([createInitialFlatworkTruck('')])
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draftReady, setDraftReady] = useState(false)
  const [draftStatus, setDraftStatus] = useState<DraftStatus>('Saved')
  const [activeSectionIndex, setActiveSectionIndex] = useState<number | null>(null)
  const [activeTruckIndex, setActiveTruckIndex] = useState<number | null>(null)
  const draftKey = `mobile:pour-log:draft:${projectId}:flatwork`
  const skipNextDraftSave = useRef(false)

  useEffect(() => {
    const draft = getLocalDraft(draftKey)
    if (draft) {
      setLogDate(asText(draft.logDate) || getToday())
      setWeather(asText(draft.weather))
      setAmbientTemp(asText(draft.ambientTemp))
      setConcreteSupplier(asText(draft.concreteSupplier))
      setSubmittedBy(asText(draft.submittedBy))
      setPhotos(restoreUploadPhotos(draft.photos))
      setSections(Array.isArray(draft.sections) && draft.sections.length ? draft.sections : [createInitialFlatworkSection()])
      setTrucks(Array.isArray(draft.trucks) && draft.trucks.length ? draft.trucks : [createInitialFlatworkTruck('')])
      setActiveSectionIndex(draft.activeSectionIndex == null ? null : Number.isFinite(Number(draft.activeSectionIndex)) ? Number(draft.activeSectionIndex) : null)
      setActiveTruckIndex(draft.activeTruckIndex == null ? null : Number.isFinite(Number(draft.activeTruckIndex)) ? Number(draft.activeTruckIndex) : null)
      setDraftStatus('Draft saved')
      skipNextDraftSave.current = true
    }
    setDraftReady(true)
  }, [draftKey])

  const saveDraftNow = useCallback(() => {
    if (!draftReady || saving) return false

    const saved = setLocalDraft(draftKey, {
      logDate,
      weather,
      ambientTemp,
      concreteSupplier,
      submittedBy,
      photos,
      sections,
      trucks,
      activeSectionIndex,
      activeTruckIndex,
    })
    setDraftStatus(saved ? 'Draft saved' : 'Unsaved changes')
    return saved
  }, [activeSectionIndex, activeTruckIndex, ambientTemp, concreteSupplier, draftKey, draftReady, logDate, photos, saving, sections, submittedBy, trucks, weather])

  useEffect(() => {
    if (!draftReady || saving) return
    if (skipNextDraftSave.current) {
      skipNextDraftSave.current = false
      return
    }

    setDraftStatus('Unsaved changes')
    const timeoutId = setTimeout(() => {
      setDraftStatus('Saving')
      saveDraftNow()
    }, 350)

    return () => clearTimeout(timeoutId)
  }, [activeSectionIndex, activeTruckIndex, ambientTemp, concreteSupplier, draftKey, draftReady, logDate, photos, saveDraftNow, saving, sections, submittedBy, trucks, weather])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') saveDraftNow()
    })

    return () => subscription.remove()
  }, [saveDraftNow])

  useEffect(() => {
    setActiveSectionIndex((current) => {
      if (current == null || sections.length === 0) return null
      return Math.max(0, Math.min(current, sections.length - 1))
    })
  }, [sections.length])

  useEffect(() => {
    setActiveTruckIndex((current) => {
      if (current == null || trucks.length === 0) return null
      return Math.max(0, Math.min(current, trucks.length - 1))
    })
  }, [trucks.length])

  useEffect(() => {
    let cancelled = false
    async function loadWeather() {
      setWeatherLoading(true)
      try {
        const result = await fetch(buildWebUrl(`/api/weather/${projectId}?date=${logDate}`)).then((response) => response.json())
        if (!cancelled && result?.weather && !weather) setWeather(result.weather)
      } catch {}
      if (!cancelled) setWeatherLoading(false)
    }
    if (projectId && logDate) loadWeather()
    return () => {
      cancelled = true
    }
  }, [projectId, logDate])

  function updateSection(index: number, key: string, value: string) {
    setSections((current) => current.map((section, sectionIndex) => sectionIndex === index ? { ...section, [key]: value } : section))
  }

  function addSection() {
    setSections((current) => {
      setActiveSectionIndex(current.length)
      return [...current, createInitialFlatworkSection()]
    })
  }

  function removeSection(index: number) {
    setSections((current) => current.filter((_, sectionIndex) => sectionIndex !== index))
    setActiveSectionIndex((current) => {
      if (current == null || current === index) return null
      return current > index ? current - 1 : current
    })
  }

  function updateTruck(index: number, key: string, value: string) {
    setTrucks((current) => current.map((truck, truckIndex) => truckIndex === index ? { ...truck, [key]: value } : truck))
  }

  function addTruck() {
    setTrucks((current) => {
      const nextTruck = createInitialFlatworkTruck('')
      setActiveTruckIndex(current.length)
      return [...current, nextTruck]
    })
  }

  function duplicateActiveTruck() {
    setTrucks((current) => {
      const sourceTruck = activeTruckIndex == null ? current[current.length - 1] : current[activeTruckIndex] || current[current.length - 1]
      const nextTruck = {
        ...createInitialFlatworkTruck(''),
        concrete_temp: sourceTruck?.concrete_temp || '',
        slump: sourceTruck?.slump || '',
        air_content: sourceTruck?.air_content || '',
        water_added: sourceTruck?.water_added || '',
        cylinders_cast: sourceTruck?.cylinders_cast || '',
      }
      setActiveTruckIndex(current.length)
      return [...current, nextTruck]
    })
  }

  function removeTruck(index: number) {
    setTrucks((current) => current.filter((_, truckIndex) => truckIndex !== index))
    setActiveTruckIndex((current) => {
      if (current == null || current === index) return null
      return current > index ? current - 1 : current
    })
  }

  async function pickFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access to attach pour log photos.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10,
    })

    if (!result.canceled) {
      setPhotos((current) => [...current, ...mapPickedAssets(result.assets, 'pour-log-photo')])
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access to attach pour log photos.')
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    })

    if (!result.canceled) {
      setPhotos((current) => [...current, ...mapPickedAssets(result.assets, 'pour-log-photo')])
    }
  }

  function removePhoto(index: number) {
    setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))
  }

  async function handleSubmit() {
    if (saving) return
    setSaving(true)
    try {
      let photoUrls: string[] = []
      if (photos.length > 0) {
        setUploadingPhotos(true)
        const uploaded = await uploadPhotos('pour-logs', photos, session, projectId)
        photoUrls = uploaded.urls
      }

      const result = await createPourLog({
        project_id: projectId,
        project_name: projectName,
        log_type: 'flatwork',
        log_date: logDate,
        weather,
        ambient_temp: ambientTemp,
        concrete_supplier: concreteSupplier,
        submitted_by: submittedBy,
        photo_urls: photoUrls,
        sections,
        trucks,
      }, session)
      clearLocalDraft(draftKey)
      setDraftStatus('Saved')
      onCreated(result.id)
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Could not create the pour log.')
    } finally {
      setUploadingPhotos(false)
      setSaving(false)
    }
  }

  return (
    <ScrollView style={flowStyles.screen} contentContainerStyle={flowStyles.content}>
      <GuardedBackLink hasUnsavedChanges={draftStatus === 'Unsaved changes' || draftStatus === 'Saving'} onBack={onBack} />

      <View style={flowStyles.hero}>
        <Text style={flowStyles.heroEyebrow}>Pour Log</Text>
        <Text style={flowStyles.heroTitle}>{projectName}</Text>
        <Text style={flowStyles.heroSubtitle}>Native flatwork create flow. Photo attachments can still be added later on the web.</Text>
      </View>

      <DraftStatusPill status={draftStatus} />

      <Section title="Job Info">
        <Field label="Date">
          <TextInput value={logDate} onChangeText={setLogDate} style={flowStyles.input} placeholder="YYYY-MM-DD" />
        </Field>
        <Field label={`Weather${weatherLoading ? ' (loading...)' : ''}`}>
          <TextInput value={weather} onChangeText={setWeather} style={flowStyles.input} />
        </Field>
        <Field label="Ambient Temp">
          <TextInput value={ambientTemp} onChangeText={setAmbientTemp} style={flowStyles.input} />
        </Field>
        <Field label="Concrete Supplier">
          <TextInput value={concreteSupplier} onChangeText={setConcreteSupplier} style={flowStyles.input} />
        </Field>
        <Field label="Submitted By">
          <TextInput value={submittedBy} onChangeText={setSubmittedBy} style={flowStyles.input} />
        </Field>
      </Section>

      <Section title="Foundation Info">
        {sections.map((section, index) => (
          activeSectionIndex !== index ? (
            <FlatworkSectionSummaryCard
              key={`section-summary-${index}`}
              section={section}
              index={index}
              onPress={() => setActiveSectionIndex((current) => current === index ? null : index)}
            />
          ) : (
          <View key={`section-${index}`} style={[flowStyles.subCard, flowStyles.activeTruckCard]}>
            <Text style={flowStyles.subCardTitle}>Section {index + 1}</Text>
            <Field label="Type">
              <BooleanChoice
                value={section.section_type}
                onChange={(value) => updateSection(index, 'section_type', value)}
                options={[
                  { label: 'Slab', value: 'Slab' },
                  { label: 'Spread Footer', value: 'Spread Footer' },
                ]}
              />
            </Field>
            <Field label="Section / Area Name">
              <TextInput value={section.foundation_id} onChangeText={(value) => updateSection(index, 'foundation_id', value)} style={flowStyles.input} />
            </Field>
            {section.section_type === 'Slab' ? (
              <Field label="Square Footage">
                <TextInput value={section.square_footage} onChangeText={(value) => updateSection(index, 'square_footage', value)} style={flowStyles.input} />
              </Field>
            ) : null}
            <Field label="Thickness / Depth">
              <TextInput value={section.total_depth} onChangeText={(value) => updateSection(index, 'total_depth', value)} style={flowStyles.input} />
            </Field>
            <Field label="Estimated Yards">
              <TextInput value={section.estimated_yards} onChangeText={(value) => updateSection(index, 'estimated_yards', value)} style={flowStyles.input} />
            </Field>
            <Field label="Notes">
              <TextInput value={section.notes} onChangeText={(value) => updateSection(index, 'notes', value)} style={[flowStyles.input, flowStyles.textArea]} multiline />
            </Field>
            {sections.length > 1 ? (
              <Pressable style={flowStyles.secondaryButton} onPress={() => removeSection(index)}>
                <Text style={flowStyles.secondaryButtonText}>Remove Section</Text>
              </Pressable>
            ) : null}
          </View>
          )
        ))}
        <Pressable style={flowStyles.secondaryButton} onPress={addSection}>
          <Text style={flowStyles.secondaryButtonText}>Add Section</Text>
        </Pressable>
      </Section>

      <Section title="Concrete Trucks">
        {trucks.map((truck, index) => (
          activeTruckIndex !== index ? (
            <TruckSummaryCard
              key={`truck-flatwork-summary-${index}`}
              truck={truck}
              index={index}
              onPress={() => setActiveTruckIndex((current) => current === index ? null : index)}
            />
          ) : (
          <View key={`truck-flatwork-${index}`} style={[flowStyles.subCard, flowStyles.activeTruckCard]}>
            <View style={flowStyles.truckEditHeader}>
              <Text style={flowStyles.subCardTitle}>Truck {index + 1}</Text>
              <Text style={flowStyles.activeTruckBadge}>Active</Text>
            </View>
            <Field label="Truck ID / Unit #">
              <TextInput value={truck.truck_number} onChangeText={(value) => updateTruck(index, 'truck_number', value)} style={flowStyles.input} />
            </Field>
            <Field label="Batch Time">
              <TimeSelectorField value={truck.batch_time} onChange={(value) => updateTruck(index, 'batch_time', value)} />
            </Field>
            <Field label="Arrival Time">
              <TimeSelectorField value={truck.arrival_time} onChange={(value) => updateTruck(index, 'arrival_time', value)} />
            </Field>
            <Field label="Pour Start">
              <TimeSelectorField value={truck.pour_start} onChange={(value) => updateTruck(index, 'pour_start', value)} />
            </Field>
            <Field label="Pour Complete">
              <TimeSelectorField value={truck.pour_complete} onChange={(value) => updateTruck(index, 'pour_complete', value)} />
            </Field>
            <Field label="Yards">
              <TextInput value={truck.yards} onChangeText={(value) => updateTruck(index, 'yards', value)} style={flowStyles.input} />
            </Field>
            <Field label="Concrete Temp">
              <TextInput value={truck.concrete_temp} onChangeText={(value) => updateTruck(index, 'concrete_temp', value)} style={flowStyles.input} />
            </Field>
            <Field label="Slump">
              <TextInput value={truck.slump} onChangeText={(value) => updateTruck(index, 'slump', value)} style={flowStyles.input} />
            </Field>
            <Field label="Air Content">
              <TextInput value={truck.air_content} onChangeText={(value) => updateTruck(index, 'air_content', value)} style={flowStyles.input} />
            </Field>
            <Field label="Water Added">
              <TextInput value={truck.water_added} onChangeText={(value) => updateTruck(index, 'water_added', value)} style={flowStyles.input} />
            </Field>
            <Field label="Cylinders Cast">
              <TextInput value={truck.cylinders_cast} onChangeText={(value) => updateTruck(index, 'cylinders_cast', value)} style={flowStyles.input} />
            </Field>
            <Field label="Notes">
              <TextInput value={truck.notes} onChangeText={(value) => updateTruck(index, 'notes', value)} style={[flowStyles.input, flowStyles.textArea]} multiline />
            </Field>
            {trucks.length > 1 ? (
              <Pressable style={flowStyles.secondaryButton} onPress={() => removeTruck(index)}>
                <Text style={flowStyles.secondaryButtonText}>Remove Truck</Text>
              </Pressable>
            ) : null}
          </View>
          )
        ))}
        <Pressable style={flowStyles.secondaryButton} onPress={addTruck}>
          <Text style={flowStyles.secondaryButtonText}>Add Truck</Text>
        </Pressable>
        <Pressable style={flowStyles.secondaryButton} onPress={duplicateActiveTruck}>
          <Text style={flowStyles.secondaryButtonText}>Duplicate Test Fields</Text>
        </Pressable>
      </Section>

      <PhotoAttachmentsSection
        photos={photos}
        onPickLibrary={pickFromLibrary}
        onPickCamera={takePhoto}
        onRemove={removePhoto}
        busy={saving || uploadingPhotos}
      />

      <View style={flowStyles.infoCardMuted}>
        <Text style={flowStyles.infoCardText}>
          Native pour log create is optimized for speed. Advanced edits can still be handled later through the website.
        </Text>
      </View>

      <Pressable style={[flowStyles.primaryButton, saving && flowStyles.buttonDisabled]} onPress={handleSubmit} disabled={saving}>
        <Text style={flowStyles.primaryButtonText}>{saving ? (uploadingPhotos ? 'Uploading Photos…' : 'Saving…') : 'Submit Pour Log'}</Text>
      </Pressable>
    </ScrollView>
  )
}

const flowStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3efe8',
  },
  centeredState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  content: {
    padding: 18,
    paddingBottom: 36,
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
  hero: {
    backgroundColor: '#143a52',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },
  heroEyebrow: {
    color: '#d7e5ef',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  heroSubtitle: {
    color: '#d7e5ef',
    fontSize: 14,
    lineHeight: 20,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#1d1c1b',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  field: {
    marginBottom: 12,
  },
  label: {
    color: '#383431',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
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
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeValueButton: {
    flex: 1,
    justifyContent: 'center',
  },
  timeValueText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '700',
  },
  timeValuePlaceholder: {
    color: '#8f857a',
    fontWeight: '500',
  },
  timePickerWrap: {
    marginTop: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#f7f4ef',
  },
  choiceButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d8d0c7',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  choiceButtonActive: {
    backgroundColor: '#b44a12',
    borderColor: '#b44a12',
  },
  choiceButtonText: {
    color: '#4d433a',
    fontSize: 13,
    fontWeight: '700',
  },
  choiceButtonTextActive: {
    color: '#fff',
  },
  infoCard: {
    backgroundColor: '#fff8ee',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#f0dcc0',
  },
  infoCardMuted: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e4ded6',
  },
  infoCardTitle: {
    color: '#8a4a00',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  infoCardText: {
    color: '#72583b',
    fontSize: 14,
    lineHeight: 20,
  },
  draftStatusPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e4ded6',
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 12,
  },
  draftStatusText: {
    color: '#5e554d',
    fontSize: 12,
    fontWeight: '800',
  },
  mutedText: {
    color: '#6b655d',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: '#b44a12',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 24,
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d8d0c7',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
  },
  secondaryButtonText: {
    color: '#5e554d',
    fontSize: 14,
    fontWeight: '800',
  },
  actionButton: {
    minWidth: 140,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.55,
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
    textAlign: 'center',
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
  listCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },
  listCode: {
    color: '#8a4a00',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  listTitle: {
    color: '#1d1c1b',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  subCard: {
    backgroundColor: '#f7f4ef',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  activeTruckCard: {
    borderWidth: 2,
    borderColor: '#b44a12',
    backgroundColor: '#fffaf3',
  },
  truckEditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  activeTruckBadge: {
    color: '#fff',
    backgroundColor: '#b44a12',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '800',
  },
  truckSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e4ded6',
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  truckSummaryMain: {
    flex: 1,
  },
  truckSummaryTitle: {
    color: '#1d1c1b',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 3,
  },
  truckSummaryText: {
    color: '#6b655d',
    fontSize: 13,
    lineHeight: 18,
  },
  truckSummaryAction: {
    color: '#b44a12',
    fontSize: 13,
    fontWeight: '800',
  },
  subCardTitle: {
    color: '#1d1c1b',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  statCard: {
    flexGrow: 1,
    minWidth: 74,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
  },
  statLabel: {
    color: '#6b655d',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  statValue: {
    color: '#1d1c1b',
    fontSize: 20,
    fontWeight: '800',
  },
  photoCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    marginBottom: 12,
    overflow: 'hidden',
  },
  photoPickerRow: {
    gap: 10,
    paddingTop: 4,
  },
  selectedPhotoCard: {
    width: 140,
    backgroundColor: '#f7f4ef',
    borderRadius: 14,
    padding: 8,
  },
  selectedPhotoImage: {
    width: '100%',
    height: 96,
    borderRadius: 10,
    backgroundColor: '#ddd6ce',
    marginBottom: 8,
  },
  selectedPhotoName: {
    color: '#4d433a',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  removeChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d8d0c7',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  removeChipText: {
    color: '#8a4a00',
    fontSize: 12,
    fontWeight: '800',
  },
  galleryImage: {
    width: '100%',
    height: 220,
  },
  photoCardBody: {
    padding: 14,
  },
  photoBadge: {
    color: '#8a4a00',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  photoCardTitle: {
    color: '#1d1c1b',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  photoMeta: {
    color: '#6d665f',
    fontSize: 13,
    lineHeight: 18,
  },
})
