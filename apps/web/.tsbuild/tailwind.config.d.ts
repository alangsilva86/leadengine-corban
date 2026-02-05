declare const config: {
    content: string[];
    theme: {
        extend: {
            spacing: {
                1: string;
                2: string;
                3: string;
                4: string;
                5: string;
                6: string;
                8: string;
            };
            borderRadius: {
                DEFAULT: string;
                sm: string;
                md: string;
                lg: string;
                xl: string;
            };
            boxShadow: {
                xs: string;
                sm: string;
                md: string;
                lg: string;
                xl: string;
                'focus-primary': string;
                'brand-ring': string;
            };
            colors: {
                surface: Record<string, string>;
                foreground: Record<string, string>;
                accent: Record<string, string>;
                status: Record<string, string>;
                tone: Record<string, string>;
            };
        };
    };
    plugins: import("node_modules/tailwindcss/dist/types-WlZgYgM8.mjs").b[];
};
export default config;
