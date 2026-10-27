const hasDom = typeof window !== "undefined" && typeof document !== "undefined";
const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";

export const checkIphone = () => /iPhone/i.test(userAgent);
export const checkAndroid = () => /Android/i.test(userAgent);
export const checkIpad = () => /iPad/i.test(userAgent);
export const checkMobile = () => /Android/i.test(userAgent) || /iPhone/i.test(userAgent);

export function checkIos() {
    // iPad on iOS 13 detection
    const isIpad =
        userAgent.includes("Macintosh") && typeof navigator !== "undefined" && navigator.maxTouchPoints >= 1;
    return /iPad|iPhone|iPod/.test(userAgent) || isIpad;
}

export const isIos = checkIos();
export const isMobileDevice = checkMobile() || isIos;

export const isSharedMemorySupported =
    typeof SharedArrayBuffer !== "undefined" && hasDom && window.crossOriginIsolated === true;

export const isTouchDevice =
    hasDom && !!(navigator.maxTouchPoints || "ontouchstart" in document.documentElement);

export const isWebGL2Supported = hasDom && !!document.createElement("canvas").getContext("webgl2");

export const pixelRatio = hasDom ? window.devicePixelRatio || 1 : 1;
