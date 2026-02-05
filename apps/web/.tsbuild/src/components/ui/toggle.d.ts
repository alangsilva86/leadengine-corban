export function Toggle({ className, variant, size, ...props }: {
    [x: string]: any;
    className: any;
    variant: any;
    size: any;
}): import("react/jsx-runtime").JSX.Element;
export const toggleVariants: (props?: ({
    variant?: "default" | "outline" | null | undefined;
    size?: "default" | "sm" | "lg" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
