// Pure helpers for the Privatus Analytics DatoCMS plugin.
// API docs: https://privatusanalytics.com/docs/api

export const API_URL = 'https://privatusanalytics.com'
export const SITE_ID = /^pa_[A-Za-z0-9]+$/
export const TOKEN = /^pat_\S+$/
export const DEFAULT_MODULES = 'engage,auto,vitals,clicks,ask'

export const PERIODS = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'Month to date', value: 'mtd' },
  { label: 'Last 12 months', value: '12mo' },
] as const

export type Period = (typeof PERIODS)[number]['value']

export interface Parameters {
  apiToken?: string
  siteId?: string
  period?: string
  // Model API key -> page path template, for example "/blog/{slug}"
  paths?: Record<string, string>
}

export interface Settings {
  apiToken: string
  siteId: string
  period: Period
  paths: Record<string, string>
}

export function readSettings(raw: unknown): Settings {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Parameters
  const paths: Record<string, string> = {}
  if (p.paths && typeof p.paths === 'object') {
    for (const [key, value] of Object.entries(p.paths)) {
      if (typeof value === 'string' && value.trim()) paths[key] = value.trim()
    }
  }
  return {
    apiToken: typeof p.apiToken === 'string' ? p.apiToken.trim() : '',
    siteId: typeof p.siteId === 'string' ? p.siteId.trim() : '',
    period: normalizePeriod(p.period),
    paths,
  }
}

export function normalizePeriod(value: unknown): Period {
  return (PERIODS.find((p) => p.value === value)?.value ?? '30d') as Period
}

export function periodLabel(value: Period): string {
  return PERIODS.find((p) => p.value === value)?.label ?? value
}

export function isValidSiteId(value: unknown): value is string {
  return typeof value === 'string' && SITE_ID.test(value)
}

export function isValidToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN.test(value)
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

// The tag to paste into the <head> of the website that shows DatoCMS content.
export function trackerSnippet(siteId: string): string {
  const id = isValidSiteId(siteId) ? siteId : 'pa_YOURSITEID'
  return `<script defer src="https://privatusstats.com/js/pa.js" data-site="${escapeHtml(id)}" data-modules="${DEFAULT_MODULES}"></script>`
}

function scalar(value: unknown, locale: string): string {
  let v = value
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const localized = v as Record<string, unknown>
    v = locale in localized ? localized[locale] : undefined
  }
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return ''
}

// Turns "/blog/{slug}" into "/blog/hello-world" using the record's form values.
// Returns null when a placeholder has no value yet (a new record, an empty slug).
export function buildPath(template: string, formValues: Record<string, unknown>, locale: string): string | null {
  const t = template.trim()
  if (!t) return null
  let missing = false
  let path = t.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) => {
    const value = key === 'locale' ? locale : scalar(formValues[key], locale)
    if (!value) missing = true
    return value.replace(/^\/+|\/+$/g, '')
  })
  if (missing) return null
  // Accept a full URL in the template and keep only the path.
  path = path.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '')
  path = path.split(/[?#]/)[0]
  if (!path.startsWith('/')) path = `/${path}`
  path = path.replace(/\/{2,}/g, '/')
  if (path.length > 1) path = path.replace(/\/$/, '')
  return path
}

export interface Metrics {
  visitors: number
  visits: number
  pageviews: number
  views_per_visit: number
  bounce_rate: number
  visit_duration: number
}

export type Change = Partial<Record<keyof Metrics, number | null>> | null

export interface Row {
  value: string
  visitors?: number
  visits?: number
  pageviews?: number
  share?: number
}

export interface Report {
  metrics: Metrics
  change: Change
  rows: Row[]
}

export class PrivatusError extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.name = 'PrivatusError'
    this.status = status
  }
}

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>

const EMPTY: Metrics = { visitors: 0, visits: 0, pageviews: 0, views_per_visit: 0, bounce_rate: 0, visit_duration: 0 }

async function getJson(fetchImpl: Fetch, url: string, token: string): Promise<any> {
  let response: Response
  try {
    response = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
  } catch {
    throw new PrivatusError('Could not reach Privatus Analytics. Check your connection.')
  }
  let body: any = null
  try {
    body = await response.json()
  } catch {
    body = null
  }
  if (!response.ok) {
    if (response.status === 401) throw new PrivatusError('The API token was not accepted. Check it in the plugin settings.', 401)
    if (response.status === 403 || response.status === 404) throw new PrivatusError('This token cannot see that site. Check the site ID and the token.', response.status)
    const message = body?.error?.message || `Privatus Analytics responded with status ${response.status}.`
    throw new PrivatusError(message, response.status)
  }
  return body?.data ?? body
}

function check(settings: Settings) {
  if (!settings.apiToken) throw new PrivatusError('Add your Privatus Analytics API token in the plugin settings.')
  if (!isValidSiteId(settings.siteId)) throw new PrivatusError('Add your site ID (it starts with pa_) in the plugin settings.')
}

function query(params: Record<string, string>): string {
  return new URLSearchParams(params).toString()
}

// Numbers for one page, plus the top sources that sent visitors to it.
export async function loadPageReport(settings: Settings, path: string, fetchImpl: Fetch = (i, init) => fetch(i, init)): Promise<Report> {
  check(settings)
  const base = `${API_URL}/sites/${encodeURIComponent(settings.siteId)}`
  const filters = JSON.stringify([['page', 'is', path]])
  const [aggregate, sources] = await Promise.all([
    getJson(fetchImpl, `${base}/stats/aggregate.json?${query({ period: settings.period, compare: 'previous_period', filters })}`, settings.apiToken),
    getJson(fetchImpl, `${base}/breakdown/channel.json?${query({ period: settings.period, limit: '5', filters })}`, settings.apiToken),
  ])
  return {
    metrics: { ...EMPTY, ...(aggregate?.metrics ?? {}) },
    change: aggregate?.change ?? null,
    rows: Array.isArray(sources?.rows) ? sources.rows : [],
  }
}

// Numbers for the whole site, plus the top pages.
export async function loadSiteReport(settings: Settings, fetchImpl: Fetch = (i, init) => fetch(i, init)): Promise<Report> {
  check(settings)
  const base = `${API_URL}/sites/${encodeURIComponent(settings.siteId)}`
  const [aggregate, pages] = await Promise.all([
    getJson(fetchImpl, `${base}/stats/aggregate.json?${query({ period: settings.period, compare: 'previous_period' })}`, settings.apiToken),
    getJson(fetchImpl, `${base}/breakdown/page.json?${query({ period: settings.period, limit: '10' })}`, settings.apiToken),
  ])
  return {
    metrics: { ...EMPTY, ...(aggregate?.metrics ?? {}) },
    change: aggregate?.change ?? null,
    rows: Array.isArray(pages?.rows) ? pages.rows : [],
  }
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat('en').format(Math.round(Number(value || 0)))
}

export function formatPercent(value: number | null | undefined): string {
  return `${Math.round(Number(value || 0) * 10) / 10}%`
}

export function formatDuration(ms: number | null | undefined): string {
  const total = Math.round(Number(ms || 0) / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export function formatChange(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return ''
  const rounded = Math.round(value * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded}%`
}

export function channelLabel(value: string): string {
  const s = String(value || '').replace(/_/g, ' ')
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Unknown'
}

export function dashboardUrl(siteId: string, path?: string | null): string {
  if (!isValidSiteId(siteId)) return 'https://privatusanalytics.com'
  const base = `${API_URL}/sites/${siteId}`
  return path ? `${base}/pages/detail?${query({ path })}` : base
}
