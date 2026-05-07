import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

type ToastListener = (toasts: Toast[]) => void

let _toasts: Toast[] = []
const _listeners = new Set<ToastListener>()

function notify() {
  _listeners.forEach(fn => fn([..._toasts]))
}

function addToast(type: ToastType, message: string, duration = 4500) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  _toasts = [..._toasts, { id, type, message, duration }]
  notify()
  if (duration > 0) {
    setTimeout(() => removeToast(id), duration)
  }
}

function removeToast(id: string) {
  _toasts = _toasts.filter(t => t.id !== id)
  notify()
}

export const toast = {
  success: (msg: string, duration?: number) => addToast('success', msg, duration),
  error:   (msg: string, duration?: number) => addToast('error',   msg, duration ?? 6000),
  warning: (msg: string, duration?: number) => addToast('warning', msg, duration),
  info:    (msg: string, duration?: number) => addToast('info',    msg, duration),
}

const ICONS: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error:   AlertCircle,
  warning: AlertTriangle,
  info:    Info,
}

const STYLES: Record<ToastType, string> = {
  success: 'bg-white border-success text-neutral-900',
  error:   'bg-white border-danger text-neutral-900',
  warning: 'bg-white border-warning text-neutral-900',
  info:    'bg-white border-accent text-neutral-900',
}

const ICON_COLORS: Record<ToastType, string> = {
  success: 'text-success',
  error:   'text-danger',
  warning: 'text-warning',
  info:    'text-accent',
}

function ToastItem({ t, onDismiss }: { t: Toast; onDismiss: (id: string) => void }) {
  const Icon = ICONS[t.type]
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'w-80 flex items-start gap-3 px-4 py-3 rounded-md border border-neutral-200 border-l-2 shadow-lg',
        STYLES[t.type],
      )}
    >
      <Icon size={16} className={cn('flex-shrink-0 mt-0.5', ICON_COLORS[t.type])} />
      <p className="text-[13px] leading-snug flex-1 text-neutral-700">{t.message}</p>
      <button
        onClick={() => onDismiss(t.id)}
        aria-label="Dismiss notification"
        className="flex-shrink-0 text-neutral-400 hover:text-neutral-700 transition-colors"
      >
        <X size={13} />
      </button>
    </motion.div>
  )
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const listener: ToastListener = updated => setToasts(updated)
    _listeners.add(listener)
    return () => { _listeners.delete(listener) }
  }, [])

  const dismiss = useCallback((id: string) => removeToast(id), [])

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem t={t} onDismiss={dismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
