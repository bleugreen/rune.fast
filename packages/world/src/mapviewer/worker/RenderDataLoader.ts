import { SdMapDataLoader } from "../webgl/loader/SdMapDataLoader";
import type { WorkerState } from "./RenderDataWorker";

export type RenderDataResult<T> = {
    data: T;
    transferables: Transferable[];
};

export interface RenderDataLoader<I, D> {
    // The loader's name in the worker's own table; loaders cross the worker boundary by name.
    __type: RenderDataLoaderName;

    init(): void;

    load(state: WorkerState, input: I): Promise<RenderDataResult<D>>;

    reset(): void;
}

const loaders = {
    sdMapDataLoader: new SdMapDataLoader(),
};

export type RenderDataLoaderName = keyof typeof loaders;

export function getRenderDataLoader(name: RenderDataLoaderName): RenderDataLoader<any, any> {
    const loader = loaders[name];
    if (!loader) throw new Error("Unknown render data loader: " + name);
    return loader;
}
