import { describe, expect, it, vi } from 'vitest'
import {
  buildPath, dashboardUrl, formatChange, formatDuration, isValidSiteId, loadPageReport, loadSiteReport,
  normalizePeriod, readSettings, trackerSnippet, PrivatusError,
} from '../src/lib'

const settings = { apiToken: 'pat_test', siteId: 'pa_ABC123', period: '30d' as const, paths: {} }

function okFetch(byPath: Record<string, unknown>) {
  return vi.fn(async (url: string, _init?: RequestInit) => {
    const key = Object.keys(byPath).find((k) => url.includes(k))
    return new Response(JSON.stringify({ data: key ? byPath[key] : {} }), { status: 200 })
  })
}

describe('site id and snippet', () => {
  it('validates site ids', () => {
    expect(isValidSiteId('pa_ABC123')).toBe(true)
    expect(isValidSiteId('pa_')).toBe(false)
    expect(isValidSiteId('pa_abc"><script>')).toBe(false)
    expect(isValidSiteId(42)).toBe(false)
  })

  it('builds the tracker tag and never echoes a bad id', () => {
    expect(trackerSnippet('pa_ABC123')).toBe(
      '<script defer src="https://privatusstats.com/js/pa.js" data-site="pa_ABC123" data-modules="engage,auto,vitals,clicks,ask"></script>',
    )
    expect(trackerSnippet('"><img src=x>')).toContain('data-site="pa_YOURSITEID"')
  })
})

describe('readSettings', () => {
  it('fills defaults and drops empty paths', () => {
    expect(readSettings(undefined)).toEqual({ apiToken: '', siteId: '', period: '30d', paths: {} })
    expect(readSettings({ apiToken: ' pat_x ', siteId: 'pa_A', period: '7d', paths: { post: ' /blog/{slug} ', page: '', bad: 3 } })).toEqual({
      apiToken: 'pat_x', siteId: 'pa_A', period: '7d', paths: { post: '/blog/{slug}' },
    })
    expect(normalizePeriod('forever')).toBe('30d')
  })
})

describe('buildPath', () => {
  it('fills placeholders from form values', () => {
    expect(buildPath('/blog/{slug}', { slug: 'hello-world' }, 'en')).toBe('/blog/hello-world')
  })
  it('reads localized fields for the current locale', () => {
    expect(buildPath('/{locale}/blog/{slug}', { slug: { en: 'hello', it: 'ciao' } }, 'it')).toBe('/it/blog/ciao')
  })
  it('returns null while a value is missing', () => {
    expect(buildPath('/blog/{slug}', { slug: '' }, 'en')).toBeNull()
    expect(buildPath('/blog/{slug}', { slug: { en: 'x' } }, 'de')).toBeNull()
    expect(buildPath('', {}, 'en')).toBeNull()
  })
  it('keeps only the path of a full URL and tidies slashes', () => {
    expect(buildPath('https://example.com/docs/{slug}/?ref=x#top', { slug: '/a/b/' }, 'en')).toBe('/docs/a/b')
    expect(buildPath('about', {}, 'en')).toBe('/about')
    expect(buildPath('/', {}, 'en')).toBe('/')
  })
  it('accepts numbers', () => {
    expect(buildPath('/p/{id}', { id: 12 }, 'en')).toBe('/p/12')
  })
})

describe('API calls', () => {
  it('loads a page report with a page filter and comparison', async () => {
    const fetchImpl = okFetch({
      'stats/aggregate.json': { metrics: { visitors: 12, pageviews: 30 }, change: { visitors: 20 } },
      'breakdown/channel.json': { rows: [{ value: 'organic_search', visitors: 8 }] },
    })
    const report = await loadPageReport(settings, '/blog/hello', fetchImpl)
    expect(report.metrics.visitors).toBe(12)
    expect(report.metrics.bounce_rate).toBe(0)
    expect(report.change).toEqual({ visitors: 20 })
    expect(report.rows).toHaveLength(1)

    const urls = fetchImpl.mock.calls.map((c) => new URL(c[0] as string))
    const agg = urls.find((u) => u.pathname.endsWith('/stats/aggregate.json'))!
    expect(agg.origin).toBe('https://privatusanalytics.com')
    expect(agg.pathname).toBe('/sites/pa_ABC123/stats/aggregate.json')
    expect(agg.searchParams.get('period')).toBe('30d')
    expect(agg.searchParams.get('compare')).toBe('previous_period')
    expect(JSON.parse(agg.searchParams.get('filters')!)).toEqual([['page', 'is', '/blog/hello']])
    const init = fetchImpl.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer pat_test')
  })

  it('loads a site report with top pages', async () => {
    const fetchImpl = okFetch({
      'stats/aggregate.json': { metrics: { visitors: 5 } },
      'breakdown/page.json': { rows: [{ value: '/', pageviews: 9 }] },
    })
    const report = await loadSiteReport(settings, fetchImpl)
    expect(report.rows[0]).toEqual({ value: '/', pageviews: 9 })
    const pages = fetchImpl.mock.calls.map((c) => new URL(c[0] as string)).find((u) => u.pathname.endsWith('page.json'))!
    expect(pages.searchParams.get('limit')).toBe('10')
    expect(pages.searchParams.get('filters')).toBeNull()
  })

  it('refuses to call without settings', async () => {
    const fetchImpl = vi.fn()
    await expect(loadSiteReport({ ...settings, apiToken: '' }, fetchImpl)).rejects.toThrow(/API token/)
    await expect(loadSiteReport({ ...settings, siteId: 'nope' }, fetchImpl)).rejects.toThrow(/site ID/)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('explains auth and network errors', async () => {
    const unauthorized = vi.fn(async () => new Response('{}', { status: 401 }))
    await expect(loadSiteReport(settings, unauthorized)).rejects.toMatchObject({ status: 401, message: expect.stringMatching(/not accepted/) })
    const offline = vi.fn(async () => {
      throw new TypeError('fail')
    })
    await expect(loadSiteReport(settings, offline)).rejects.toBeInstanceOf(PrivatusError)
    const server = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Bad period' } }), { status: 422 }))
    await expect(loadSiteReport(settings, server)).rejects.toThrow('Bad period')
  })
})

describe('formatting', () => {
  it('formats change and duration', () => {
    expect(formatChange(12.34)).toBe('+12.3%')
    expect(formatChange(-5)).toBe('-5%')
    expect(formatChange(null)).toBe('')
    expect(formatDuration(65_000)).toBe('1m 5s')
    expect(formatDuration(4_000)).toBe('4s')
  })
  it('links to the dashboard', () => {
    expect(dashboardUrl('pa_ABC123', '/blog/a b')).toBe('https://privatusanalytics.com/sites/pa_ABC123/pages/detail?path=%2Fblog%2Fa+b')
    expect(dashboardUrl('bad')).toBe('https://privatusanalytics.com')
  })
})
