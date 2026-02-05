export default meta;
export namespace Proposta {
    namespace args {
        let currentStage: string;
    }
}
export namespace Qualificando {
    export namespace args_1 {
        let currentStage_1: string;
        export { currentStage_1 as currentStage };
    }
    export { args_1 as args };
    export namespace parameters {
        namespace docs {
            namespace description {
                let story: string;
            }
        }
    }
}
export namespace Liquidacao {
    export namespace args_2 {
        let currentStage_2: string;
        export { currentStage_2 as currentStage };
    }
    export { args_2 as args };
}
export namespace EtapaDesconhecida {
    export namespace args_3 {
        let currentStage_3: string;
        export { currentStage_3 as currentStage };
    }
    export { args_3 as args };
    export namespace parameters_1 {
        export namespace docs_1 {
            export namespace description_1 {
                let story_1: string;
                export { story_1 as story };
            }
            export { description_1 as description };
        }
        export { docs_1 as docs };
    }
    export { parameters_1 as parameters };
}
declare namespace meta {
    export let title: string;
    export { StageProgress as component };
    export namespace parameters_2 {
        export let layout: string;
        export namespace docs_2 {
            export namespace description_2 {
                let component: string;
            }
            export { description_2 as description };
        }
        export { docs_2 as docs };
    }
    export { parameters_2 as parameters };
    export namespace argTypes {
        export namespace currentStage_4 {
            export let control: string;
            let description_3: string;
            export { description_3 as description };
        }
        export { currentStage_4 as currentStage };
    }
}
import StageProgress from './StageProgress.jsx';
