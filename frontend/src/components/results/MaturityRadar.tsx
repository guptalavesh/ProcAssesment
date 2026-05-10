import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'
import type { DimensionResult } from '@/lib/types'
import { scoreColor } from '@/lib/utils'

interface Props { dims: DimensionResult[] }

export default function MaturityRadar({ dims }: Props) {
  const scored = dims.filter(d => d.score !== null)
  const data = scored.map(d => ({
    subject: d.dim_id,
    fullName: d.name,
    score: d.score_display ?? 0,
    fullMark: 4,
  }))

  if (!data.length) return <p className="text-caption text-sm text-center py-8">No scored dimensions.</p>

  return (
    <ResponsiveContainer width="100%" height={340}>
      <RadarChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
        <PolarGrid stroke="#e6e6dc" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#0F141C', fontWeight: 600 }} />
        <Radar name="Score" dataKey="score" stroke="#2251FF" fill="#2251FF" fillOpacity={0.2}
          strokeWidth={2} dot={{ fill: '#2251FF', r: 4 }} isAnimationActive />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload
            return (
              <div className="bg-white border border-bg-secondary rounded px-3 py-2 shadow text-xs">
                <p className="font-bold text-brand-dark">{d.fullName}</p>
                <p style={{ color: scoreColor(d.score) }}>Score: <strong>{d.score?.toFixed(0)}</strong> / 4</p>
              </div>
            )
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
