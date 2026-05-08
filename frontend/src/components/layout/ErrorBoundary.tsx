import { Component, type ReactNode } from 'react'
import { AlertOctagon, RefreshCw, Mail } from 'lucide-react'
import AccentureMark from '@/components/ui/AccentureMark'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null; componentStack: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, componentStack: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, componentStack: '' }
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info)
    this.setState({ componentStack: info.componentStack ?? '' })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const msg = this.state.error?.message ?? ''
    const stack = this.state.error?.stack ?? ''
    const componentStack = this.state.componentStack ?? ''

    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-6">
        <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg border border-neutral-200 p-8 text-center">
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 rounded-full bg-danger-soft flex items-center justify-center">
              <AlertOctagon className="text-danger" size={28} />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-neutral-900 mb-2">Something went wrong</h1>
          <p className="text-sm text-neutral-500 mb-1">Your work is safe. The application hit an unexpected error.</p>
          {msg && (
            <p className="text-xs text-neutral-700 font-mono bg-neutral-100 px-3 py-1.5 rounded-sm mt-3 inline-block max-w-full truncate">
              {msg}
            </p>
          )}
          {(stack || componentStack) && (
            <details className="mt-3 text-left">
              <summary className="text-[11px] text-neutral-500 cursor-pointer">Show stack</summary>
              <pre className="text-[10px] text-neutral-700 bg-neutral-100 p-3 rounded-sm mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all">
{stack}
{componentStack ? `\n\nComponent stack:${componentStack}` : ''}
              </pre>
            </details>
          )}
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-700 text-white font-semibold text-sm px-4 py-2 rounded-md transition-colors"
            >
              <RefreshCw size={14} /> Reload
            </button>
            <a
              href="mailto:support@aivault.example?subject=AIVault%20%E2%80%94%20error%20report"
              className="inline-flex items-center gap-1.5 border border-neutral-200 text-neutral-900 text-sm px-4 py-2 rounded-md hover:bg-neutral-50 transition-colors"
            >
              <Mail size={14} /> Report issue
            </a>
          </div>
          <div className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-neutral-500">
            <AccentureMark className="w-3 h-3 text-accent" />
            <span>AIVault · Functional maturity assessment</span>
          </div>
        </div>
      </div>
    )
  }
}
