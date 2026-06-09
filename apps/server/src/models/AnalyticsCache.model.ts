// Pre-computed analytics cache. Mirrors remote AnalyticsCache model.
// Expensive aggregations are stored here with an expiry so the admin
// dashboard does not re-run them on every request.
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const analyticsCacheSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    computedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false },
);

// MongoDB TTL index — removes stale cache docs automatically.
analyticsCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type AnalyticsCacheDocument = HydratedDocument<InferSchemaType<typeof analyticsCacheSchema>>;
export const AnalyticsCacheModel = model('AnalyticsCache', analyticsCacheSchema);
