import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMessages } from './useMessages';
const mocks = vi.hoisted(() => ({ getDocs: vi.fn(), onSnapshot: vi.fn(), stop: vi.fn() }));
vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('../lib/api', () => ({ errorMessage: () => 'Falha' }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: mocks.getDocs,
  onSnapshot: mocks.onSnapshot,
}));
function page(start: number, end: number) {
  return {
    docs: Array.from({ length: end - start + 1 }, (_, index) => {
      const sequence = end - index;
      return { id: `m${sequence}`, data: () => ({ sequence, text: `${sequence}`, senderId: 'a' }) };
    }),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.onSnapshot.mockReturnValue(mocks.stop);
});
describe('histórico incremental', () => {
  it('preserva a janela anterior ao receber mais de 40 mensagens e pagina sem duplicar', async () => {
    mocks.getDocs.mockResolvedValueOnce(page(41, 80)).mockResolvedValueOnce(page(1, 40));
    const { result } = renderHook(() => useMessages('chat'));
    await waitFor(() => expect(result.current.messages).toHaveLength(40));
    expect(result.current.hasMore).toBe(true);
    const firstListener = mocks.onSnapshot.mock.calls[0][1];
    await act(async () => firstListener({ docs: page(81, 120).docs.reverse() }));
    expect(mocks.stop).toHaveBeenCalled();
    expect(mocks.onSnapshot).toHaveBeenCalledTimes(2);
    const secondListener = mocks.onSnapshot.mock.calls[1][1];
    await act(async () => secondListener(page(121, 121)));
    await act(async () => secondListener(page(121, 121)));
    await act(async () => result.current.loadMore());
    expect(result.current.messages).toHaveLength(121);
    expect(result.current.messages.map((message) => message.sequence)).toEqual(
      Array.from({ length: 121 }, (_, index) => index + 1),
    );
    expect(result.current.hasMore).toBe(false);
  });
  it('ignora resposta atrasada da conversa anterior', async () => {
    let finish!: (value: unknown) => void;
    mocks.getDocs
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValueOnce(page(1, 1));
    const { result, rerender } = renderHook(({ id }) => useMessages(id), {
      initialProps: { id: 'old' },
    });
    rerender({ id: 'new' });
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    await act(async () => finish(page(2, 20)));
    expect(result.current.messages.map((message) => message.id)).toEqual(['m1']);
  });
});
