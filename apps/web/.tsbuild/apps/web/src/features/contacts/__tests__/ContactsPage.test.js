import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ContactsPage from '../pages/ContactsPage.jsx';
const mockMutate = vi.fn();
vi.mock('react-virtuoso', () => ({
    Virtuoso: ({ data = [], itemContent, components }) => (_jsxs("div", { children: [data.map((item, index) => (_jsx("div", { children: itemContent(index, item) }, item?.id ?? index))), components?.Footer ? _jsx(components.Footer, {}) : null] })),
}));
vi.mock('../hooks/useContactsApi.js', () => ({
    useContactsQuery: () => ({
        data: {
            pages: [
                {
                    items: [
                        {
                            id: 'contact-1',
                            name: 'Alice Doe',
                            phone: '+5511999990000',
                            email: 'alice@example.com',
                            tags: ['VIP'],
                        },
                    ],
                },
            ],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        isFetching: false,
        refetch: vi.fn(),
    }),
    useContactBulkMutation: () => ({ mutate: mockMutate, isPending: false }),
    useCreateContactMutation: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('../hooks/useContactsLiveUpdates.js', () => ({
    __esModule: true,
    default: vi.fn(),
}));
const renderPage = () => {
    const client = new QueryClient();
    return render(_jsx(QueryClientProvider, { client: client, children: _jsx(MemoryRouter, { children: _jsx(ContactsPage, {}) }) }));
};
describe('ContactsPage', () => {
    beforeEach(() => {
        mockMutate.mockReset();
    });
    it('renderiza contatos e toolbar de busca', () => {
        renderPage();
        expect(screen.getByPlaceholderText('Buscar por nome, telefone ou e-mail')).toBeInTheDocument();
        expect(screen.getByText(/Alice Doe/)).toBeInTheDocument();
    });
    it('habilita ações em massa após selecionar um contato', () => {
        renderPage();
        const [checkbox] = screen.getAllByRole('checkbox', { name: /Selecionar Alice Doe/i });
        fireEvent.click(checkbox);
        const [dedupeButton] = screen.getAllByRole('button', { name: /Deduplicar/i });
        expect(dedupeButton).not.toBeDisabled();
        fireEvent.click(dedupeButton);
        expect(mockMutate).toHaveBeenCalledTimes(1);
        expect(mockMutate.mock.calls[0][0]).toEqual({
            action: 'mergeDuplicates',
            contactIds: ['contact-1'],
        });
    });
});
