import { useMemo, useState } from 'react'
import type { RenderConfigScreenCtx } from 'datocms-plugin-sdk'
import { Button, Canvas, FieldGroup, Form, SelectField, TextField } from 'datocms-react-ui'
import { PERIODS, isValidSiteId, isValidToken, loadSiteReport, readSettings, trackerSnippet, type Period } from '../lib'
import '../styles.css'

type Option = { label: string; value: Period }

export default function ConfigScreen({ ctx }: { ctx: RenderConfigScreenCtx }) {
  const initial = readSettings(ctx.plugin.attributes.parameters)
  const [apiToken, setApiToken] = useState(initial.apiToken)
  const [siteId, setSiteId] = useState(initial.siteId)
  const [period, setPeriod] = useState<Period>(initial.period)
  const [paths, setPaths] = useState<Record<string, string>>(initial.paths)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const models = useMemo(
    () =>
      Object.values(ctx.itemTypes)
        .filter((t): t is NonNullable<typeof t> => Boolean(t) && !t!.attributes.modular_block)
        .sort((a, b) => a.attributes.name.localeCompare(b.attributes.name)),
    [ctx.itemTypes],
  )

  const siteError = siteId && !isValidSiteId(siteId) ? 'A site ID starts with pa_ and has only letters and numbers.' : undefined
  const tokenError = apiToken && !isValidToken(apiToken) ? 'An API token starts with pat_.' : undefined

  const cleanPaths = () => Object.fromEntries(Object.entries(paths).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]))

  async function save() {
    if (siteError || tokenError) return
    setSaving(true)
    try {
      await ctx.updatePluginParameters({ apiToken: apiToken.trim(), siteId: siteId.trim(), period, paths: cleanPaths() })
      ctx.notice('Settings saved.')
    } finally {
      setSaving(false)
    }
  }

  async function test() {
    setTesting(true)
    try {
      const report = await loadSiteReport({ apiToken: apiToken.trim(), siteId: siteId.trim(), period, paths: {} })
      ctx.notice(`Connected. ${report.metrics.visitors} visitors in this period.`)
    } catch (e) {
      ctx.alert((e as Error).message)
    } finally {
      setTesting(false)
    }
  }

  return (
    <Canvas ctx={ctx}>
      <Form onSubmit={save}>
        <p className="pa-muted">
          Cookie pop-ups make visitors leave, and bots make your numbers look bigger than they are. Privatus Analytics counts real
          people without cookies, so you do not need a cookie pop-up. This plugin shows those numbers right next to your content.
          No account yet? <a href="https://privatusanalytics.com" target="_blank" rel="noopener noreferrer">Start free</a>, no card needed.
        </p>
        <FieldGroup>
          <TextField
            id="siteId"
            name="siteId"
            label="Site ID"
            hint="Find it in Privatus Analytics under your site's settings. It looks like pa_ABC123."
            placeholder="pa_YOURSITEID"
            value={siteId}
            onChange={setSiteId}
            error={siteError}
          />
          <TextField
            id="apiToken"
            name="apiToken"
            label="API token"
            hint="Make a token with read-only access in Privatus Analytics under Account, API tokens. Everyone who can use this plugin in DatoCMS can see it, so never use a token that can change things."
            placeholder="pat_..."
            value={apiToken}
            onChange={setApiToken}
            error={tokenError}
            textInputProps={{ type: 'password', autoComplete: 'off' }}
          />
          <SelectField<Option, false, never>
            id="period"
            name="period"
            label="Date range"
            value={PERIODS.find((p) => p.value === period) as Option}
            onChange={(o) => o && setPeriod(o.value)}
            selectInputProps={{ options: PERIODS as unknown as Option[] }}
          />
        </FieldGroup>

        <h2 className="pa-h">Where each record lives on your website</h2>
        <p className="pa-muted">
          Write the page path for each model you want numbers for. Put a field's API key in curly brackets, like /blog/{'{slug}'}. Use{' '}
          {'{locale}'} for the language. Leave a model empty to hide the panel there.
        </p>
        <FieldGroup>
          {models.map((model) => (
            <TextField
              key={model.id}
              id={`path-${model.attributes.api_key}`}
              name={`path-${model.attributes.api_key}`}
              label={model.attributes.name}
              placeholder={model.attributes.singleton ? '/' : `/${model.attributes.api_key}/{slug}`}
              value={paths[model.attributes.api_key] ?? ''}
              onChange={(v) => setPaths((prev) => ({ ...prev, [model.attributes.api_key]: v }))}
            />
          ))}
        </FieldGroup>

        <FieldGroup>
          <Button type="submit" buttonType="primary" disabled={saving || Boolean(siteError || tokenError)}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>{' '}
          <Button type="button" onClick={test} disabled={testing || !apiToken || !isValidSiteId(siteId)}>
            {testing ? 'Checking…' : 'Check connection'}
          </Button>
        </FieldGroup>

        <h2 className="pa-h">Add the tracker to your website</h2>
        <p className="pa-muted">
          DatoCMS holds your content, but visitors see it on your own website. Paste this tag into the head of that website, the
          same place for every page.
        </p>
        <div className="pa-snippet">{trackerSnippet(siteId)}</div>
      </Form>
    </Canvas>
  )
}
