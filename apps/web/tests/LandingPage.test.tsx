import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LandingPage } from '../src/pages/LandingPage';

describe('guest landing experience', () => {
  it('states that no signup is required', () => { render(<MemoryRouter><LandingPage/></MemoryRouter>); expect(screen.getByText('No sign-up')).toBeInTheDocument(); expect(screen.getByText(/email reminders are optional/i)).toBeInTheDocument(); });
  it('accepts a room code and navigates directly to prejoin', async () => { render(<MemoryRouter initialEntries={['/']}><Routes><Route path="/" element={<LandingPage/>}/><Route path="/room/:roomId" element={<div>Prejoin reached</div>}/></Routes></MemoryRouter>); await userEvent.type(screen.getByLabelText(/invitation link/i), 'abc123'); await userEvent.click(screen.getByRole('button', { name:/join room/i })); expect(screen.getByText('Prejoin reached')).toBeInTheDocument(); });
});
