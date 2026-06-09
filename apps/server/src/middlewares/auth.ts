// Authentication + RBAC middlewares. Two layers: `requireAuth` proves identity; `requireRole` proves permission.
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { UserRole } from '@samagama/shared';
import { effectiveRole } from '@samagama/shared';
import { ApiError } from '../utils/api-error.js';
import { verifyAccessToken } from '../utils/jwt.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      role: UserRole;
    };
  }
}

export const requireAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(ApiError.unauthorized('Missing Bearer token'));
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) return next(ApiError.unauthorized('Missing Bearer token'));

  try {
    const claims = verifyAccessToken(token);
    req.user = { id: claims.sub, role: claims.role };
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Best-effort authentication for routes usable both signed-in and anonymously (e.g. public
 * FAQ browsing/voting from the login page). Populates `req.user` when a valid Bearer token is
 * present; otherwise — including for missing or expired/invalid tokens — it proceeds without a
 * user instead of rejecting. Downstream handlers decide what an anonymous caller may do.
 */
export const optionalAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();
  const token = header.slice('Bearer '.length).trim();
  if (!token) return next();
  try {
    const claims = verifyAccessToken(token);
    req.user = { id: claims.sub, role: claims.role };
  } catch {
    // Invalid/expired token on a public route — continue anonymously.
  }
  next();
};

/**
 * Restricts a route to one or more roles. Use after `requireAuth`.
 * Trainee roles are normalized to their full counterpart (t-admin→admin, t-moderator→moderator)
 * so a temporary admin/moderator passes exactly the same gates as the real role.
 */
export const requireRole =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(effectiveRole(req.user.role))) {
      return next(ApiError.forbidden(`Requires role: ${roles.join(' or ')}`));
    }
    next();
  };

/**
 * Allows access if the authenticated user has one of the given roles OR is the
 * owner of the resource. Mirrors remote requireOwnerOrRole.
 *
 * @param getOwnerId — async fn(req) → string | null that resolves the resource owner id.
 * @param roles      — role(s) that are always allowed regardless of ownership.
 */
export const requireOwnerOrRole =
  (getOwnerId: (req: Request) => Promise<string | null>, ...roles: UserRole[]): RequestHandler =>
  async (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (roles.includes(effectiveRole(req.user.role))) return next();

    try {
      const ownerId = await getOwnerId(req);
      if (ownerId && ownerId.toString() === req.user.id) return next();
      return next(ApiError.forbidden('You do not have access to this resource'));
    } catch (err) {
      next(err);
    }
  };
