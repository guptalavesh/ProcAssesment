import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Check, ChevronRight, ChevronLeft, Lock } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useAssessmentStore, type ScreenType } from '@/store/assessmentStore'
import AccentureMark from '@/components/ui/AccentureMark'
import AccentureLogo from '@/components/ui/AccentureLogo'

const STEPS: { id: ScreenType; label: string; num: number }[] = [
  { id: 'setup',     label: 'Setup',         num: 1 },
  { id: 'upload',    label: 'Upload data',   num: 2 },
  { id: 'columns',   label: 'Column review', num: 3 },
  { id: 'configure', label: 'Configure',     num: 4 },
  { id: 'running',   label: 'Running',       num: 5 },
  { id: 'results',   label: 'Results',       num: 6 },
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
      animate={{ width: collapsed ? 56 : 248 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="h-screen bg-white border-r border-neutral-150 flex flex-col overflow-hidden flex-shrink-0 relative sticky top-0"
    >
      <button
        onClick={() => navigate('/')}
        aria-label="Home"
        title="Home"
        className={cn(
          'group flex items-center flex-shrink-0 w-full text-left transition-colors',
          collapsed ? 'px-3 py-4 justify-center' : 'px-4 py-4',
        )}
      >
        {collapsed ? (
          <AccentureMark className="w-5 h-5 text-accent flex-shrink-0" />
        ) : (
          <AccentureLogo className="h-6 w-auto text-neutral-900" />
        )}
      </button>

      {!collapsed && clientName && (
        <div className="px-4 pb-3 flex-shrink-0">
          <div className="rounded-md border border-neutral-150 bg-neutral-50 px-3 py-2">
            <p className="eyebrow mb-0.5">Client</p>
            <p className="text-[13px] font-medium text-neutral-900 truncate">{clientName}</p>
            {skillName && (
              <p className="text-[11px] text-neutral-500 truncate mt-0.5">{skillName}</p>
            )}
          </div>
        </div>
      )}

      {!collapsed && (
        <div className="px-4 pt-1 pb-2">
          <p className="eyebrow">Assessment steps</p>
        </div>
      )}

      <nav className="flex-1 px-2 overflow-y-auto min-h-0">
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
                    isDone ? 'bg-accent' : 'bg-neutral-150',
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
                  'relative z-10 w-full flex items-center gap-3 px-2 py-2 rounded-sm text-left mb-0.5 transition-colors',
                  collapsed && 'justify-center',
                  isActive  && 'bg-accent-50 text-accent-700',
                  isDone    && 'text-neutral-700 hover:bg-neutral-100 cursor-pointer',
                  isPending && 'text-neutral-400 cursor-not-allowed',
                )}
              >
                <span className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0',
                  isActive  && 'bg-accent text-white',
                  isDone    && 'bg-accent text-white',
                  isPending && 'bg-neutral-100 text-neutral-400',
                )}>
                  {isDone ? <Check size={13} strokeWidth={2.5} /> : isPending ? <Lock size={10} /> : step.num}
                </span>
                {!collapsed && (
                  <>
                    <span className="text-[13px] font-medium whitespace-nowrap flex-1">{step.label}</span>
                    {isActive && <ChevronRight size={14} className="opacity-70 flex-shrink-0" />}
                    {isDone   && <span className="text-[11px] text-accent-600 font-medium opacity-80 flex-shrink-0">Edit</span>}
                  </>
                )}
              </button>
            </div>
          )
        })}
      </nav>

      {!collapsed && (
        <div className="px-3 py-3 border-t border-neutral-150 flex-shrink-0">
          <button
            onClick={() => { reset(); navigate('/') }}
            className="w-full text-left text-[12px] text-neutral-500 hover:text-accent transition-colors py-1"
          >
            + New assessment
          </button>
        </div>
      )}

      <button
        onClick={toggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          'absolute bottom-3 flex items-center justify-center w-6 h-6 rounded-full bg-white border border-neutral-200 hover:border-accent hover:text-accent transition-colors text-neutral-500',
          collapsed ? 'left-1/2 -translate-x-1/2' : 'right-2',
        )}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.aside>
  )
}
