declare namespace _default {
    export let title: string;
    export { TypographyScale as component };
    export namespace argTypes {
        namespace sampleText {
            let control: string;
            let name: string;
        }
    }
    export namespace args {
        let sampleText_1: string;
        export { sampleText_1 as sampleText };
    }
}
export default _default;
export namespace Exibir {
    export namespace args_1 {
        let sampleText_2: string;
        export { sampleText_2 as sampleText };
    }
    export { args_1 as args };
}
declare function TypographyScale({ sampleText }: {
    sampleText: any;
}): import("react/jsx-runtime").JSX.Element;
