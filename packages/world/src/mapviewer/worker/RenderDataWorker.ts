import { CacheSystem } from "../../rs/cache/CacheSystem";
import {
    CacheLoaderFactory,
    getCacheLoaderFactory,
} from "../../rs/cache/loader/CacheLoaderFactory";
import { Bzip2 } from "../../rs/compression/Bzip2";
import { Gzip } from "../../rs/compression/Gzip";
import { BasTypeLoader } from "../../rs/config/bastype/BasTypeLoader";
import { LocModelLoader } from "../../rs/config/loctype/LocModelLoader";
import { LocTypeLoader } from "../../rs/config/loctype/LocTypeLoader";
import { NpcModelLoader } from "../../rs/config/npctype/NpcModelLoader";
import { NpcTypeLoader } from "../../rs/config/npctype/NpcTypeLoader";
import { ObjModelLoader } from "../../rs/config/objtype/ObjModelLoader";
import { ObjTypeLoader } from "../../rs/config/objtype/ObjTypeLoader";
import { SeqTypeLoader } from "../../rs/config/seqtype/SeqTypeLoader";
import { VarManager } from "../../rs/config/vartype/VarManager";
import { SeqFrameLoader } from "../../rs/model/seq/SeqFrameLoader";
import { SkeletalSeqLoader } from "../../rs/model/skeletal/SkeletalSeqLoader";
import { SceneBuilder } from "../../rs/scene/SceneBuilder";
import { TextureLoader } from "../../rs/texture/TextureLoader";
import { Hasher } from "../../util/Hasher";
import { EntityAnimData, EntityAnimRequest, EntityModelLoader } from "../../live/EntityModelLoader";
import { LoadedCache } from "../Caches";
import { RenderDataLoaderName, getRenderDataLoader } from "./RenderDataLoader";
import { transferableBuffers } from "./TransferBuffers";
import { RpcRequest, RpcResponse, Transfer } from "./WorkerRpc";

const compressionPromise = Promise.all([Bzip2.initWasm(), Gzip.initWasm()]);
const hasherPromise = Hasher.init();

export type WorkerState = {
    cache: LoadedCache;
    cacheSystem: CacheSystem;
    cacheLoaderFactory: CacheLoaderFactory;

    locTypeLoader: LocTypeLoader;
    objTypeLoader: ObjTypeLoader;
    npcTypeLoader: NpcTypeLoader;

    seqTypeLoader: SeqTypeLoader;
    basTypeLoader: BasTypeLoader;

    textureLoader: TextureLoader;
    seqFrameLoader: SeqFrameLoader;
    skeletalSeqLoader: SkeletalSeqLoader | undefined;

    locModelLoader: LocModelLoader;
    objModelLoader: ObjModelLoader;
    npcModelLoader: NpcModelLoader;

    sceneBuilder: SceneBuilder;

    varManager: VarManager;

    // Live entities (players, npcs, spotanims); undefined for caches the live layer can't build.
    entityModelLoader: EntityModelLoader | undefined;
    textureIdIndexMap: Map<number, number>;
};

let workerStatePromise: Promise<WorkerState> | undefined;

