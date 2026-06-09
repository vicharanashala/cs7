// Cross-cutting transport types. Domain DTOs derive from Zod schemas; this file holds the rest.

/** Standard API response envelope (matches the server's response helper). */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
}

/** A 24-character Mongo ObjectId serialized as a hex string. */
export type ObjectIdString = string;
