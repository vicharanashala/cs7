// Category domain service.
import type { CategoryCreateInput, CategoryUpdateInput } from '@samagama/shared';
import { CategoryModel } from '../models/Category.model.js';
import { FaqModel } from '../models/Faq.model.js';
import { QuestionModel } from '../models/Question.model.js';
import { ApiError } from '../utils/api-error.js';
import { slugify } from '../utils/slugify.js';

export const categoryService = {
  // List categories alphabetically; inactive ones are hidden unless explicitly requested.
  async list(includeInactive = false) {
    const filter = includeInactive ? {} : { isActive: true };
    return CategoryModel.find(filter).sort({ name: 1 }).lean();
  },

  // Create a category, rejecting duplicates by slug.
  async create(input: CategoryCreateInput) {
    const slug = slugify(input.name);
    const existing = await CategoryModel.findOne({ slug }).lean();
    if (existing) throw ApiError.conflict('A category with this name already exists');
    return CategoryModel.create({ ...input, slug });
  },

  // Update a category; renaming also regenerates the slug to keep it in sync with the name.
  async update(id: string, input: CategoryUpdateInput) {
    const update: Record<string, unknown> = { ...input };
    if (input.name) update.slug = slugify(input.name);
    const updated = await CategoryModel.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!updated) throw ApiError.notFound('Category not found');
    return updated;
  },

  /** Hard-delete a category. Cascades: removes the ref from all FAQs and Questions. */
  async delete(id: string): Promise<void> {
    const exists = await CategoryModel.findById(id).lean();
    if (!exists) throw ApiError.notFound('Category not found');

    await Promise.all([
      // Pull this category out of every FAQ's categories array.
      FaqModel.updateMany({ categories: id }, { $pull: { categories: id } }),
      // Unset from Questions (single-ref field).
      QuestionModel.updateMany({ category: id }, { $unset: { category: '' } }),
    ]);

    await CategoryModel.findByIdAndDelete(id);
  },
};
