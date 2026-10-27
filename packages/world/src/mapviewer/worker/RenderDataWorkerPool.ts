import { EntityAnimData, EntityAnimRequest } from "../../live/EntityModelLoader";
import { LoadedCache } from "../Caches";
import { RenderDataLoader } from "./RenderDataLoader";
import type { RenderDataWorkerApi } from "./RenderDataWorker";
import { Received, RpcRequest, RpcResponse } from "./WorkerRpc";

type Method = keyof RenderDataWorkerApi;
type Args<M extends Method> = Parameters<RenderDataWorkerApi[M]>;
type Result<M extends Method> = Received<Awaited<ReturnType<RenderDataWorkerApi[M]>>>;

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void };

// One module worker and its in-flight calls.
class WorkerHandle {
    private readonly worker: Worker;
    private readonly pending = new Map<number, Pending>();
    private nextId = 0;
    // Set once the worker has died (its module failed to load, or it crashed) or was terminated:
    // it will never answer again, so every later call fails at once instead of waiting forever.
    private failed?: Error;
    // Running a task from the pool queue; broadcasts do not count.
    busy = false;

    constructor() {
        this.worker = new Worker(new URL("./RenderDataWorker.ts", import.meta.url), {
            type: "module",
            name: "render-data",
        });
        this.worker.onmessage = (e: MessageEvent<RpcResponse>) => {
            const response = e.data;
            const pending = this.pending.get(response.id);
            if (!pending) return;
            this.pending.delete(response.id);
            if (response.ok) pending.resolve(response.value);
            else pending.reject(new Error(response.error));
        };
        this.worker.onerror = (e) => {
            this.failAll(new Error("Render worker failed: " + (e.message || "script error")));
        };
    }

    call<M extends Method>(method: M, ...args: Args<M>): Promise<Result<M>> {
        if (this.failed) return Promise.reject(this.failed);
        const id = this.nextId++;
        return new Promise<Result<M>>((resolve, reject) => {
            this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
            const request: RpcRequest = { id, method, args };
            this.worker.postMessage(request);
        });
    }

    terminate(): void {
        this.worker.terminate();
        this.failAll(new Error("Render worker terminated"));
    }

    private failAll(error: Error): void {
        this.failed ??= error;
        for (const pending of this.pending.values()) pending.reject(error);
        this.pending.clear();
    }
}

type Task = {
    run: (worker: WorkerHandle) => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
};

// A fixed set of module workers sharing one FIFO queue: an idle worker takes the next task and
// runs one queued task at a time. Broadcasts (cache init, loader init, vars) go to every worker
// directly, outside the queue.
export class RenderDataWorkerPool {
    private readonly workers: WorkerHandle[];
    private readonly queue: Task[] = [];
    private terminated = false;

    static create(size: number): RenderDataWorkerPool {
        return new RenderDataWorkerPool(size);
    }

    private constructor(readonly size: number) {
        this.workers = Array.from({ length: size }, () => new WorkerHandle());
    }

    initCache(cache: LoadedCache): void {
        for (const worker of this.workers) {
            worker.call("initCache", cache).catch((e) => console.error("Render worker init failed", e));
        }
    }

    private async broadcast<M extends Method>(method: M, ...args: Args<M>): Promise<void> {
        await Promise.all(this.workers.map((worker) => worker.call(method, ...args)));
    }

    initLoader(loader: RenderDataLoader<any, any>): Promise<void> {
        return this.broadcast("initDataLoader", loader.__type);
    }

    resetLoader(loader: RenderDataLoader<any, any>): Promise<void> {
        return this.broadcast("resetDataLoader", loader.__type);
    }

    setVars(vars: Int32Array): Promise<void> {
        return this.broadcast("setVars", vars);
    }

    queueLoad<I, D>(loader: RenderDataLoader<I, D>, input: I): Promise<D | undefined> {
        return this.enqueue(
            (w) => w.call("load", loader.__type, input) as Promise<D | undefined>,
        );
    }

    queueEntityAnim(request: EntityAnimRequest): Promise<EntityAnimData | undefined> {
        return this.enqueue((w) => w.call("loadEntityAnim", request));
    }

    // Map-square loads queued or running, for the replay's "ready" signal.
    get pendingTasks(): number {
        return this.queue.length + this.workers.filter((w) => w.busy).length;
    }

    terminate(): Promise<void> {
        this.terminated = true;
        for (const worker of this.workers) worker.terminate();
        for (const task of this.queue.splice(0)) task.reject(new Error("Render worker pool terminated"));
        return Promise.resolve();
    }

    private enqueue<T>(run: (worker: WorkerHandle) => Promise<T>): Promise<T> {
        if (this.terminated) return Promise.reject(new Error("Render worker pool terminated"));
        return new Promise<T>((resolve, reject) => {
            this.queue.push({ run, resolve: resolve as (value: unknown) => void, reject });
            this.drain();
        });
    }

    private drain(): void {
        for (const worker of this.workers) {
            if (worker.busy) continue;
            const task = this.queue.shift();
            if (!task) return;
            worker.busy = true;
            task.run(worker)
                .then(task.resolve, task.reject)
                .finally(() => {
                    worker.busy = false;
                    if (!this.terminated) this.drain();
                });
        }
    }
}
