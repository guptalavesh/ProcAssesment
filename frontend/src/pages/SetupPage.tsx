import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight, BarChart3, TrendingUp, Loader2, Download } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import { api } from '@/lib/api'
import { useAssessmentStore } from '@/store/assessmentStore'
import type { SkillSummary } from '@/lib/types'
import { cn } from '@/lib/utils'

const INDUSTRIES = [
  'Metals & Mining', 'Cement', 'Building Materials', 'Chemicals',
  'Paper & Agro', 'Textiles', 'Automotive', 'FMCG', 'Oil & Gas', 'Pharmaceuticals', 'Other'
]

const ASSESSMENT_TYPES = ['Baseline', 'Interim review', 'Post-transformation', 'Annual review']

export default function SetupPage() {
  const navigate = useNavigate()
  const { setSessionId, setSkill, setClientName, setScreen } = useAssessmentStore()

  const [skills, setSkills] = useState<SkillSummary[]>([])
  const [selectedSkill, setSelectedSkill] = useState<SkillSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    client_name: '',
    industry: 'Metals & Mining',
    assessment_type: 'Baseline',
    date: new Date().toISOString().split('T')[0],
    assessor_name: '',
    notes: '',
    fte_count: '',
    annual_spend: '',
    annual_revenue: '',
  })

  useEffect(() => {
    api.getSkills().then(setSkills).catch(() => setError('Failed to load skills. Is the backend running?'))
  }, [])

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleNext = async () => {
    if (!form.client_name.trim()) { setError('Client name is required.'); return }
    if (!selectedSkill) { setError('Please select an assessment skill.'); return }
    setError('')
    setLoading(true)
    try {
      const { session_id } = await api.createSession()
      const sid = session_id
      setSessionId(session_id)
      await api.setup(sid, {
        ...form,
        skill_path: selectedSkill.path,
        fte_count: form.fte_count ? parseFloat(form.fte_count) : null,
        annual_spend: form.annual_spend ? parseFloat(form.annual_spend) : null,
        annual_revenue: form.annual_revenue ? parseFloat(form.annual_revenue) : null,
      })
      setSkill(selectedSkill.path, selectedSkill.display_name, selectedSkill.is_procurement)
      setClientName(form.client_name)
      setScreen('upload')
      navigate('/upload')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader title="Assessment setup" subtitle="Configure engagement details and select a skill" />

      <p className="eyebrow mb-4">Step 1 of 4 · Engagement details</p>

      {error && (
        <div className="mb-4 px-3 py-2 bg-danger-soft border border-danger/20 text-danger-fg rounded-sm text-[13px]">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <div className="acc-card">
            <h2 className="text-[15px] font-semibold text-neutral-900 mb-4">Engagement details</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-neutral-700 mb-1">Client name *</label>
                <input value={form.client_name} onChange={f('client_name')}
                  placeholder="e.g. JSW Steel"
                  className="input input-lg" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-neutral-700 mb-1">Industry</label>
                  <select value={form.industry} onChange={f('industry')} className="input input-lg">
                    {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-neutral-700 mb-1">Assessment type</label>
                  <select value={form.assessment_type} onChange={f('assessment_type')} className="input input-lg">
                    {ASSESSMENT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-neutral-700 mb-1">Date</label>
                  <input type="date" value={form.date} onChange={f('date')} className="input input-lg" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-neutral-700 mb-1">Assessor name</label>
                  <input value={form.assessor_name} onChange={f('assessor_name')}
                    placeholder="Your name"
                    className="input input-lg" />
                </div>
              </div>

              {selectedSkill?.is_procurement && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  className="grid grid-cols-3 gap-3 pt-3 border-t border-neutral-150">
                  <div>
                    <label className="block text-[12px] font-medium text-neutral-700 mb-1">FTE count</label>
                    <input type="number" value={form.fte_count} onChange={f('fte_count')}
                      placeholder="e.g. 45" className="input input-lg" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-neutral-700 mb-1">Annual spend (₹ Cr)</label>
                    <input type="number" value={form.annual_spend} onChange={f('annual_spend')}
                      placeholder="e.g. 500" className="input input-lg" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-neutral-700 mb-1">Revenue (₹ Cr)</label>
                    <input type="number" value={form.annual_revenue} onChange={f('annual_revenue')}
                      placeholder="Optional" className="input input-lg" />
                  </div>
                </motion.div>
              )}

              <div>
                <label className="block text-[12px] font-medium text-neutral-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={f('notes')} rows={2}
                  placeholder="Any additional context…"
                  className="input input-lg resize-none py-2" style={{ height: 'auto', minHeight: 64 }} />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="acc-card">
            <h2 className="text-[15px] font-semibold text-neutral-900 mb-4">Select assessment skill</h2>
            {skills.length === 0 ? (
              <p className="text-[13px] text-neutral-500">Loading skills…</p>
            ) : (
              <div className="space-y-2">
                {skills.map((skill) => {
                  const isSelected = selectedSkill?.path === skill.path
                  return (
                    <button key={skill.path} onClick={() => setSelectedSkill(skill)}
                      className={cn(
                        'w-full text-left p-3 rounded-sm border transition-colors',
                        isSelected
                          ? 'border-accent bg-accent-50'
                          : 'border-neutral-200 hover:border-neutral-300 bg-white'
                      )}>
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'p-2 rounded-sm flex-shrink-0',
                          isSelected ? 'bg-accent text-white' : 'bg-neutral-100 text-neutral-700'
                        )}>
                          {skill.is_procurement ? <BarChart3 size={16} /> : <TrendingUp size={16} />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[14px] text-neutral-900">{skill.display_name}</p>
                          <p className="text-[12px] text-neutral-500 mt-0.5">
                            <span className="num">{skill.dimension_count}</span> dimensions
                            <span className="mx-1.5 text-neutral-300">·</span>
                            v<span className="num">{skill.schema_version}</span>
                            {skill.is_procurement && (
                              <>
                                <span className="mx-1.5 text-neutral-300">·</span>
                                8-KPI model
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="/api/v1/templates/qre"
            download="AIVault_Assessment_Client_Pack.xlsx"
            className="btn btn-sec btn-lg"
          >
            <Download size={14} />
            Download client data pack
          </a>
          <a
            href="/api/v1/templates/synthetic"
            download="AIVault_Assessment_Synthetic_Test_Data.xlsx"
            className="btn btn-ghost btn-lg"
          >
            <Download size={14} />
            Download test data
          </a>
          <span className="text-[12px] text-neutral-500">Client pack to send · Test data to verify the app</span>
        </div>

        <button onClick={handleNext} disabled={loading} className="btn btn-pri btn-lg">
          {loading && <Loader2 size={14} className="animate-spin" />}
          Next: Upload data <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
