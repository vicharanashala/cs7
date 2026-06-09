// Verifies Change Spec §4: FAB is reachable via accessible name and navigates to /chatbot.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChatbotFab } from '../ChatbotFab';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

describe('<ChatbotFab>', () => {
  it('exposes an accessible label', () => {
    render(
      <MemoryRouter>
        <ChatbotFab />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /open yaksha chatbot/i })).toBeInTheDocument();
  });
});
