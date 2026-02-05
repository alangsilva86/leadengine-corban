import type { ReactNode } from 'react';
declare const SIZE_PRESETS: {
    44: {
        container: string;
        image: string;
        spinner: string;
        icon: string;
    };
    64: {
        container: string;
        image: string;
        spinner: string;
        icon: string;
    };
};
type SizePresetKey = keyof typeof SIZE_PRESETS;
type QrPreviewProps = {
    src?: string | null | undefined;
    isGenerating?: boolean;
    statusMessage?: ReactNode | null | undefined;
    onGenerate?: (() => void | Promise<void>) | null | undefined;
    onOpen?: (() => void | Promise<void>) | null | undefined;
    generateDisabled?: boolean;
    openDisabled?: boolean;
    className?: string;
    illustrationClassName?: string;
    size?: SizePresetKey | number | string | null | undefined;
};
declare const QrPreview: ({ src, isGenerating, statusMessage, onGenerate, onOpen, generateDisabled, openDisabled, className, illustrationClassName, size, }: QrPreviewProps) => import("react/jsx-runtime").JSX.Element;
export default QrPreview;
