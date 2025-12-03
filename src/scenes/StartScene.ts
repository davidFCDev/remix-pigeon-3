/**
 * StartScene - Pantalla de inicio del juego
 * Se muestra después del PreloadScene y antes de MainScene
 */
export class StartScene {
  private overlay: HTMLElement | null = null;
  private onStart: () => void;

  constructor(onStart: () => void) {
    this.onStart = onStart;
  }

  public show(): void {
    this.createStartScreen();
  }

  private createStartScreen(): void {
    // Crear overlay principal
    const overlay = document.createElement("div");
    overlay.id = "start-overlay";
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding-top: 30px;
      background-image: url('https://remix.gg/blob/fb09d2b3-365a-4008-a339-895b07e1fcb8/birdgame-MEWRiHFC5bAwzYbzaQhH4ZJUdqGFEK.webp?q415');
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      z-index: 9999;
    `;

    // Capa de oscurecimiento sutil para mejor legibilidad
    const darkOverlay = document.createElement("div");
    darkOverlay.style.cssText = `
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.3);
    `;
    overlay.appendChild(darkOverlay);

    // Contenedor del contenido (sobre el darkOverlay)
    const content = document.createElement("div");
    content.style.cssText = `
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      width: 100%;
      padding-bottom: 30px;
    `;

    // Título del juego
    const titleContainer = document.createElement("div");
    titleContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 15px;
    `;

    // Columna 1: BIRD y GAME
    const textColumn = document.createElement("div");
    textColumn.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0;
    `;

    const birdText = document.createElement("div");
    birdText.textContent = "BIRD";
    birdText.style.cssText = `
      font-family: 'Fredoka', 'Comic Sans MS', cursive;
      font-size: 64px;
      font-weight: bold;
      color: #ffffff;
      text-shadow: 
        4px 4px 0 #000,
        -2px -2px 0 #000,
        2px -2px 0 #000,
        -2px 2px 0 #000,
        0 0 20px rgba(255, 200, 0, 0.5);
      line-height: 0.9;
      letter-spacing: 4px;
    `;

    const gameText = document.createElement("div");
    gameText.textContent = "GAME";
    gameText.style.cssText = `
      font-family: 'Fredoka', 'Comic Sans MS', cursive;
      font-size: 64px;
      font-weight: bold;
      color: #ffffff;
      text-shadow: 
        4px 4px 0 #000,
        -2px -2px 0 #000,
        2px -2px 0 #000,
        -2px 2px 0 #000,
        0 0 20px rgba(255, 200, 0, 0.5);
      line-height: 0.9;
      letter-spacing: 4px;
    `;

    textColumn.appendChild(birdText);
    textColumn.appendChild(gameText);

    // Columna 2: El número 3 grande
    const numberThree = document.createElement("div");
    numberThree.textContent = "3";
    numberThree.style.cssText = `
      font-family: 'Fredoka', 'Comic Sans MS', cursive;
      font-size: 140px;
      font-weight: bold;
      color: #ffcc00;
      text-shadow: 
        5px 5px 0 #000,
        -2px -2px 0 #000,
        2px -2px 0 #000,
        -2px 2px 0 #000,
        0 0 30px rgba(255, 200, 0, 0.7);
      line-height: 0.8;
    `;

    titleContainer.appendChild(textColumn);
    titleContainer.appendChild(numberThree);

    // Botón de Start
    const startButton = document.createElement("button");
    startButton.textContent = "FLY";
    startButton.style.cssText = `
      font-family: 'Fredoka', 'Comic Sans MS', cursive;
      font-size: 36px;
      font-weight: bold;
      color: #ffffff;
      background: linear-gradient(180deg, #44bb44 0%, #228822 100%);
      border: 4px solid #000;
      border-radius: 15px;
      padding: 10px 60px;
      cursor: pointer;
      text-shadow: 
        2px 2px 0 #000,
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000;
      box-shadow: 
        0 6px 0 #115511,
        0 8px 10px rgba(0, 0, 0, 0.4);
      transition: all 0.1s ease;
      outline: none;
    `;

    // Efectos hover y active
    startButton.onmouseenter = () => {
      startButton.style.transform = "translateY(-2px)";
      startButton.style.boxShadow = `
        0 8px 0 #115511,
        0 10px 15px rgba(0, 0, 0, 0.4)
      `;
    };

    startButton.onmouseleave = () => {
      startButton.style.transform = "translateY(0)";
      startButton.style.boxShadow = `
        0 6px 0 #115511,
        0 8px 10px rgba(0, 0, 0, 0.4)
      `;
    };

    startButton.onmousedown = () => {
      startButton.style.transform = "translateY(4px)";
      startButton.style.boxShadow = `
        0 2px 0 #115511,
        0 4px 5px rgba(0, 0, 0, 0.4)
      `;
    };

    startButton.onmouseup = () => {
      startButton.style.transform = "translateY(-2px)";
      startButton.style.boxShadow = `
        0 8px 0 #115511,
        0 10px 15px rgba(0, 0, 0, 0.4)
      `;
    };

    startButton.onclick = () => {
      this.showInstructionsModal();
    };

    // Contenedor para centrar el botón verticalmente en el espacio restante
    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = `
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    buttonContainer.appendChild(startButton);

    content.appendChild(titleContainer);
    content.appendChild(buttonContainer);
    overlay.appendChild(content);

    document.body.appendChild(overlay);
    this.overlay = overlay;
  }

