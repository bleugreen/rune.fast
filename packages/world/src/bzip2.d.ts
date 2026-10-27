declare module "bzip2" {
    const bzip2: {
        array(bytes: Uint8Array): unknown;
        simple(bits: unknown): Uint8Array;
    };
    export default bzip2;
}
