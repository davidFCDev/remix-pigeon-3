import GameSettings from "./config/GameSettings";
import { MainScene } from "./scenes/MainScene";
import { PreloadScene } from "./scenes/PreloadScene";

// SDK mock is automatically initialized by the framework (dev-init.ts)

// Estilo para el contenedor del canvas
const style = document.createElement("style");
style.textContent = `
  #game-container {
    width: ${GameSettings.canvas.width}px;
    height: ${GameSettings.canvas.height}px;
    margin: 0 auto;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  #game-container canvas {
    outline: none;
  }
`;
document.head.appendChild(style);

// Crear contenedor del juego
const gameContainer = document.createElement("div");
gameContainer.id = "game-container";
document.body.appendChild(gameContainer);

// Iniciar Preloader y luego el juego
const preloadScene = new PreloadScene((assets) => {
  // Crear la escena principal con los assets cargados
  const mainScene = new MainScene(assets);

  // Añadir el canvas de Three.js al contenedor
  gameContainer.appendChild(mainScene.getRendererElement());

  // Almacenar globalmente para HMR cleanup
  (window as any).mainScene = mainScene;
});

preloadScene.start();

// Cleanup para Hot Module Replacement
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if ((window as any).mainScene) {
      (window as any).mainScene.destroy();
    }
    gameContainer.remove();
    const overlay = document.getElementById("studio-overlay");
    if (overlay) overlay.remove();
  });
}
