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

const ASSESSMENT_TYPES = ['Baseline', 'Interim Review', 'Post-Transformation', 'Annual Review']

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
      <PageHeader title="Assessment Setup" subtitle="Configure engagement details and select a skill" />

      <p className="text-[11px] uppercase tracking-widest text-brand-purple font-semibold mb-3">Step 1 of 4 · Engagement details</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
          <div className="acc-card">
            <h2 className="text-base font-bold text-brand-dark mb-4">Engagement Details</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-brand-dark mb-1">Client Name *</label>
                <input value={form.client_name} onChange={f('client_name')}
                  placeholder="e.g. JSW Steel"
                  className="w-full border border-bg-secondary rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-purple" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-brand-dark mb-1">Industry</label>
                  <select value={form.industry} onChange={f('industry')}
                    className="w-full border border-bg-secondary rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-purple">
                    {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-dark mb-1">Assessment Type</label>
                  <select value={form.assessment_type} onChange={f('assessment_type')}
                    className="w-full border border-bg-secondary rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-purple">
                    {ASSESSMENT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-brand-dark mb-1">Date</label>
                  <input type="date" value={form.date} onChange={f('date')}
                    className="w-full border border-bg-secondary rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-purple" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-dark mb-1">Assessor Name</label>
                  <input value={form.assessor_name} onChange={f('assessor_name')}
                    placeholder="Your name"
                    className="w-full border border-bg-secondary rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-purple" />
                </div>
              </div>

              {selectedSkill?.is_procurement && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  className="grid grid-cols-3 gap-3 pt-2 border-t border-bg-secondary">
                  <div>
                    <label className="block text-xs font-semibold text-brand-dark mb-1">FTE Count</label>
                    <input type="number" value={form.fte_count} onChange={f('fte_count')}
                      placeholder="e.g. 45"
                      className="w-full border border-bg-secondary rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-purple" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-brand-dark mb-1">Annual Spend (₹ Cr)</label>
                    <input type="number" value={form.annual_spend} onChange={f('annual_spend')}
                      placeholder="e.g. 500"
                      className="w-full border border-bg-secondary rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-purple" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-brand-dark mb-1">Revenue (₹ Cr)</label>
                    <input type="number" value={form.annual_revenue} onChange={f('annual_revenue')}
                      placeholder="Optional"
                      className="w-full border border-bg-secondary rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-purple" />
                  </div>
                </motion.div>
              )}

              <div>
                <label className="block text-xs font-semibold text-brand-dark mb-1">Notes</label>
                <textarea value={form.notes} onChange={f('notes')} rows={2}
                  placeholder="Any additional context..."
                  className="w-full border border-bg-secondary rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-purple resize-none" />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
          <div className="acc-card">
            <h2 className="text-base font-bold text-brand-dark mb-4">Select Assessment Skill</h2>
            {skills.length === 0 ? (
              <p className="text-caption text-sm">Loading skills…</p>
            ) : (
              <div className="space-y-3">
                {skills.map((skill) => (
                  <button key={skill.path} onClick={() => setSelectedSkill(skill)}
                    className={cn(
                      'w-full text-left p-4 rounded border-2 transition-all',
                      selectedSkill?.path === skill.path
                        ? 'border-brand-purple bg-bg-secondary'
                        : 'border-bg-secondary hover:border-brand-mid'
                    )}>
                    <div className="flex items-start gap-3">
                      <div className={cn('p-2 rounded', selectedSkill?.path === skill.path ? 'bg-brand-purple text-white' : 'bg-bg-secondary text-brand-dark')}>
                        {skill.is_procurement ? <BarChart3 size={18} /> : <TrendingUp size={18} />}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-black">{skill.display_name}</p>
                        <p className="text-xs text-caption mt-0.5">
                          {skill.dimension_count} dimensions · v{skill.schema_version}
                          {skill.is_procurement && ' · 8-KPI Model'}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a
            href="/api/v1/templates/qre"
            download="Accenture_Assessment_Client_Pack.xlsx"
            className="flex items-center gap-2 border-2 border-brand-purple text-brand-purple px-4 py-2.5 rounded font-semibold text-sm hover:bg-brand-purple hover:text-white transition-colors"
          >
            <Download size={15} />
            Download Client Data Pack
          </a>
          <a
            href="/api/v1/templates/synthetic"
            download="Accenture_Assessment_Synthetic_Test_Data.xlsx"
            className="flex items-center gap-2 border border-brand-mid text-brand-dark px-4 py-2.5 rounded font-semibold text-sm hover:bg-bg-secondary transition-colors"
          >
            <Download size={15} />
            Download Test Data
          </a>
          <span className="text-xs text-caption">Client pack to send to client · Test data to verify the app</span>
        </div>

        <button onClick={handleNext} disabled={loading}
          className="flex items-center gap-2 bg-brand-purple text-white px-6 py-2.5 rounded font-semibold text-sm hover:bg-brand-dark transition-colors disabled:opacity-60">
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          Next: Upload Data <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
