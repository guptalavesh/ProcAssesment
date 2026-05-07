# REBUILD_03 — Frontend Pages \& Layout Components

## Overview
All frontend pages (full wizard flow: Setup → Upload → Columns → Configure → Running → FormulaReview → Results, plus Landing and 404) and layout shell components (AppShell, Sidebar, ErrorBoundary, PageHeader).

---

## frontend/src/App.tsx

```tsx
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import AppShell from '@/components/layout/AppShell'
import ErrorBoundary from '@/components/layout/ErrorBoundary'
import LandingPage from '@/pages/LandingPage'
import SetupPage from '@/pages/SetupPage'
import UploadPage from '@/pages/UploadPage'
import ColumnReviewPage from '@/pages/ColumnReviewPage'
import ConfigurePage from '@/pages/ConfigurePage'
import RunningPage from '@/pages/RunningPage'
import FormulaReviewPage from '@/pages/FormulaReviewPage'
import ResultsPage from '@/pages/ResultsPage'
import NotFoundPage from '@/pages/NotFoundPage'

function AppRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/columns" element={<ColumnReviewPage />} />
        <Route path="/configure" element={<ConfigurePage />} />
        <Route path="/running" element={<RunningPage />} />
        <Route path="/formula-review" element={<FormulaReviewPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/offerings" element={<Navigate to="/results" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppShell>
        <AppRoutes />
      </AppShell>
    </ErrorBoundary>
  )
}
```

---

## frontend/src/components/layout/AppShell.tsx

```tsx
import { AnimatePresence, motion } from 'framer-motion'
import { useLocation, matchPath } from 'react-router-dom'
import Sidebar from './Sidebar'
import { ToastContainer } from '@/components/ui/Toast'

interface Props { children: React.ReactNode }

// Routes that render without the wizard sidebar/shell (full-bleed pages like Landing, 404)
const NO_SHELL_ROUTES: string[] = ['/', '/404']
const NO_SHELL_PATTERNS: string[] = []

function isNoShell(pathname: string): boolean {
  if (NO_SHELL_ROUTES.includes(pathname)) return true
  return NO_SHELL_PATTERNS.some(p => matchPath(p, pathname))
}

export default function AppShell({ children }: Props) {
  const location = useLocation()

  if (isNoShell(location.pathname)) {
    return (
      <div className="min-h-screen bg-white">
        <ToastContainer />
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    )
  }

  // Recognise catch-all → NotFoundPage also renders without sidebar.
  // We detect by checking if children's page sets its own full-viewport chrome —
  // NotFoundPage handles its own layout, so we only use the wizard shell for
  // known wizard routes. Anything else (including 404) bypasses the sidebar.
  const WIZARD_ROUTES = ['/setup', '/upload', '/columns', '/configure', '/running', '/formula-review', '/results']
  const isWizard = WIZARD_ROUTES.includes(location.pathname)

  if (!isWizard) {
    return (
      <div className="min-h-screen bg-white">
        <ToastContainer />
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />
      <ToastContainer />
      <main className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="p-5 max-w-6xl mx-auto"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
```

---

## frontend/src/components/layout/Sidebar.tsx

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, ChevronRight, ChevronLeft, Lock } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useAssessmentStore } from '@/store/assessmentStore'
import type { AppScreen } from '@/lib/types'
import AccentureMark from '@/components/ui/AccentureMark'
import AccentureLogo from '@/components/ui/AccentureLogo'

const STEPS: { id: AppScreen; label: string; num: number }[] = [
  { id: 'setup',     label: 'Setup',         num: 1 },
  { id: 'upload',    label: 'Upload Data',    num: 2 },
  { id: 'columns',   label: 'Column Review',  num: 3 },
  { id: 'configure', label: 'Configure',      num: 4 },
  { id: 'running',   label: 'Running',        num: 5 },
  { id: 'results',   label: 'Results',        num: 6 },
]

const SCREEN_ORDER: AppScreen[] = ['setup','upload','columns','configure','running','results']

export default function Sidebar() {
  const { currentScreen, clientName, skillName, setScreen, reset } = useAssessmentStore()
  const navigate = useNavigate()
  const currentIdx = SCREEN_ORDER.indexOf(currentScreen)

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true' } catch { return false }
  })

  const toggle = () => {
    setCollapsed(c => {
      const next = !c
      try { localStorage.setItem('sidebar_collapsed', String(next)) } catch {}
      return next
    })
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 56 : 240 }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
      className="h-screen bg-white border-r border-bg-secondary flex flex-col overflow-hidden flex-shrink-0 relative sticky top-0"
    >
      {/* Logo — click returns to landing. Default = GT mark; hover swaps to full wordmark. */}
      <button
        onClick={() => navigate('/')}
        aria-label="Back to landing page"
        title="Back to landing page"
        className={cn(
          'group border-b border-bg-secondary flex items-center flex-shrink-0 w-full text-left hover:bg-bg-secondary/40 transition-colors',
          collapsed ? 'px-3 py-4 justify-center' : 'px-5 py-4',
        )}
      >
        {collapsed ? (
          <AccentureMark className="w-6 h-6 text-brand-purple flex-shrink-0" />
        ) : (
          <div className="relative flex items-center h-[34px] w-full overflow-hidden">
            {/* Default: GT mark + caption */}
            <div className="flex items-center gap-2 transition-opacity duration-150 group-hover:opacity-0">
              <AccentureMark className="w-6 h-6 text-brand-purple flex-shrink-0" />
              <p className="text-[11px] text-caption leading-tight">Functional Maturity<br/>Assessment</p>
            </div>
            {/* Hover: full Accenture wordmark */}
            <div className="absolute inset-0 flex items-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 pointer-events-none">
              <AccentureLogo className="h-[22px] w-auto text-black" />
            </div>
          </div>
        )}
      </button>

      {/* Engagement info */}
      {!collapsed && clientName && (
        <div className="px-5 py-2.5 bg-bg-secondary/50 border-b border-bg-secondary flex-shrink-0">
          <p className="text-[10px] text-caption uppercase font-semibold tracking-wide">Client</p>
          <p className="text-sm font-semibold text-brand-dark truncate">{clientName}</p>
          {skillName && <p className="text-xs text-caption truncate">{skillName}</p>}
        </div>
      )}

      {/* Steps */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto min-h-0">
        {STEPS.map((step, stepIdx) => {
          const screenIdx = SCREEN_ORDER.indexOf(step.id)
          const isDone    = screenIdx < currentIdx
          const isActive  = step.id === currentScreen
          const isPending = screenIdx > currentIdx
          const isLast    = stepIdx === STEPS.length - 1

          return (
            <div key={step.id} className="relative">
              {/* Vertical connector line between steps */}
              {!isLast && (
                <div
                  className={cn(
                    'absolute w-px top-[34px] bottom-0 z-0',
                    collapsed ? 'left-[27px]' : 'left-[19px]',
                    isDone ? 'bg-brand-purple' : 'bg-bg-muted',
                  )}
                  style={{ height: 'calc(100% - 24px)' }}
                />
              )}
              <button
                onClick={() => { if (isDone) { setScreen(step.id); navigate('/' + step.id) } }}
                disabled={!isDone && !isActive}
                title={
                  collapsed
                    ? step.label
                    : isPending
                      ? 'Complete current step first'
                      : isDone
                        ? `Go back to ${step.label}`
                        : undefined
                }
                aria-label={step.label}
                className={cn(
                  'relative z-10 w-full flex items-center gap-3 px-2 py-2.5 rounded text-left mb-0.5 transition-all',
                  collapsed && 'justify-center',
                  isActive  && 'bg-brand-purple text-white cursor-default',
                  isDone    && 'text-brand-dark hover:bg-bg-secondary cursor-pointer',
                  isPending && 'text-caption cursor-not-allowed opacity-40',
                )}
              >
                <span className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                  isActive  && 'bg-white text-brand-purple',
                  isDone    && 'bg-brand-purple text-white',
                  isPending && 'bg-bg-muted text-caption',
                )}>
                  {isDone    ? <CheckCircle size={14} /> : isPending ? <Lock size={10} /> : step.num}
                </span>
                {!collapsed && (
                  <>
                    <span className="text-sm font-medium whitespace-nowrap flex-1">{step.label}</span>
                    {isActive && <ChevronRight size={14} className="opacity-70 flex-shrink-0" />}
                    {isDone   && <span className="text-[10px] text-brand-purple font-semibold opacity-70 flex-shrink-0">edit</span>}
                  </>
                )}
              </button>
            </div>
          )
        })}
      </nav>

      {/* New assessment */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-bg-secondary flex-shrink-0">
          <button
            onClick={reset}
            className="w-full text-xs text-caption hover:text-brand-purple transition-colors py-1"
          >
            + New Assessment
          </button>
        </div>
      )}

      {/* Collapse / expand toggle */}
      <button
        onClick={toggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          'absolute bottom-4 flex items-center justify-center w-6 h-6 rounded-full bg-bg-secondary border border-bg-secondary hover:bg-brand-purple hover:text-white hover:border-brand-purple transition-all text-caption',
          collapsed ? 'left-1/2 -translate-x-1/2' : 'right-2',
        )}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.aside>
  )
}
```

---

## frontend/src/components/layout/PageHeader.tsx

```tsx
interface Props {
  title: string
  subtitle?: string
  right?: React.ReactNode
}

