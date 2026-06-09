// JWT helpers. Keeps signing/verification details out of services and middlewares.
import jwt, { type SignOptions } from 'jsonwebtoken';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from '@samagama/shared';
import type { UserRole } from '@samagama/shared';
import { env } from '../config/env.js';
import { ApiError } from './api-error.js';

export interface AccessTokenClaims {
  sub: string; // user id
  role: UserRole;
  type: 'access';
}

export interface RefreshTokenClaims {
  sub: string;
  type: 'refresh';
  /** Token version, lets us invalidate refresh tokens on password change. */
  ver: number;
}

export function signAccessToken(claims: Omit<AccessTokenClaims, 'type'>): string {
  const opts: SignOptions = { expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  return jwt.sign({ ...claims, type: 'access' }, env.JWT_ACCESS_SECRET, opts);
}

export function signRefreshToken(claims: Omit<RefreshTokenClaims, 'type'>): string {
  const opts: SignOptions = { expiresIn: REFRESH_TOKEN_TTL_SECONDS };
  return jwt.sign({ ...claims, type: 'refresh' }, env.JWT_REFRESH_SECRET, opts);
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenClaims;
    if (decoded.type !== 'access') throw ApiError.unauthorized('Invalid token type');
    return decoded;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.unauthorized('Invalid or expired token');
  }
}

export function verifyRefreshToken(token: string): RefreshTokenClaims {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenClaims;
    if (decoded.type !== 'refresh') throw ApiError.unauthorized('Invalid token type');
    return decoded;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }
}
