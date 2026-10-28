import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

vi.mock('datocms-react-ui', () => ({ Canvas: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))

import RecordPanel from '../src/entrypoints/RecordPanel'

function ctx(overrides: Record<string, unknown> = {}) {
  return {
    plugin: { attributes: { parameters: { apiToken: 'pat_test', siteId: 'pa_ABC123', period: '7d', paths: { post: '/blog/{slug}' } } } },
    itemType: { attributes: { api_key: 'post' } },
    formValues: { slug: 'hello' },
    locale: 'en',
    itemStatus: 'published',
    ...overrides,
  } as any
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('RecordPanel', () => {
  it('shows page numbers and sources for the record', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      new Response(
        JSON.stringify({
          data: url.includes('aggregate')
            ? { metrics: { visitors: 1234, pageviews: 2000, bounce_rate: 40, visit_duration: 61000 }, change: { visitors: 10 } }
            : { rows: [{ value: 'organic_search', visitors: 900 }] },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<RecordPanel ctx={ctx()} />)
    expect(screen.getByText('/blog/hello')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('1,234')).toBeTruthy())
    expect(screen.getByText('+10%')).toBeTruthy()
    expect(screen.getByText('Organic search')).toBeTruthy()
    expect(screen.getByText('1m 1s')).toBeTruthy()
    expect(screen.getByText('Open in Privatus Analytics').getAttribute('href')).toContain('/sites/pa_ABC123/pages/detail?path=%2Fblog%2Fhello')
  })

  it('waits for a slug before calling the API', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<RecordPanel ctx={ctx({ formValues: { slug: '' } })} />)
    expect(screen.getByText(/once this record has a page/)).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows API errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    render(<RecordPanel ctx={ctx()} />)
    await waitFor(() => expect(screen.getByText(/not accepted/)).toBeTruthy())
  })
})
