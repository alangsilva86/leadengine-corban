declare namespace _default {
    export let title: string;
    export { ColorTokenGrid as component };
    export namespace argTypes {
        namespace group {
            export let name: string;
            export let options: string[];
            export namespace control {
                let type: string;
            }
            export { COLOR_GROUPS as mapping };
            export let labels: {
                [k: string]: string;
            };
        }
    }
    export namespace args {
        let group_1: string;
        export { group_1 as group };
    }
}
export default _default;
export namespace Exibir {
    export namespace args_1 {
        let group_2: string;
        export { group_2 as group };
    }
    export { args_1 as args };
}
declare function ColorTokenGrid({ group }: {
    group: any;
}): import("react/jsx-runtime").JSX.Element;
declare namespace COLOR_GROUPS {
    namespace surface {
        export let label: string;
        export { surface as tokens };
    }
    namespace foreground {
        let label_1: string;
        export { label_1 as label };
        export { foreground as tokens };
    }
    namespace accent {
        let label_2: string;
        export { label_2 as label };
        export { accent as tokens };
    }
    namespace status {
        let label_3: string;
        export { label_3 as label };
        export { status as tokens };
    }
}
import { surface as surface_1 } from '../../../tailwind.tokens.js';
import { foreground as foreground_1 } from '../../../tailwind.tokens.js';
import { accent as accent_1 } from '../../../tailwind.tokens.js';
import { status as status_1 } from '../../../tailwind.tokens.js';
