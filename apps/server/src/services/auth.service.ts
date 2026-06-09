// Auth domain service. Pure business logic — no Express types here.
import bcrypt from 'bcryptjs';
import type {
  AuthTokenPayload,
  LoginInput,
  PublicUser,
  RegisterInput,
  UserRole,
} from '@samagama/shared';
import { SPURTI_POINTS } from '@samagama/shared';
import { UserModel, type UserDocument } from '../models/User.model.js';
import { ApiError } from '../utils/api-error.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';

const BCRYPT_ROUNDS = 12;

// Map an internal user document to the safe, client-facing shape (never exposes passwordHash etc.).
function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    // Surface Spurti Points only on student accounts — moderators/admins don't earn them.
    ...(user.role === 'student' ? { spurtiPoints: user.spurtiPoints ?? 0 } : {}),
    createdAt: user.createdAt.toISOString(),
  };
}

// Build the standard login response: a short-lived access token, a longer-lived refresh
// token (bound to the user's tokenVersion), and the public user profile.
function buildAuthPayload(user: UserDocument): AuthTokenPayload {
  return {
    accessToken: signAccessToken({ sub: user.id, role: user.role }),
    refreshToken: signRefreshToken({ sub: user.id, ver: user.tokenVersion }),
    user: toPublicUser(user),
  };
}

export const authService = {
  // Register a new account. Open registration creates students; only an admin requester
  // may assign a different role. Rejects duplicate or previously-suspended emails.
  async register(input: RegisterInput, requesterRole?: UserRole): Promise<AuthTokenPayload> {
    const existing = await UserModel.findOne({ email: input.email }).lean();
    if (existing) {
      if (existing.status === 'suspended' || existing.status === 'banned') {
        throw ApiError.forbidden('This account has been suspended and cannot be re-registered');
      }
      throw ApiError.conflict('An account with this email already exists');
    }

    // Only admins may assign a role at registration time. Otherwise default to student.
    const role: UserRole = requesterRole === 'admin' && input.role ? input.role : 'student';

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await UserModel.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role,
      // Students start with the seed balance; moderators/admins remain at 0.
      spurtiPoints: role === 'student' ? SPURTI_POINTS.INITIAL_BALANCE : 0,
    });

    return buildAuthPayload(user);
  },

  // Verify credentials and issue tokens. Returns the same generic error for unknown email
  // and wrong password so callers can't probe which emails are registered.
  async login(input: LoginInput): Promise<AuthTokenPayload> {
    const user = await UserModel.findOne({ email: input.email });
    if (!user) throw ApiError.unauthorized('Invalid credentials');
    if (user.status !== 'active') throw ApiError.forbidden('Account is not active');

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw ApiError.unauthorized('Invalid credentials');

    return buildAuthPayload(user);
  },

  // Exchange a valid refresh token for a fresh token pair. The token's `ver` must still match
  // the user's current tokenVersion, so a password change (which bumps it) revokes old tokens.
  async refresh(refreshToken: string): Promise<AuthTokenPayload> {
    const claims = verifyRefreshToken(refreshToken);
    const user = await UserModel.findById(claims.sub);
    if (!user || user.status !== 'active') throw ApiError.unauthorized('Account no longer active');
    if (user.tokenVersion !== claims.ver) {
      throw ApiError.unauthorized('Refresh token has been revoked');
    }
    return buildAuthPayload(user);
  },

  // Fetch the current user's public profile (backs GET /auth/me).
  async getProfile(userId: string): Promise<PublicUser> {
    const user = await UserModel.findById(userId);
    if (!user) throw ApiError.notFound('User not found');
    return toPublicUser(user);
  },
};
