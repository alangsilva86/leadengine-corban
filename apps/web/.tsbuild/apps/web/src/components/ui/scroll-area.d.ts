export const ScrollArea: React.ForwardRefExoticComponent<ScrollAreaProps & React.RefAttributes<HTMLDivElement>>;
export const ScrollBar: React.FC<React.HTMLAttributes<HTMLDivElement>>;
export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
    viewportClassName?: string;
    viewportRef?: React.Ref<HTMLDivElement>;
    viewportProps?: React.HTMLAttributes<HTMLDivElement>;
}
import * as React from 'react';
