// Category collection. PRD §12.3.
// Slug is auto-derived from name and unique-indexed so URLs stay stable across renames.
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { slugify } from '../utils/slugify.js';

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, trim: true, maxlength: 500 },
    // Extra terms used to route questions/FAQs to this category during search/classification.
    keywords: { type: [String], default: [] },
    // Soft on/off switch so a category can be hidden without deleting its content.
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

// Auto-generate the slug from the name when one isn't supplied explicitly.
categorySchema.pre('validate', function deriveSlug(next) {
  if (!this.slug && this.name) this.slug = slugify(this.name);
  next();
});

export type CategoryDocument = HydratedDocument<InferSchemaType<typeof categorySchema>>;
export const CategoryModel = model('Category', categorySchema);
