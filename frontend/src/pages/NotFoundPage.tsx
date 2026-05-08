import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, Play } from 'lucide-react'
import AccentureMark from '@/components/ui/AccentureMark'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-accent text-white flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-lg w-full text-center"
      >
        <div className="flex items-center justify-center gap-2 mb-6 opacity-80">
          <AccentureMark className="w-5 h-5 text-white" />
          <span className="text-sm font-semibold tracking-wide">AIVault · Maturity Assessment</span>
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
