import type {
  SkillSummary, UploadResult, ColumnResolutionState,
  ConfigureState, AssessmentResults, InsightCard,
  DiagnosticSummary, Engagement, OrgRecommendation,
  ValueTreeData, CategoryChannel, BuyingChannelData
} from './types'

const BASE = '/api/v1'

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  createSession: () => req<{ session_id: string }>('/session', { method: 'POST', body: '{}' }),
  deleteSession: (sid: string) => req(`/session/${sid}`, { method: 'DELETE' }),
  sessionState:  (sid: string) => req<any>(`/session/${sid}/state`),

  // ── Skills ────────────────────────────────────────────────────────────────
  getSkills: () => req<SkillSummary[]>('/skills'),

  // ── Setup ─────────────────────────────────────────────────────────────────
  setup: (sid: string, payload: Partial<Engagement> & { skill_path: string }) =>
    req(`/session/${sid}/setup`, { method: 'POST', body: JSON.stringify(payload) }),

  // ── Upload ────────────────────────────────────────────────────────────────
  inspectFiles: (files: File[]): Promise<{
    files: {
      filename: string
      size_kb?: number
      error?: string
      sheets: {
        name: string
        columns?: string[]
        row_count_sample?: number
        suggested_slot: string
        confidence: 'high' | 'medium' | 'low'
        reasoning?: string
        error?: string
      }[]
    }[]
  }> => {
    const form = new FormData()
    for (const f of files) form.append('files', f)
    return fetch(`${BASE}/files/inspect`, { method: 'POST', body: form })
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({ detail: `HTTP ${r.status}` }))
          throw new Error(err.detail || 'Inspect failed')
        }
        return r.json()
      })
  },

  uploadFiles: (
    sid: string,
    files: Record<string, File | null>,
    onProgress?: (pct: number) => void,
    sheets: Record<string, string | null> = {},
  ): Promise<UploadResult> => {
    return new Promise((resolve, reject) => {
      const form = new FormData()
      for (const [key, file] of Object.entries(files)) {
        if (file) form.append(key, file)
      }
      for (const [key, sheet] of Object.entries(sheets)) {
        if (sheet) {
          const sheetKey = key.replace(/_file$/, '_sheet')
          form.append(sheetKey, sheet)
        }
      }
      const xhr = new XMLHttpRequest()
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 95))
        }
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            if (onProgress) onProgress(100)
            resolve(JSON.parse(xhr.responseText) as UploadResult)
          } catch {
            reject(new Error('Invalid JSON response'))
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText)
            reject(new Error(err.detail || `HTTP ${xhr.status}`))
          } catch {
            reject(new Error(`HTTP ${xhr.status}`))
          }
        }
      }
      xhr.onerror = () => reject(new Error('Upload failed — check your network connection'))
      xhr.ontimeout = () => reject(new Error('Upload timed out'))
      xhr.open('POST', `${BASE}/session/${sid}/upload`)
      xhr.send(form)
    })
  },

  parseTextQre: (sid: string, text: string) =>
    req(`/session/${sid}/parse-text-qre`, { method: 'POST', body: JSON.stringify({ text }) }),

  confirmTextQre: (sid: string, confirmed: Record<string, number>) =>
    req(`/session/${sid}/confirm-text-qre`, { method: 'POST', body: JSON.stringify({ confirmed }) }),

  getQuestionnaire: (skillPath: string): Promise<any> =>
    req(`/skills/questionnaire?skill_path=${encodeURIComponent(skillPath)}`),

  saveQuestionnaireDetail: (sid: string, detail: Record<string, Record<string, number>>) =>
    req(`/session/${sid}/questionnaire-detail`, {
      method: 'POST',
      body: JSON.stringify({ detail }),
    }),

  getDiscoveryQuestions: () =>
    req<any>('/discovery-qre/questions'),

  saveDiscoveryQRE: (sid: string, answers: Record<string, string>) =>
    req(`/session/${sid}/discovery-qre`, { method: 'POST', body: JSON.stringify({ answers }) }),

  getDiscoveryQRE: (sid: string) => req<any>(`/session/${sid}/discovery-qre`),

  // ── Column Review ─────────────────────────────────────────────────────────
  getColumns: (sid: string) => req<ColumnResolutionState>(`/session/${sid}/columns`),
  confirmColumns: (sid: string, confirmed: Record<string, string>, unavailable: string[]) =>
    req(`/session/${sid}/columns/confirm`, {
      method: 'POST',
      body: JSON.stringify({ confirmed, unavailable }),
    }),

  // ── Configure ─────────────────────────────────────────────────────────────
  getConfigure: (sid: string) => req<ConfigureState>(`/session/${sid}/configure`),
  saveConfigure: (
    sid: string,
    weight_config: Record<string, number>,
    include_dims: Record<string, boolean>,
    kpi_weight_config?: Record<string, number>,
  ) =>
    req(`/session/${sid}/configure`, {
      method: 'POST',
      body: JSON.stringify({ weight_config, include_dims, kpi_weight_config: kpi_weight_config ?? {} }),
    }),

  // ── Run ───────────────────────────────────────────────────────────────────
  triggerRun: (sid: string, llmKey?: string) =>
    req(`/session/${sid}/run`, {
      method: 'POST',
      body: JSON.stringify({ llm_api_key: llmKey || null }),
    }),

  runStatusUrl: (sid: string) => `${BASE}/session/${sid}/run-status`,
  runStatusJson: (sid: string) =>
    req<{ status: string; pct: number; message: string }>(`/session/${sid}/run-status-json`),

  // ── Results ───────────────────────────────────────────────────────────────
  getResults: (sid: string) => req<AssessmentResults>(`/session/${sid}/results`),
  getInsights: (sid: string) => req<{ insights: InsightCard[] }>(`/session/${sid}/results/insights`),
  getDiagnostic: (sid: string) => req<DiagnosticSummary>(`/session/${sid}/results/diagnostic`),
  getKpiDashboard: (sid: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return req<any>(`/session/${sid}/results/kpi-dashboard${qs}`)
  },
  getOrganogram: (sid: string, model: string, fte: number) =>
    req<{ html: string }>(`/session/${sid}/results/organogram?model=${encodeURIComponent(model)}&fte=${fte}`),
  getSwimlane: (sid: string, kpiGaps: string[]) =>
    req<{ html: string }>(`/session/${sid}/results/swimlane?kpi_gaps=${kpiGaps.join(',')}`),
  getDownloadUrl: (sid: string) => `${BASE}/session/${sid}/download`,
  getProcessDesign: (sid: string) => req<{ phases: any[]; source: string }>(`/session/${sid}/results/process-design`),
  getProcessDesignL5: (sid: string) => req<{ phases: any[]; source: string }>(`/session/${sid}/results/process-design`),
  getSwimlaneInteractive: (sid: string) => req<{ html: string }>(`/session/${sid}/results/swimlane-interactive`),
  getSalientInsights: (sid: string) => req<{ insights: any[] }>(`/session/${sid}/results/kpi-dashboard/salient-insights`),
  getOrgRecommendation: (sid: string) => req<OrgRecommendation>(`/session/${sid}/results/org-recommendation`),
  getValueTree: (sid: string) => req<ValueTreeData>(`/session/${sid}/results/value-tree`),
  getCategoryChannels: (sid: string) => req<{ categories: CategoryChannel[]; source: string }>(`/session/${sid}/results/category-channels`),
  getBuyingChannel: (sid: string) => req<BuyingChannelData>(`/session/${sid}/results/buying-channel`),
  getAiUsecases: (sid: string) => req<any>(`/session/${sid}/results/ai-usecases`),
  debugKpiTrace: (sid: string) => req<any>(`/session/${sid}/debug/kpi-trace`),

  // ── Formula review ────────────────────────────────────────────────────────
  getFormulaConfig: (sid: string) =>
    req<any>(`/session/${sid}/results/formula-config`),
  saveFormulaOverrides: (sid: string, overrides: any[]) =>
    req(`/session/${sid}/results/formula-overrides`, { method: 'POST', body: JSON.stringify({ overrides }) }),
  clearFormulaOverrides: (sid: string) =>
    req(`/session/${sid}/results/formula-overrides`, { method: 'DELETE' }),
  applyFormulaOverrides: (sid: string) =>
    req(`/session/${sid}/results/apply-formula-overrides`, { method: 'POST' }),
  getFormulaParams: (sid: string) =>
    req<any>(`/session/${sid}/results/formula-params`),
  saveFormulaParams: (sid: string, params: Record<string, any>) =>
    req(`/session/${sid}/results/formula-params`, { method: 'POST', body: JSON.stringify({ params }) }),

  // ── AI ────────────────────────────────────────────────────────────────────
  generateAiInsights: (sid: string, forceRefresh = false) =>
    req(`/session/${sid}/results/ai-insights`, { method: 'POST', body: JSON.stringify({ force_refresh: forceRefresh }) }),

  generateTabInsights: (sid: string, context: string, forceRefresh = false) =>
    req(`/session/${sid}/results/ai-tab-insights`, {
      method: 'POST',
      body: JSON.stringify({ context, force_refresh: forceRefresh }),
    }),

  generateBuyingCategories: (sid: string) =>
    req(`/session/${sid}/results/ai-buying-categories`, { method: 'POST', body: '{}' }),

  getAiStatus: (sid: string) =>
    req<any>(`/session/${sid}/results/ai-insights/status`),
}
