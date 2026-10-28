import { connect } from 'datocms-plugin-sdk'
import 'datocms-react-ui/styles.css'
import { readSettings } from './lib'
import { render } from './render'
import ConfigScreen from './entrypoints/ConfigScreen'
import RecordPanel from './entrypoints/RecordPanel'
import OverviewPage from './entrypoints/OverviewPage'

export const PANEL_ID = 'privatusPageStats'
export const PAGE_ID = 'privatusOverview'

connect({
  renderConfigScreen(ctx) {
    render(<ConfigScreen ctx={ctx} />)
  },
  mainNavigationTabs() {
    return [
      {
        label: 'Analytics',
        icon: 'chart-line',
        pointsTo: { pageId: PAGE_ID },
        placement: ['after', 'content'],
      },
    ]
  },
  renderPage(pageId, ctx) {
    if (pageId === PAGE_ID) render(<OverviewPage ctx={ctx} />)
  },
  itemFormSidebarPanels(itemType, ctx) {
    const settings = readSettings(ctx.plugin.attributes.parameters)
    if (!settings.paths[itemType.attributes.api_key]) return []
    return [{ id: PANEL_ID, label: 'Privatus Analytics', startOpen: true, initialHeight: 260 }]
  },
  renderItemFormSidebarPanel(panelId, ctx) {
    if (panelId === PANEL_ID) render(<RecordPanel ctx={ctx} />)
  },
})
