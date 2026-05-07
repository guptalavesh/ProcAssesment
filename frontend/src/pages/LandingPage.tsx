import { useState, useEffect } from 'react'
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
  { Icon: Gauge,     title: 'Maturity Score',    blurb: '0–4 score mapped to Foundation / Intermediate / Advanced / Leading.' },
  { Icon: Target,    title: 'KPI Benchmarks',    blurb: 'Every KPI compared against industry medians with clear gap deltas.' },
  { Icon: Sparkles,  title: 'AI Commentary',     blurb: 'Gemini-grounded interpretation of your gaps and 30-day priorities.' },
  { Icon: Briefcase, title: 'Accenture Offerings', blurb: 'Auto-matched services mapped to each finding and bucket.' },
]

const STEPS = [
  { Icon: Settings, title: 'Set up',    blurb: 'Client, industry, engagement type' },
  { Icon: Upload,   title: 'Upload',    blurb: 'SAP PO/PR/invoice extracts' },
  { Icon: Play,     title: 'Run',       blurb: 'Score KPIs & dimensions' },
  { Icon: BarChart3, title: 'Review',   blurb: 'Dashboards, RCA & offerings' },
]

function HeroPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
      className="relative hidden lg:block pointer-events-none select-none"
    >
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-5 shadow-2xl w-[380px]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/60 font-semibold">Sample Client</p>
            <p className="text-sm font-bold text-white">JSW Steel · Baseline</p>
          </div>
          <div className="text-[10px] bg-white/15 text-white px-2 py-0.5 rounded-full">Live preview</div>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <ScoreGauge score={2.8} size={96} variant="on-dark" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-white leading-none">2.8</span>
              <span className="text-[10px] text-white/60">/ 4</span>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-wide text-white/60">Maturity Level</p>
            <p className="text-lg font-bold text-white leading-tight">Advanced</p>
            <p className="text-[11px] text-white/70 mt-1 leading-snug">Structured, proactive, good system adoption.</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Efficiency',    score: 3.2, color: '#86efac' },
            { label: 'Effectiveness', score: 2.4, color: '#fbbf24' },
            { label: 'Risk',          score: 2.1, color: '#fdba74' },
          ].map(b => (
            <div key={b.label} className="bg-white/10 rounded-lg p-2 border border-white/10">
              <p className="text-[9px] uppercase tracking-wide text-white/60 font-semibold">{b.label}</p>
              <p className="text-base font-bold text-white">{b.score.toFixed(0)}</p>
              <div className="mt-1 h-1 bg-white/15 rounded-full overflow-hidden">
                <div className="h-1 rounded-full" style={{ width: `${(b.score / 4) * 100}%`, backgroundColor: b.color }} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-white/70">
          <Sparkles size={10} className="text-white" />
          <span>AI: <em className="not-italic text-white/90">"RC adoption is the single biggest lever — 14% below peer median."</em></span>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="absolute -bottom-4 -left-6 bg-white rounded-lg shadow-xl border border-bg-secondary p-3 w-44"
      >
        <p className="text-[9px] uppercase tracking-wide text-caption font-semibold mb-0.5">Top opportunity</p>
        <p className="text-xs font-bold text-brand-dark">Vendor Management</p>
        <p className="text-[10px] text-caption mt-0.5">3 matched Accenture offerings</p>
      </motion.div>
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
    <div className="min-h-screen bg-white">
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all ${scrolled ? 'bg-white/95 backdrop-blur shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="group relative flex items-center focus:outline-none h-[28px]"
            aria-label="Home"
          >
            <div className="flex items-center gap-2 transition-opacity duration-150 group-hover:opacity-0">
              <AccentureMark className={`w-5 h-5 ${scrolled ? 'text-brand-purple' : 'text-white'}`} />
              <p className={`text-[11px] font-semibold leading-tight ${scrolled ? 'text-brand-dark' : 'text-white'}`}>Functional Maturity<br/>Assessment</p>
            </div>
            <div className="absolute inset-0 flex items-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 pointer-events-none">
              <AccentureLogo className={`h-[20px] w-auto ${scrolled ? 'text-brand-dark' : 'text-white'}`} />
            </div>
          </button>
          <div className="flex items-center gap-2">
            {sessionId && (
              <button
                onClick={() => navigate('/results')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${scrolled ? 'text-brand-purple hover:bg-purple-50' : 'text-white/90 hover:bg-white/10'}`}
              >
                Resume session
              </button>
            )}
            <button
              onClick={startAssessment}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${scrolled ? 'bg-brand-purple text-white hover:bg-brand-dark' : 'bg-white text-brand-purple hover:bg-white/90'}`}
            >
              Start assessment
            </button>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden bg-gradient-to-br from-brand-dark via-brand-mid to-brand-purple bg-[length:200%_200%] animate-gradient text-white">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[480px] h-[480px] rounded-full bg-brand-purple blur-3xl" />
        </div>
        <div className="max-w-6xl mx-auto px-5 pt-32 pb-24 relative">
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-10 items-center">
            <div>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="text-[11px] uppercase tracking-[0.2em] font-semibold text-white/70 mb-4"
              >
                Functional Maturity Assessment Tool
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-4xl md:text-5xl font-bold leading-[1.1] tracking-tight"
              >
                Measure your functional<br />maturity in minutes.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
                className="text-base md:text-lg text-white/75 mt-5 max-w-xl leading-relaxed"
              >
                Upload your data, review benchmarks, and walk away with an AI-grounded view
                of where to invest next — across 8 KPIs, 5 buckets, and Accenture's reference framework.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.26 }}
                className="mt-8 flex flex-wrap items-center gap-3"
              >
                <button
                  onClick={startAssessment}
                  className="group inline-flex items-center gap-2 bg-white text-brand-purple font-semibold px-5 py-2.5 rounded-lg text-sm hover:bg-white/90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg"
                >
                  Start new assessment
                  <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
                <button
                  onClick={() => sessionId ? navigate('/results') : navigate('/setup')}
                  disabled={!sessionId}
                  className="inline-flex items-center gap-2 border border-white/40 text-white font-semibold px-5 py-2.5 rounded-lg text-sm hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sessionId ? 'Resume last session' : 'No active session'}
                </button>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-10 flex items-center gap-5 text-[11px] text-white/60"
              >
                <span className="flex items-center gap-1.5"><Shield size={11} /> Accenture reference framework</span>
                <span className="flex items-center gap-1.5"><Zap size={11} /> Runs in under a minute</span>
              </motion.div>
            </div>

            <HeroPreview />
          </div>
        </div>

        <svg
          className="absolute bottom-0 left-0 w-full text-white"
          viewBox="0 0 1440 60"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0 60 L1440 0 L1440 60 Z" fill="currentColor" />
        </svg>
      </section>

      <section className="max-w-6xl mx-auto px-5 py-16">
        <div className="text-center mb-10">
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-brand-purple mb-2">What you'll get</p>
          <h2 className="text-2xl md:text-3xl font-bold text-brand-dark">A full diagnostic, not a checklist.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="acc-card hover:border-brand-purple/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center mb-3">
                <f.Icon size={20} className="text-brand-purple" />
              </div>
              <p className="font-bold text-sm text-brand-dark mb-1">{f.title}</p>
              <p className="text-xs text-caption leading-relaxed">{f.blurb}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="bg-bg-secondary/30 py-16">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-10">
            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-brand-purple mb-2">How it works</p>
            <h2 className="text-2xl md:text-3xl font-bold text-brand-dark">Four steps, guided end-to-end.</h2>
          </div>

          <div className="relative">
            <div className="hidden md:block absolute left-0 right-0 top-[28px] h-px bg-gradient-to-r from-transparent via-brand-purple/40 to-transparent" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
              {STEPS.map((s, i) => (
                <motion.div
                  key={s.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="text-center"
                >
                  <div className="relative z-10 mx-auto w-14 h-14 rounded-full bg-white border-2 border-brand-purple/30 flex items-center justify-center shadow-sm mb-3">
                    <s.Icon size={22} className="text-brand-purple" />
                  </div>
                  <p className="text-[10px] font-bold text-brand-purple uppercase tracking-widest mb-1">Step {i + 1}</p>
                  <p className="font-bold text-sm text-brand-dark">{s.title}</p>
                  <p className="text-xs text-caption mt-1">{s.blurb}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="text-center mt-12">
            <button
              onClick={startAssessment}
              className="group inline-flex items-center gap-2 bg-brand-purple hover:bg-brand-dark text-white font-semibold px-6 py-3 rounded-lg text-sm transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-brand-purple/20"
            >
              Start your assessment
              <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      <section className="py-8 border-t border-bg-secondary">
        <div className="max-w-6xl mx-auto px-5 text-center">
          <p className="text-xs text-caption">
            Built on Accenture's procurement reference framework
            <span className="mx-2 opacity-50">·</span>
            Powered by Vertex AI &amp; Gemini 2.5 Pro
            <span className="mx-2 opacity-50">·</span>
            Data stays within your session
          </p>
        </div>
      </section>

      <footer className="bg-brand-dark text-white/70 py-6">
        <div className="max-w-6xl mx-auto px-5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-100 opacity-80 transition-opacity" aria-label="Home">
            <AccentureMark className="w-4 h-4 text-white/80" />
            <span className="font-semibold text-white/90">Functional Maturity Assessment</span>
            <span className="opacity-60">· v2</span>
          </button>
          <span className="opacity-60">© {new Date().getFullYear()} Accenture · Internal use only</span>
        </div>
      </footer>
    </div>
  )
}
