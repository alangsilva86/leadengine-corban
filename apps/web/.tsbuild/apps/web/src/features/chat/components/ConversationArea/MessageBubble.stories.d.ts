declare namespace _default {
    export let title: string;
    export { MessageBubble as component };
    export namespace args {
        namespace message {
            let id: string;
            let status: string;
            let createdAt: string;
            let direction: string;
            let type: string;
            let text: string;
            let metadata: any;
        }
    }
    export function render(args: any): import("react/jsx-runtime").JSX.Element;
}
export default _default;
export namespace TextMessage {
    export namespace args_1 {
        export namespace message_1 { }
        export { message_1 as message };
    }
    export { args_1 as args };
}
export namespace ImageMessage {
    export namespace args_2 {
        export namespace message_2 { }
        export { message_2 as message };
    }
    export { args_2 as args };
}
export namespace VideoMessage {
    export namespace args_3 {
        export namespace message_3 { }
        export { message_3 as message };
    }
    export { args_3 as args };
}
export namespace AudioMessage {
    export namespace args_4 {
        export namespace message_4 { }
        export { message_4 as message };
    }
    export { args_4 as args };
}
export namespace DocumentMessage {
    export namespace args_5 {
        export namespace message_5 { }
        export { message_5 as message };
    }
    export { args_5 as args };
}
export namespace LocationMessage {
    export namespace args_6 {
        export namespace message_6 { }
        export { message_6 as message };
    }
    export { args_6 as args };
}
export namespace ContactMessage {
    export namespace args_7 {
        export namespace message_7 { }
        export { message_7 as message };
    }
    export { args_7 as args };
}
export namespace TemplateMessage {
    export namespace args_8 {
        export namespace message_8 { }
        export { message_8 as message };
    }
    export { args_8 as args };
}
export namespace PollMessage {
    export namespace args_9 {
        export namespace message_9 { }
        export { message_9 as message };
    }
    export { args_9 as args };
}
export namespace PollMessageWithoutMetadata {
    export namespace args_10 {
        export namespace message_10 { }
        export { message_10 as message };
    }
    export { args_10 as args };
}
export namespace PollChoiceResponse {
    export namespace args_11 {
        export namespace message_11 { }
        export { message_11 as message };
    }
    export { args_11 as args };
}
export namespace UnsupportedMessage {
    export namespace args_12 {
        export namespace message_12 { }
        export { message_12 as message };
    }
    export { args_12 as args };
}
import MessageBubble from './MessageBubble.jsx';
