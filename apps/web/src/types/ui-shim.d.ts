import type * as React from 'react';

declare module '@/components/ui/button.jsx' {
  export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: string;
    size?: string;
    asChild?: boolean;
  }

  export const Button: React.FC<ButtonProps>;
  export const buttonVariants: (options?: unknown) => string;
}

declare module '@/components/ui/label.jsx' {
  export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;
  export const Label: React.FC<LabelProps>;
}

declare module '@/components/ui/input.jsx' {
  export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
  export const Input: React.FC<InputProps>;
}

declare module '@/components/ui/textarea.jsx' {
  export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;
  export const Textarea: React.FC<TextareaProps>;
}

declare module '@/components/ui/switch.jsx' {
  export interface SwitchProps extends React.ComponentPropsWithoutRef<'button'> {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }

  export const Switch: React.FC<SwitchProps>;
}

declare module '@/components/ui/select.jsx' {
  export interface SelectProps {
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    disabled?: boolean;
    children?: React.ReactNode;
  }

  export interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    size?: 'default' | 'sm' | string;
  }

  export const Select: React.FC<SelectProps>;
  export const SelectGroup: React.FC<{ children?: React.ReactNode }>;
  export const SelectValue: React.FC<{ placeholder?: React.ReactNode; children?: React.ReactNode }>;
  export const SelectTrigger: React.FC<SelectTriggerProps>;
  export const SelectContent: React.FC<{ children?: React.ReactNode }>;
  export const SelectItem: React.FC<{ value: string; children?: React.ReactNode }>;
  export const SelectSeparator: React.FC<{ children?: React.ReactNode }>;
  export const SelectLabel: React.FC<{ children?: React.ReactNode }>;
  export const SelectScrollDownButton: React.FC<{ children?: React.ReactNode }>;
  export const SelectScrollUpButton: React.FC<{ children?: React.ReactNode }>;
}

declare module '@/components/ui/scroll-area.jsx' {
  export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
    viewportClassName?: string;
    viewportRef?: React.Ref<HTMLDivElement>;
    viewportProps?: React.HTMLAttributes<HTMLDivElement>;
    children?: React.ReactNode;
  }

  export const ScrollArea: React.ForwardRefExoticComponent<
    ScrollAreaProps & React.RefAttributes<HTMLDivElement>
  >;

  export const ScrollBar: React.FC<React.HTMLAttributes<HTMLDivElement>>;
}

