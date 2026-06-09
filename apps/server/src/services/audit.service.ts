// Audit trail service. Fire-and-forget log writes + paginated list for the admin UI.
import type { Types } from 'mongoose';
import { AuditLogModel } from '../models/AuditLog.model.js';

export interface AuditLogInput {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
}

export interface PublicAuditLog {
  id: string;
  actor: { id: string; name: string; email: string };
  action: string;
  entityType: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  createdAt: string;
}

export interface AuditListQuery {
  page: number;
  pageSize: number;
  action?: string;
  entityType?: string;
  actorId?: string;
}

interface PopulatedAuditLog {
  _id: Types.ObjectId;
  actorId: { _id: Types.ObjectId; name: string; email: string };
  action: string;
  entityType: string;
  entityId?: Types.ObjectId;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  createdAt: Date;
}

export const auditService = {
  /**
   * Fire-and-forget audit write. Catches internally so callers never fail
   * due to audit infrastructure issues.
   */
  async log(input: AuditLogInput): Promise<void> {
    try {
      await AuditLogModel.create({
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        before: input.before,
        after: input.after,
        reason: input.reason,
      });
    } catch {
      // Best-effort — don't break the caller's flow.
      console.error('[audit] Failed to write audit log:', input.action, input.entityType);
    }
  },

  async list(query: AuditListQuery): Promise<{ items: PublicAuditLog[]; total: number }> {
    const filter: Record<string, unknown> = {};
    if (query.action) filter.action = query.action;
    if (query.entityType) filter.entityType = query.entityType;
    if (query.actorId) filter.actorId = query.actorId;

    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      AuditLogModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(query.pageSize)
        .populate('actorId', 'name email')
        .lean<PopulatedAuditLog[]>(),
      AuditLogModel.countDocuments(filter),
    ]);

    const items: PublicAuditLog[] = rows.map((row) => ({
      id: row._id.toString(),
      actor: {
        id: row.actorId._id.toString(),
        name: row.actorId.name,
        email: row.actorId.email,
      },
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId?.toString(),
      before: row.before ?? undefined,
      after: row.after ?? undefined,
      reason: row.reason ?? undefined,
      createdAt: row.createdAt.toISOString(),
    }));

    return { items, total };
  },
};