  private hide(): void {
    if (this.overlay) {
      // Animación de fade out
      this.overlay.style.transition = "opacity 0.5s ease";
      this.overlay.style.opacity = "0";

      setTimeout(() => {
        if (this.overlay && this.overlay.parentElement) {
          this.overlay.remove();
        }
      }, 500);
    }
  }

  private showInstructionsModal(): void {
    // Crear overlay oscuro para el modal
    const modalOverlay = document.createElement("div");
    modalOverlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.95);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 80px;
      z-index: 10000;
      animation: fadeIn 0.3s ease;
    `;

    // Agregar keyframes de animación
    const style = document.createElement("style");
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideIn {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    // Contenedor del modal
    const modal = document.createElement("div");
    modal.style.cssText = `
      background: transparent;
      padding: 30px 40px;
      max-width: 500px;
      width: 90%;
      text-align: center;
      animation: slideIn 0.4s ease;
    `;

    // Lista de instrucciones
    const instructions = [
      { number: "1", text: "Pigeon is hungry, eat donuts!" },
      { number: "2", text: "If the meter empties, game over" },
      { number: "3", text: "Flamingos steal your food" },
      { number: "4", text: "Use power-ups to go faster" },
      { number: "5", text: "Avoid whirlpools, they slow you down" },
    ];

    const instructionsList = document.createElement("div");
    instructionsList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 30px;
    `;

    instructions.forEach((item) => {
      const row = document.createElement("div");
      row.style.cssText = `
        display: flex;
        align-items: center;
        gap: 15px;
        text-align: left;
      `;

      const number = document.createElement("div");
      number.textContent = item.number;
      number.style.cssText = `
        font-family: 'Fredoka', 'Comic Sans MS', cursive;
        font-size: 32px;
        font-weight: bold;
        color: #ffcc00;
        text-shadow: 
          2px 2px 0 #000,
          -1px -1px 0 #000;
        min-width: 40px;
        text-align: center;
      `;

      const text = document.createElement("div");
      text.textContent = item.text;
      text.style.cssText = `
        font-family: 'Fredoka', 'Comic Sans MS', cursive;
        font-size: 20px;
        font-weight: 500;
        color: #ffffff;
        text-shadow: 
          1px 1px 0 #000,
          -1px -1px 0 #000;
      `;

      row.appendChild(number);
      row.appendChild(text);
      instructionsList.appendChild(row);
    });

    // Botón GO
    const goButton = document.createElement("button");
    goButton.textContent = "GO!";
    goButton.style.cssText = `
      font-family: 'Fredoka', 'Comic Sans MS', cursive;
      font-size: 32px;
      font-weight: bold;
      color: #ffffff;
      background: linear-gradient(180deg, #44bb44 0%, #228822 100%);
      border: 4px solid #000;
      border-radius: 15px;
      padding: 10px 80px;
      cursor: pointer;
      text-shadow: 
        2px 2px 0 #000,
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000;
      box-shadow: 
        0 6px 0 #115511,
        0 8px 10px rgba(0, 0, 0, 0.4);
      transition: all 0.1s ease;
      outline: none;
    `;

    // Efectos hover y active para GO
    goButton.onmouseenter = () => {
      goButton.style.transform = "translateY(-2px)";
      goButton.style.boxShadow = `
        0 8px 0 #115511,
        0 10px 15px rgba(0, 0, 0, 0.4)
      `;
    };

    goButton.onmouseleave = () => {
      goButton.style.transform = "translateY(0)";
      goButton.style.boxShadow = `
        0 6px 0 #115511,
        0 8px 10px rgba(0, 0, 0, 0.4)
      `;
    };

    goButton.onmousedown = () => {
      goButton.style.transform = "translateY(4px)";
      goButton.style.boxShadow = `
        0 2px 0 #115511,
        0 4px 5px rgba(0, 0, 0, 0.4)
      `;
    };

    goButton.onmouseup = () => {
      goButton.style.transform = "translateY(-2px)";
      goButton.style.boxShadow = `
        0 8px 0 #115511,
        0 10px 15px rgba(0, 0, 0, 0.4)
      `;
    };

    goButton.onclick = () => {
      modalOverlay.remove();
      this.hide();
      this.onStart();
    };

    modal.appendChild(instructionsList);
    modal.appendChild(goButton);
    modalOverlay.appendChild(modal);
    document.body.appendChild(modalOverlay);
  }
}
