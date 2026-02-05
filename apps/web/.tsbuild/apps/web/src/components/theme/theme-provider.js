import { jsx as _jsx } from "react/jsx-runtime";
import { ThemeProvider as NextThemesProvider } from 'next-themes';
export function ThemeProvider({ children, ...props }) {
    return (_jsx(NextThemesProvider, { attribute: "class", defaultTheme: "system", enableSystem: true, storageKey: "leadengine-theme", disableTransitionOnChange: true, ...props, children: children }));
}
export default ThemeProvider;
