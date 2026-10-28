import { useEffect, useState } from 'react'
import type { RenderPageCtx } from 'datocms-plugin-sdk'
import { Canvas } from 'datocms-react-ui'
import { dashboardUrl, formatNumber, isValidSiteId, loadSiteReport, periodLabel, readSettings, type Report } from '../lib'
import { Stats } from './Stats'
import '../styles.css'

export default function OverviewPage({ ctx }: { ctx: RenderPageCtx }) {
  const settings = readSettings(ctx.plugin.attributes.parameters)
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    loadSiteReport(settings)
      .then((r) => live && setReport(r))
      .catch((e: Error) => live && setError(e.message))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.siteId, settings.apiToken, settings.period])

  return (
    <Canvas ctx={ctx}>
      <div className="pa-page">
        <h1 className="pa-h">Website analytics: {periodLabel(settings.period)}</h1>
        {error && <p className="pa-error">{error}</p>}
        {!error && !report && <p className="pa-muted">Loading…</p>}
        {report && (
          <>
            <Stats metrics={report.metrics} change={report.change} />
            <h2 className="pa-h">Top pages</h2>
            {report.rows.length === 0 ? (
              <p className="pa-muted">No page views yet. Check that the tracker tag is on your website.</p>
            ) : (
              <ul className="pa-list">
                {report.rows.map((row) => (
                  <li key={row.value}>
                    <span>{row.value}</span>
                    <span>{formatNumber(row.pageviews)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {isValidSiteId(settings.siteId) && (
          <p className="pa-muted">
            <a href={dashboardUrl(settings.siteId)} target="_blank" rel="noopener noreferrer">
              Open the full dashboard in Privatus Analytics
            </a>
          </p>
        )}
      </div>
    </Canvas>
  )
}
