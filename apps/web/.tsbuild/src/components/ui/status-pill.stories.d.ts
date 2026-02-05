declare namespace _default {
    export let title: string;
    export { StatusPill as component };
    export let tags: string[];
    export namespace argTypes {
        namespace tone {
            export let control: string;
            export { toneOptions as options };
        }
        namespace size {
            let control_1: string;
            export { control_1 as control };
            export let options: string[];
        }
        namespace withDot {
            let control_2: string;
            export { control_2 as control };
        }
    }
    export namespace args {
        let tone_1: string;
        export { tone_1 as tone };
        let size_1: string;
        export { size_1 as size };
        let withDot_1: boolean;
        export { withDot_1 as withDot };
        export let children: string;
    }
}
export default _default;
export namespace Playground {
    export namespace args_1 {
        let tone_2: string;
        export { tone_2 as tone };
        let children_1: string;
        export { children_1 as children };
    }
    export { args_1 as args };
}
export namespace ComIcone {
    export function render(args: any): import("react/jsx-runtime").JSX.Element;
    export namespace args_2 {
        let tone_3: string;
        export { tone_3 as tone };
        let withDot_2: boolean;
        export { withDot_2 as withDot };
    }
    export { args_2 as args };
}
export namespace Estados {
    export function render_1(args: any): import("react/jsx-runtime").JSX.Element;
    export { render_1 as render };
    export namespace args_3 {
        let withDot_3: boolean;
        export { withDot_3 as withDot };
        let size_2: string;
        export { size_2 as size };
    }
    export { args_3 as args };
    export namespace parameters {
        namespace controls {
            let exclude: string[];
        }
    }
}
import { StatusPill } from './status-pill.jsx';
declare const toneOptions: string[];
