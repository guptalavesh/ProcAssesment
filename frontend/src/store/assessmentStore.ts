import { create } from 'zustand'
import type { AppScreen, AssessmentResults, ConfigureState, UploadResult } from '@/lib/types'

export type AiContext = 'kpi_overview' | 'rca' | 'offerings'
export type ScreenType = AppScreen

interface AssessmentState {
  sessionId: string | null
  currentScreen: AppScreen
  screen: AppScreen
  skillPath: string | null
  skillName: string | null
  isProcurement: boolean
  clientName: string
  uploadResult: UploadResult | null
  configureState: ConfigureState | null
  results: AssessmentResults | null
  llmApiKey: string
  aiInsights: Partial<Record<AiContext, any>>
  aiLoading: Partial<Record<AiContext, boolean>>
  aiError: Partial<Record<AiContext, string>>
  aiOptedIn: boolean

  setSessionId: (id: string) => void
  setScreen: (screen: AppScreen) => void
  setSkill: (path: string, name: string, isProcurement: boolean) => void
  setClientName: (name: string) => void
  setUploadResult: (r: UploadResult) => void
  setConfigureState: (c: ConfigureState) => void
  setResults: (r: AssessmentResults) => void
  setLlmApiKey: (key: string) => void
  setAiInsight: (ctx: AiContext, data: any) => void
  setAiLoading: (ctx: AiContext, loading: boolean) => void
  setAiError: (ctx: AiContext, error: string) => void
  setAiOptedIn: (v: boolean) => void
  clearAiCache: () => void
  reset: () => void
}

const STORAGE_KEY = 'acc_assessment_session'

export const useAssessmentStore = create<AssessmentState>((set) => ({
  sessionId: localStorage.getItem(STORAGE_KEY),
  currentScreen: 'setup',
  screen: 'setup',
  skillPath: null,
  skillName: null,
  isProcurement: false,
  clientName: '',
  uploadResult: null,
  configureState: null,
  results: null,
  llmApiKey: '',
  aiInsights: {},
  aiLoading: {},
  aiError: {},
  aiOptedIn: false,

  setSessionId: (id) => {
    localStorage.setItem(STORAGE_KEY, id)
    set({ sessionId: id })
  },
  setScreen: (screen) => set({ currentScreen: screen, screen }),
  setSkill: (path, name, isProcurement) => set({ skillPath: path, skillName: name, isProcurement }),
  setClientName: (name) => set({ clientName: name }),
  setUploadResult: (r) => set({ uploadResult: r }),
  setConfigureState: (c) => set({ configureState: c }),
  setResults: (r) => set({ results: r }),
  setLlmApiKey: (key) => set({ llmApiKey: key }),
  setAiInsight: (ctx, data) => set((s) => ({ aiInsights: { ...s.aiInsights, [ctx]: data } })),
  setAiLoading: (ctx, loading) => set((s) => ({ aiLoading: { ...s.aiLoading, [ctx]: loading } })),
  setAiError: (ctx, error) => set((s) => ({ aiError: { ...s.aiError, [ctx]: error } })),
  setAiOptedIn: (v) => set({ aiOptedIn: v }),
  clearAiCache: () => set({ aiInsights: {}, aiLoading: {}, aiError: {} }),
  reset: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({
      sessionId: null,
      currentScreen: 'setup',
      screen: 'setup',
      skillPath: null,
      skillName: null,
      isProcurement: false,
      clientName: '',
      uploadResult: null,
      configureState: null,
      results: null,
      aiInsights: {},
      aiLoading: {},
      aiError: {},
      aiOptedIn: false,
    })
  },
}))

// Dev helper — expose store globally so preview tools can navigate screens
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.__store = useAssessmentStore
}
