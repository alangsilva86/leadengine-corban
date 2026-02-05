export const Button: React.FC<ButtonProps>;
export const buttonVariants: (options?: unknown) => string;
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: string;
    size?: string;
    asChild?: boolean;
}
import * as React from "react";
