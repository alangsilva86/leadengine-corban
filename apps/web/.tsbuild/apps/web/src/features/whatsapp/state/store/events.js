export const createEvents = () => {
    const handlers = new Map();
    return {
        on(event, handler) {
            const set = handlers.get(event) ?? new Set();
            set.add(handler);
            handlers.set(event, set);
            return () => {
                set.delete(handler);
            };
        },
        emit(event, payload) {
            const set = handlers.get(event);
            if (!set) {
                return;
            }
            for (const handler of Array.from(set)) {
                handler(payload);
            }
        },
    };
};
