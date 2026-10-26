import bzip2 from "bzip2";

// Pure JS. The wasm build rs-dash also carried (@foxglove/wasm-bz2) loads its module with
// require(), which needed a bundler fs shim; one implementation serves the page, the worker and
// headless scripts alike.
export class Bzip2 {
    static bzip2Header = new Uint8Array("BZh1".split("").map((char) => char.charCodeAt(0)));

    static async initWasm(): Promise<void> {}

    static decompress(compressed: Uint8Array, actualSize: number): Int8Array {
        const compressedBzip = new Uint8Array(compressed.length + 4);
        compressedBzip.set(Bzip2.bzip2Header, 0);
        compressedBzip.set(compressed, 4);
        const decompressed: Uint8Array = bzip2.simple(bzip2.array(compressedBzip));
        return new Int8Array(decompressed.buffer, decompressed.byteOffset, actualSize);
    }
}
