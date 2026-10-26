import { vec3 } from "gl-matrix";

import { MenuTargetType } from "../rs/MenuEntry";
import { CacheSystem } from "../rs/cache/CacheSystem";
import { CacheLoaderFactory, getCacheLoaderFactory } from "../rs/cache/loader/CacheLoaderFactory";
import { BasTypeLoader } from "../rs/config/bastype/BasTypeLoader";
import { LocTypeLoader } from "../rs/config/loctype/LocTypeLoader";
import { NpcTypeLoader } from "../rs/config/npctype/NpcTypeLoader";
import { ObjTypeLoader } from "../rs/config/objtype/ObjTypeLoader";
import { SeqTypeLoader } from "../rs/config/seqtype/SeqTypeLoader";
import { VarManager } from "../rs/config/vartype/VarManager";
import { MapFileIndex } from "../rs/map/MapFileIndex";
import { SeqFrameLoader } from "../rs/model/seq/SeqFrameLoader";
import { Pathfinder } from "../rs/pathfinder/Pathfinder";
import { TextureLoader } from "../rs/texture/TextureLoader";
import { isTouchDevice } from "../util/DeviceUtil";
import { FeedFactory } from "../live/FeedSource";
import { LiveController } from "../live/LiveController";
import { LoadedCache } from "./Caches";
import { Camera, CameraView } from "./Camera";
import { InputManager } from "./InputManager";
import { MapViewerRenderer } from "./MapViewerRenderer";
import { OsrsMenuEntry } from "./OsrsMenuEntry";
import { WebGLMapViewerRenderer } from "./webgl/WebGLMapViewerRenderer";
import { RenderDataWorkerPool } from "./worker/RenderDataWorkerPool";

export class MapViewer {
    inputManager: InputManager = new InputManager();
    // Steep enough that the ground fills a landscape pane before any helper is framed.
    camera: Camera = new Camera(3242, -30, 3202, -320, 1862);

    pathfinder: Pathfinder = new Pathfinder();

    renderer: MapViewerRenderer;

    // Cache
    loadedCache!: LoadedCache;
    cacheSystem!: CacheSystem;
    loaderFactory!: CacheLoaderFactory;

    textureLoader!: TextureLoader;
    seqTypeLoader!: SeqTypeLoader;
    seqFrameLoader!: SeqFrameLoader;

    locTypeLoader!: LocTypeLoader;
    objTypeLoader!: ObjTypeLoader;
    npcTypeLoader!: NpcTypeLoader;

    basTypeLoader!: BasTypeLoader;

    varManager!: VarManager;

    mapFileIndex!: MapFileIndex;

    isNewTextureAnim: boolean = false;

    // Settings

    // Tile distance. Follows the zoom: the renderer sets it every frame.
    renderDistance: number = 128;
    // Map square distance
    unloadDistance: number = 2;
    // Map square distance
    lodDistance: number = 3;

    tooltips: boolean = !isTouchDevice;

    // State
    menuOpen: boolean = false;
    menuOpenedFrame: number = 0;
    menuX: number = -1;
    menuY: number = -1;
    menuEntries: OsrsMenuEntry[] = [];

    debugText?: string;

    cameraSpeed: number = 1;

    // Attached by startLive; the viewer draws no entities without it.
    live?: LiveController;

    constructor(
        readonly workerPool: RenderDataWorkerPool,
        cache: LoadedCache,
    ) {
        this.renderer = new WebGLMapViewerRenderer(this);
        this.initCache(cache);
    }

    disposed = false;

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.live?.stop();
        void this.workerPool.terminate();
    }

    initCache(cache: LoadedCache): void {
        this.loadedCache = cache;
        this.cacheSystem = CacheSystem.fromFiles(cache.type, cache.files);
        this.loaderFactory = getCacheLoaderFactory(cache.info, this.cacheSystem);
        this.workerPool.initCache(cache);

        this.textureLoader = this.loaderFactory.getTextureLoader();
        this.seqTypeLoader = this.loaderFactory.getSeqTypeLoader();
        this.seqFrameLoader = this.loaderFactory.getSeqFrameLoader();
        this.locTypeLoader = this.loaderFactory.getLocTypeLoader();
        this.objTypeLoader = this.loaderFactory.getObjTypeLoader();
        this.npcTypeLoader = this.loaderFactory.getNpcTypeLoader();
        this.basTypeLoader = this.loaderFactory.getBasTypeLoader();

        this.varManager = new VarManager(this.loaderFactory.getVarBitTypeLoader());
        const questTypeLoader = this.loaderFactory.getQuestTypeLoader();
        if (questTypeLoader) {
            this.varManager.setQuestsCompleted(questTypeLoader);
        }

        const mapFileLoader = this.loaderFactory.getMapFileLoader();
        this.mapFileIndex = mapFileLoader.mapFileIndex;

        this.isNewTextureAnim = cache.info.game === "runescape" && cache.info.revision >= 681;

        this.renderer.initCache();

        // Static NPCs must not impersonate observed ones: entities come only from a feed.
        this.renderer.setLoadNpcs?.(false);
    }

    // Attaches a live layer reading from `feed`. Needs the player kits and spotanims only the
    // pre-dat2 (rs-sdk) caches provide.
    startLive(feed: FeedFactory): LiveController {
        this.live?.stop();
        if (!this.loaderFactory.getIdkTypeLoader) {
            throw new Error("The live layer needs an rs-sdk cache");
        }
        this.live = new LiveController(
            feed,
            this.npcTypeLoader,
            this.seqTypeLoader,
            this.seqFrameLoader,
            this.loaderFactory.getSpotAnimTypeLoader?.(),
            this.loadedCache.info.revision,
        );
        this.live.hitmarkSprites = this.loaderFactory.getHitmarkSprites?.() ?? [];
        return this.live;
    }

    /**
     * Sets the camera position to a new arbitrary position
     * @param newView Any of the items you want to move: Position, pitch, yaw
     */
    setCamera(newView: Partial<CameraView>): void {
        if (newView.position) {
            vec3.copy(this.camera.pos, newView.position);
        }
        if (newView.pitch !== undefined) {
            this.camera.pitch = newView.pitch;
        }
        if (newView.yaw !== undefined) {
            this.camera.yaw = newView.yaw;
        }
        if (newView.fov !== undefined) {
            this.camera.fov = newView.fov;
        }
        if (newView.orthoZoom !== undefined) {
            this.camera.orthoZoom = newView.orthoZoom;
        }
        this.camera.updated = true;
    }

    closeMenu = () => {
        this.menuOpen = false;
        this.menuX = -1;
        this.menuY = -1;
        this.renderer.canvas.focus();
    };

    resetMenu = () => {
        this.closeMenu();
        this.menuOpenedFrame = 0;
    };

    onExamine = (entry: OsrsMenuEntry) => {
        let lookupType: string | undefined;
        switch (entry.targetType) {
            case MenuTargetType.NPC:
                lookupType = "npc";
                break;
            case MenuTargetType.LOC:
                lookupType = "object";
                break;
            case MenuTargetType.OBJ:
                lookupType = "item";
                break;
        }
        if (lookupType) {
            window.open(
                `https://oldschool.runescape.wiki/w/Special:Lookup?type=${lookupType}&id=${entry.targetId}`,
                "_blank",
            );
        }
        this.closeMenu();
    };

    updateVars(): void {
        this.workerPool.setVars(this.varManager.values);
    }
}
