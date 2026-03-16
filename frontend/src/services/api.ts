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
  getPersonas: (productIds?: string, params?: any) => {
    const queryParams = productIds ? { ...params, product_ids: productIds } : params
    return apiClient.get('/api/v1/personas/', { params: queryParams })
  },
  getSegments: () => apiClient.get('/api/v1/personas/segments/list'),
  createPersona: (data: any) => apiClient.post('/api/v1/personas/', data),
  generatePersonas: (data: any) => apiClient.post('/api/v1/personas/generate', data),
  refreshPersonas: () => apiClient.post('/api/v1/personas/refresh'),
  refreshPersonasAsync: () => apiClient.post('/api/v1/personas/refresh-async'),
  simulatePersona: (data: any) => apiClient.post('/api/v1/personas/simulate', data),
  askPersona: (data: any) => apiClient.post('/api/v1/personas/simulate', data), // Alias for simulate
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
  saveGeneratedPersonas: (data: any) => apiClient.post('/api/v1/workbench/save-personas', data),
  validateIdea: (data: any) => apiClient.post('/api/v1/workbench/validate-idea', data),
  saveDecision: (data: any) => apiClient.post('/api/v1/workbench/decisions', data),
  getDecision: (id: number) => apiClient.get(`/api/v1/workbench/decisions/${id}`),
  listWorkbenchDecisions: () => apiClient.get('/api/v1/workbench/decisions'),

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

  // Context (Unified Context System)
  context: {
    // Context Sources
    getSources: (params?: any) => apiClient.get('/api/v1/context/sources', { params }),
    createSource: (data: any) => apiClient.post('/api/v1/context/sources', data),
    uploadFile: (formData: FormData) => apiClient.post('/api/v1/context/sources/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
    deleteSource: (sourceId: number) => apiClient.delete(`/api/v1/context/sources/${sourceId}`),
    extractEntities: (sourceId: number) => apiClient.post(`/api/v1/context/sources/${sourceId}/extract`),

    // Retention
    getRetentionPolicies: () => apiClient.get('/api/v1/context/retention/policies'),
    updateRetentionPolicy: (sourceId: number, policy: string) =>
      apiClient.put(`/api/v1/context/sources/${sourceId}/retention`, { policy }),
    deleteContent: (sourceId: number) => apiClient.post(`/api/v1/context/sources/${sourceId}/delete-content`),
    getContent: (sourceId: number, reason?: string) =>
      apiClient.get(`/api/v1/context/sources/${sourceId}/content`, { params: { reason } }),
    getRetentionStats: () => apiClient.get('/api/v1/context/retention/stats'),

    // Extracted Entities
    getEntities: (params?: any) => apiClient.get('/api/v1/context/entities', { params }),
    getEntitiesSummary: (params?: any) => apiClient.get('/api/v1/context/entities/summary', { params }),

    // Evidence
    buildInitiativeEvidence: (initiativeId: number, entityIds?: number[]) =>
      apiClient.post(`/api/v1/context/evidence/initiative/${initiativeId}`, entityIds ? { entity_ids: entityIds } : {}),
    getInitiativeEvidence: (initiativeId: number) =>
      apiClient.get(`/api/v1/context/evidence/initiative/${initiativeId}`),
    getSupportingEntities: (initiativeId: number, limit?: number) =>
      apiClient.get(`/api/v1/context/evidence/initiative/${initiativeId}/entities`, { params: { limit } }),

    // Deduplication
    linkToDuplicate: (sourceId: number, existingSourceId: number) =>
      apiClient.post(`/api/v1/context/sources/${sourceId}/link-duplicate`, { existing_source_id: existingSourceId }),
    createSourceGroup: (data: { name: string; source_ids: number[]; event_date?: string; description?: string }) =>
      apiClient.post('/api/v1/context/deduplication/source-groups', data),
    findSimilarEntities: (entityId: number, threshold?: number, limit?: number) =>
      apiClient.get(`/api/v1/context/deduplication/entities/${entityId}/similar`, { params: { similarity_threshold: threshold, limit } }),
    markEntityDuplicate: (primaryId: number, duplicateId: number, score: number) =>
      apiClient.post('/api/v1/context/deduplication/entities/mark-duplicate', { primary_entity_id: primaryId, duplicate_entity_id: duplicateId, similarity_score: score }),
    mergeEntities: (primaryId: number, duplicateId: number) =>
      apiClient.post('/api/v1/context/deduplication/entities/merge', { primary_entity_id: primaryId, duplicate_entity_id: duplicateId }),
    getDeduplicationStats: () =>
      apiClient.get('/api/v1/context/deduplication/stats'),
  },

  // Projects
  getProjects: (params?: any) => apiClient.get('/api/v1/projects/', { params }),
  getProject: (projectId: number) => apiClient.get(`/api/v1/projects/${projectId}`),
  generateProjects: (data?: any) => apiClient.post('/api/v1/projects/generate', data || {}),
  generateProjectsAsync: (data?: any) => apiClient.post('/api/v1/projects/generate-async', data || {}),
  updateProject: (id: number, data: any) => apiClient.patch(`/api/v1/projects/${id}`, data),
  deleteProject: (id: number) => apiClient.delete(`/api/v1/projects/${id}`),
  recalculatePriorities: () => apiClient.post('/api/v1/projects/recalculate-priorities'),

  // User Management (for TENANT_ADMIN)
  getUsers: () => apiClient.get('/api/v1/users/'),
  createUser: (data: any) => apiClient.post('/api/v1/users/', data),
  deleteUser: (userId: number) => apiClient.delete(`/api/v1/users/${userId}`),

  // User Profile Management
  updateMyProfile: (data: { full_name?: string; job_title?: string }) =>
    apiClient.put('/api/v1/users/me/profile', data),
  changeMyPassword: (data: { current_password: string; new_password: string }) =>
    apiClient.post('/api/v1/users/me/change-password', data),

  // Generic helpers
  get: (path: string, params?: any) => apiClient.get(`/api/v1${path}`, { params }),
  post: (path: string, data: any, config?: any) => apiClient.post(`/api/v1${path}`, data, config),
  put: (path: string, data: any) => apiClient.put(`/api/v1${path}`, data),
  delete: (path: string) => apiClient.delete(`/api/v1${path}`),
}

export default api
