import type { InstancesStoreBundle, InstancesStoreDependencies, InstancesStoreState } from './types';
export declare const createInstancesStore: (deps: InstancesStoreDependencies) => InstancesStoreBundle;
export declare const InstancesStoreProvider: import("react").Provider<InstancesStoreBundle | null>;
export declare const useInstancesStoreBundle: () => InstancesStoreBundle;
export declare const useInstancesStore: <T>(selector: (state: InstancesStoreState) => T, equalityFn?: (a: T, b: T) => boolean) => T;
export * from './types';
