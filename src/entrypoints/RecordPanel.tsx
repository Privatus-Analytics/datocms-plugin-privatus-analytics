import { useEffect, useState } from 'react'
import type { RenderItemFormSidebarPanelCtx } from 'datocms-plugin-sdk'
import { Canvas } from 'datocms-react-ui'
import { buildPath, channelLabel, dashboardUrl, formatNumber, loadPageReport, periodLabel, readSettings, type Report } from '../lib'
import { Stats } from './Stats'
import '../styles.css'

export default function RecordPanel({ ctx }: { ctx: RenderItemFormSidebarPanelCtx }) {
  const settings = readSettings(ctx.plugin.attributes.parameters)
  const template = settings.paths[ctx.itemType.attributes.api_key] ?? ''
  const path = buildPath(template, ctx.formValues, ctx.locale)
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!path || ctx.itemStatus === 'new') return
    let live = true
    setReport(null)
    setError('')
    loadPageReport(settings, path)
      .then((r) => live && setReport(r))
      .catch((e: Error) => live && setError(e.message))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, settings.siteId, settings.apiToken, settings.period])

  return (
    <Canvas ctx={ctx}>
      {!path || ctx.itemStatus === 'new' ? (
        <p className="pa-muted">Numbers show up here once this record has a page on your website.</p>
      ) : (
        <>
          <div className="pa-path">{path}</div>
          {error && <p className="pa-error">{error}</p>}
          {!error && !report && <p className="pa-muted">Loading…</p>}
          {report && (
            <>
              <Stats metrics={report.metrics} change={report.change} />
              {report.rows.length > 0 && (
                <ul className="pa-list">
                  {report.rows.map((row) => (
                    <li key={row.value}>
                      <span>{channelLabel(row.value)}</span>
                      <span>{formatNumber(row.visitors ?? row.visits)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="pa-muted">
                {periodLabel(settings.period)}.{' '}
                <a href={dashboardUrl(settings.siteId, path)} target="_blank" rel="noopener noreferrer">
                  Open in Privatus Analytics
                </a>
              </p>
            </>
          )}
        </>
      )}
    </Canvas>
  )
}
