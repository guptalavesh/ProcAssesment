import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight, Gauge, Target, Sparkles, Briefcase,
  Upload, Settings, Play, BarChart3, Shield, Zap,
} from 'lucide-react'
import AccentureMark from '@/components/ui/AccentureMark'
import AccentureLogo from '@/components/ui/AccentureLogo'
import ScoreGauge from '@/components/ui/ScoreGauge'
import { useAssessmentStore } from '@/store/assessmentStore'

const FEATURES = [
  { Icon: Gauge,     title: 'Maturity score',    blurb: 'Single 0–4 score mapped to Foundation, Intermediate, Advanced or Leading.' },
  { Icon: Target,    title: 'KPI benchmarks',    blurb: 'Every KPI compared against industry medians with clear gap deltas.' },
  { Icon: Sparkles,  title: 'AI commentary',     blurb: 'Gemini-grounded interpretation of your gaps and 30-day priorities.' },
  { Icon: Briefcase, title: 'Matched offerings', blurb: 'Services and plays auto-matched to each finding and bucket.' },
]

const STEPS = [
  { Icon: Settings,  title: 'Set up',  blurb: 'Client, industry, engagement type' },
  { Icon: Upload,    title: 'Upload',  blurb: 'SAP PO / PR / invoice extracts' },
  { Icon: Play,      title: 'Run',     blurb: 'Score KPIs and dimensions' },
  { Icon: BarChart3, title: 'Review',  blurb: 'Dashboards, root-cause and offerings' },
]

function HeroPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative hidden lg:block pointer-events-none select-none"
    >
      <div className="bg-white border border-neutral-150 rounded-lg p-5 shadow-md w-[380px]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="eyebrow">Sample client</p>
            <p className="text-sm font-semibold text-neutral-900 mt-1">JSW Steel · Baseline</p>
          </div>
          <span className="pill pill-agent"><span className="dot" />Live preview</span>
        </div>

        <div className="flex items-center gap-4 mb-5">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <ScoreGauge score={2.8} size={96} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="num text-[26px] font-semibold leading-none text-neutral-900">2.8</span>
              <span className="text-[11px] text-neutral-500">/ 4</span>
            </div>
          </div>
          <div className="flex-1">
            <p className="eyebrow">Maturity level</p>
            <p className="text-lg font-semibold text-neutral-900 mt-1 leading-tight">Advanced</p>
            <p className="text-[12px] text-neutral-500 mt-1 leading-snug">Structured, proactive, good system adoption.</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Efficiency',    score: 3.2, color: '#039855' },
            { label: 'Effectiveness', score: 2.4, color: '#DC6803' },
            { label: 'Risk',          score: 2.1, color: '#DC6803' },
          ].map(b => (
            <div key={b.label} className="bg-neutral-50 rounded-sm p-2 border border-neutral-150">
              <p className="eyebrow text-[10px]">{b.label}</p>
              <p className="num text-[15px] font-semibold text-neutral-900 mt-0.5">{b.score.toFixed(1)}</p>
              <div className="mt-1.5 h-1 bg-neutral-150 rounded-full overflow-hidden">
                <div className="h-1 rounded-full" style={{ width: `${(b.score / 4) * 100}%`, backgroundColor: b.color }} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-start gap-2 text-[12px] text-neutral-700 bg-agent-surface border border-agent-border rounded-sm px-3 py-2">
          <Sparkles size={12} className="text-accent mt-0.5 flex-shrink-0" />
          <span>RC adoption is the single biggest lever — 14% below peer median.</span>
        </div>
      </div>
    </motion.div>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { sessionId } = useAssessmentStore()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const startAssessment = () => navigate('/setup')

  return (
    <div className="min-h-screen bg-neutral-50">
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-colors ${scrolled ? 'bg-white/95 backdrop-blur border-b border-neutral-150' : 'bg-transparent border-b border-transparent'}`}>
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center focus:outline-none h-7"
            aria-label="Home"
          >
            <AccentureLogo className="h-6 w-auto text-neutral-900" />
          </button>
          <div className="flex items-center gap-2">
            {sessionId && (
              <button
                onClick={() => navigate('/results')}
                className="btn btn-ghost"
              >
                Resume session
              </button>
            )}
            <button onClick={startAssessment} className="btn btn-pri">
              Start assessment
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden bg-neutral-50">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(60% 40% at 80% 0%, rgba(34,81,255,0.10) 0%, rgba(34,81,255,0) 60%), radial-gradient(50% 40% at 0% 100%, rgba(34,81,255,0.06) 0%, rgba(34,81,255,0) 70%)',
          }}
        />
        <div className="max-w-6xl mx-auto px-6 pt-28 pb-20 relative">
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
            <div>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="eyebrow mb-4"
              >
                Functional maturity assessment
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-[40px] md:text-[48px] font-semibold leading-[1.05] tracking-[-0.02em] text-neutral-900"
              >
                Measure your functional<br />maturity in minutes.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
                className="text-base md:text-lg text-neutral-700 mt-5 max-w-xl leading-relaxed"
              >
                Upload your data, review benchmarks, and walk away with an AI-grounded view of where to invest next — across 8 KPIs, 5 buckets, and a reference framework calibrated for ops teams.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.26 }}
                className="mt-8 flex flex-wrap items-center gap-3"
              >
                <button onClick={startAssessment} className="btn btn-pri btn-lg">
                  Start new assessment
                  <ArrowRight size={15} />
                </button>
                <button
                  onClick={() => sessionId ? navigate('/results') : navigate('/setup')}
                  disabled={!sessionId}
                  className="btn btn-sec btn-lg"
                >
                  {sessionId ? 'Resume last session' : 'No active session'}
                </button>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-10 flex items-center gap-6 text-[12px] text-neutral-500"
              >
                <span className="flex items-center gap-1.5"><Shield size={12} /> Reference framework included</span>
                <span className="flex items-center gap-1.5"><Zap size={12} /> Runs in under a minute</span>
              </motion.div>
            </div>

            <HeroPreview />
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="mb-10">
          <p className="eyebrow mb-2">What you'll get</p>
          <h2 className="text-[28px] md:text-[32px] font-semibold tracking-[-0.01em] text-neutral-900">A full diagnostic, not a checklist.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="acc-card hover:border-neutral-300 transition-colors"
            >
              <div className="w-10 h-10 rounded-sm bg-accent-50 flex items-center justify-center mb-3">
                <f.Icon size={20} className="text-accent" />
              </div>
              <p className="font-semibold text-[15px] text-neutral-900 mb-1">{f.title}</p>
              <p className="text-[13px] text-neutral-500 leading-relaxed">{f.blurb}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="bg-white border-y border-neutral-150 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-10">
            <p className="eyebrow mb-2">How it works</p>
            <h2 className="text-[28px] md:text-[32px] font-semibold tracking-[-0.01em] text-neutral-900">Four steps, guided end-to-end.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
              >
                <div className="w-10 h-10 rounded-sm bg-accent-50 flex items-center justify-center mb-3">
                  <s.Icon size={18} className="text-accent" />
                </div>
                <p className="eyebrow mb-1">Step {i + 1}</p>
                <p className="font-semibold text-[15px] text-neutral-900">{s.title}</p>
                <p className="text-[13px] text-neutral-500 mt-1">{s.blurb}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-12">
            <button onClick={startAssessment} className="btn btn-pri btn-lg">
              Start your assessment
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>

      <section className="py-8">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-[12px] text-neutral-500">
            Reference framework included
            <span className="mx-2 opacity-50">·</span>
            Powered by Vertex AI &amp; Gemini 2.5 Pro
            <span className="mx-2 opacity-50">·</span>
            Data stays within your session
          </p>
        </div>
      </section>

      <footer className="border-t border-neutral-150 py-6 bg-white">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-between gap-3 text-[12px] text-neutral-500">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:text-neutral-900 transition-colors" aria-label="Home">
            <AccentureMark className="w-4 h-4 text-accent" />
            <span className="font-medium text-neutral-700">AIVault · Functional maturity assessment</span>
          </button>
          <span>© {new Date().getFullYear()} AIVault · Internal use</span>
        </div>
      </footer>
    </div>
  )
}
