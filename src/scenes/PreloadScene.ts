/**
 * PreloadScene - Pantalla de carga minimalista con sprite animado
 * Carga los assets esenciales (modelos 3D y audio) antes de iniciar el juego
 */
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class PreloadScene {
  private onComplete: (assets: any) => void;
  private container: HTMLDivElement | null = null;
  private sprite: HTMLDivElement | null = null;
  private frameIndex: number = 0;
  private totalFrames: number = 18;
  private frameWidth: number = 241;
  private frameHeight: number = 345;
  private fps: number = 12;
  private animationInterval: any = null;
  private assets: any = {};
  private loader: GLTFLoader;
  private assetsLoaded: boolean = false;
  private animationComplete: boolean = false;

  // URL del sprite (mismo que en PreloadSceneBase)
  private readonly SPRITE_URL =
    "https://remix.gg/blob/13e738d9-e135-454e-9d2a-e456476a0c5e/sprite-start-oVCq0bchsVLwbLqAPbLgVOrQqxcVh5.webp?Cbzd";

  // URL de la primera canción (precargamos solo esta)
  private readonly MUSIC_TRACK1_URL =
    "https://remix.gg/blob/fb09d2b3-365a-4008-a339-895b07e1fcb8/music1-3Qi9aRaEBUzcg1z8HaLMBWkOddhPFo.mp3?iB5y";

  // Modelos 3D esenciales (URLs remotas)
  private readonly MODELS = {
    map: "https://remix.gg/blob/fb09d2b3-365a-4008-a339-895b07e1fcb8/map-oXzgPQilN7-5ANGhlWdRCMadhlpLLfBXO9ER27Qhv.glb?vS75",
    pigeon:
      "https://remix.gg/blob/fb09d2b3-365a-4008-a339-895b07e1fcb8/animated_bird_pigeon-ChFuZzZ1CnyHJ3wlXAI98BTDsrSuHV.glb?zzMM",
    donut:
      "https://raw.githubusercontent.com/davidFCDev/remix-pigeon-3/main/public/donut.glb",
    flamingo:
      "https://remix.gg/blob/fb09d2b3-365a-4008-a339-895b07e1fcb8/flying_flamingo-OlazB63JqxOUEsaspAV8vLV3ltVT3E.glb?greA",
  };

  constructor(onComplete: (assets: any) => void) {
    this.onComplete = onComplete;
    this.loader = new GLTFLoader();
  }

  public async start() {
    this.createDOM();

    // Iniciar animación del sprite inmediatamente
    this.playAnimation();

    // Cargar recursos esenciales en paralelo
    await this.preloadEssentials();
  }

  private createDOM() {
    // Contenedor principal (Fondo negro)
    this.container = document.createElement("div");
    this.container.id = "preload-container";
    Object.assign(this.container.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      backgroundColor: "#000000",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: "9999",
    });

    // Elemento Sprite
    this.sprite = document.createElement("div");
    this.sprite.id = "preload-sprite";

    // Escala ajustada: 0.65x para un tamaño intermedio
    const scale =
      Math.min(window.innerWidth / 300, window.innerHeight / 400, 1.5) * 0.65;

    Object.assign(this.sprite.style, {
      width: `${this.frameWidth}px`,
      height: `${this.frameHeight}px`,
      backgroundImage: `url("${this.SPRITE_URL}")`,
      backgroundRepeat: "no-repeat",
      backgroundPosition: "0px 0px",
      backgroundSize: `auto ${this.frameHeight}px`,
      transform: `scale(${scale})`,
      transformOrigin: "center center",
    });

    this.container.appendChild(this.sprite);
    document.body.appendChild(this.container);
  }

  private async preloadEssentials(): Promise<void> {
    const promises: Promise<void>[] = [];

    // 0. Precargar fuente Fredoka (importante para móvil)
    const fontPromise = new Promise<void>((resolve) => {
      // Usar Font Loading API si está disponible
      if (document.fonts && document.fonts.load) {
        document.fonts
          .load("bold 48px Fredoka")
          .then(() => {
            console.log("Font Fredoka loaded");
            resolve();
          })
          .catch(() => {
            console.warn("Font Fredoka failed to load via API");
            resolve();
          });
      } else {
        // Fallback: crear elemento temporal para forzar carga
        const testEl = document.createElement("span");
        testEl.style.fontFamily = "Fredoka";
        testEl.style.fontSize = "48px";
        testEl.style.position = "absolute";
        testEl.style.left = "-9999px";
        testEl.textContent = "Font Loading Test";
        document.body.appendChild(testEl);
        setTimeout(() => {
          testEl.remove();
          resolve();
        }, 500);
      }
      // Timeout de seguridad
      setTimeout(resolve, 2000);
    });
    promises.push(fontPromise);

    // 1. Precargar audio (Track 1)
    const audioPromise = new Promise<void>((resolve) => {
      const audio = new Audio(this.MUSIC_TRACK1_URL);
      audio.preload = "auto";
      const done = () => resolve();
      audio.oncanplaythrough = done;
      audio.onerror = done;
      setTimeout(done, 3000);
      audio.load();
    });
    promises.push(audioPromise);

    // 2. Precargar modelos 3D esenciales
    for (const [key, url] of Object.entries(this.MODELS)) {
      const modelPromise = new Promise<void>((resolve) => {
        this.loader.load(
          url,
          (gltf) => {
            this.assets[key] = gltf;
            console.log(`Loaded: ${key}`);
            resolve();
          },
          undefined,
          (error) => {
            console.error(`Error loading ${key}:`, error);
            resolve(); // Continuar aunque falle
          }
        );
      });
      promises.push(modelPromise);
    }

    // Esperar a que todo termine
    await Promise.all(promises);

    this.assetsLoaded = true;
    this.checkTransition();
  }

  private playAnimation() {
    if (!this.sprite) return;

    // Precargar la imagen del sprite
    const img = new Image();
    img.onload = () => this.runAnimationLoop();
    img.onerror = () => this.runAnimationLoop();
    img.src = this.SPRITE_URL;
  }

  private runAnimationLoop() {
    const frameDuration = 1000 / this.fps;

    this.animationInterval = setInterval(() => {
      if (!this.sprite) return;

      const positionX = -(this.frameIndex * this.frameWidth);
      this.sprite.style.backgroundPosition = `${positionX}px 0px`;

      this.frameIndex++;

      if (this.frameIndex >= this.totalFrames) {
        this.finishAnimation();
      }
    }, frameDuration);
  }

  private finishAnimation() {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }

    // Mantener el último frame visible
    if (this.sprite) {
      const lastFrameX = -((this.totalFrames - 1) * this.frameWidth);
      this.sprite.style.backgroundPosition = `${lastFrameX}px 0px`;
    }

    // Esperar 500ms en el último frame
    setTimeout(() => {
      this.animationComplete = true;
      this.checkTransition();
    }, 500);
  }

  private checkTransition() {
    // Solo transicionar cuando AMBOS estén listos
    if (this.animationComplete && this.assetsLoaded) {
      this.cleanup();
      this.onComplete(this.assets);
    }
  }

  private cleanup() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.sprite = null;
  }
}
