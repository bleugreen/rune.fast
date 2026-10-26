import pako from "pako";
import init, { decompressGzip } from "wasm-gzip";
import wasmGzipUrl from "wasm-gzip/wasm_gzip_bg.wasm?url";

export class Gzip {
    static wasmLoaded = false;

    static async initWasm(): Promise<void> {
        await init(wasmGzipUrl);
        Gzip.wasmLoaded = true;
        console.info("[world] gzip: wasm-gzip");
    }

    static decompress(compressed: Uint8Array): Int8Array {
        if (!Gzip.wasmLoaded) {
            const decompressed = new Int8Array(pako.ungzip(compressed).buffer);
            return decompressed;
        }
        const decompressed = decompressGzip(compressed);
        if (!decompressed) {
            throw new Error("Failed to decompress gzip");
        }
        return new Int8Array(decompressed.buffer);
    }
}
