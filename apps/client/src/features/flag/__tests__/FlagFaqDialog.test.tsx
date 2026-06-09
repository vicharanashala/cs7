// Locks the student "Flag this FAQ" affordance:
//  - Button is rendered.
//  - Clicking it opens a dialog with reason chips.
//  - Submitting calls the API with { entityType: 'faq', entityId, reason } and the success
//    state replaces the button with a confirmation message.
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FlagFaqButton } from '../FlagFaqDialog';

const createMock = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'flag-1' }));

vi.mock('../api', () => ({
  flagApi: {
    create: createMock,
    list: vi.fn().mockResolvedValue([]),
    updateStatus: vi.fn(),
  },
}));

function renderButton() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FlagFaqButton faqId="faq-123" />
    </QueryClientProvider>,
  );
}

describe('<FlagFaqButton>', () => {
  it('renders the trigger button', () => {
    renderButton();
    expect(screen.getByRole('button', { name: /flag this faq/i })).toBeInTheDocument();
  });

  it('opens the dialog and submits with default reason "outdated"', async () => {
    createMock.mockClear();
    renderButton();

    await act(async () => {
      screen.getByRole('button', { name: /flag this faq/i }).click();
    });
    expect(screen.getByRole('dialog', { name: /flag this faq/i })).toBeInTheDocument();

    await act(async () => {
      screen.getByRole('button', { name: /^submit flag$/i }).click();
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith({
      entityType: 'faq',
      entityId: 'faq-123',
      reason: 'outdated',
      details: undefined,
    });
    expect(await screen.findByText(/flagged for review/i)).toBeInTheDocument();
  });

  it('switches reason chip on click before submit', async () => {
    createMock.mockClear();
    renderButton();
    await act(async () => {
      screen.getByRole('button', { name: /flag this faq/i }).click();
    });
    await act(async () => {
      screen.getByRole('button', { name: /^incorrect$/i }).click();
    });
    await act(async () => {
      screen.getByRole('button', { name: /^submit flag$/i }).click();
    });
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ reason: 'incorrect' }));
  });
});