export default function PageHeader({ title, subtitle, right }: Props) {
  return (
    <div className="page-header flex items-center justify-between">
      <div>
        <h1 className="text-white text-xl font-bold m-0">{title}</h1>
        {subtitle && <p className="text-white/80 text-sm mt-0.5">{subtitle}</p>}
      </div>
      {right && <div>{right}</div>}
    </div>
  )
}
```

---

## frontend/src/components/layout/ErrorBoundary.tsx

```tsx
import { Component, type ReactNode } from 'react'
import { AlertOctagon, RefreshCw, Mail } from 'lucide-react'
import AccentureMark from '@/components/ui/AccentureMark'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-secondary/30 px-6">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg border border-bg-secondary p-8 text-center">
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
              <AlertOctagon className="text-red-500" size={28} />
            </div>
          </div>
          <h1 className="text-xl font-bold text-brand-dark mb-2">Something went wrong</h1>
          <p className="text-sm text-caption mb-1">Your work is safe. The application hit an unexpected error.</p>
          {this.state.error?.message && (
            <p className="text-xs text-caption font-mono bg-bg-secondary/60 px-3 py-1.5 rounded mt-3 inline-block max-w-full truncate">
              {this.state.error.message}
            </p>
          )}
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-1.5 bg-brand-purple hover:bg-brand-dark text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
            >
              <RefreshCw size={14} /> Reload
            </button>
            <a
              href="mailto:abbas.abidi@accenture.com?subject=Assessment%20App%20—%20error%20report"
              className="inline-flex items-center gap-1.5 border border-bg-secondary text-brand-dark text-sm px-4 py-2 rounded-lg hover:bg-bg-secondary transition-colors"
            >
              <Mail size={14} /> Report issue
            </a>
          </div>
          <div className="mt-8 flex items-center justify-center gap-1.5 text-[10px] text-caption">
            <AccentureMark className="w-3 h-3 text-brand-purple" />
            <span>Accenture Maturity Assessment</span>
          </div>
        </div>
      </div>
    )
  }
}
```

---
## frontend/src/pages/LandingPage.tsx

```tsx
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
            { label: 'Efficiency',   score: 3.2, color: '#86efac' },
            { label: 'Effectiveness', score: 2.4, color: '#fbbf24' },
            { label: 'Risk',         score: 2.1, color: '#fdba74' },
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
      {/* ── Nav strip ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all ${scrolled ? 'bg-white/95 backdrop-blur shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="group relative flex items-center focus:outline-none h-[28px]"
            aria-label="Home"
          >
            {/* Default: GT mark only */}
            <div className="flex items-center gap-2 transition-opacity duration-150 group-hover:opacity-0">
              <AccentureMark className={`w-5 h-5 ${scrolled ? 'text-brand-purple' : 'text-white'}`} />
              <p className={`text-[11px] font-semibold leading-tight ${scrolled ? 'text-brand-dark' : 'text-white'}`}>Functional Maturity<br/>Assessment</p>
            </div>
            {/* Hover: full wordmark */}
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

      {/* ── Hero ── */}
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

        {/* Diagonal divider */}
        <svg
          className="absolute bottom-0 left-0 w-full text-white"
          viewBox="0 0 1440 60"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0 60 L1440 0 L1440 60 Z" fill="currentColor" />
        </svg>
      </section>

      {/* ── What you'll get ── */}
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

      {/* ── How it works ── */}
      <section className="bg-bg-secondary/30 py-16">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-10">
            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-brand-purple mb-2">How it works</p>
            <h2 className="text-2xl md:text-3xl font-bold text-brand-dark">Four steps, guided end-to-end.</h2>
          </div>

          <div className="relative">
            {/* Connector line */}
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

      {/* ── Trust strip ── */}
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

      {/* ── Footer ── */}
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
```

---

## frontend/src/pages/NotFoundPage.tsx

```tsx
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, Play } from 'lucide-react'
import AccentureMark from '@/components/ui/AccentureMark'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-dark via-brand-mid to-brand-purple text-white flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-lg w-full text-center"
      >
        <div className="flex items-center justify-center gap-2 mb-6 opacity-80">
          <AccentureMark className="w-5 h-5 text-white" />
          <span className="text-sm font-semibold tracking-wide">Accenture Maturity Assessment</span>
        </div>
        <p className="text-[140px] leading-none font-black tracking-tight bg-gradient-to-br from-white to-white/40 bg-clip-text text-transparent">
          404
        </p>
        <h1 className="text-2xl font-bold mt-2">That page doesn't exist</h1>
        <p className="text-sm text-white/70 mt-2">
          The link may be outdated or mistyped. Head back to the landing page or jump straight into an assessment.
        </p>
        <div className="mt-8 flex items-center justify-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 bg-white text-brand-purple font-semibold text-sm px-4 py-2 rounded-lg hover:bg-white/90 transition-colors"
          >
            <Home size={14} /> Back to landing
          </Link>
          <Link
            to="/setup"
            className="inline-flex items-center gap-1.5 border border-white/40 text-white text-sm px-4 py-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Play size={14} /> Start an assessment
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
```

---

## frontend/src/pages/SetupPage.tsx

```tsx
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
  const { setSessionId, setSkill, setClientName, setScreen, sessionId } = useAssessmentStore()

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
      // Always create a fresh session on Setup — the stored one may be stale
      // (e.g. backend restarted and lost in-memory sessions)
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
        {/* Left: Form */}
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

        {/* Right: Skill selector */}
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

      {/* Download templates + Next button row */}
      <div className="mt-6 flex items-center justify-between">
        {/* Download client pack */}
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
```

---
## frontend/src/pages/UploadPage.tsx

```tsx
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, X, ChevronRight, ChevronLeft, Loader2, CheckCircle, AlertCircle, FileText, ChevronDown, Sparkles, FileSpreadsheet } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import QuestionnaireSection from '@/components/upload/QuestionnaireSection'
import DiscoveryQRESection from '@/components/upload/DiscoveryQRESection'
import { api } from '@/lib/api'
import { useAssessmentStore } from '@/store/assessmentStore'
import { cn } from '@/lib/utils'

interface FileSlot {
  key: string
  label: string
  required?: boolean
  hint?: string
  scOnly?: boolean
}

const FILE_SLOTS: FileSlot[] = [
  { key: 'po_file',             label: 'PO Dump',              required: true,  hint: 'SAP ME2N export' },
  { key: 'pr_file',             label: 'PR Dump',              required: true,  hint: 'SAP ME5A export' },
  { key: 'invoice_file',        label: 'Invoice / AP Data',    hint: 'SAP MIR5 export' },
  { key: 'qre_file',            label: 'QRE (Excel)',          hint: 'Qualitative responses' },
  { key: 'workforce_file',      label: 'Workforce Data',       hint: 'FTE breakdown' },
  { key: 'quality_file',        label: 'Quality / Rejection',  hint: 'For Defect Rate KPI' },
  { key: 'inventory_file',      label: 'Inventory Snapshot',   hint: 'SAP MB52/MMBE', scOnly: true },
  { key: 'goods_movement_file', label: 'Goods Movement',       hint: 'SAP MB51', scOnly: true },
  { key: 'po_gr_file',          label: 'PO + GR Data',         hint: 'SAP ME2M+MIGO', scOnly: true },
  { key: 'production_file',     label: 'Production Orders',    hint: 'SAP COOIS', scOnly: true },
  { key: 'maintenance_file',    label: 'Maintenance Orders',   hint: 'SAP IW38', scOnly: true },
]

function DropZone({ slot, file, onChange }: { slot: FileSlot; file: File | null; onChange: (f: File | null) => void }) {
  const onDrop = useCallback((accepted: File[]) => { if (accepted[0]) onChange(accepted[0]) }, [onChange])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, multiple: false,
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.xls'] }
  })
  return (
    <div className={cn('border-2 rounded p-3 transition-all cursor-pointer',
      isDragActive ? 'border-brand-purple bg-bg-secondary' : file ? 'border-green-400 bg-green-50' : 'border-dashed border-bg-secondary hover:border-brand-purple')}
      {...getRootProps()}>
      <input {...getInputProps()} />
      <div className="flex items-center gap-2">
        {file ? <CheckCircle size={16} className="text-green-600 flex-shrink-0" /> : <Upload size={16} className="text-caption flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{file ? file.name : slot.label}</p>
          {!file && <p className="text-xs text-caption">{slot.hint}</p>}
          {file && <p className="text-xs text-green-600">{(file.size / 1024).toFixed(0)} KB</p>}
        </div>
        {file && <button onClick={(e) => { e.stopPropagation(); onChange(null) }} className="text-caption hover:text-red-500"><X size={14} /></button>}
      </div>
    </div>
  )
}

const COVERAGE_COLORS: Record<string, string> = {
  scoreable: 'text-green-700 bg-green-100',
  partial: 'text-orange-700 bg-orange-100',
  insufficient: 'text-red-700 bg-red-100',
}

const CONF_COLORS: Record<string, string> = {
  High: 'text-green-700 bg-green-100',
  Medium: 'text-orange-700 bg-orange-100',
  Low: 'text-red-700 bg-red-100',
}

interface TextQREResult {
  dim_id: string
  dim_name: string
  score: number
  confidence: number
  confidence_label: string
  evidence: string[]
}

// ── Qualitative Text Section ────────────────────────────────────────────────

