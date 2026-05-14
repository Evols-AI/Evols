export const AUTH_EVENTS = {
  SIGNUP_STARTED: 'Signup Started',
  SIGNUP_COMPLETED: 'Signup Completed',
  LOGIN_SUCCESS: 'Login Success',
  LOGIN_FAILED: 'Login Failed',
  LOGOUT: 'Logout',
} as const

export const PRODUCT_EVENTS = {
  PRODUCT_CREATED: 'Product Created',
  PRODUCT_SELECTED: 'Product Selected',
  PRODUCT_DELETED: 'Product Deleted',
  DEMO_PRODUCT_WARNING_SHOWN: 'Demo Product Warning Shown',
  DEMO_PRODUCT_WARNING_ACCEPTED: 'Demo Product Warning Accepted',
  DEMO_PRODUCT_WARNING_REJECTED: 'Demo Product Warning Rejected',
} as const

export const FEEDBACK_EVENTS = {
  FEEDBACK_SUBMITTED: 'Feedback Submitted',
  FEEDBACK_CSV_UPLOADED: 'Feedback CSV Uploaded',
  FEEDBACK_DOCUMENT_PARSED: 'Feedback Document Parsed',
  FEEDBACK_VIEWED: 'Feedback Viewed',
  FEEDBACK_FILTERED: 'Feedback Filtered',
  FEEDBACK_EXPORTED: 'Feedback Exported',
} as const

export const THEME_EVENTS = {
  THEMES_GENERATED: 'Themes Generated',
  THEME_VIEWED: 'Theme Viewed',
  THEME_EDITED: 'Theme Edited',
  THEME_MERGED: 'Theme Merged',
} as const

export const PERSONA_EVENTS = {
  PERSONAS_REFRESHED: 'Personas Refreshed',
  PERSONA_VIEWED: 'Persona Viewed',
  PERSONA_EDITED: 'Persona Edited',
  PERSONA_VOTED: 'Persona Voted',
  PERSONA_EXTERNAL_CONTEXT_PULLED: 'Persona External Context Pulled',
} as const

export const ROADMAP_EVENTS = {
  ROADMAP_VIEWED: 'Roadmap Viewed',
  INITIATIVES_REFRESHED: 'Initiatives Refreshed',
  INITIATIVE_CREATED: 'Initiative Created',
  INITIATIVE_EDITED: 'Initiative Edited',
  INITIATIVE_STATUS_CHANGED: 'Initiative Status Changed',
  STRATEGY_RADAR_VIEWED: 'Strategy Radar Viewed',
  PRIORITY_MATRIX_VIEWED: 'Priority Matrix Viewed',
} as const

export const WORKBENCH_EVENTS = {
  WORKBENCH_OPENED: 'Workbench Opened',
  ASK_PERSONA_CLICKED: 'Ask Persona Clicked',
  PERSONA_QUESTION_ASKED: 'Persona Question Asked',
  PROPOSAL_GENERATED: 'Proposal Generated',
  PROPOSAL_EXPORTED: 'Proposal Exported',
} as const

export const KNOWLEDGE_EVENTS = {
  SOURCE_ADDED: 'Knowledge Source Added',
  SOURCE_DELETED: 'Knowledge Source Deleted',
  CAPABILITY_ADDED: 'Capability Added',
  CAPABILITY_EDITED: 'Capability Edited',
  CAPABILITY_DELETED: 'Capability Deleted',
} as const

export const SETTINGS_EVENTS = {
  LLM_SETTINGS_UPDATED: 'LLM Settings Updated',
  USER_INVITED: 'User Invited',
  USER_REMOVED: 'User Removed',
  TENANT_SETTINGS_UPDATED: 'Tenant Settings Updated',
} as const

export const ADMIN_EVENTS = {
  TENANT_CREATED: 'Tenant Created',
  TENANT_DELETED: 'Tenant Deleted',
  ADMIN_USER_CREATED: 'Admin User Created',
  ADMIN_PANEL_ACCESSED: 'Admin Panel Accessed',
} as const

export const ERROR_EVENTS = {
  API_ERROR: 'API Error',
  LLM_ERROR: 'LLM Error',
  STORAGE_QUOTA_EXCEEDED: 'Storage Quota Exceeded',
  USER_QUOTA_EXCEEDED: 'User Quota Exceeded',
  UPLOAD_FAILED: 'Upload Failed',
} as const

export const FEATURE_EVENTS = {
  FIRST_FEEDBACK_SUBMITTED: 'First Feedback Submitted',
  FIRST_THEME_GENERATED: 'First Theme Generated',
  FIRST_PERSONA_REFRESHED: 'First Persona Refreshed',
  FIRST_INITIATIVE_CREATED: 'First Initiative Created',
  FIRST_SOURCE_ADDED: 'First Source Added',
} as const

export const ALL_EVENTS = {
  ...AUTH_EVENTS,
  ...PRODUCT_EVENTS,
  ...FEEDBACK_EVENTS,
  ...THEME_EVENTS,
  ...PERSONA_EVENTS,
  ...ROADMAP_EVENTS,
  ...WORKBENCH_EVENTS,
  ...KNOWLEDGE_EVENTS,
  ...SETTINGS_EVENTS,
  ...ADMIN_EVENTS,
  ...ERROR_EVENTS,
  ...FEATURE_EVENTS,
} as const

export type EventName = typeof ALL_EVENTS[keyof typeof ALL_EVENTS]
