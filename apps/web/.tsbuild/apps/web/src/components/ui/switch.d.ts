export const Switch: React.FC<SwitchProps>;
export interface SwitchProps extends  {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
}
import * as React from "react";
