import { type Change, type Metrics, formatChange, formatDuration, formatNumber, formatPercent } from '../lib'

const ITEMS: { key: keyof Metrics; label: string; format: (v: number) => string; lowerIsBetter?: boolean }[] = [
  { key: 'visitors', label: 'Visitors', format: formatNumber },
  { key: 'pageviews', label: 'Pageviews', format: formatNumber },
  { key: 'bounce_rate', label: 'Bounce rate', format: formatPercent, lowerIsBetter: true },
  { key: 'visit_duration', label: 'Visit time', format: formatDuration },
]

export function Stats({ metrics, change }: { metrics: Metrics; change: Change }) {
  return (
    <div className="pa-stats">
      {ITEMS.map((item) => {
        const delta = change?.[item.key]
        const text = formatChange(delta)
        const good = delta != null && (item.lowerIsBetter ? delta < 0 : delta > 0)
        return (
          <div className="pa-stat" key={item.key}>
            <div className="pa-stat__label">{item.label}</div>
            <div className="pa-stat__value">{item.format(metrics[item.key])}</div>
            {text && <div className={good ? 'pa-up' : 'pa-down'}>{text}</div>}
          </div>
        )
      })}
    </div>
  )
}
