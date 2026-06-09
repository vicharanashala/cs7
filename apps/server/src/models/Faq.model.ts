// FAQ collection. Mirrors PRD §12.2 plus Change Spec §8.3 helpful/unhelpful vote tracking.
//
// Enhancements aligned with remote repo:
//  - qualityScore: 0-100 composite score (helpfulness, freshness, view traction)
//  - reviewState:  workflow state for moderation queue
//  - embedding:    384-dim vector with dimension validation (set on publish)
//  - helpfulnessRatio: virtual getter
//  - calculateQualityScore(): static method mirrors remote analyticsService logic
//
// Field names kept as LOCAL convention:
//  - unhelpfulCount (NOT notHelpfulCount — remote naming)
//  - category refs as 'Faq' (NOT 'FAQ')
import { Schema, model, type InferSchemaType, type HydratedDocument, type Model } from 'mongoose';
import { FAQ_STATUSES } from '@samagama/shared';
import { slugify } from '../utils/slugify.js';

export const FAQ_REVIEW_STATES = ['none', 'needs_review', 'in_review', 'reviewed'] as const;
export type FaqReviewState = (typeof FAQ_REVIEW_STATES)[number];

// ─── Schema ──────────────────────────────────────────────────────────────────

const faqSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 280 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    answer: { type: String, required: true, trim: true, maxlength: 8000 },
    summary: { type: String, trim: true, maxlength: 280 },

    categories: [{ type: Schema.Types.ObjectId, ref: 'Category', required: true }],
    tags: [{ type: Schema.Types.ObjectId, ref: 'Tag' }],

    status: {
      type: String,
      enum: FAQ_STATUSES,
      default: 'draft',
      required: true,
      index: true,
    },

    /** Moderation review workflow state — mirrors remote reviewState. */
    reviewState: {
      type: String,
      enum: FAQ_REVIEW_STATES,
      default: 'none',
      index: true,
    },

    sourceType: {
      type: String,
      enum: ['manual', 'community_conversion', 'imported'],
      default: 'manual',
    },
    sourceQuestionId: { type: Schema.Types.ObjectId, ref: 'Question' },

    /**
     * 384-dim vector embedding of the FAQ title (for semantic search).
     * Populated on publish by the embedding service. Validated to ensure
     * dimension consistency — mirrors remote's embed validator.
     */
    embedding: {
      type: [Number],
      default: undefined,
      select: false,
      validate: {
        validator: (v: number[]) => !v || v.length === 0 || v.length === 384,
        message: 'embedding must be exactly 384 dimensions',
      },
    },

    helpfulCount: { type: Number, default: 0, min: 0 },
    unhelpfulCount: { type: Number, default: 0, min: 0 },
    helpfulVotes: { type: [Schema.Types.ObjectId], default: [], select: false },
    unhelpfulVotes: { type: [Schema.Types.ObjectId], default: [], select: false },

    viewCount: { type: Number, default: 0, min: 0 },
    flagCount: { type: Number, default: 0, min: 0 },

    /**
     * Composite quality score 0–100, recomputed by analyticsService.
     * Mirrors remote qualityScore field.
     * Factors: helpfulness 35%, view traction 25%, freshness 20%,
     *          low repeat questions 10%, mod-reviewed 10%.
     */
    qualityScore: { type: Number, default: 0, min: 0, max: 100, index: true },

    duplicateOf: { type: Schema.Types.ObjectId, ref: 'Faq' },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    publishedAt: { type: Date },
    lastReviewedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────

/** Mirrors remote helpfulnessRatio virtual. */
faqSchema.virtual('helpfulnessRatio').get(function () {
  const total = (this.helpfulCount ?? 0) + (this.unhelpfulCount ?? 0);
  return total > 0 ? (this.helpfulCount ?? 0) / total : null;
});

// ─── Hooks ────────────────────────────────────────────────────────────────────

faqSchema.pre('validate', function deriveSlug(next) {
  if (!this.slug && this.title) {
    const base = slugify(this.title);
    this.slug = `${base}-${Date.now().toString(36)}`;
  }
  next();
});

// ─── Indexes ─────────────────────────────────────────────────────────────────

faqSchema.index(
  { title: 'text', summary: 'text', answer: 'text' },
  { weights: { title: 10, summary: 5, answer: 1 }, name: 'faq_text_index' },
);
faqSchema.index({ status: 1, updatedAt: -1 });
faqSchema.index({ status: 1, qualityScore: -1 });
faqSchema.index({ categories: 1 });
faqSchema.index({ tags: 1 });

// ─── Statics ─────────────────────────────────────────────────────────────────

/** Mirrors remote calculateQualityScore static.
 *  Recomputes and persists qualityScore for a single FAQ.
 *  Called by the analytics service on a schedule or after feedback events.
 */
faqSchema.statics.calculateQualityScore = async function (faqId: string): Promise<number> {
  const faq = await this.findById(faqId).select(
    'helpfulCount unhelpfulCount viewCount flagCount publishedAt lastReviewedAt',
  );
  if (!faq) return 0;

  // 1. Helpfulness (35%) — ratio of positive votes.
  const totalVotes = (faq.helpfulCount ?? 0) + (faq.unhelpfulCount ?? 0);
  const helpfulnessPct = totalVotes > 0 ? (faq.helpfulCount ?? 0) / totalVotes : 0.5;
  const helpfulnessScore = helpfulnessPct * 35;

  // 2. View traction (25%) — log scale capped at 1 000 views.
  const viewScore = Math.min((Math.log10(Math.max(faq.viewCount ?? 1, 1)) / 3) * 25, 25);

  // 3. Freshness (20%) — decays over 180 days since publish.
  const daysSincePublish = faq.publishedAt
    ? (Date.now() - faq.publishedAt.getTime()) / (1000 * 60 * 60 * 24)
    : 365;
  const freshnessPct = Math.max(1 - daysSincePublish / 180, 0);
  const freshnessScore = freshnessPct * 20;

  // 4. Low flags (10%) — penalise heavily-flagged FAQs.
  const flagPenalty = Math.min((faq.flagCount ?? 0) * 3, 10);
  const flagScore = 10 - flagPenalty;

  // 5. Moderator reviewed (10%) — bonus if recently reviewed.
  const reviewScore = faq.lastReviewedAt ? 10 : 0;

  const score = Math.round(helpfulnessScore + viewScore + freshnessScore + flagScore + reviewScore);
  const clamped = Math.max(0, Math.min(100, score));

  await this.updateOne({ _id: faqId }, { qualityScore: clamped });
  return clamped;
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FaqModelStatics extends Model<InferSchemaType<typeof faqSchema>> {
  calculateQualityScore(faqId: string): Promise<number>;
}

export type FaqDocument = HydratedDocument<InferSchemaType<typeof faqSchema>>;
export const FaqModel = model<InferSchemaType<typeof faqSchema>, FaqModelStatics>('Faq', faqSchema);
