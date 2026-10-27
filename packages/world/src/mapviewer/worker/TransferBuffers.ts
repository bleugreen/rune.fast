export function transferableBuffers(buffers: readonly ArrayBufferLike[]): ArrayBuffer[] {
    // Shared buffers are cloned by reference; listing one (or a duplicate) makes postMessage fail.
    return Array.from(new Set(buffers.filter((buffer): buffer is ArrayBuffer => buffer instanceof ArrayBuffer)));
}
