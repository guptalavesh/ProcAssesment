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
