export const DEFAULT_NAMESPACES = [
  'general',
  'people',
  'projects',
  'relationships',
  'recipes',
  'notes'
] as const;

export const VECTOR_DIMENSIONS = 768;
export const MAX_MEMORY_LENGTH = 8000;
export const MAX_LABEL_LENGTH = 50;
export const MAX_LABELS_PER_MEMORY = 10;
export const DEFAULT_SEARCH_LIMIT = 20;
export const DEFAULT_SIMILARITY_THRESHOLD = 0.7;