// Audit log collection. Records admin/moderator actions for traceability.
// PRD §12.10 + Admin spec §9.
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const auditLogSchema = new Schema(
  {
    // Who performed the action.
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // What they did (e.g. 'faq.publish') and the target entity it was done to.
    action: { type: String, required: true, trim: true, maxlength: 100, index: true },
    entityType: { type: String, required: true, trim: true, maxlength: 50, index: true },
    entityId: { type: Schema.Types.ObjectId, index: true },
    // Snapshots of the entity before/after the change, for diffing in the audit UI.
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    // Optional human-entered justification (e.g. why a user was suspended).
    reason: { type: String, trim: true, maxlength: 500 },
  },
  {
    // Audit entries are immutable — only the creation time is meaningful.
    timestamps: { createdAt: true, updatedAt: false },
  },
);

// "Show all actions on this entity" lookups.
auditLogSchema.index({ entityType: 1, entityId: 1 });
// Reverse-chronological audit feed.
auditLogSchema.index({ createdAt: -1 });

export type AuditLogDocument = HydratedDocument<InferSchemaType<typeof auditLogSchema>>;
export const AuditLogModel = model('AuditLog', auditLogSchema);
