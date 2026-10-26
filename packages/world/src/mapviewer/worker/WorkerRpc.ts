// The message shapes between RenderDataWorkerPool (page) and RenderDataWorker (worker). Shared by
// both sides; it must not import anything that touches the DOM or the worker global.

export type RpcRequest = {
    id: number;
    method: string;
    args: unknown[];
};

export type RpcResponse =
    | { id: number; ok: true; value: unknown }
    | { id: number; ok: false; error: string };

// A result whose buffers move to the receiver instead of being copied.
export class Transfer<T> {
    constructor(
        readonly value: T,
        readonly transferables: Transferable[],
    ) {}
}

// Unwraps a worker method's return type the way the page receives it.
export type Received<T> = T extends Transfer<infer V> ? V : T;
