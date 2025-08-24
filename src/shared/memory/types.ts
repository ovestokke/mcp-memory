export interface Memory {
  id: string;
  userId: string;
  namespace: string;
  content: string;
  labels: string[];
  embedding?: number[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Namespace {
  id: string;
  userId: string;
  name: string;
  description?: string | undefined;
  createdAt: Date;
}

export interface MemorySearchOptions {
  namespace?: string;
  labels?: string[];
  query?: string;
  limit?: number;
  similarityThreshold?: number;
}

export interface MemorySearchResult {
  memory: Memory;
  similarity?: number;
}