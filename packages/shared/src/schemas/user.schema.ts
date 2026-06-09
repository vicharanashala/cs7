// User management contracts — admin surfaces.
import { z } from 'zod';
import { USER_ROLES, USER_STATUSES } from '../enums.js';
import { objectIdSchema } from './common.schema.js';

/** Query params for GET /api/users */
export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  q: z.string().trim().optional(),
});

/** Body for PATCH /api/users/:id/role */
export const changeRoleSchema = z.object({
  role: z.enum(USER_ROLES),
});

export type UserListQuery = z.infer<typeof userListQuerySchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;

/** Public user shape for admin user-management tables. */
export interface PublicUserAdmin {
  id: string;
  name: string;
  email: string;
  role: (typeof USER_ROLES)[number];
  status: (typeof USER_STATUSES)[number];
  spurtiPoints?: number;
  createdAt: string;
  updatedAt: string;
}
