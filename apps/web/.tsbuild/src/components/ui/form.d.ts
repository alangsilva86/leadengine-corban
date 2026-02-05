export function useFormField(): {
    invalid: boolean;
    isDirty: boolean;
    isTouched: boolean;
    isValidating: boolean;
    error?: import("react-hook-form").FieldError;
    id: any;
    name: any;
    formItemId: string;
    formDescriptionId: string;
    formMessageId: string;
};
export const Form: <TFieldValues extends import("react-hook-form").FieldValues, TContext = any, TTransformedValues = TFieldValues>(props: import("react-hook-form").FormProviderProps<TFieldValues, TContext, TTransformedValues>) => React.JSX.Element;
export function FormItem({ className, ...props }: {
    [x: string]: any;
    className: any;
}): import("react/jsx-runtime").JSX.Element;
export function FormLabel({ className, ...props }: {
    [x: string]: any;
    className: any;
}): import("react/jsx-runtime").JSX.Element;
export function FormControl({ ...props }: {
    [x: string]: any;
}): import("react/jsx-runtime").JSX.Element;
export function FormDescription({ className, ...props }: {
    [x: string]: any;
    className: any;
}): import("react/jsx-runtime").JSX.Element;
export function FormMessage({ className, ...props }: {
    [x: string]: any;
    className: any;
}): import("react/jsx-runtime").JSX.Element | null;
export function FormField({ ...props }: {
    [x: string]: any;
}): import("react/jsx-runtime").JSX.Element;
import * as React from "react";
