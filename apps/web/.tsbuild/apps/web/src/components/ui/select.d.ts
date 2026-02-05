export const Select: React.FC<SelectProps>;
export const SelectContent: React.FC<{
    children?: React.ReactNode;
}>;
export const SelectGroup: React.FC<{
    children?: React.ReactNode;
}>;
export const SelectItem: React.FC<{
    value: string;
    children?: React.ReactNode;
}>;
export const SelectLabel: React.FC<{
    children?: React.ReactNode;
}>;
export const SelectScrollDownButton: React.FC<{
    children?: React.ReactNode;
}>;
export const SelectScrollUpButton: React.FC<{
    children?: React.ReactNode;
}>;
export const SelectSeparator: React.FC<{
    children?: React.ReactNode;
}>;
export const SelectTrigger: React.FC<SelectTriggerProps>;
export const SelectValue: React.FC<{
    placeholder?: React.ReactNode;
    children?: React.ReactNode;
}>;
export interface SelectProps {
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    disabled?: boolean;
    children?: React.ReactNode;
}
export interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    size?: "default" | "sm" | string;
}
import * as React from "react";
