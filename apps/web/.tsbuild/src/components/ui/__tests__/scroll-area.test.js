import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('@radix-ui/react-scroll-area', async () => {
    const React = await import('react');
    const Root = React.forwardRef(function Root({ children, ...props }, ref) {
        return (_jsx("div", { ref: ref, ...props, children: children }));
    });
    const Viewport = React.forwardRef(function Viewport({ children, ...props }, ref) {
        return (_jsx("div", { ref: ref, ...props, children: children }));
    });
    const ScrollAreaScrollbar = React.forwardRef(function ScrollAreaScrollbar({ children, orientation, ...props }, ref) {
        return (_jsx("div", { ref: ref, "data-orientation": orientation, ...props, children: children }));
    });
    const ScrollAreaThumb = React.forwardRef(function ScrollAreaThumb(props, ref) {
        return _jsx("div", { ref: ref, ...props });
    });
    const Corner = React.forwardRef(function Corner(props, ref) {
        return _jsx("div", { ref: ref, ...props });
    });
    return {
        __esModule: true,
        Root,
        Viewport,
        ScrollAreaScrollbar,
        ScrollAreaThumb,
        Corner,
    };
});
import { ScrollArea } from '../scroll-area.jsx';
beforeAll(() => {
    if (typeof window.ResizeObserver === 'undefined') {
        class ResizeObserverMock {
            observe() { }
            unobserve() { }
            disconnect() { }
        }
        window.ResizeObserver = ResizeObserverMock;
        global.ResizeObserver = ResizeObserverMock;
    }
});
describe('ScrollArea', () => {
    it('forwards props to the root element and keeps overflow hidden', () => {
        const { getByTestId } = render(_jsx(ScrollArea, { "data-testid": "scroll-root", className: "custom-root", children: _jsx("div", { children: "content" }) }));
        const root = getByTestId('scroll-root');
        expect(root).toHaveAttribute('data-slot', 'scroll-area');
        expect(root.className).toMatch(/relative/);
        expect(root.className).toMatch(/custom-root/);
    });
    it('decorates the viewport with chat scroll classes for consistent styling', () => {
        const { getByTestId } = render(_jsx(ScrollArea, { viewportProps: { 'data-testid': 'viewport' }, viewportClassName: "custom-viewport", children: _jsx("div", { children: "Viewport content" }) }));
        const viewport = getByTestId('viewport');
        expect(viewport).toHaveAttribute('data-slot', 'scroll-area-viewport');
        expect(viewport.className).toMatch(/chat-scroll-area/);
        expect(viewport.className).toMatch(/custom-viewport/);
    });
    it('renders the vertical scrollbar with the expected data attributes', () => {
        const { container } = render(_jsx(ScrollArea, { children: _jsx("div", { style: { height: 2000, width: 2000 }, children: "huge content" }) }));
        const scrollbars = container.querySelectorAll('[data-slot="scroll-area-scrollbar"]');
        expect(scrollbars.length).toBeGreaterThanOrEqual(1);
        const orientations = Array.from(scrollbars).map((node) => node.getAttribute('data-orientation'));
        expect(orientations).toContain('vertical');
        const thumb = container.querySelector('[data-slot="scroll-area-thumb"]');
        expect(thumb).not.toBeNull();
    });
});
