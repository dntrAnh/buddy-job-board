import type { ComponentType } from 'react'
import { template as newJob } from './new-job'
import { template as friendApplied } from './friend-applied'
import { template as groupInvite } from './group-invite'
import { template as jobDigest } from './job-digest'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'new-job': newJob,
  'friend-applied': friendApplied,
  'group-invite': groupInvite,
  'job-digest': jobDigest,
}
