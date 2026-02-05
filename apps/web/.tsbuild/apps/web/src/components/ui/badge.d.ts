export function Badge({ className, variant, tone, asChild, ...props }: {
    [x: string]: any;
    className?: string | undefined;
    variant?: string | undefined;
    tone?: string | undefined;
    asChild?: boolean | undefined;
}): import("react/jsx-runtime").JSX.Element;
export const badgeVariants: (props?: ({
    variant?: "default" | "destructive" | "outline" | "secondary" | "status" | "success" | "warning" | "info" | null | undefined;
    tone?: "error" | "success" | "warning" | "info" | "neutral" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
