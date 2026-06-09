// Locks Change Spec §5.3 — WhatsApp-style status ticks for personal questions.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PublicQuestion } from '@samagama/shared';

// vi.mock is hoisted above all top-level statements. Use vi.hoisted so the
// mocked data is available inside the factory.
const fixtures = vi.hoisted(() => {
  const base: PublicQuestion = {
    id: 'p1',
    title: 'NOC delay help',
    description: 'Pending for two weeks.',
    type: 'personal',
    status: 'open',
    category: { id: 'c1', name: 'NOC', slug: 'noc' },
    tags: [],
    author: { id: 'me', name: 'Me' },
    answerCount: 0,
    viewCount: 0,
    displayState: 'posted',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return [
    base,
    { ...base, id: 'p2', title: 'Certificate question', displayState: 'seen' as const },
    {
      ...base,
      id: 'p3',
      title: 'Stipend question',
      status: 'answered' as const,
      answerCount: 1,
      displayState: 'responded' as const,
    },
  ];
});

vi.mock('../api', () => ({
  qnaApi: {
    listQuestions: vi.fn().mockResolvedValue(fixtures),
  },
  moderationApi: { listPendingAnswers: vi.fn() },
}));

import { MyQuestionsPage } from '../MyQuestionsPage';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MyQuestionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('<MyQuestionsPage> personal tab status ticks', () => {
  it('renders Posted / Seen / Responded labels for the three states', async () => {
    renderPage();
    expect(await screen.findByText(/Posted/i)).toBeInTheDocument();
    expect(screen.getByText(/Seen/i)).toBeInTheDocument();
    expect(screen.getByText(/Responded/i)).toBeInTheDocument();
  });
});
