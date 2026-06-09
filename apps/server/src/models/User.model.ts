// User document. Mirrors PRD §12.1 with the additions required by Change Spec.
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { USER_ROLES, USER_STATUSES } from '@samagama/shared';

// Embedded sub-document: a single "recently viewed FAQ" entry on a user's history.
// `_id: false` keeps the array lean — these entries are never referenced individually.
const recentlyViewedSchema = new Schema(
  {
    faqId: { type: Schema.Types.ObjectId, ref: 'Faq', required: true },
    viewedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    // Login identifier — normalized to lowercase and unique across the collection.
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // bcrypt hash; the plaintext password is never stored.
    passwordHash: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, default: 'student', required: true, index: true },
    status: { type: String, enum: USER_STATUSES, default: 'active', required: true },
    /** Bumped on password change to invalidate outstanding refresh tokens. */
    tokenVersion: { type: Number, default: 0 },
    /** Spurti Points — earned by contributing to Community Q&A. Default 100 for new students. */
    spurtiPoints: { type: Number, default: 0, index: true },
    recentlyViewedFaqs: { type: [recentlyViewedSchema], default: [] },
  },
  { timestamps: true },
);

// Supports admin user-management filters that combine role + status (e.g. "active moderators").
userSchema.index({ role: 1, status: 1 });

export type UserDocument = HydratedDocument<InferSchemaType<typeof userSchema>>;

export const UserModel = model('User', userSchema);
