import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle, ChevronRight, ChevronLeft, Lock } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useAssessmentStore, type ScreenType } from '@/store/assessmentStore'
import AccentureMark from '@/components/ui/AccentureMark'
import AccentureLogo from '@/components/ui/AccentureLogo'

const STEPS: { id: ScreenType; label: string; num: number }[] = [
  { id: 'setup',     label: 'Setup',          num: 1 },
  { id: 'upload',    label: 'Upload Data',    num: 2 },
  { id: 'columns',   label: 'Column Review',  num: 3 },
  { id: 'configure', label: 'Configure',      num: 4 },
  { id: 'running',   label: 'Running',        num: 5 },
  { id: 'results',   label: 'Results',        num: 6 },
]

const SCREEN_ORDER: ScreenType[] = ['setup','upload','columns','configure','running','results']

export default function Sidebar() {
  const { clientName, skillName, setScreen, reset } = useAssessmentStore()
  const navigate = useNavigate()
  const location = useLocation()
  const currentScreen = (location.pathname.replace('/', '') || 'setup') as ScreenType
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
            <div className="flex items-center gap-2 transition-opacity duration-150 group-hover:opacity-0">
              <AccentureMark className="w-6 h-6 text-brand-purple flex-shrink-0" />
              <p className="text-[11px] text-caption leading-tight">Functional Maturity<br/>Assessment</p>
            </div>
            <div className="absolute inset-0 flex items-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 pointer-events-none">
              <AccentureLogo className="h-[22px] w-auto text-black" />
            </div>
          </div>
        )}
      </button>

      {!collapsed && clientName && (
        <div className="px-5 py-2.5 bg-bg-secondary/50 border-b border-bg-secondary flex-shrink-0">
          <p className="text-[10px] text-caption uppercase font-semibold tracking-wide">Client</p>
          <p className="text-sm font-semibold text-brand-dark truncate">{clientName}</p>
          {skillName && <p className="text-xs text-caption truncate">{skillName}</p>}
        </div>
      )}

      <nav className="flex-1 py-3 px-2 overflow-y-auto min-h-0">
        {STEPS.map((step, stepIdx) => {
          const screenIdx = SCREEN_ORDER.indexOf(step.id)
          const isDone    = screenIdx < currentIdx
          const isActive  = step.id === currentScreen
          const isPending = screenIdx > currentIdx
          const isLast    = stepIdx === STEPS.length - 1

          return (
            <div key={step.id} className="relative">
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
                title={collapsed ? step.label : isPending ? 'Complete current step first' : isDone ? `Go back to ${step.label}` : undefined}
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
                  {isDone ? <CheckCircle size={14} /> : isPending ? <Lock size={10} /> : step.num}
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

      {!collapsed && (
        <div className="px-4 py-3 border-t border-bg-secondary flex-shrink-0">
          <button
            onClick={() => { reset(); navigate('/') }}
            className="w-full text-xs text-caption hover:text-brand-purple transition-colors py-1"
          >
            + New Assessment
          </button>
        </div>
      )}

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
