// API Client — uses same-origin routing so nginx proxies /api/* to the backend

import axios from 'axios'
import { getAuthToken } from '@/utils/auth'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''

// Create axios instance with default config
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 300000, // 300 seconds (5 minutes) timeout for search-heavy skills
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


  // Roadmap (Initiatives)
  getInitiatives: (params?: any) => apiClient.get('/api/v1/roadmap/', { params }),
  getInitiative: (id: number) => apiClient.get(`/api/v1/roadmap/${id}`),
  updateInitiative: (id: number, data: any) => apiClient.patch(`/api/v1/roadmap/${id}`, data),

  // Decisions
  getDecisions: (params?: any) => apiClient.get('/api/v1/decisions/', { params }),
  createDecision: (data: any) => apiClient.post('/api/v1/decisions/', data),

  // Settings
  getKnowledgeRefreshSettings: () => apiClient.get('/api/v1/settings/knowledge-refresh'),
  updateKnowledgeRefreshSettings: (data: any) => apiClient.put('/api/v1/settings/knowledge-refresh', data),

  // Workbench
  getWorkbenchContext: (data: any) => apiClient.post('/api/v1/workbench/context', data),
  generateOptions: (data: any) => apiClient.post('/api/v1/workbench/generate-options', data),
  getPersonaVotes: (data: any) => apiClient.post('/api/v1/workbench/persona-votes', data),
  regenerateOptions: (data: any) => apiClient.post('/api/v1/workbench/regenerate-options', data),
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


  // LLM Settings (BYOK - Bring Your Own Keys)
  getLLMSettings: () => apiClient.get('/api/v1/llm-settings/'),
  updateLLMSettings: (config: any) => apiClient.put('/api/v1/llm-settings/', config),
  testLLMConnection: (config: any) => apiClient.post('/api/v1/llm-settings/test', { config }),
  deleteLLMSettings: () => apiClient.delete('/api/v1/llm-settings/'),
  getModelOptions: () => apiClient.get('/api/v1/llm-settings/models'),
  refreshModels: (provider: string) => apiClient.post('/api/v1/llm-settings/models/refresh', null, { params: { provider } }),

  // Context (Unified Context System)
  context: {
    // Context Sources
    getSources: (params?: any) => apiClient.get('/api/v1/context/sources', { params }),
    createSource: (data: any) => apiClient.post('/api/v1/context/sources', data),
    uploadFile: (formData: FormData) => apiClient.post('/api/v1/context/sources/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
    deleteSource: (sourceId: number) => apiClient.delete(`/api/v1/context/sources/${sourceId}`),
    pushToGraph: (sourceId: number) => apiClient.post(`/api/v1/context/sources/${sourceId}/extract`),

    // Source Groups
    getSourceGroups: (params?: any) => apiClient.get('/api/v1/context/source-groups', { params }),
    getSourceGroupSources: (groupId: number) => apiClient.get(`/api/v1/context/source-groups/${groupId}/sources`),
    deleteSourceGroup: (groupId: number) => apiClient.delete(`/api/v1/context/source-groups/${groupId}`),

    // Retention
    getRetentionPolicies: () => apiClient.get('/api/v1/context/retention/policies'),
    updateRetentionPolicy: (sourceId: number, policy: string) =>
      apiClient.put(`/api/v1/context/sources/${sourceId}/retention`, { policy }),
    deleteContent: (sourceId: number) => apiClient.post(`/api/v1/context/sources/${sourceId}/delete-content`),
    getContent: (sourceId: number, reason?: string) =>
      apiClient.get(`/api/v1/context/sources/${sourceId}/content`, { params: { reason } }),
    getRetentionStats: () => apiClient.get('/api/v1/context/retention/stats'),

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

  // Work Context (Personal PM Operating System)
  workContext: {
    // Work Context
    getWorkContext: () => apiClient.get('/api/v1/work-context/work-context'),
    updateWorkContext: (data: any) => apiClient.put('/api/v1/work-context/work-context', data),

    // Active Projects
    getActiveProjects: () => apiClient.get('/api/v1/work-context/active-projects'),
    createActiveProject: (data: any) => apiClient.post('/api/v1/work-context/active-projects', data),
    updateActiveProject: (id: number, data: any) => apiClient.put(`/api/v1/work-context/active-projects/${id}`, data),
    deleteActiveProject: (id: number) => apiClient.delete(`/api/v1/work-context/active-projects/${id}`),

    // Key Relationships
    getKeyRelationships: () => apiClient.get('/api/v1/work-context/key-relationships'),
    createKeyRelationship: (data: any) => apiClient.post('/api/v1/work-context/key-relationships', data),
    updateKeyRelationship: (id: number, data: any) => apiClient.put(`/api/v1/work-context/key-relationships/${id}`, data),
    deleteKeyRelationship: (id: number) => apiClient.delete(`/api/v1/work-context/key-relationships/${id}`),

    // PM Decisions
    getPMDecisions: (params?: any) => apiClient.get('/api/v1/work-context/pm-decisions', { params }),
    getPMDecision: (id: number) => apiClient.get(`/api/v1/work-context/pm-decisions/${id}`),
    createPMDecision: (data: any) => apiClient.post('/api/v1/work-context/pm-decisions', data),
    updatePMDecision: (id: number, data: any) => apiClient.put(`/api/v1/work-context/pm-decisions/${id}`, data),
    deletePMDecision: (id: number) => apiClient.delete(`/api/v1/work-context/pm-decisions/${id}`),

    // Tasks
    getTasks: (params?: any) => apiClient.get('/api/v1/work-context/tasks', { params }),
    getTask: (id: number) => apiClient.get(`/api/v1/work-context/tasks/${id}`),
    createTask: (data: any) => apiClient.post('/api/v1/work-context/tasks', data),
    updateTask: (id: number, data: any) => apiClient.put(`/api/v1/work-context/tasks/${id}`, data),
    deleteTask: (id: number) => apiClient.delete(`/api/v1/work-context/tasks/${id}`),

    // Weekly Focus
    getWeeklyFocus: (params?: any) => apiClient.get('/api/v1/work-context/weekly-focus', { params }),
    getCurrentWeeklyFocus: () => apiClient.get('/api/v1/work-context/weekly-focus/current'),
    updateWeeklyFocus: (id: number, data: any) => apiClient.put(`/api/v1/work-context/weekly-focus/${id}`, data),

    // Meeting Notes
    getMeetingNotes: (params?: any) => apiClient.get('/api/v1/work-context/meeting-notes', { params }),
    getMeetingNote: (id: number) => apiClient.get(`/api/v1/work-context/meeting-notes/${id}`),
    createMeetingNote: (data: any) => apiClient.post('/api/v1/work-context/meeting-notes', data),
    updateMeetingNote: (id: number, data: any) => apiClient.put(`/api/v1/work-context/meeting-notes/${id}`, data),
    deleteMeetingNote: (id: number) => apiClient.delete(`/api/v1/work-context/meeting-notes/${id}`),
  },

  // Skill Customizations
  skillCustomizations: {
    // List all available skills with customization status
    getAvailableSkills: () => apiClient.get('/api/v1/skill-customizations/available-skills'),

    // Get user's customizations
    getCustomizations: () => apiClient.get('/api/v1/skill-customizations/'),

    // Get specific skill customization
    getCustomization: (skillName: string) => apiClient.get(`/api/v1/skill-customizations/${skillName}`),

    // Create or update skill customization
    createCustomization: (data: any) => apiClient.post('/api/v1/skill-customizations/', data),

    // Update existing customization
    updateCustomization: (skillName: string, data: any) => apiClient.put(`/api/v1/skill-customizations/${skillName}`, data),

    // Delete customization (revert to default)
    deleteCustomization: (skillName: string) => apiClient.delete(`/api/v1/skill-customizations/${skillName}`),

    // Preview customization
    previewCustomization: (skillName: string, data: any) => apiClient.post(`/api/v1/skill-customizations/${skillName}/preview`, data),
  },

  // Knowledge Graph mutations
  graph: {
    editEntity: (data: { entity_name: string; updated_data: Record<string, any>; allow_rename?: boolean; allow_merge?: boolean }) =>
      apiClient.post('/api/v1/graph/entity/edit', data),
    mergeEntities: (data: { entities_to_change: string[]; entity_to_change_into: string }) =>
      apiClient.post('/api/v1/graph/entities/merge', data),
    createEntity: (data: { entity_name: string; entity_data: Record<string, any> }) =>
      apiClient.post('/api/v1/graph/entity/create', data),
    editRelation: (data: { source_id: string; target_id: string; updated_data: Record<string, any> }) =>
      apiClient.post('/api/v1/graph/relation/edit', data),
  },

  // Generic helpers
  get: (path: string, params?: any) => apiClient.get(`/api/v1${path}`, { params }),
  post: (path: string, data: any, config?: any) => apiClient.post(`/api/v1${path}`, data, config),
  put: (path: string, data: any) => apiClient.put(`/api/v1${path}`, data),
  delete: (path: string) => apiClient.delete(`/api/v1${path}`),
}

export default api
