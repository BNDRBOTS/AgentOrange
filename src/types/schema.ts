import { z } from 'zod';

// Core Configuration Schema
export const AgentConfigSchema = z.object({
  workspaceRoot: z.string(),
  maxAuditLogSizeMB: z.number().default(10),
  denyPatterns: z.array(z.string()).default([
    '.git/**',
    '.env*',
    'node_modules/**',
    'id_rsa*',
    '**/*.pem'
  ]),
  trusted: z.boolean().default(false)
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

// Journal Entry for Transactional VFS
export const JournalEntrySchema = z.object({
  type: z.enum(['write', 'create', 'delete']),
  path: z.string(),
  backupPath: z.string().optional(),
  timestamp: z.number(),
  txId: z.string()
});

export type JournalEntry = z.infer<typeof JournalEntrySchema>;

// Audit Log Entry Schema
export const AuditEventSchema = z.object({
  timestamp: z.string(),
  level: z.string(),
  event: z.string(),
  details: z.record(z.unknown()).optional(),
  txId: z.string().optional()
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;