function QualitativeTextSection({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [results, setResults] = useState<TextQREResult[]>([])
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  const [confirmed, setConfirmed] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [parseError, setParseError] = useState('')

  const handleAnalyse = async () => {
    if (!text.trim()) return
    setParsing(true)
    setParseError('')
    try {
      const res = await api.parseTextQre(sessionId, text) as any
      const parsed: TextQREResult[] = res.results || []
      setResults(parsed)
      const defaults: Record<string, number> = {}
      parsed.forEach((r: TextQREResult) => { defaults[r.dim_id] = r.score })
      setOverrides(defaults)
      setConfirmed(false)
    } catch (e: any) {
      setParseError(e.message)
    } finally {
      setParsing(false)
    }
  }

  const handleConfirm = async () => {
    setSaving(true)
    try {
      await api.confirmTextQre(sessionId, overrides)
      setConfirmed(true)
    } catch (e: any) {
      setParseError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleClear = () => {
    setText('')
    setResults([])
    setOverrides({})
    setConfirmed(false)
    setParseError('')
  }

  return (
    <div className="acc-card mb-6">
      {/* Header toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-brand-purple" />
          <span className="text-sm font-bold text-brand-dark">Qualitative Text Input</span>
          <span className="text-xs text-caption ml-1">(Optional — paste meeting notes or interview transcript)</span>
          {confirmed && (
            <span className="ml-2 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded">
              {Object.keys(overrides).length} dims confirmed
            </span>
          )}
        </div>
        <ChevronDown size={16} className={cn('text-caption transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-bg-secondary">
              <p className="text-xs text-caption mb-3">
                Paste meeting notes, a Copilot summary, or stakeholder interview transcript.
                The engine scans for maturity signals across all dimensions and suggests scores.
                For dimensions with SAP data it blends <strong>70% data + 30% text</strong>;
                for qualitative dimensions (D1, D5, D13) the text score is used directly.
              </p>

              {parseError && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-center gap-2">
                  <AlertCircle size={13} /> {parseError}
                </div>
              )}

              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                rows={6}
                placeholder={`e.g. "The procurement team has no documented category strategies. POs are mostly raised on a spot basis with limited competition. Ariba is used for IT categories only. No vendor performance reviews are conducted formally..."`}
                className="w-full text-xs border border-bg-secondary rounded p-3 resize-y focus:outline-none focus:border-brand-purple text-black placeholder:text-caption"
              />

              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleAnalyse}
                  disabled={parsing || !text.trim()}
                  className="flex items-center gap-2 bg-brand-purple text-white px-4 py-2 rounded text-xs font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50"
                >
                  {parsing ? <Loader2 size={13} className="animate-spin" /> : null}
                  Analyse Text
                </button>
                <button
                  onClick={handleClear}
                  className="px-4 py-2 border border-bg-secondary text-caption rounded text-xs hover:bg-bg-secondary transition-colors"
                >
                  Clear
                </button>
              </div>

              {/* Results review table */}
              {results.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-brand-dark">Review — adjust scores before confirming:</p>
                    <span className="text-xs text-caption">{results.length} dimension{results.length > 1 ? 's' : ''} detected</span>
                  </div>
                  <table className="w-full acc-table text-xs">
                    <thead>
                      <tr>
                        <th>Dimension</th>
                        <th>Confidence</th>
                        <th>Score</th>
                        <th>Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map(r => (
                        <tr key={r.dim_id}>
                          <td className="font-medium">
                            <span className="text-caption mr-1">{r.dim_id}</span>{r.dim_name}
                          </td>
                          <td>
                            <span className={cn('text-xs px-1.5 py-0.5 rounded font-semibold', CONF_COLORS[r.confidence_label] || 'bg-bg-muted text-caption')}>
                              {r.confidence_label} ({(r.confidence * 100).toFixed(0)}%)
                            </span>
                          </td>
                          <td>
                            <select
                              value={overrides[r.dim_id] ?? r.score}
                              onChange={e => setOverrides(prev => ({ ...prev, [r.dim_id]: Number(e.target.value) }))}
                              className="text-xs border border-bg-secondary rounded px-2 py-1 focus:outline-none focus:border-brand-purple"
                            >
                              <option value={1}>1 — Foundation</option>
                              <option value={2}>2 — Intermediate</option>
                              <option value={3}>3 — Advanced</option>
                              <option value={4}>4 — Leading</option>
                            </select>
                          </td>
                          <td>
                            <details className="cursor-pointer">
                              <summary className="text-brand-purple text-xs">Show ({r.evidence.length})</summary>
                              <ul className="mt-1 space-y-0.5 text-caption">
                                {r.evidence.slice(0, 5).map((ev, i) => (
                                  <li key={i} className="before:content-['•'] before:mr-1">{ev}</li>
                                ))}
                              </ul>
                            </details>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex items-center gap-3 mt-3">
                    <button
                      onClick={handleConfirm}
                      disabled={saving || confirmed}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold transition-colors',
                        confirmed
                          ? 'bg-green-600 text-white cursor-default'
                          : 'bg-brand-dark text-white hover:bg-brand-purple'
                      )}
                    >
                      {saving ? <Loader2 size={13} className="animate-spin" /> : confirmed ? <CheckCircle size={13} /> : null}
                      {confirmed ? 'Scores Confirmed' : 'Confirm Scores'}
                    </button>
                    {confirmed && (
                      <span className="text-xs text-green-700">
                        These scores will be applied during the assessment run.
                      </span>
                    )}
                  </div>
                </motion.div>
              )}

              {results.length === 0 && text.trim() && !parsing && (
                <p className="text-xs text-caption mt-3 text-center">
                  No maturity signals detected yet — click Analyse Text.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


// ── Main UploadPage ──────────────────────────────────────────────────────────

// ── Smart Upload — drop many, auto-classify, pick sheet, accept ───────────────

interface InspectedSheet {
  name: string
  columns?: string[]
  row_count_sample?: number
  suggested_slot: string
  confidence: 'high' | 'medium' | 'low'
  reasoning?: string
  error?: string
}
interface InspectedFile {
  filename: string
  size_kb?: number
  error?: string
  sheets: InspectedSheet[]
}

interface PlannedAssignment {
  file: File          // the source File (re-used for upload)
  slotKey: string     // chosen slot, e.g. "po_file"
  sheetName?: string  // chosen sheet (xlsx only); empty for csv
}

const CONF_BADGE: Record<string, string> = {
  high:   'bg-green-100 text-green-700 border-green-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low:    'bg-red-100 text-red-700 border-red-200',
}

function SmartUploadZone({
  visibleSlots,
  onAccept,
}: {
  visibleSlots: FileSlot[]
  onAccept: (assignments: PlannedAssignment[]) => void
}) {
  const [inspecting, setInspecting] = useState(false)
  const [error, setError] = useState('')
  // raw inspect result keyed by file index (so we can re-read the original File when accepting)
  const [pending, setPending] = useState<{ file: File; inspected: InspectedFile }[] | null>(null)
  // per-(fileIdx, sheetIdx) chosen slot (or "" to skip); user can override the AI suggestion
  const [chosen, setChosen] = useState<Record<string, string>>({})

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length === 0) return
    setInspecting(true)
    setError('')
    api.inspectFiles(accepted)
      .then((res) => {
        const list = res.files.map((f, i) => ({ file: accepted[i], inspected: f }))
        setPending(list)
        // Seed chosen with the AI suggestion for the FIRST sheet of each file
        const seed: Record<string, string> = {}
        list.forEach((entry, fIdx) => {
          entry.inspected.sheets.forEach((sh, sIdx) => {
            const k = `${fIdx}.${sIdx}`
            // Only auto-pick the first sheet per file by default — others left empty (skip)
            seed[k] = sIdx === 0 ? sh.suggested_slot || '' : ''
          })
        })
        setChosen(seed)
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setInspecting(false))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, multiple: true,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
  })

  const handleAccept = () => {
    if (!pending) return
    const assignments: PlannedAssignment[] = []
    const usedSlots = new Set<string>()
    pending.forEach((entry, fIdx) => {
      entry.inspected.sheets.forEach((sh, sIdx) => {
        const slotKey = chosen[`${fIdx}.${sIdx}`]
        if (!slotKey) return
        if (usedSlots.has(slotKey)) return  // first selection wins
        usedSlots.add(slotKey)
        assignments.push({
          file: entry.file,
          slotKey,
          sheetName: sh.name === '(csv)' ? undefined : sh.name,
        })
      })
    })
    if (assignments.length === 0) {
      setError('Pick at least one sheet → slot mapping before accepting.')
      return
    }
    onAccept(assignments)
    setPending(null)
    setChosen({})
  }

  const reset = () => { setPending(null); setChosen({}); setError('') }

  return (
    <div className="acc-card mb-5 py-4 px-4 border-2 border-brand-purple/30">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-brand-purple" />
          <span className="text-sm font-bold text-brand-dark">Smart upload</span>
          <span className="text-[10px] uppercase tracking-wide text-caption font-semibold">drop many · we'll classify</span>
        </div>
        {pending && (
          <button onClick={reset} className="text-xs text-caption hover:text-brand-purple">
            Clear
          </button>
        )}
      </div>

      {!pending && (
        <div
          {...getRootProps()}
          className={cn(
            'rounded-lg p-5 text-center cursor-pointer transition-colors border-2 border-dashed',
            isDragActive
              ? 'border-brand-purple bg-purple-50'
              : 'border-bg-secondary hover:border-brand-purple hover:bg-purple-50/30'
          )}
        >
          <input {...getInputProps()} />
          {inspecting ? (
            <div className="flex items-center justify-center gap-2 text-sm text-caption">
              <Loader2 size={14} className="animate-spin text-brand-purple" />
              Inspecting files & detecting sheets…
            </div>
          ) : (
            <>
              <FileSpreadsheet size={22} className="text-brand-purple mx-auto mb-1.5" />
              <p className="text-sm font-semibold text-brand-dark">
                Drop multiple xlsx / csv files here
              </p>
              <p className="text-[11px] text-caption mt-0.5">
                We'll list each sheet, recommend which file slot it maps to, and let you pick the right one before upload.
              </p>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>
      )}

      {pending && pending.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] text-caption">
            <span className="font-semibold text-brand-dark">{pending.length}</span> file{pending.length > 1 ? 's' : ''} inspected.
            Confirm or override each sheet's slot, then click Accept. Multiple sheets in one file → only the ones you assign will be used.
          </p>
          {pending.map((entry, fIdx) => (
            <div key={fIdx} className="border border-bg-secondary rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-bg-secondary/40 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={13} className="text-brand-purple flex-shrink-0" />
                  <span className="text-xs font-bold text-brand-dark truncate">{entry.inspected.filename}</span>
                  {entry.inspected.size_kb != null && (
                    <span className="text-[10px] text-caption">· {entry.inspected.size_kb} KB</span>
                  )}
                </div>
                {entry.inspected.error && (
                  <span className="text-[10px] text-red-700">{entry.inspected.error}</span>
                )}
              </div>
              <div className="divide-y divide-bg-secondary/60">
                {entry.inspected.sheets.map((sh, sIdx) => {
                  const k = `${fIdx}.${sIdx}`
                  const selected = chosen[k] ?? ''
                  return (
                    <div key={sIdx} className="px-3 py-2 flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-brand-dark truncate">{sh.name}</span>
                          {sh.confidence && (
                            <span className={cn('text-[9px] border px-1.5 py-0.5 rounded font-bold uppercase tracking-wide', CONF_BADGE[sh.confidence])}>
                              {sh.confidence} conf.
                            </span>
                          )}
                          {sh.suggested_slot && (
                            <span className="text-[10px] text-brand-purple bg-purple-50 border border-brand-purple/20 rounded px-1.5 py-0.5">
                              suggested: {visibleSlots.find(s => s.key === sh.suggested_slot)?.label ?? sh.suggested_slot}
                            </span>
                          )}
                        </div>
                        {sh.reasoning && <p className="text-[10px] text-caption mt-0.5">{sh.reasoning}</p>}
                        {sh.columns && sh.columns.length > 0 && (
                          <p className="text-[10px] text-caption mt-0.5 truncate">
                            cols: {sh.columns.slice(0, 6).join(', ')}{sh.columns.length > 6 ? `, +${sh.columns.length - 6}` : ''}
                          </p>
                        )}
                      </div>
                      <select
                        value={selected}
                        onChange={(e) => setChosen((prev) => ({ ...prev, [k]: e.target.value }))}
                        className="text-xs border border-bg-secondary rounded px-2 py-1 bg-white focus:outline-none focus:border-brand-purple"
                      >
                        <option value="">— skip this sheet —</option>
                        {visibleSlots.map((slot) => (
                          <option key={slot.key} value={slot.key}>
                            {slot.label}{slot.required ? ' *' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={reset} className="text-xs border border-bg-secondary text-caption hover:text-brand-dark px-3 py-1.5 rounded">
              Cancel
            </button>
            <button
              onClick={handleAccept}
              className="text-xs bg-brand-purple text-white px-4 py-1.5 rounded font-semibold hover:bg-brand-dark transition-colors flex items-center gap-1.5"
            >
              <CheckCircle size={12} /> Accept assignments
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function UploadPage() {
  const navigate = useNavigate()
  const { sessionId, isProcurement, skillPath, setUploadResult, setScreen } = useAssessmentStore()
  const [files, setFiles] = useState<Record<string, File | null>>({})
  // Per-slot sheet name (only set when the source file is multi-sheet xlsx and user picked one)
  const [sheets, setSheets] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [error, setError] = useState('')
  const [coverage, setCoverage] = useState<Record<string, string> | null>(null)

  const setFile = (key: string) => (f: File | null) => {
    setFiles(prev => ({ ...prev, [key]: f }))
    // Clear any sheet selection when the file is removed/replaced
    setSheets(prev => ({ ...prev, [key]: null }))
  }
  const setSheet = (key: string, sheet: string | null) =>
    setSheets(prev => ({ ...prev, [key]: sheet }))

  const visibleSlots = FILE_SLOTS.filter(s => {
    if (s.scOnly && isProcurement) return false
    return true
  })

  const handleNext = async () => {
    if (!sessionId) return
    const po = files['po_file']
    if (!po) { setError('PO Dump is required.'); return }
    setError('')
    setLoading(true)
    setUploadPct(0)
    try {
      const result = await api.uploadFiles(sessionId, files, setUploadPct, sheets)
      setUploadResult(result)
      setCoverage(result.coverage)
      setScreen(result.next_screen as any)
      navigate(result.next_screen === 'column_review' ? '/columns' : '/configure')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Live file coverage — count required + uploaded files for the inviting goal-meter
  const requiredCount = visibleSlots.filter(s => s.required).length
  const uploadedRequired = visibleSlots.filter(s => s.required && files[s.key]).length
  const uploadedOptional = visibleSlots.filter(s => !s.required && files[s.key]).length
  const totalUploaded = uploadedRequired + uploadedOptional

  return (
    <div>
      <PageHeader title="Upload Data Files" subtitle="Upload SAP exports and optional supporting data" />

      <p className="text-[11px] uppercase tracking-widest text-brand-purple font-semibold mb-3">Step 2 of 4 · Data upload</p>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>}

      {/* Live coverage meter */}
      <div className="acc-card mb-5 py-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-caption font-semibold">File coverage</p>
            <p className="text-sm font-bold text-brand-dark mt-0.5">
              {uploadedRequired}/{requiredCount} required
              {uploadedOptional > 0 && <span className="text-caption font-normal"> · +{uploadedOptional} optional</span>}
            </p>
          </div>
          <div className="flex-1 min-w-[160px] max-w-xs">
            <div className="relative w-full h-1.5 bg-bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-1.5 rounded-full bg-gradient-to-r from-brand-dark to-brand-purple"
                initial={false}
                animate={{ width: `${requiredCount ? (uploadedRequired / requiredCount) * 100 : 0}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <p className="text-[10px] text-caption mt-1">
              {uploadedRequired === requiredCount
                ? 'Ready to continue — all required files present.'
                : `Upload ${requiredCount - uploadedRequired} more required file${requiredCount - uploadedRequired !== 1 ? 's' : ''} to unlock the next step.`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-caption font-semibold">Files uploaded</p>
            <p className="text-2xl font-black text-brand-dark leading-none mt-0.5">{totalUploaded}<span className="text-sm font-normal text-caption"> / {visibleSlots.length}</span></p>
          </div>
        </div>
      </div>

      {/* Smart drop-many — recommended path. Falls back to the per-slot grid below. */}
      <SmartUploadZone
        visibleSlots={visibleSlots}
        onAccept={(assignments) => {
          // assignments: [{ file, slotKey, sheetName? }, …]
          setFiles((prev) => {
            const next = { ...prev }
            for (const a of assignments) next[a.slotKey] = a.file
            return next
          })
          setSheets((prev) => {
            const next = { ...prev }
            for (const a of assignments) next[a.slotKey] = a.sheetName ?? null
            return next
          })
        }}
      />

      {/* File upload grid (per-slot fallback / manual override) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
        {visibleSlots.map((slot) => (
          <div key={slot.key}>
            <div className="flex items-center gap-1 mb-1">
              <label className="text-xs font-semibold text-brand-dark">{slot.label}</label>
              {slot.required && <span className="text-red-500 text-xs">*</span>}
              {sheets[slot.key] && (
                <span className="text-[10px] text-brand-purple bg-purple-50 border border-brand-purple/20 rounded px-1.5 py-0.5 ml-1">
                  sheet: {sheets[slot.key]}
                </span>
              )}
            </div>
            <DropZone slot={slot} file={files[slot.key] || null} onChange={setFile(slot.key)} />
          </div>
        ))}
      </div>

      {/* Discovery QRE — qualitative stakeholder inputs (feeds AI insights) */}
      {sessionId && <DiscoveryQRESection sessionId={sessionId} />}

      {/* Qualitative text input (free-text paste → auto-score dimensions) */}
      {sessionId && <QualitativeTextSection sessionId={sessionId} />}

      {/* Click-to-answer questionnaire — companion to the qre_file Excel upload */}
      {sessionId && skillPath && (
        <QuestionnaireSection sessionId={sessionId} skillPath={skillPath} />
      )}

      {/* Coverage preview */}
      {coverage && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="acc-card mb-6">
          <h3 className="text-sm font-bold text-brand-dark mb-3">Dimension Coverage Preview</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(coverage).map(([dim, status]) => (
              <span key={dim} className={cn('text-xs px-2 py-1 rounded font-medium', COVERAGE_COLORS[status] || 'bg-bg-muted text-caption')}>
                {dim}: {status}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      <div className="flex justify-between">
        <button onClick={() => { setScreen('setup'); navigate('/') }}
          className="flex items-center gap-2 border border-bg-secondary text-brand-dark px-5 py-2 rounded text-sm hover:bg-bg-secondary transition-colors">
          <ChevronLeft size={16} /> Back
        </button>
        <div className="flex flex-col items-end gap-2">
          {loading && (
            <div className="w-48">
              <div className="w-full bg-bg-muted rounded-full h-1.5 overflow-hidden">
                <motion.div
                  className="h-1.5 rounded-full bg-brand-purple"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadPct}%` }}
                  transition={{ ease: 'easeOut', duration: 0.3 }}
                />
              </div>
              <p className="text-[11px] text-caption text-right mt-1">
                {uploadPct < 100 ? `${uploadPct}% uploaded…` : 'Processing…'}
              </p>
            </div>
          )}
          <button onClick={handleNext} disabled={loading}
            className="flex items-center gap-2 bg-brand-purple text-white px-6 py-2.5 rounded font-semibold text-sm hover:bg-brand-dark transition-colors disabled:opacity-60">
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
```

---
## frontend/src/pages/ColumnReviewPage.tsx

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight, ChevronLeft, CheckCircle, AlertCircle, Loader2, Pencil, X } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import { api } from '@/lib/api'
import { useAssessmentStore } from '@/store/assessmentStore'
import type { ColumnResolutionState } from '@/lib/types'
import { cn } from '@/lib/utils'

type Action = 'use_suggested' | 'manual' | 'unavailable'

export default function ColumnReviewPage() {
  const navigate = useNavigate()
  const { sessionId, setScreen } = useAssessmentStore()
  const [state, setState] = useState<ColumnResolutionState | null>(null)
  const [actions, setActions] = useState<Record<string, Action>>({})
  const [manuals, setManuals] = useState<Record<string, string>>({})
  const [unmatchedPicks, setUnmatchedPicks] = useState<Record<string, string>>({})
  const [autoOverrides, setAutoOverrides] = useState<Record<string, string>>({})
  const [editingAuto, setEditingAuto] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Mark this step as active so sidebar shows prior steps as completed
    setScreen('columns')
    if (!sessionId) return
    api.getColumns(sessionId).then(data => {
      setState(data)
      const defaultActions: Record<string, Action> = {}
      Object.keys(data.suggestions).forEach(k => { defaultActions[k] = 'use_suggested' })
      setActions(defaultActions)
    }).catch(e => setError(e.message))
  }, [sessionId])

  const handleConfirm = async () => {
    if (!sessionId || !state) return
    setLoading(true)
    try {
      const confirmed: Record<string, string> = {}
      const unavailable: string[] = []

      // Apply auto-resolve overrides first
      for (const [logical, actual] of Object.entries(state.resolved)) {
        confirmed[logical] = autoOverrides[logical] || actual
      }

      // Handle suggestions
      for (const [logical, action] of Object.entries(actions)) {
        if (action === 'use_suggested') {
          const sug = state.suggestions[logical]?.suggested
          if (sug) confirmed[logical] = sug
        } else if (action === 'manual') {
          const pick = manuals[logical]
          if (pick) confirmed[logical] = pick
        } else {
          unavailable.push(logical)
        }
      }

      // Handle unmatched
      for (const logical of state.unmatched) {
        const pick = unmatchedPicks[logical]
        if (pick === '__unavailable__' || !pick) {
          unavailable.push(logical)
        } else {
          confirmed[logical] = pick
        }
      }

      await api.confirmColumns(sessionId, confirmed, unavailable)
      setScreen('configure')
      navigate('/configure')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!state) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-brand-purple" size={32} />
    </div>
  )

  return (
    <div>
      <PageHeader title="Column Review" subtitle="Confirm how your file columns map to expected fields" />
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>}

      {/* Auto resolved */}
      {Object.keys(state.resolved).length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="acc-card mb-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={16} className="text-green-600" />
            <h3 className="text-sm font-bold text-brand-dark">Auto-Resolved ({Object.keys(state.resolved).length})</h3>
            <span className="text-xs text-caption ml-1">— click ✏ to override any mapping</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(state.resolved).map(([logical, actual]) => (
              <div key={logical} className="text-xs bg-green-50 border border-green-200 rounded px-2 py-1.5 flex items-center gap-2">
                <span className="text-caption w-36 flex-shrink-0">{logical}</span>
                <span className="text-brand-purple font-bold">→</span>
                {editingAuto[logical] ? (
                  <div className="flex items-center gap-1 flex-1">
                    <select
                      value={autoOverrides[logical] || actual}
                      onChange={e => setAutoOverrides(prev => ({ ...prev, [logical]: e.target.value }))}
                      className="text-xs border border-brand-purple rounded px-2 py-0.5 flex-1 focus:outline-none bg-white"
                    >
                      {state.available_columns.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <button
                      onClick={() => setEditingAuto(prev => ({ ...prev, [logical]: false }))}
                      className="text-caption hover:text-green-600"
                    >
                      <CheckCircle size={13} />
                    </button>
                    <button
                      onClick={() => {
                        setAutoOverrides(prev => { const n = { ...prev }; delete n[logical]; return n })
                        setEditingAuto(prev => ({ ...prev, [logical]: false }))
                      }}
                      className="text-caption hover:text-red-500"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className={cn('font-medium flex-1', autoOverrides[logical] ? 'text-brand-purple' : 'text-green-800')}>
                      {autoOverrides[logical] || actual}
                      {autoOverrides[logical] && <span className="ml-1 text-[10px] text-brand-purple font-bold">(overridden)</span>}
                    </span>
                    <button
                      onClick={() => setEditingAuto(prev => ({ ...prev, [logical]: true }))}
                      className="text-caption hover:text-brand-purple transition-colors flex-shrink-0"
                      title="Override this mapping"
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Suggestions */}
      {Object.keys(state.suggestions).length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="acc-card mb-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={16} className="text-orange-500" />
            <h3 className="text-sm font-bold text-brand-dark">Suggestions ({Object.keys(state.suggestions).length})</h3>
          </div>
          <table className="w-full acc-table text-xs">
            <thead><tr><th>Expected Field</th><th>Suggested Column</th><th>Confidence</th><th>Action</th></tr></thead>
            <tbody>
              {Object.entries(state.suggestions).map(([logical, sug]) => (
                <tr key={logical}>
                  <td className="font-medium">{logical}<br /><span className="text-caption font-normal">{state.skill_aliases[logical]}</span></td>
                  <td className="font-mono text-brand-dark">{sug.suggested}</td>
                  <td>
                    <span className={cn('font-semibold', sug.confidence > 0.9 ? 'text-green-700' : sug.confidence > 0.8 ? 'text-orange-600' : 'text-red-600')}>
                      {(sug.confidence * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td>
                    <select value={actions[logical] || 'use_suggested'}
                      onChange={e => setActions(prev => ({ ...prev, [logical]: e.target.value as Action }))}
                      className="text-xs border border-bg-secondary rounded px-2 py-1 focus:outline-none focus:border-brand-purple">
                      <option value="use_suggested">Use suggested</option>
                      <option value="manual">Choose manually</option>
                      <option value="unavailable">Mark unavailable</option>
                    </select>
                    {actions[logical] === 'manual' && (
                      <select value={manuals[logical] || ''}
                        onChange={e => setManuals(prev => ({ ...prev, [logical]: e.target.value }))}
                        className="mt-1 text-xs border border-bg-secondary rounded px-2 py-1 w-full focus:outline-none focus:border-brand-purple">
                        <option value="">— pick column —</option>
                        {state.available_columns.map(c => <option key={c}>{c}</option>)}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      {/* Unmatched */}
      {state.unmatched.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="acc-card mb-4">
          <h3 className="text-sm font-bold text-red-700 mb-3">Unmatched Fields ({state.unmatched.length})</h3>
          <div className="space-y-2">
            {state.unmatched.map(logical => (
              <div key={logical} className="flex items-center gap-3">
                <span className="text-xs font-medium text-brand-dark w-40 flex-shrink-0">{logical}</span>
                <select value={unmatchedPicks[logical] || ''}
                  onChange={e => setUnmatchedPicks(prev => ({ ...prev, [logical]: e.target.value }))}
                  className="text-xs border border-bg-secondary rounded px-2 py-1 flex-1 focus:outline-none focus:border-brand-purple">
                  <option value="">— pick column or leave —</option>
                  <option value="__unavailable__">Mark as unavailable</option>
                  {state.available_columns.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="flex justify-between">
        <button onClick={() => { setScreen('upload'); navigate('/upload') }}
          className="flex items-center gap-2 border border-bg-secondary text-brand-dark px-5 py-2 rounded text-sm hover:bg-bg-secondary transition-colors">
          <ChevronLeft size={16} /> Back
        </button>
        <button onClick={handleConfirm} disabled={loading}
          className="flex items-center gap-2 bg-brand-purple text-white px-6 py-2.5 rounded font-semibold text-sm hover:bg-brand-dark transition-colors disabled:opacity-60">
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          Confirm & Continue <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
```

---

## frontend/src/pages/ConfigurePage.tsx

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, CheckCircle, AlertCircle, Loader2, Play, RefreshCw } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import { api } from '@/lib/api'
import { useAssessmentStore } from '@/store/assessmentStore'
import type { ConfigureState } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function ConfigurePage() {
  const navigate = useNavigate()
  const { sessionId, isProcurement, setConfigureState, setScreen } = useAssessmentStore()
  const [config, setConfig] = useState<ConfigureState | null>(null)
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [includes, setIncludes] = useState<Record<string, boolean>>({})
  const [kpiWeights, setKpiWeights] = useState<Record<string, number>>({})  // procurement KPI weights (pct)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sessionId) return
    api.getConfigure(sessionId).then(data => {
      setConfig(data)
      setConfigureState(data)
      const w: Record<string, number> = {}
      const inc: Record<string, boolean> = {}
      data.dimensions.forEach(d => { w[d.dim_id] = d.weight; inc[d.dim_id] = true })
      setWeights(w)
      setIncludes(inc)
      // Init KPI weights from meta (already includes saved overrides from backend)
      if (data.kpi_meta) {
        const kw: Record<string, number> = {}
        Object.entries(data.kpi_meta).forEach(([kid, m]) => {
          kw[kid] = parseFloat((m.weight * 100).toFixed(0))
        })
        setKpiWeights(kw)
      }
    }).catch(e => setError(e.message))
  }, [sessionId])

  // SC dimension weight validation
  const totalWeight = Object.entries(weights).reduce((sum, [id, w]) => sum + (includes[id] ? w : 0), 0)
  const weightOk = Math.abs(totalWeight - 100) < 0.5

  // KPI weight validation (procurement)
  const totalKpiWeight = Object.values(kpiWeights).reduce((s, w) => s + w, 0)
  const kpiWeightOk = Math.abs(totalKpiWeight - 100) < 0.5

  const autoRedistribute = () => {
    const active = Object.keys(includes).filter(id => includes[id])
    if (!active.length) return
    const each = parseFloat((100 / active.length).toFixed(0))
    const newW = { ...weights }
    active.forEach(id => { newW[id] = each })
    setWeights(newW)
  }

  const autoRedistributeKpi = () => {
    const keys = Object.keys(kpiWeights)
    if (!keys.length) return
    const each = parseFloat((100 / keys.length).toFixed(0))
    const newW: Record<string, number> = {}
    keys.forEach(k => { newW[k] = each })
    setKpiWeights(newW)
  }

  const resetKpiWeights = () => {
    if (!config?.kpi_meta) return
    const defaults: Record<string, number> = {
      tat: 25, savings_lpo: 20, spend_per_fte: 15, rc_adoption: 10,
      otd: 10, defect_rate: 10, sourcing_tool: 5, pac_prs: 5,
    }
    const kw: Record<string, number> = {}
    Object.keys(config.kpi_meta).forEach(kid => {
      kw[kid] = defaults[kid] ?? parseFloat((config.kpi_meta![kid].weight * 100).toFixed(0))
    })
    setKpiWeights(kw)
  }

  const handleRun = async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      await api.saveConfigure(sessionId, weights, includes, isProcurement ? kpiWeights : undefined)
      await api.triggerRun(sessionId)
      setScreen('running')
      navigate('/running')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!config) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-brand-purple" size={32} />
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Configure Assessment"
        subtitle={isProcurement ? 'Adjust KPI weights for the 8-KPI procurement model' : 'Adjust dimension weights'}
      />
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>}

      {isProcurement ? (
        // ── Procurement: editable KPI weight sliders ──────────────────────────
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="acc-card mb-6">
          {config.engagement.fte_count !== null && (
            <p className="text-xs text-caption mb-4">
              FTE: <strong>{config.engagement.fte_count}</strong> · Annual Spend:{' '}
              <strong>₹{config.engagement.annual_spend} Cr</strong> · Industry:{' '}
              <strong>{config.engagement.industry}</strong>
            </p>
          )}

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-brand-dark">KPI Weights</h3>
            <div className="flex items-center gap-2">
              <span className={cn(
                'text-xs font-bold px-2 py-0.5 rounded',
                kpiWeightOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              )}>
                Total: {totalKpiWeight.toFixed(0)}% {kpiWeightOk ? '✓' : '(must = 100%)'}
              </span>
              <button onClick={autoRedistributeKpi}
                className="text-xs text-brand-purple border border-brand-purple px-2 py-1 rounded hover:bg-bg-secondary transition-colors flex items-center gap-1">
                <RefreshCw size={11} /> Equal
              </button>
              <button onClick={resetKpiWeights}
                className="text-xs text-caption border border-bg-secondary px-2 py-1 rounded hover:bg-bg-secondary transition-colors">
                Reset
              </button>
            </div>
          </div>

          {Object.entries(config.buckets ?? {}).map(([bucket, kpiIds]) => (
            <div key={bucket} className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-caption">{bucket}</span>
                <div className="flex-1 border-t border-bg-secondary" />
              </div>
              <div className="space-y-3">
                {(kpiIds as string[]).map(kid => {
                  const meta = config.kpi_meta?.[kid]
                  if (!meta) return null
                  const w = kpiWeights[kid] ?? (meta.weight * 100)
                  const hasData = config.data_ready?.[kid]
                  return (
                    <div key={kid} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm font-medium text-brand-dark truncate">{meta.label}</span>
                          {hasData
                            ? <CheckCircle size={12} className="text-green-600 flex-shrink-0" />
                            : <AlertCircle size={12} className="text-orange-500 flex-shrink-0" />}
                          <span className="text-[10px] text-caption ml-auto flex-shrink-0">
                            {meta.direction === 'lower_is_better' ? '↓ Lower better' : '↑ Higher better'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range" min={0} max={50} step={1}
                            value={w}
                            onChange={e => setKpiWeights(prev => ({ ...prev, [kid]: parseFloat(e.target.value) }))}
                            className="flex-1 accent-brand-purple h-1.5"
                          />
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <input
                              type="number" min={0} max={50} step={1}
                              value={w}
                              onChange={e => setKpiWeights(prev => ({ ...prev, [kid]: parseFloat(e.target.value) || 0 }))}
                              className="w-14 border border-bg-secondary rounded px-2 py-0.5 text-xs text-right focus:outline-none focus:border-brand-purple"
                            />
                            <span className="text-xs text-caption">%</span>
                          </div>
                        </div>
                        {config.benchmarks_display?.[kid] && (
                          <p className="text-[10px] text-caption mt-0.5">
                            Benchmark: <span className="font-mono">{config.benchmarks_display[kid]}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </motion.div>
      ) : (
        // ── Supply chain: dimension weights ───────────────────────────────────
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="acc-card mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-brand-dark">Dimension Weights</h3>
            <div className="flex items-center gap-3">
              <span className={cn('text-xs font-bold', weightOk ? 'text-green-700' : 'text-red-600')}>
                Total: {totalWeight.toFixed(0)}% {weightOk ? '✓' : '(must equal 100%)'}
              </span>
              <button onClick={autoRedistribute}
                className="text-xs text-brand-purple border border-brand-purple px-2 py-1 rounded hover:bg-bg-secondary transition-colors">
                Auto-redistribute
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {config.dimensions.map((dim) => (
              <div key={dim.dim_id} className="flex items-center gap-3 py-1.5 border-b border-bg-secondary/50">
                <input type="checkbox" checked={includes[dim.dim_id] ?? true}
                  onChange={e => setIncludes(prev => ({ ...prev, [dim.dim_id]: e.target.checked }))}
                  className="accent-brand-purple" />
                <span className="text-xs font-medium w-8 text-caption">{dim.dim_id}</span>
                <span className="text-sm flex-1">{dim.name}</span>
                <span className="text-xs text-caption">{dim.kpi_count} KPI{dim.kpi_count !== 1 ? 's' : ''}</span>
                <input type="number" min={0} max={100} step={0.1}
                  value={weights[dim.dim_id] ?? dim.weight}
                  onChange={e => setWeights(prev => ({ ...prev, [dim.dim_id]: parseFloat(e.target.value) || 0 }))}
                  disabled={!includes[dim.dim_id]}
                  className="w-16 border border-bg-secondary rounded px-2 py-1 text-xs text-right focus:outline-none focus:border-brand-purple disabled:opacity-40" />
                <span className="text-xs text-caption">%</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="flex justify-between">
        <button onClick={() => { setScreen('upload'); navigate('/upload') }}
          className="flex items-center gap-2 border border-bg-secondary text-brand-dark px-5 py-2 rounded text-sm hover:bg-bg-secondary transition-colors">
          <ChevronLeft size={16} /> Back
        </button>
        <button
          onClick={handleRun}
          disabled={loading || (isProcurement ? !kpiWeightOk : !weightOk)}
          className="flex items-center gap-2 bg-brand-purple text-white px-6 py-2.5 rounded font-semibold text-sm hover:bg-brand-dark transition-colors disabled:opacity-60">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          Run Assessment
        </button>
      </div>
    </div>
  )
}
```

---

## frontend/src/pages/RunningPage.tsx

```tsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Loader2, AlertCircle, ChevronRight, Clock, Sparkles } from 'lucide-react'
import { useAssessmentStore } from '@/store/assessmentStore'
import type { ProgressEvent } from '@/lib/types'
import PageHeader from '@/components/layout/PageHeader'

const DID_YOU_KNOW: string[] = [
  'Top-quartile procurement teams see RC adoption above 60% — the largest single lever on TAT.',
  'A 10% reduction in single-source PRs typically unlocks 2–3% in category savings.',
  'Leading organisations review supplier performance quarterly, not annually.',
  'PO compliance above 85% correlates strongly with predictable cash-out and fewer audit flags.',
  'Digitised sourcing cycles are 38% faster than email/RFQ-driven ones, on average.',
]

export default function RunningPage() {
  const navigate = useNavigate()
  const { sessionId, setScreen } = useAssessmentStore()
  const [events, setEvents] = useState<ProgressEvent[]>([])
  const [pct, setPct] = useState(0)
  const [currentMsg, setCurrentMsg] = useState('Starting assessment…')
  const [stepLabel, setStepLabel] = useState('')
  const [status, setStatus] = useState<'running' | 'done' | 'error'>('running')
  const [errorMsg, setErrorMsg] = useState('')
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sessionId) return
    const url = `/api/v1/session/${sessionId}/run-status`
    let active = true

    const run = async () => {
      try {
        const res = await fetch(url)
        if (!res.body) return
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (active) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const evt: ProgressEvent = JSON.parse(line.slice(6))
                if (evt.pct !== undefined) setPct(evt.pct)
                if (evt.message) {
                  setCurrentMsg(evt.message)
                  setEvents(prev => [...prev, evt])
                }
                if (evt.step !== undefined && evt.total !== undefined) {
                  setStepLabel(`Step ${evt.step} of ${evt.total}`)
                }
                if (evt.status === 'done') {
                  setStatus('done')
                  setPct(100)
                  setTimeout(() => { setScreen('formula-review'); navigate('/formula-review') }, 1500)
                }
                if (evt.status === 'error') {
                  setStatus('error')
                  setErrorMsg(evt.message || 'Unknown error')
                }
              } catch {}
            }
          }
        }
      } catch (e: any) {
        if (active) { setStatus('error'); setErrorMsg(e.message) }
      }
    }

    run()
    return () => { active = false }
  }, [sessionId])

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  // Rotate "Did you know?" fact every 6s while running
  const [factIdx, setFactIdx] = useState(0)
  useEffect(() => {
    if (status !== 'running') return
    const id = setInterval(() => setFactIdx(i => (i + 1) % DID_YOU_KNOW.length), 6000)
    return () => clearInterval(id)
  }, [status])

  const { clientName } = useAssessmentStore()

  return (
    <div className="px-4">
      <PageHeader
        title={status === 'running' ? `Running Assessment${clientName ? ` — ${clientName}` : ''}` : status === 'done' ? 'Assessment Complete!' : 'Assessment Failed'}
        subtitle={status === 'running' ? 'Calculating KPIs, scoring dimensions, and generating insights…' : undefined}
      />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl mx-auto">

        {/* Status icon */}
        <div className="text-center mb-6">
          {status === 'running' && <Loader2 size={44} className="text-brand-purple animate-spin mx-auto mb-3" />}
          {status === 'done'    && <CheckCircle size={44} className="text-green-600 mx-auto mb-3" />}
          {status === 'error'   && <AlertCircle size={44} className="text-red-600 mx-auto mb-3" />}
          {status === 'error' && <p className="text-sm text-red-600 mt-1">{errorMsg}</p>}
          {status === 'running' && pct < 50 && (
            <p className="text-xs text-caption flex items-center justify-center gap-1 mt-2">
              <Clock size={11} /> Typically completes in 30–60 seconds
            </p>
          )}
        </div>

        {/* Progress bar + % */}
        <div className="mb-2 flex items-center justify-between text-xs text-caption font-medium">
          <span>{stepLabel}</span>
          <span className="tabular-nums font-bold text-brand-purple">{pct}%</span>
        </div>
        <div className="w-full bg-bg-muted rounded-full h-3 mb-3 overflow-hidden">
          <motion.div
            className="h-3 rounded-full bg-gradient-to-r from-brand-dark to-brand-purple"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {/* Current step message */}
        {status === 'running' && (
          <p className="text-sm text-center text-brand-dark font-medium mb-4 min-h-[1.25rem]">
            {currentMsg}
          </p>
        )}

        {/* Did you know? — rotates every 6s while running */}
        {status === 'running' && (
          <div className="mb-6 rounded-lg border border-bg-secondary bg-bg-secondary/30 px-4 py-3">
            <div className="flex items-start gap-2">
              <Sparkles size={14} className="text-brand-purple flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest font-bold text-brand-purple mb-0.5">Did you know?</p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={factIdx}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.3 }}
                    className="text-xs text-brand-dark leading-relaxed"
                  >
                    {DID_YOU_KNOW[factIdx]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {/* Step log */}
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {events.map((evt, i) => {
              const isLast = i === events.length - 1 && status === 'running'
              return (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded border text-sm ${
                    isLast
                      ? 'border-brand-purple bg-bg-secondary text-brand-dark font-semibold'
                      : 'border-bg-secondary bg-white text-black'
                  }`}>
                  {isLast
                    ? <Loader2 size={15} className="text-brand-purple animate-spin flex-shrink-0" />
                    : <CheckCircle size={15} className="text-green-600 flex-shrink-0" />}
                  <span className="flex-1">{evt.message}</span>
                  <span className="text-xs text-caption tabular-nums">{evt.pct}%</span>
                  {isLast && <ChevronRight size={13} className="text-brand-purple flex-shrink-0" />}
                </motion.div>
              )
            })}
          </AnimatePresence>
          <div ref={logEndRef} />
        </div>

        {status === 'error' && (
          <button onClick={() => { setScreen('configure'); navigate('/configure') }}
            className="mt-6 mx-auto block border border-brand-purple text-brand-purple px-5 py-2 rounded text-sm hover:bg-bg-secondary transition-colors">
            ← Back to Configure
          </button>
        )}

      </motion.div>
    </div>
  )
}
```

---
## frontend/src/pages/FormulaReviewPage.tsx

```tsx
/**
 * Formula Review Page
 *
 * Shown after run, before Results. Users can:
 * 1. Edit benchmark values (re-scores KPIs)
 * 2. Edit calculation parameters (sliders/toggles — re-computes raw KPI values)
 * 3. Edit formula display text / description (display only)
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown, ChevronUp, RefreshCw, CheckCircle2,
  Pencil, RotateCcw, ArrowRight, Info, AlertTriangle, Save, SlidersHorizontal,
} from 'lucide-react'
import { useAssessmentStore } from '@/store/assessmentStore'
import { cn, formatIndianInt } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

interface KpiFormula {
  kpi_id: string
  label: string
  bucket: string
  weight: number
  unit: string
  direction: 'lower_is_better' | 'higher_is_better'
  formula: string
  description: string
  benchmark: number
  benchmark_unit: string
  thresholds: Record<string, { label: string; condition: string }>
  multipliers: Record<string, number>
  has_override: boolean
}

interface FormulaConfig {
  kpis: KpiFormula[]
  score_labels: Record<string, string>
  score_colors: Record<string, string>
  bucket_order: string[]
  overrides_active: boolean
  override_count: number
}

interface KpiOverride {
  benchmark?: number
  formula?: string
  description?: string
}

interface ParamDef {
  key: string
  type: 'number' | 'boolean'
  label: string
  unit?: string
  min?: number
  max?: number
  step?: number
  default: number | boolean
  description: string
  value: number | boolean
}

interface FormulaParamGroup {
  label: string
  description: string
  params: ParamDef[]
  has_override: boolean
}

// ── Score colours ──────────────────────────────────────────────────────────────

const SCORE_BG: Record<string, string> = {
  Leading:      'bg-green-100 text-green-800 border-green-300',
  Advanced:     'bg-blue-100 text-blue-800 border-blue-300',
  Intermediate: 'bg-orange-100 text-orange-800 border-orange-300',
  Foundation:   'bg-red-100 text-red-800 border-red-300',
}

// ── Compute threshold ranges ───────────────────────────────────────────────────

function scoreThresholds(kpi: KpiFormula, bench: number) {
  const { direction, multipliers, unit } = kpi
  const m4 = multipliers.score_4
  const m3 = multipliers.score_3
  const m2 = multipliers.score_2
  const fmt = (v: number) =>
    unit === '₹ Cr' ? `₹${formatIndianInt(v)} Cr`
    : unit === 'days' ? `${v.toFixed(0)} days`
    : `${v.toFixed(0)}%`

  if (direction === 'lower_is_better') {
    return [
      { score: 4, label: 'Leading',      range: `< ${fmt(bench * m4)}` },
      { score: 3, label: 'Advanced',     range: `${fmt(bench * m4)} – ${fmt(bench * m3)}` },
      { score: 2, label: 'Intermediate', range: `${fmt(bench * m3)} – ${fmt(bench * m2)}` },
      { score: 1, label: 'Foundation',   range: `≥ ${fmt(bench * m2)}` },
    ]
  }
  return [
    { score: 4, label: 'Leading',      range: `> ${fmt(bench * m4)}` },
    { score: 3, label: 'Advanced',     range: `${fmt(bench * m3)} – ${fmt(bench * m4)}` },
    { score: 2, label: 'Intermediate', range: `${fmt(bench * m2)} – ${fmt(bench * m3)}` },
    { score: 1, label: 'Foundation',   range: `< ${fmt(bench * m2)}` },
  ]
}

// ── Param control components ───────────────────────────────────────────────────

function NumberParam({
  def,
  value,
  onChange,
}: {
  def: ParamDef
  value: number
  onChange: (v: number) => void
}) {
  const isDefault = value === def.default
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-brand-dark">{def.label}</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            className="w-16 border border-gray-300 rounded-md px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-brand-purple"
            value={value}
            min={def.min}
            max={def.max}
            step={def.step}
            onChange={e => {
              const n = parseFloat(e.target.value)
              if (!isNaN(n)) onChange(Math.min(def.max ?? 999, Math.max(def.min ?? 0, n)))
            }}
          />
          <span className="text-[10px] text-caption">{def.unit}</span>
          {!isDefault && (
            <button
              onClick={() => onChange(def.default as number)}
              className="text-[10px] text-caption hover:text-brand-purple"
              title="Reset to default"
            >
              <RotateCcw size={10} />
            </button>
          )}
        </div>
      </div>
      <input
        type="range"
        className="w-full h-1.5 accent-brand-purple"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
      <div className="flex justify-between">
        <span className="text-[9px] text-caption">{def.min}{def.unit}</span>
        <span className="text-[9px] text-caption">{def.max}{def.unit}</span>
      </div>
      {!isDefault && (
        <p className="text-[10px] text-brand-purple font-medium">
          Changed from default ({def.default as number}{def.unit})
        </p>
      )}
    </div>
  )
}

function BooleanParam({
  def,
  value,
  onChange,
}: {
  def: ParamDef
  value: boolean
  onChange: (v: boolean) => void
}) {
  const isDefault = value === def.default
  return (
    <div className="flex items-start gap-3">
      <button
        onClick={() => onChange(!value)}
        className={cn(
          'flex-shrink-0 w-10 h-5 rounded-full transition-colors relative mt-0.5',
          value ? 'bg-brand-purple' : 'bg-gray-200'
        )}
      >
        <span className={cn(
          'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform',
          value ? 'translate-x-5' : 'translate-x-0.5'
        )} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-brand-dark">{def.label}</p>
        <p className="text-[10px] text-caption">{def.description}</p>
        {!isDefault && (
          <button
            onClick={() => onChange(def.default as boolean)}
            className="text-[10px] text-caption hover:text-brand-purple mt-0.5 flex items-center gap-0.5"
          >
            <RotateCcw size={9} /> Reset to default ({(def.default as boolean) ? 'On' : 'Off'})
          </button>
        )}
      </div>
    </div>
  )
}

// ── KPI Formula Card ───────────────────────────────────────────────────────────

function KpiCard({
  kpi,
  override,
  paramGroup,
  onSave,
  onReset,
  onParamChange,
}: {
  kpi: KpiFormula
  override: KpiOverride | null
  paramGroup: FormulaParamGroup | null
  onSave: (id: string, patch: KpiOverride) => void
  onReset: (id: string) => void
  onParamChange: (kpiId: string, key: string, value: number | boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const [editingFormula, setEditingFormula] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [editingBench, setEditingBench] = useState(false)

  const [formulaInput, setFormulaInput] = useState('')
  const [descInput, setDescInput] = useState('')
  const [benchInput, setBenchInput] = useState('')

  const effectiveFormula = override?.formula ?? kpi.formula
  const effectiveDesc = override?.description ?? kpi.description
  const effectiveBench = override?.benchmark ?? kpi.benchmark
  const hasOverride = override !== null && Object.keys(override).length > 0
  const hasParamChange = paramGroup?.params.some(p => p.value !== p.default) ?? false
  const thresholds = scoreThresholds(kpi, effectiveBench)

  const saveFormula = () => {
    if (formulaInput.trim()) onSave(kpi.kpi_id, { formula: formulaInput.trim() })
    setEditingFormula(false)
  }
  const saveDesc = () => {
    if (descInput.trim()) onSave(kpi.kpi_id, { description: descInput.trim() })
    setEditingDesc(false)
  }
  const saveBench = () => {
    const n = parseFloat(benchInput)
    if (!isNaN(n) && n > 0) onSave(kpi.kpi_id, { benchmark: n })
    setEditingBench(false)
  }

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden shadow-sm transition-all',
      (hasOverride || hasParamChange) ? 'border-brand-purple/50 bg-purple-50/20' : 'border-gray-200 bg-white',
    )}>
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/60 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-brand-dark">{kpi.label}</span>
            <span className="text-[10px] text-caption bg-gray-100 px-2 py-0.5 rounded-full border">{kpi.bucket}</span>
            <span className="text-[10px] text-caption">{(kpi.weight * 100).toFixed(0)}% weight</span>
            <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium',
              kpi.direction === 'lower_is_better' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-green-200')}>
              {kpi.direction === 'lower_is_better' ? '↓ lower = better' : '↑ higher = better'}
            </span>
            {hasOverride && (
              <span className="text-[10px] text-brand-purple font-semibold bg-purple-100 px-2 py-0.5 rounded-full border border-purple-300">
                ✎ Benchmark
              </span>
            )}
            {hasParamChange && (
              <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                ⚙ Parameters
              </span>
            )}
          </div>
          <p className="text-[11px] text-caption mt-0.5 font-mono truncate">{effectiveFormula}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-[10px] text-caption">Benchmark</p>
            <p className="text-sm font-bold text-brand-dark">
              {effectiveBench.toFixed(0)} <span className="text-caption font-normal text-xs">{kpi.benchmark_unit}</span>
            </p>
          </div>
          {expanded
            ? <ChevronUp size={15} className="text-caption" />
            : <ChevronDown size={15} className="text-caption" />}
        </div>
      </button>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-100 px-4 py-4 space-y-5">

              {/* ── Calculation Parameters (REAL impact on values) ──── */}
              {paramGroup && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <SlidersHorizontal size={13} className="text-amber-600" />
                    <p className="text-[10px] text-amber-700 uppercase font-bold tracking-wide">
                      Calculation Parameters
                    </p>
                    <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full font-semibold">
                      affects computed values
                    </span>
                  </div>
                  <p className="text-[11px] text-caption mb-3">{paramGroup.description}</p>
                  <div className="space-y-4">
                    {paramGroup.params.map(p => (
                      <div key={p.key} className="bg-amber-50/50 border border-amber-100 rounded-lg px-3 py-3">
                        {p.type === 'number' ? (
                          <>
                            <NumberParam
                              def={p}
                              value={p.value as number}
                              onChange={v => onParamChange(kpi.kpi_id, p.key, v)}
                            />
                            <p className="text-[10px] text-caption mt-1.5">{p.description}</p>
                          </>
                        ) : (
                          <BooleanParam
                            def={p}
                            value={p.value as boolean}
                            onChange={v => onParamChange(kpi.kpi_id, p.key, v)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Formula (editable text — display only) ─────────── */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] text-caption uppercase font-bold tracking-wide">
                    Formula Display Text
                    <span className="ml-1 normal-case font-normal text-[10px]">(display only)</span>
                  </p>
                  {!editingFormula ? (
                    <button
                      onClick={() => { setFormulaInput(effectiveFormula); setEditingFormula(true) }}
                      className="flex items-center gap-1 text-[11px] text-brand-purple hover:underline font-medium"
                    >
                      <Pencil size={10} /> Edit
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={saveFormula} className="flex items-center gap-1 text-[11px] text-green-700 hover:underline font-semibold">
                        <Save size={10} /> Save
                      </button>
                      <button onClick={() => setEditingFormula(false)} className="text-[11px] text-caption hover:text-brand-dark">
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                {editingFormula ? (
                  <textarea
                    className="w-full border border-brand-purple rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-purple/30 resize-none"
                    rows={2}
                    value={formulaInput}
                    onChange={e => setFormulaInput(e.target.value)}
                    autoFocus
                  />
                ) : (
                  <code className="block text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-brand-dark font-mono whitespace-pre-wrap">
                    {effectiveFormula}
                  </code>
                )}
              </div>

              {/* ── Description ────────────────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] text-caption uppercase font-bold tracking-wide">Description</p>
                  {!editingDesc ? (
                    <button
                      onClick={() => { setDescInput(effectiveDesc); setEditingDesc(true) }}
                      className="flex items-center gap-1 text-[11px] text-brand-purple hover:underline font-medium"
                    >
                      <Pencil size={10} /> Edit
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={saveDesc} className="flex items-center gap-1 text-[11px] text-green-700 hover:underline font-semibold">
                        <Save size={10} /> Save
                      </button>
                      <button onClick={() => setEditingDesc(false)} className="text-[11px] text-caption hover:text-brand-dark">Cancel</button>
                    </div>
                  )}
                </div>
                {editingDesc ? (
                  <textarea
                    className="w-full border border-brand-purple rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-purple/30 resize-none"
                    rows={2}
                    value={descInput}
                    onChange={e => setDescInput(e.target.value)}
                    autoFocus
                  />
                ) : (
                  <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    <Info size={12} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-800">{effectiveDesc}</p>
                  </div>
                )}
              </div>

              {/* ── Benchmark ──────────────────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] text-caption uppercase font-bold tracking-wide">
                    Industry Benchmark
                    <span className="ml-1 normal-case font-normal">(drives 1–4 scoring)</span>
                  </p>
                  {!editingBench ? (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => { setBenchInput(effectiveBench.toFixed(0)); setEditingBench(true) }}
                        className="flex items-center gap-1 text-[11px] text-brand-purple hover:underline font-medium"
                      >
                        <Pencil size={10} /> Edit benchmark
                      </button>
                      {hasOverride && (
                        <button
                          onClick={() => onReset(kpi.kpi_id)}
                          className="flex items-center gap-1 text-[11px] text-caption hover:text-red-600 transition-colors"
                        >
                          <RotateCcw size={10} /> Reset
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={saveBench} className="flex items-center gap-1 text-[11px] text-green-700 hover:underline font-semibold">
                        <Save size={10} /> Save
                      </button>
                      <button onClick={() => setEditingBench(false)} className="text-[11px] text-caption hover:text-brand-dark">Cancel</button>
                    </div>
                  )}
                </div>
                {editingBench ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="border border-brand-purple rounded-lg px-3 py-1.5 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
                      value={benchInput}
                      onChange={e => setBenchInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveBench(); if (e.key === 'Escape') setEditingBench(false) }}
                      autoFocus
                    />
                    <span className="text-xs text-caption">{kpi.benchmark_unit}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className={cn('text-sm font-bold', override?.benchmark != null ? 'text-brand-purple' : 'text-brand-dark')}>
                      {effectiveBench.toFixed(0)} {kpi.benchmark_unit}
                    </span>
                    {override?.benchmark != null && (
                      <span className="text-[10px] text-caption">(default: {kpi.benchmark.toFixed(0)})</span>
                    )}
                  </div>
                )}
              </div>

              {/* ── Scoring thresholds ─────────────────────────────── */}
              <div>
                <p className="text-[10px] text-caption uppercase font-bold tracking-wide mb-2">
                  Score Thresholds
                  {override?.benchmark != null && (
                    <span className="ml-1 normal-case font-normal text-brand-purple">(updated)</span>
                  )}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {thresholds.map(t => (
                    <div key={t.score} className={cn('rounded-lg border px-2.5 py-2 text-center text-xs', SCORE_BG[t.label] ?? '')}>
                      <p className="font-black text-sm">{t.score}/4</p>
                      <p className="font-semibold">{t.label}</p>
                      <p className="text-[10px] opacity-75 mt-0.5">{t.range}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function FormulaReviewPage() {
  const navigate = useNavigate()
  const { sessionId, setScreen } = useAssessmentStore()

  const [config, setConfig] = useState<FormulaConfig | null>(null)
  const [formulaParamsConfig, setFormulaParamsConfig] = useState<Record<string, FormulaParamGroup>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [overrides, setOverrides] = useState<Record<string, KpiOverride>>({})
  const [saving, setSaving] = useState(false)
  const [expandedBuckets, setExpandedBuckets] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!sessionId) return
    Promise.all([
      fetch(`/api/v1/session/${sessionId}/results/formula-config`).then(r => r.json()),
      fetch(`/api/v1/session/${sessionId}/results/formula-params`).then(r => r.json()),
    ])
      .then(([configData, paramsData]) => {
        setConfig(configData)
        const pre: Record<string, KpiOverride> = {}
        configData.kpis?.forEach((kpi: KpiFormula) => {
          if (kpi.has_override) pre[kpi.kpi_id] = { benchmark: kpi.benchmark }
        })
        setOverrides(pre)
        const bucketState: Record<string, boolean> = {}
        configData.bucket_order?.forEach((b: string) => { bucketState[b] = false })
        setExpandedBuckets(bucketState)
        setFormulaParamsConfig(paramsData.formula_params ?? {})
      })
      .catch(() => setError('Failed to load formula configuration.'))
      .finally(() => setLoading(false))
  }, [sessionId])

  const handleSave = useCallback((id: string, patch: KpiOverride) => {
    setOverrides(prev => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } }))
  }, [])

  const handleReset = useCallback((id: string) => {
    setOverrides(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const handleParamChange = useCallback((kpiId: string, key: string, value: number | boolean) => {
    setFormulaParamsConfig(prev => {
      const group = prev[kpiId]
      if (!group) return prev
      return {
        ...prev,
        [kpiId]: {
          ...group,
          params: group.params.map(p => p.key === key ? { ...p, value } : p),
        },
      }
    })
  }, [])

  const overrideCount = Object.keys(overrides).length
  const paramChangeCount = Object.values(formulaParamsConfig)
    .flatMap(g => g.params)
    .filter(p => p.value !== p.default).length

  const handleConfirm = async () => {
    setSaving(true)
    try {
      // Save benchmark overrides
      const benchOverrides = Object.entries(overrides)
        .filter(([, ov]) => ov.benchmark != null)
        .map(([kpi_id, ov]) => ({ kpi_id, benchmark: ov.benchmark }))

      if (benchOverrides.length > 0) {
        await fetch(`/api/v1/session/${sessionId}/results/formula-overrides`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ overrides: benchOverrides }),
        })
      }

      // Save formula params
      const paramsPayload: Record<string, Record<string, number | boolean>> = {}
      for (const [kpiId, group] of Object.entries(formulaParamsConfig)) {
        const vals: Record<string, number | boolean> = {}
        for (const p of group.params) {
          if (p.value !== p.default) vals[p.key] = p.value
        }
        if (Object.keys(vals).length > 0) paramsPayload[kpiId] = vals
      }

      if (Object.keys(paramsPayload).length > 0) {
        await fetch(`/api/v1/session/${sessionId}/results/formula-params`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ params: paramsPayload }),
        })
      }

      // Apply overrides + params (re-compute raw values + re-score)
      if (benchOverrides.length > 0 || Object.keys(paramsPayload).length > 0) {
        await fetch(`/api/v1/session/${sessionId}/results/apply-formula-overrides`, {
          method: 'POST',
        })
      }

      setScreen('results')
      navigate('/results')
    } catch {
      setSaving(false)
    }
  }

  const handleSkip = () => {
    setScreen('results')
    navigate('/results')
  }

  const grouped = config
    ? config.bucket_order.reduce<Record<string, KpiFormula[]>>((acc, bucket) => {
        const kpis = config.kpis.filter(k => k.bucket === bucket)
        if (kpis.length) acc[bucket] = kpis
        return acc
      }, {})
    : {}

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <RefreshCw size={32} className="text-brand-purple animate-spin mb-3" />
        <p className="text-brand-dark font-medium">Loading formula configuration…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 space-y-3">
        <AlertTriangle size={36} className="text-amber-500" />
        <p className="text-red-600 font-semibold">{error}</p>
        <button onClick={handleSkip} className="text-brand-purple text-sm hover:underline">
          Skip to Results →
        </button>
      </div>
    )
  }

  const totalChanges = overrideCount + paramChangeCount

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto px-4 py-6 space-y-5"
    >
      {/* Header */}
      <div className="page-header rounded-xl px-6 py-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-white font-bold text-xl">Formula Review</h2>
            <p className="text-white/70 text-sm mt-1">
              Review KPI formulas and benchmarks before viewing results.
              <strong className="text-white/90"> Calculation parameters</strong> (sliders) re-compute raw values.
              <strong className="text-white/90"> Benchmark changes</strong> re-score the 1–4 ratings.
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-white/60 text-xs">Step 6 of 6</p>
            <p className="text-white font-bold text-sm mt-0.5">Pre-Results</p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
          <SlidersHorizontal size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">Calculation Parameters</p>
            <p className="text-amber-700">Change how KPI values are computed from raw data (e.g. outlier trim, grace period).</p>
          </div>
        </div>
        <div className="flex items-start gap-2 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2.5">
          <Pencil size={13} className="text-brand-purple flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-brand-purple">Benchmarks</p>
            <p className="text-purple-700">Change the reference target that determines the 1–4 maturity score.</p>
          </div>
        </div>
      </div>

      {/* Changes banner */}
      {totalChanges > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-purple-50 border border-brand-purple/30 rounded-xl px-4 py-3"
        >
          <CheckCircle2 size={15} className="text-brand-purple flex-shrink-0" />
          <p className="text-sm text-brand-purple font-medium flex-1">
            {paramChangeCount > 0 && `${paramChangeCount} parameter${paramChangeCount !== 1 ? 's' : ''} changed (re-computes values)`}
            {paramChangeCount > 0 && overrideCount > 0 && ' · '}
            {overrideCount > 0 && `${overrideCount} benchmark${overrideCount !== 1 ? 's' : ''} overridden (re-scores)`}
          </p>
          <button
            onClick={() => {
              setOverrides({})
              setFormulaParamsConfig(prev => {
                const reset: typeof prev = {}
                for (const [k, g] of Object.entries(prev)) {
                  reset[k] = { ...g, params: g.params.map(p => ({ ...p, value: p.default })) }
                }
                return reset
              })
            }}
            className="text-xs text-caption hover:text-red-600 transition-colors flex items-center gap-1"
          >
            <RotateCcw size={11} /> Reset all
          </button>
        </motion.div>
      )}

      {/* KPI list grouped by bucket */}
      {Object.entries(grouped).map(([bucket, kpis]) => {
        const isOpen = expandedBuckets[bucket] ?? false
        const modifiedCount = kpis.filter(k =>
          overrides[k.kpi_id] != null ||
          (formulaParamsConfig[k.kpi_id]?.params ?? []).some(p => p.value !== p.default)
        ).length
        return (
          <div key={bucket} className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <button
              onClick={() => setExpandedBuckets(prev => ({ ...prev, [bucket]: !prev[bucket] }))}
              className="w-full flex items-center gap-3 px-4 py-3 bg-brand-dark/95 text-white text-left hover:bg-brand-dark transition-colors"
            >
              {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <span className="font-bold text-sm flex-1">{bucket}</span>
              <span className="text-xs opacity-60">{kpis.length} KPI{kpis.length !== 1 ? 's' : ''}</span>
              {modifiedCount > 0 && (
                <span className="text-[10px] bg-brand-purple px-2 py-0.5 rounded-full font-semibold">
                  {modifiedCount} modified
                </span>
              )}
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 space-y-3 bg-gray-50/20">
                    {kpis.map(kpi => (
                      <KpiCard
                        key={kpi.kpi_id}
                        kpi={kpi}
                        override={overrides[kpi.kpi_id] ?? null}
                        paramGroup={formulaParamsConfig[kpi.kpi_id] ?? null}
                        onSave={handleSave}
                        onReset={handleReset}
                        onParamChange={handleParamChange}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}

      {/* Sticky action bar */}
      <div className="sticky bottom-4 z-10 flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 shadow-lg">
        <div>
          <p className="text-sm font-semibold text-brand-dark">
            {totalChanges > 0
              ? `${totalChanges} change${totalChanges !== 1 ? 's' : ''} pending`
              : 'No changes — using defaults'}
          </p>
          <p className="text-xs text-caption mt-0.5">
            {totalChanges > 0
              ? 'Applying will re-compute KPI values and re-score results.'
              : 'Expand any bucket to review or adjust formulas and parameters.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSkip}
            className="text-sm text-caption hover:text-brand-dark transition-colors px-3 py-2"
          >
            Skip
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex items-center gap-2 bg-brand-purple text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-brand-dark transition-colors disabled:opacity-60"
          >
            {saving ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {totalChanges > 0 ? 'Apply & View Results' : 'View Results'}
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
```

---
