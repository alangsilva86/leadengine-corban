declare namespace _default {
    export let title: string;
    export { Button as component };
    export let tags: string[];
    export namespace argTypes {
        namespace variant {
            let control: string;
            let options: string[];
        }
        namespace size {
            let control_1: string;
            export { control_1 as control };
            let options_1: string[];
            export { options_1 as options };
        }
    }
    export namespace args {
        export let children: string;
        let variant_1: string;
        export { variant_1 as variant };
        let size_1: string;
        export { size_1 as size };
    }
}
export default _default;
export namespace Playground {
    export namespace args_1 {
        let children_1: string;
        export { children_1 as children };
    }
    export { args_1 as args };
}
export namespace ComIcone {
    export function render(args: any): import("react/jsx-runtime").JSX.Element;
    export namespace args_2 {
        let variant_2: string;
        export { variant_2 as variant };
        let size_2: string;
        export { size_2 as size };
    }
    export { args_2 as args };
}
export namespace Circular {
    let args_3: {
        variant: string;
        size: string;
        children: import("react/jsx-runtime").JSX.Element;
        'aria-label': string;
    };
    export { args_3 as args };
}
export namespace Carregando {
    export function render_1(args: any): import("react/jsx-runtime").JSX.Element;
    export { render_1 as render };
    export namespace args_4 {
        let variant_3: string;
        export { variant_3 as variant };
        let size_3: string;
        export { size_3 as size };
    }
    export { args_4 as args };
}
import { Button } from './button.jsx';
