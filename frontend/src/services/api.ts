/**
 * API Client
 * Centralized API communication layer
 */

import axios from 'axios'
import { getAuthToken } from '@/utils/auth'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Create axios instance with default config
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 120 seconds timeout (LLM calls can take time)
})

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle auth errors
let isRedirecting = false

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth data on 401
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token')
        localStorage.removeItem('user')

        // Only redirect if not already on auth pages and not already redirecting
        const currentPath = window.location.pathname
        const isAuthPage = currentPath === '/login' || currentPath === '/register'

        if (!isAuthPage && !isRedirecting) {
          isRedirecting = true
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

// API Endpoints
export const api = {
  // Auth
  register: (data: any) => apiClient.post('/api/v1/auth/register', data),
  login: (data: any) => apiClient.post('/api/v1/auth/login', data),

  // Products
  products: {
    list: async () => {
      const response = await apiClient.get('/api/v1/products/');
      return response.data;
    },
    get: async (id: number) => {
      const response = await apiClient.get(`/api/v1/products/${id}`);
      return response.data;
    },
    create: async (data: any) => {
      const response = await apiClient.post('/api/v1/products/', data);
      return response.data;
    },
    update: async (id: number, data: any) => {
      const response = await apiClient.put(`/api/v1/products/${id}`, data);
      return response.data;
    },
    delete: async (id: number) => {
      const response = await apiClient.delete(`/api/v1/products/${id}`);
      return response.data;
    },
  },

  // Feedback
  getFeedback: (params?: any) => apiClient.get('/api/v1/feedback/', { params }),
  createFeedback: (data: any) => apiClient.post('/api/v1/feedback/', data),
  uploadFeedbackCSV: (formData: FormData) => apiClient.post('/api/v1/feedback/upload-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  uploadFeedbackCSVAsync: (formData: FormData) => apiClient.post('/api/v1/feedback/upload-csv-async', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  parseFeedbackDocument: (formData: FormData) => apiClient.post('/api/v1/feedback/parse-document', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),

  // Themes
  getThemes: (params?: any) => apiClient.get('/api/v1/themes/', { params }),
  runClustering: () => apiClient.post('/api/v1/themes/cluster'),
  refreshThemes: () => apiClient.post('/api/v1/themes/refresh'),
  refreshThemesAsync: () => apiClient.post('/api/v1/themes/refresh-async'),

  // Roadmap (Initiatives)
  getInitiatives: (params?: any) => apiClient.get('/api/v1/roadmap/', { params }),
  getInitiative: (id: number) => apiClient.get(`/api/v1/roadmap/${id}`),
  updateInitiative: (id: number, data: any) => apiClient.patch(`/api/v1/roadmap/${id}`, data),

  // Decisions
  getDecisions: (params?: any) => apiClient.get('/api/v1/decisions/', { params }),
  createDecision: (data: any) => apiClient.post('/api/v1/decisions/', data),

  // Personas
  getPersonas: (params?: any) => apiClient.get('/api/v1/personas/', { params }),
  getSegments: () => apiClient.get('/api/v1/personas/segments/list'),
  generatePersonas: (data: any) => apiClient.post('/api/v1/personas/generate', data),
  refreshPersonas: () => apiClient.post('/api/v1/personas/refresh'),
  refreshPersonasAsync: () => apiClient.post('/api/v1/personas/refresh-async'),
  simulatePersona: (data: any) => apiClient.post('/api/v1/personas/simulate', data),
  personaVote: (data: any) => apiClient.post('/api/v1/personas/vote', data),
  updatePersona: (id: number, data: any) => apiClient.patch(`/api/v1/personas/${id}`, data),
  updatePersonaStatus: (id: number, status: string) => apiClient.patch(`/api/v1/personas/${id}/status`, { status }),
  mergePersonas: (data: any) => apiClient.post('/api/v1/personas/merge', data),

  // Settings
  getPersonaRefreshSettings: () => apiClient.get('/api/v1/settings/persona-refresh'),
  updatePersonaRefreshSettings: (data: any) => apiClient.put('/api/v1/settings/persona-refresh', data),
  getThemeRefreshSettings: () => apiClient.get('/api/v1/settings/theme-refresh'),
  updateThemeRefreshSettings: (data: any) => apiClient.put('/api/v1/settings/theme-refresh', data),

  // Workbench
  getWorkbenchContext: (data: any) => apiClient.post('/api/v1/workbench/context', data),
  generateOptions: (data: any) => apiClient.post('/api/v1/workbench/generate-options', data),
  getPersonaVotes: (data: any) => apiClient.post('/api/v1/workbench/persona-votes', data),
  regenerateOptions: (data: any) => apiClient.post('/api/v1/workbench/regenerate-options', data),

  // Jobs (progress tracking)
  getJob: (jobId: string) => apiClient.get(`/api/v1/jobs/${jobId}`),
  listJobs: (params?: any) => apiClient.get('/api/v1/jobs/', { params }),

  // Decision Briefs
  generateBrief: (decisionId: number) => apiClient.post(`/api/v1/decisions/${decisionId}/brief`),
  getBrief: (decisionId: number) => apiClient.get(`/api/v1/decisions/${decisionId}/brief`),
  exportBrief: (decisionId: number, format: 'markdown' | 'pdf') =>
    apiClient.get(`/api/v1/decisions/${decisionId}/export`, { params: { format }, responseType: 'blob' }),

  // Synthesis
  getSynthesisStatus: () => apiClient.get('/api/v1/synthesis/status'),
  approveSynthesis: (data: any) => apiClient.post('/api/v1/synthesis/approve', data),
  updateThemeLabel: (themeId: number, data: any) => apiClient.patch(`/api/v1/themes/${themeId}`, data),
  updateTheme: (themeId: number, data: any) => apiClient.patch(`/api/v1/themes/${themeId}`, data),
  mergeThemes: (data: any) => apiClient.post('/api/v1/themes/merge', data),

  // Signals (dashboard feed)
  getSignals: (params?: any) => apiClient.get('/api/v1/signals/', { params }),
  dismissSignal: (signalId: number) => apiClient.patch(`/api/v1/signals/${signalId}/dismiss`),

  // LLM Settings (BYOK - Bring Your Own Keys)
  getLLMSettings: () => apiClient.get('/api/v1/llm-settings/'),
  updateLLMSettings: (config: any) => apiClient.put('/api/v1/llm-settings/', config),
  testLLMConnection: (config: any) => apiClient.post('/api/v1/llm-settings/test', { config }),
  deleteLLMSettings: () => apiClient.delete('/api/v1/llm-settings/'),
  getModelOptions: () => apiClient.get('/api/v1/llm-settings/models'),
  refreshModels: (provider: string) => apiClient.post('/api/v1/llm-settings/models/refresh', null, { params: { provider } }),

  // Product RAG (Knowledge Base)
  getKnowledgeSources: (params?: any) => apiClient.get('/api/v1/knowledge-base/sources', { params }),
  addKnowledgeSource: (data: any) => apiClient.post('/api/v1/knowledge-base/sources', data),
  uploadKnowledgeSource: (formData: FormData) => apiClient.post('/api/v1/knowledge-base/sources/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteKnowledgeSource: (sourceId: number) => apiClient.delete(`/api/v1/knowledge-base/sources/${sourceId}`),
  refreshKnowledgeSource: (sourceId: number) => apiClient.post(`/api/v1/knowledge-base/sources/${sourceId}/refresh`),
  getCapabilities: (params?: any) => apiClient.get('/api/v1/knowledge-base/capabilities', { params }),
  getCapability: (capabilityId: number) => apiClient.get(`/api/v1/knowledge-base/capabilities/${capabilityId}`),
  deduplicateCapabilities: () => apiClient.post('/api/v1/knowledge-base/capabilities/deduplicate'),

  // Product RAG Refresh Settings
  getKnowledgeRefreshSettings: () => apiClient.get('/api/v1/settings/knowledge-refresh'),
  updateKnowledgeRefreshSettings: (data: any) => apiClient.put('/api/v1/settings/knowledge-refresh', data),

  // Projects
  getProjects: (params?: any) => apiClient.get('/api/v1/projects/', { params }),
  getProject: (projectId: number) => apiClient.get(`/api/v1/projects/${projectId}`),
  generateProjects: (data?: any) => apiClient.post('/api/v1/projects/generate', data || {}),
  generateProjectsAsync: (data?: any) => apiClient.post('/api/v1/projects/generate-async', data || {}),
  updateProject: (id: number, data: any) => apiClient.patch(`/api/v1/projects/${id}`, data),
  deleteProject: (id: number) => apiClient.delete(`/api/v1/projects/${id}`),
  recalculatePriorities: () => apiClient.post('/api/v1/projects/recalculate-priorities'),

  // Generic post helper for workbench
  post: (path: string, data: any) => apiClient.post(`/api/v1${path}`, data),
}

export default api