async function initWorker(cache: LoadedCache): Promise<WorkerState> {
    await compressionPromise;
    await hasherPromise;

    const cacheSystem = CacheSystem.fromFiles(cache.type, cache.files);

    const loaderFactory = getCacheLoaderFactory(cache.info, cacheSystem);
    const underlayTypeLoader = loaderFactory.getUnderlayTypeLoader();
    const overlayTypeLoader = loaderFactory.getOverlayTypeLoader();

    const varBitTypeLoader = loaderFactory.getVarBitTypeLoader();

    const locTypeLoader = loaderFactory.getLocTypeLoader();
    const objTypeLoader = loaderFactory.getObjTypeLoader();
    const npcTypeLoader = loaderFactory.getNpcTypeLoader();

    const basTypeLoader = loaderFactory.getBasTypeLoader();

    const modelLoader = loaderFactory.getModelLoader();
    const textureLoader = loaderFactory.getTextureLoader();

    const seqTypeLoader = loaderFactory.getSeqTypeLoader();
    const seqFrameLoader = loaderFactory.getSeqFrameLoader();
    const skeletalSeqLoader = loaderFactory.getSkeletalSeqLoader();

    const mapFileLoader = loaderFactory.getMapFileLoader();

    const varManager = new VarManager(varBitTypeLoader);
    const questTypeLoader = loaderFactory.getQuestTypeLoader();
    if (questTypeLoader) {
        varManager.setQuestsCompleted(questTypeLoader);
    }

    const locModelLoader = new LocModelLoader(
        locTypeLoader,
        modelLoader,
        textureLoader,
        seqTypeLoader,
        seqFrameLoader,
        skeletalSeqLoader,
    );

    const objModelLoader = new ObjModelLoader(objTypeLoader, modelLoader, textureLoader);

    const npcModelLoader = new NpcModelLoader(
        npcTypeLoader,
        modelLoader,
        textureLoader,
        seqTypeLoader,
        seqFrameLoader,
        skeletalSeqLoader,
        varManager,
    );

    const sceneBuilder = new SceneBuilder(
        cache.info,
        mapFileLoader,
        underlayTypeLoader,
        overlayTypeLoader,
        locTypeLoader,
        locModelLoader,
        cache.xteas,
    );

    let entityModelLoader: EntityModelLoader | undefined;
    if (loaderFactory.getIdkTypeLoader && loaderFactory.getSpotAnimTypeLoader) {
        entityModelLoader = new EntityModelLoader(
            npcTypeLoader,
            objTypeLoader,
            loaderFactory.getIdkTypeLoader(),
            loaderFactory.getSpotAnimTypeLoader(),
            seqTypeLoader,
            modelLoader,
            textureLoader,
            new NpcModelLoader(
                npcTypeLoader,
                modelLoader,
                textureLoader,
                seqTypeLoader,
                seqFrameLoader,
                skeletalSeqLoader,
                varManager,
            ),
        );
    }

    // Same texture layout as SdMapDataLoader / the renderer's texture array.
    const textureIds = textureLoader
        .getTextureIds()
        .filter((id) => textureLoader.isSd(id))
        .slice(0, 2047);
    const textureIdIndexMap = new Map<number, number>();
    for (let i = 0; i < textureIds.length; i++) {
        textureIdIndexMap.set(textureIds[i], i);
    }

    return {
        cache,
        cacheSystem,
        cacheLoaderFactory: loaderFactory,

        locTypeLoader,
        objTypeLoader,
        npcTypeLoader,

        seqTypeLoader,
        basTypeLoader,

        textureLoader,
        seqFrameLoader,
        skeletalSeqLoader,

        locModelLoader,
        objModelLoader,
        npcModelLoader,

        sceneBuilder,

        varManager,

        entityModelLoader,
        textureIdIndexMap,
    };
}

function clearCache(workerState: WorkerState): void {
    workerState.locModelLoader.clearCache();
    workerState.objModelLoader.clearCache();
    workerState.npcModelLoader.clearCache();
    workerState.seqFrameLoader.clearCache();
    workerState.skeletalSeqLoader?.clearCache();
}

async function getWorkerState(): Promise<WorkerState> {
    const workerState = await workerStatePromise;
    if (!workerState) {
        throw new Error("Worker not initialized");
    }
    return workerState;
}

const api = {
    initCache(cache: LoadedCache): void {
        const started = performance.now();
        workerStatePromise = initWorker(cache);
        void workerStatePromise.then(() =>
            console.info(`[world] worker ready in ${Math.round(performance.now() - started)} ms`),
        );
    },
    initDataLoader(name: RenderDataLoaderName): void {
        getRenderDataLoader(name).init();
    },
    resetDataLoader(name: RenderDataLoaderName): void {
        getRenderDataLoader(name).reset();
    },
    async load(name: RenderDataLoaderName, input: unknown): Promise<Transfer<unknown> | undefined> {
        const workerState = await getWorkerState();
        const { data, transferables } = await getRenderDataLoader(name).load(workerState, input);

        clearCache(workerState);

        if (!data) {
            return undefined;
        }
        return new Transfer(data, transferables);
    },
    async loadEntityAnim(
        request: EntityAnimRequest,
    ): Promise<Transfer<EntityAnimData> | undefined> {
        const workerState = await getWorkerState();
        const loader = workerState.entityModelLoader;
        if (!loader) {
            return undefined;
        }
        const data = loader.bake(request, workerState.textureIdIndexMap);
        workerState.seqFrameLoader.clearCache();
        if (loader.bodyCache.size > 512) {
            loader.clearCache();
        }
        return new Transfer(data, [data.vertices.buffer, data.indices.buffer]);
    },
    async setVars(values: Int32Array): Promise<void> {
        const workerState = await getWorkerState();
        workerState.varManager.set(values);
    },
};

export type RenderDataWorkerApi = typeof api;

// The worker global, typed by hand: the package compiles against the DOM lib only.
const scope = self as unknown as {
    onmessage: ((e: MessageEvent<RpcRequest>) => void) | null;
    postMessage(message: RpcResponse, transfer?: Transferable[]): void;
};

scope.onmessage = async (e) => {
    const { id, method, args } = e.data;
    try {
        const fn = api[method as keyof RenderDataWorkerApi] as (...a: unknown[]) => unknown;
        if (typeof fn !== "function") throw new Error("Unknown worker method: " + method);
        const result = await fn(...args);
        if (result instanceof Transfer) {
            scope.postMessage(
                { id, ok: true, value: result.value },
                transferableBuffers(result.transferables as ArrayBufferLike[]),
            );
        } else {
            scope.postMessage({ id, ok: true, value: result });
        }
    } catch (error) {
        scope.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
};
