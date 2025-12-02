import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class PreloadScene {
  private overlay: HTMLElement | null = null;
  private progressBarElement: HTMLElement | null = null;
  private loadingManager: THREE.LoadingManager;
  private assets: { [key: string]: any } = {};
  private onComplete: (assets: any) => void;
  private assetsLoaded: boolean = false;

  constructor(onComplete: (assets: any) => void) {
    this.onComplete = onComplete;
    this.loadingManager = new THREE.LoadingManager();
  }

  public start(): void {
    this.createStudioBranding();
    this.loadAssets();
  }

  private loadAssets(): void {
    const gltfLoader = new GLTFLoader(this.loadingManager);

    // Setup loading progress listeners
    this.loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
      const progress = itemsLoaded / itemsTotal;
      this.updateProgressBar(progress);
    };

    this.loadingManager.onLoad = () => {
      console.log("✅ Todos los assets cargados al 100%");
      this.assetsLoaded = true;
      this.updateProgressBar(1);
      this.showStudioText();
    };

    this.loadingManager.onError = (url) => {
      console.warn("⚠️ Error cargando archivo:", url);
    };

    // Load WebFont script manually
    this.loadWebFont();

    // --- GLB MODELS ---
    const models = {
      map: "https://g3-remix-bucket.s3.eu-north-1.amazonaws.com/map.glb",
      pigeon:
        "https://g3-remix-bucket.s3.eu-north-1.amazonaws.com/animated_bird_pigeon.glb",
      flamingo:
        "https://g3-remix-bucket.s3.eu-north-1.amazonaws.com/flying_flamingo.glb",
      donut: "https://g3-remix-bucket.s3.eu-north-1.amazonaws.com/donut.glb",
    };

    for (const [key, url] of Object.entries(models)) {
      gltfLoader.load(url, (gltf) => {
        this.assets[key] = gltf;
      });
    }

    // --- AUDIO (Pre-fetch to cache) ---
    // We just fetch them so they are in browser cache
    const audioUrls = [
      "https://remix.gg/blob/fb09d2b3-365a-4008-a339-895b07e1fcb8/ding-65Fby49xt1IWgfqbAptxlYM0EpgwSx.mp3?mo7R",
      "https://remix.gg/blob/fb09d2b3-365a-4008-a339-895b07e1fcb8/wind-hV7dAD5Sv2fVqKFhSEX7rdgcnLnVFh.mp3?WvSR",
      "https://remix.gg/blob/fb09d2b3-365a-4008-a339-895b07e1fcb8/music1-3Qi9aRaEBUzcg1z8HaLMBWkOddhPFo.mp3?iB5y",
      "https://remix.gg/blob/fb09d2b3-365a-4008-a339-895b07e1fcb8/music2-4plbvbDdRUTrPDc0k2qhKYfs7zMExi.mp3?AyFb",
      "https://remix.gg/blob/fb09d2b3-365a-4008-a339-895b07e1fcb8/music3-xIkd3wjbGPWBMZ774DE8We2lzXyBo2.mp3?xIFL",
    ];

    // We don't block the loading manager for audio fetch, but we could if we wanted to be strict.
    // For now, let's just fire and forget, or use a simple fetch.
    // To make the progress bar reflect audio, we can use a FileLoader for them, but AudioManager uses HTMLAudioElement.
    // Let's just stick to GLBs for the progress bar as they are the heavy ones.
  }

  private loadWebFont(): void {
    const script = document.createElement("script");
    script.src =
      "https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js";
    script.async = true;
    document.head.appendChild(script);
  }

  private createStudioBranding(): void {
    const overlay = document.createElement("div");
    overlay.id = "studio-overlay";
    overlay.style.cssText = `
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #000000;
      z-index: 9999;
      pointer-events: all;
    `;

    const studioText = document.createElement("div");
    studioText.id = "studio-text";
    studioText.style.cssText = `
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: "Pixelify Sans", "Press Start 2P", system-ui, monospace;
      font-weight: 700;
      color: #ffffff;
      text-shadow: 3px 3px 0 #000;
      gap: 6px;
      opacity: 0;
      transform: translateY(8px) scale(0.98);
      transition: opacity 700ms ease, transform 500ms cubic-bezier(0.2, 0.6, 0.2, 1);
      min-height: 80px;
      width: 100%;
    `;

    const brandMain = document.createElement("div");
    brandMain.style.cssText = `
      font-size: 24px;
      letter-spacing: 3px;
      line-height: 1;
      color: #ffffff;
      position: relative;
      text-shadow: 2px 0 #000, -2px 0 #000, 0 2px #000, 0 -2px #000,
        2px 2px #000, -2px 2px #000, 2px -2px #000, -2px -2px #000,
        3px 3px 0 #000;
      margin-bottom: 8px;
    `;
    brandMain.textContent = "HELLBOUND";

    const progressContainer = document.createElement("div");
    progressContainer.style.cssText = `
      width: 200px;
      height: 20px;
      border: 3px solid #000000;
      border-radius: 12px;
      margin: 12px auto;
      display: block;
      position: relative;
      box-sizing: border-box;
      background: #1a1a1a;
      overflow: hidden;
      box-shadow: 
        inset 0 2px 4px rgba(0, 0, 0, 0.5),
        0 0 8px rgba(183, 255, 0, 0.3);
    `;

    const greenLine = document.createElement("div");
    greenLine.style.cssText = `
      width: 0%;
      height: 100%;
      background: linear-gradient(to bottom, 
        #b7ff00 0%, 
        #a0e600 30%,
        #8fcc00 50%,
        #a0e600 70%,
        #b7ff00 100%
      );
      border-radius: 9px;
      transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      box-shadow: 
        0 0 10px rgba(183, 255, 0, 0.6),
        inset 0 1px 0 rgba(255, 255, 255, 0.3);
    `;

    progressContainer.appendChild(greenLine);
    this.progressBarElement = greenLine;

    const brandSub = document.createElement("div");
    brandSub.style.cssText = `
      font-size: 14px;
      letter-spacing: 4px;
      color: #b7ff00;
      text-shadow: 3px 3px 0 #000, 0 0 10px rgba(183, 255, 0, 0.3);
      line-height: 1;
    `;
    brandSub.textContent = "STUDIOS";

    const brandTm = document.createElement("span");
    brandTm.style.cssText = `
      position: absolute;
      top: -6px;
      right: -16px;
      font-size: 9px;
      color: #ffffff;
      text-shadow: 2px 2px 0 #000;
      opacity: 0.9;
    `;
    brandTm.textContent = "™";

    brandMain.appendChild(brandTm);
    studioText.appendChild(brandMain);
    studioText.appendChild(progressContainer);
    studioText.appendChild(brandSub);
    overlay.appendChild(studioText);

    document.body.appendChild(overlay);

    this.overlay = overlay;
    (this as any).studioText = studioText;
  }

  private showStudioText(): void {
    const studioText = (this as any).studioText;

    if (!studioText) {
      this.transitionToGame();
      return;
    }

    studioText.style.opacity = "1";
    studioText.style.transform = "translateY(0) scale(1)";

    this.waitForAssetsAndTransition();
  }

  private waitForAssetsAndTransition(): void {
    const minDisplayTime = 2000;
    const startTime = Date.now();

    const ensureFontsLoaded = (): Promise<void> => {
      return new Promise((resolve) => {
        const onWebFontReady = () => {
          const wf = (window as any).WebFont;
          if (!wf || !wf.load) {
            if ((document as any).fonts?.ready) {
              (document as any).fonts.ready
                .then(() => resolve())
                .catch(() => resolve());
            } else {
              resolve();
            }
            return;
          }

          wf.load({
            google: {
              families: ["Fredoka:700"],
            },
            active: () => resolve(),
            inactive: () => resolve(),
          });
        };

        const checkInterval = setInterval(() => {
          if ((window as any).WebFont) {
            clearInterval(checkInterval);
            onWebFontReady();
          }
        }, 50);

        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 3000);
      });
    };

    const checkAndTransition = () => {
      const elapsedTime = Date.now() - startTime;

      if (this.assetsLoaded && elapsedTime >= minDisplayTime) {
        ensureFontsLoaded().then(() => {
          const studioText = (this as any).studioText;
          if (studioText) {
            studioText.style.opacity = "0";
            studioText.style.transform = "translateY(8px) scale(0.98)";
          }

          setTimeout(() => {
            this.transitionToGame();
          }, 600);
        });
      } else {
        setTimeout(checkAndTransition, 100);
      }
    };

    checkAndTransition();
  }

  private updateProgressBar(progress: number): void {
    if (this.progressBarElement) {
      const percentage = Math.round(progress * 100);
      this.progressBarElement.style.width = `${percentage}%`;
    }
  }

  private transitionToGame(): void {
    if (this.overlay && this.overlay.parentElement) {
      this.overlay.parentElement.removeChild(this.overlay);
    }
    this.onComplete(this.assets);
  }
}
