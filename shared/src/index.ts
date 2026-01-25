// Types
export * from './types/experiments.js';
export * from './types/subjects.js';
export * from './types/observations.js';
export * from './types/samples.js';
export * from './types/storage.js';
export * from './types/plots.js';

// Constants
export * from './constants/css-scoring.js';

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Common query parameters
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface DateRangeParams {
  start_date?: string;
  end_date?: string;
}

// Export formats
export type ExportFormat = 'csv' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  include_headers?: boolean;
  date_format?: string;
}
