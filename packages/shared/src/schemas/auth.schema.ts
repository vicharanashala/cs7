// Auth request/response contracts.
import { z } from 'zod';
import { USER_ROLES, USER_STATUSES } from '../enums.js';

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email().toLowerCase().trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long'),
  role: z.enum(USER_ROLES).optional(), // Only admins may set role; controller enforces this.
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

/** Public user shape returned by /me, /login, /register. */
export const publicUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(USER_ROLES),
  status: z.enum(USER_STATUSES),
  /** Spurti Points balance — only emitted for students; undefined for moderators/admins. */
  spurtiPoints: z.number().int().optional(),
  createdAt: z.string(),
});

export type PublicUser = z.infer<typeof publicUserSchema>;

export const authTokenPayloadSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: publicUserSchema,
});

export type AuthTokenPayload = z.infer<typeof authTokenPayloadSchema>;
