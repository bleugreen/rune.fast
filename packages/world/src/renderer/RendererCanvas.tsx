import { useEffect, useRef, useState } from "react";

import { Renderer } from "./Renderer";

export interface RendererCanvasProps {
    renderer: Renderer;
}

export function RendererCanvas({ renderer }: RendererCanvasProps): JSX.Element {
    const divRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string>();
    useEffect(() => {
        const container = divRef.current;
        if (!container) return;
        let active = true;
        let stopped = false;
        const stop = () => {
            if (stopped) return;
            stopped = true;
            renderer.stop();
        };
        container.appendChild(renderer.canvas);
        renderer
            .init()
            .then(() => {
                if (active) renderer.start();
            })
            .catch(() => {
                if (!active) return;
                stop();
                setError(
                    "Renderer failed · check WebGL2 and cache",
                );
            });
        return () => {
            active = false;
            stop();
            renderer.canvas.remove();
        };
    }, [renderer]);
    return (
        <div ref={divRef} style={{ width: "100%", height: "100%" }} tabIndex={0}>
            {error && (
                <div role="alert" className="center-container content-text">
                    {error}
                </div>
            )}
        </div>
    );
}
