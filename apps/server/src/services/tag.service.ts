// Tag domain service. Mirrors category.service intentionally — small enough to keep parallel.
import type { TagCreateInput, TagUpdateInput } from '@samagama/shared';
import { TagModel } from '../models/Tag.model.js';
import { FaqModel } from '../models/Faq.model.js';
import { QuestionModel } from '../models/Question.model.js';
import { ApiError } from '../utils/api-error.js';
import { slugify } from '../utils/slugify.js';

export const tagService = {
  // List tags alphabetically; inactive ones are hidden unless explicitly requested.
  async list(includeInactive = false) {
    const filter = includeInactive ? {} : { isActive: true };
    return TagModel.find(filter).sort({ name: 1 }).lean();
  },

  // Create a tag, rejecting duplicates by slug (so "NOC" and "noc" can't both exist).
  async create(input: TagCreateInput) {
    const slug = slugify(input.name);
    const existing = await TagModel.findOne({ slug }).lean();
    if (existing) throw ApiError.conflict('A tag with this name already exists');
    return TagModel.create({ ...input, slug });
  },

  // Update a tag; renaming also regenerates the slug to keep it in sync with the name.
  async update(id: string, input: TagUpdateInput) {
    const update: Record<string, unknown> = { ...input };
    if (input.name) update.slug = slugify(input.name);
    const updated = await TagModel.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!updated) throw ApiError.notFound('Tag not found');
    return updated;
  },

  /** Hard-delete a tag. Cascades: pulls the ref from all FAQs and Questions. */
  async delete(id: string): Promise<void> {
    const exists = await TagModel.findById(id).lean();
    if (!exists) throw ApiError.notFound('Tag not found');

    await Promise.all([
      FaqModel.updateMany({ tags: id }, { $pull: { tags: id } }),
      QuestionModel.updateMany({ tags: id }, { $pull: { tags: id } }),
    ]);

    await TagModel.findByIdAndDelete(id);
  },
};
