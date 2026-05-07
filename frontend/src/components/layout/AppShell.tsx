import { AnimatePresence, motion } from 'framer-motion'
import { useLocation, matchPath, Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { ToastContainer } from '@/components/ui/Toast'

const NO_SHELL_ROUTES: string[] = ['/', '/404']
const NO_SHELL_PATTERNS: string[] = []

function isNoShell(pathname: string): boolean {
  if (NO_SHELL_ROUTES.includes(pathname)) return true
  return NO_SHELL_PATTERNS.some(p => matchPath(p, pathname))
}

export default function AppShell() {
  const location = useLocation()
  const children = <Outlet />

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
