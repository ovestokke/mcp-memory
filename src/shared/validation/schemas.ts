import { z } from 'zod';
import { MAX_MEMORY_LENGTH, MAX_LABEL_LENGTH, MAX_LABELS_PER_MEMORY } from '@shared/memory/constants';

export const MemorySchema = z.object({
  namespace: z.string().min(1).max(100),
  content: z.string().min(1).max(MAX_MEMORY_LENGTH),
  labels: z.array(z.string().max(MAX_LABEL_LENGTH)).max(MAX_LABELS_PER_MEMORY).default([])
});

export const NamespaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional()
});

export const MemorySearchSchema = z.object({
  namespace: z.string().optional(),
  labels: z.array(z.string()).optional(),
  query: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  similarityThreshold: z.number().min(0).max(1).default(0.7)
});

export type CreateMemoryRequest = z.infer<typeof MemorySchema>;
export type CreateNamespaceRequest = z.infer<typeof NamespaceSchema>;
export type SearchMemoryRequest = z.infer<typeof MemorySearchSchema>;