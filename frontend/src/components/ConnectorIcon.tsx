/**
 * Brand-accurate connector icons using Simple Icons (react-icons/si).
 * Falls back to a lucide-react generic when a brand icon isn't available.
 */
import React from 'react'
import {
  SiSlack, SiNotion, SiSalesforce, SiZendesk, SiGithub, SiIntercom,
  SiJira, SiConfluence, SiGooglemeet, SiGmail, SiHubspot, SiZoom,
  SiGooglesheets, SiAsana, SiLinear, SiDiscord,
} from 'react-icons/si'
import { TbBrandTeams } from 'react-icons/tb'
import {
  Mail, FileText, Database, MessageSquare, Globe, Upload,
  HelpCircle, BarChart2, Cloud, File, Users, Headphones, TrendingUp,
} from 'lucide-react'

interface ConnectorIconProps {
  type: string
  className?: string
}

// Map source_type / integration key → brand icon component.
// Lucide fallbacks are used when no dedicated brand icon exists.
const BRAND_ICONS: Record<string, React.ElementType> = {
  // Communication & collaboration
  slack:             SiSlack,
  slack_conversation: SiSlack,
  slack_integration: SiSlack,
  teams:             TbBrandTeams,
  microsoft_teams:   TbBrandTeams,
  outlook:           Mail,
  email:             Mail,
  gmail:             SiGmail,
  gmail_api:         SiGmail,
  google_meet:       SiGooglemeet,
  zoom:              SiZoom,
  discord:           SiDiscord,

  // Knowledge & docs
  notion:            SiNotion,
  document_notion:   SiNotion,
  confluence:        SiConfluence,
  web_page:          Globe,
  document_pdf:      FileText,
  document_word:     File,
  api_docs:          Cloud,
  mcp_server:        Database,
  api:               Cloud,
  manual_upload:     Upload,
  document:          Upload,

  // Project & task management
  jira:              SiJira,
  asana:             SiAsana,
  linear:            SiLinear,

  // CRM & sales
  salesforce:        SiSalesforce,
  hubspot:           SiHubspot,
  pipedrive:         TrendingUp,   // no si icon

  // Support
  zendesk:           SiZendesk,
  freshdesk:         Headphones,   // no si icon
  intercom:          SiIntercom,
  support_ticket:    HelpCircle,
  productboard:      HelpCircle,

  // Dev
  github:            SiGithub,
  github_repo:       SiGithub,

  // Data / analytics
  csv_survey:        SiGooglesheets,
  analytics_export:  BarChart2,
  usage_data:        BarChart2,
  nps_csat:          Users,

  // Meetings & transcripts
  meeting_transcript: MessageSquare,
}

export default function ConnectorIcon({ type, className = 'w-5 h-5' }: ConnectorIconProps) {
  const Icon = BRAND_ICONS[type] ?? Database
  return <Icon className={className} />
}
