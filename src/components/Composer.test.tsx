import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Composer } from './Composer';
const send = vi.hoisted(() => vi.fn());
vi.mock('../lib/api', () => ({ sendMessage: send, errorMessage: () => 'Falha de conexão.' }));
beforeEach(() => send.mockReset());
describe('compositor', () => {
  it('rejeita texto vazio e só limpa o campo depois da confirmação', async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    send.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    render(<Composer chatId="chat" onSent={vi.fn()} />);
    const field = screen.getByRole('textbox', { name: 'Mensagem' });
    expect(screen.getByRole('button', { name: 'Enviar mensagem' })).toBeDisabled();
    await user.type(field, '   ');
    expect(screen.getByRole('button')).toBeDisabled();
    await user.clear(field);
    await user.type(field, 'Olá');
    await user.click(screen.getByRole('button'));
    expect(field).toHaveValue('Olá');
    expect(screen.getByRole('button')).toBeDisabled();
    resolve();
    await waitFor(() => expect(field).toHaveValue(''));
  });
  it('preserva texto e identificador ao tentar novamente após falha', async () => {
    const user = userEvent.setup();
    send.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(undefined);
    render(<Composer chatId="chat" onSent={vi.fn()} />);
    await user.type(screen.getByRole('textbox'), 'Oi!');
    await user.click(screen.getByRole('button'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha de conexão');
    await user.click(screen.getByRole('button', { name: 'Tentar enviar novamente' }));
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''));
    expect(send.mock.calls[0]).toEqual(send.mock.calls[1]);
    expect(send.mock.calls[0][2]).toBe('Oi!');
  });
  it('Shift+Enter permite quebra de linha, Enter envia e IME não envia', async () => {
    send.mockResolvedValue(undefined);
    render(<Composer chatId="chat" onSent={vi.fn()} />);
    const field = screen.getByRole('textbox');
    fireEvent.change(field, { target: { value: 'Mensagem' } });
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });
    fireEvent.keyDown(field, { key: 'Enter', isComposing: true });
    expect(send).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  });
});
