import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';

const loginMock = vi.fn();

vi.mock('./useAuth', () => ({
  useAuth: () => ({
    login: loginMock,
    logout: vi.fn(),
    user: null,
    status: 'unauthenticated',
  }),
}));

vi.mock('../../lib/demo-auth', () => ({
  demoEmail: 'demo@exemplo.test',
  demoPassword: 'senha-demo-ficticia',
  isDemoLoginEnabled: true,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    loginMock.mockReset();
  });

  it('mostra erro de validação quando o e-mail é inválido', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('E-mail'), 'não-é-email');
    await user.type(screen.getByLabelText('Senha'), '123456');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('E-mail inválido.')).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('preenche credenciais demo ao clicar no botão', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Preencher acesso demo' }));

    expect(screen.getByLabelText('E-mail')).toHaveValue('demo@exemplo.test');
    expect(screen.getByLabelText('Senha')).toHaveValue('senha-demo-ficticia');
  });

  it('chama login com credenciais válidas', async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValueOnce(undefined);
    renderPage();

    await user.type(screen.getByLabelText('E-mail'), 'admin@atlas.com');
    await user.type(screen.getByLabelText('Senha'), 'admin123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() =>
      expect(loginMock).toHaveBeenCalledWith('admin@atlas.com', 'admin123'),
    );
  });

  it('exibe mensagem quando o login falha', async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValueOnce(new Error('boom'));
    renderPage();

    await user.type(screen.getByLabelText('E-mail'), 'admin@atlas.com');
    await user.type(screen.getByLabelText('Senha'), 'errada');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(
      await screen.findByText('Não foi possível entrar.'),
    ).toBeInTheDocument();
  });
});
