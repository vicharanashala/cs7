// Search query log. Mirrors remote SearchLog model.
// Records every search so the admin can surface "unanswered searches" —
// queries that returned no published FAQ. TTL index auto-purges after 365 days.
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const searchLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    /** Raw query as the user typed it. */
    query: { type: String, required: true, trim: true, maxlength: 500 },
    /** Lowercased, whitespace-normalised version for deduplication. */
    normalizedQuery: { type: String, required: true, trim: true, index: true },
    resultCount: { type: Number, default: 0 },
    /** FAQ the user clicked from results, if any. */
    clickedFaqId: { type: Schema.Types.ObjectId, ref: 'Faq' },
    /** Question created after this search returned no results. */
    ledToQuestionId: { type: Schema.Types.ObjectId, ref: 'Question' },
    searchedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// Auto-purge logs older than 1 year.
searchLogSchema.index({ searchedAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });
searchLogSchema.index({ normalizedQuery: 1, resultCount: 1 });

export type SearchLogDocument = HydratedDocument<InferSchemaType<typeof searchLogSchema>>;
export const SearchLogModel = model('SearchLog', searchLogSchema);
