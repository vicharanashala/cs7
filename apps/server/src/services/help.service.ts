// Unified help-data export for the client-side MiniSearch engine.
// Returns published FAQs + open/answered community questions in a flat
// format the search worker indexes on first page load.
import crypto from 'node:crypto';
import { FaqModel } from '../models/Faq.model.js';
import { QuestionModel } from '../models/Question.model.js';

export interface SearchDoc {
  id: string;
  type: 'faq' | 'community';
  title: string;
  content: string;
  tags: string[];
}

interface ETagResult {
  docs: SearchDoc[];
  etag: string;
}

export const helpService = {
  async exportForSearch(): Promise<ETagResult> {
    const [faqs, questions] = await Promise.all([
      FaqModel.find({ status: 'published' })
        .select('title answer categories tags updatedAt')
        .populate<{ categories: { name: string }[] }>('categories', 'name')
        .populate<{ tags: { name: string }[] }>('tags', 'name')
        .lean(),

      QuestionModel.find({ type: 'community', status: { $in: ['open', 'answered'] } })
        .select('title description category tags updatedAt')
        .populate<{ category: { name: string } | null }>('category', 'name')
        .populate<{ tags: { name: string }[] }>('tags', 'name')
        .lean(),
    ]);

    const faqDocs: SearchDoc[] = faqs.map((f) => ({
      id: `faq_${(f._id as { toString(): string }).toString()}`,
      type: 'faq',
      title: f.title,
      // Trim to 600 chars — enough context for TF-IDF, avoids bloating the bundle.
      content: f.answer.slice(0, 600),
      tags: [
        ...(f.categories as { name: string }[]).map((c) => c.name.toLowerCase()),
        ...(f.tags as { name: string }[]).map((t) => t.name.toLowerCase()),
      ],
    }));

    const communityDocs: SearchDoc[] = questions.map((q) => ({
      id: `com_${(q._id as { toString(): string }).toString()}`,
      type: 'community',
      title: q.title,
      content: (q.description ?? '').slice(0, 300),
      tags: [
        ...(q.category ? [(q.category as { name: string }).name.toLowerCase()] : []),
        ...(q.tags as { name: string }[]).map((t) => t.name.toLowerCase()),
      ],
    }));

    const docs = [...faqDocs, ...communityDocs];

    // ETag based on doc count + latest updatedAt — cheap to compute, correct for cache validation.
    const latest = Math.max(
      ...faqs.map((f) => new Date(f.updatedAt as Date).getTime()),
      ...questions.map((q) => new Date(q.updatedAt as Date).getTime()),
      0,
    );
    const etag = `"${docs.length}-${crypto.createHash('md5').update(`${docs.length}:${latest}`).digest('hex').slice(0, 10)}"`;

    return { docs, etag };
  },
};
