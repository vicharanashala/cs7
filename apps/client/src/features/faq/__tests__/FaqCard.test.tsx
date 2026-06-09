// Locks Dashboard Spec into regression tests:
//  - students NEVER see viewCount (Dashboard Spec)
//  - moderators DO see viewCount
//  - YouTube-style vote bar renders in expanded section
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PublicFaq } from '@samagama/shared';
import { FaqCard } from '../FaqCard';

vi.mock('../api', () => ({
  faqApi: {
    recordView: vi.fn().mockResolvedValue(undefined),
    submitFeedback: vi
      .fn()
      .mockResolvedValue({ helpfulCount: 1, unhelpfulCount: 0, userVote: 'helpful' }),
  },
}));

const studentFaq: PublicFaq = {
  id: 'f1',
  title: 'How do I download my NOC?',
  answer: 'Go to Documents > NOC.',
  categories: [{ id: 'c1', name: 'NOC', slug: 'noc' }],
  tags: [{ id: 't1', name: 'noc', slug: 'noc' }],
  status: 'published',
  userVote: null,
  helpfulCount: 5,
  unhelpfulCount: 1,
  updatedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
};

const moderatorFaq: PublicFaq = {
  ...studentFaq,
  viewCount: 42,
};

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('<FaqCard>', () => {
  it('hides viewCount from students', () => {
    renderWithClient(<FaqCard faq={{ ...studentFaq, viewCount: 42 }} role="student" />);
    expect(screen.queryByText(/42/)).not.toBeInTheDocument();
  });

  it('shows viewCount to moderators in the header', () => {
    renderWithClient(<FaqCard faq={moderatorFaq} role="moderator" />);
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it('does not show vote counts in the collapsed header', () => {
    renderWithClient(<FaqCard faq={studentFaq} role="student" />);
    // Counts must not appear in the header — only in the expanded vote bar.
    expect(screen.queryByLabelText(/helpful/i)).not.toBeInTheDocument();
  });

  it('reveals YouTube-style vote bar for students after expanding', () => {
    renderWithClient(<FaqCard faq={studentFaq} role="student" />);
    fireEvent.click(screen.getByRole('button', { name: /how do i download my noc/i }));
    expect(screen.getByRole('button', { name: /helpful/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /not helpful/i })).toBeInTheDocument();
  });

  it('shows read-only vote bar for moderators after expanding', () => {
    renderWithClient(<FaqCard faq={moderatorFaq} role="moderator" />);
    fireEvent.click(screen.getByRole('button', { name: /how do i download my noc/i }));
    // Buttons are present but disabled (read-only).
    const likeBtn = screen.getByRole('button', { name: /helpful/i });
    expect(likeBtn).toBeDisabled();
  });

  it('keeps vote buttons visible when user has already voted so they can undo', () => {
    renderWithClient(<FaqCard faq={{ ...studentFaq, userVote: 'helpful' }} role="student" />);
    fireEvent.click(screen.getByRole('button', { name: /how do i download my noc/i }));
    expect(screen.getByRole('button', { name: /helpful/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /not helpful/i })).toBeInTheDocument();
  });
});
