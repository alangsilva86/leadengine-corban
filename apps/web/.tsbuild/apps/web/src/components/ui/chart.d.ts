export function ChartContainer({ id, className, children, config, ...props }: {
    [x: string]: any;
    id: any;
    className: any;
    children: any;
    config: any;
}): import("react/jsx-runtime").JSX.Element;
export const ChartTooltip: typeof RechartsPrimitive.Tooltip;
export function ChartTooltipContent({ active, payload, className, indicator, hideLabel, hideIndicator, label, labelFormatter, labelClassName, formatter, color, nameKey, labelKey }: {
    active: any;
    payload: any;
    className: any;
    indicator?: string | undefined;
    hideLabel?: boolean | undefined;
    hideIndicator?: boolean | undefined;
    label: any;
    labelFormatter: any;
    labelClassName: any;
    formatter: any;
    color: any;
    nameKey: any;
    labelKey: any;
}): import("react/jsx-runtime").JSX.Element | null;
export const ChartLegend: typeof RechartsPrimitive.Legend;
export function ChartLegendContent({ className, hideIcon, payload, verticalAlign, nameKey }: {
    className: any;
    hideIcon?: boolean | undefined;
    payload: any;
    verticalAlign?: string | undefined;
    nameKey: any;
}): import("react/jsx-runtime").JSX.Element | null;
export function ChartStyle({ id, config }: {
    id: any;
    config: any;
}): import("react/jsx-runtime").JSX.Element | null;
import * as RechartsPrimitive from "recharts";
