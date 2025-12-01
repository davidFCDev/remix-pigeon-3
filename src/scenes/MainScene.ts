import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import GameSettings from "../config/GameSettings";

/**
 * MainScene - Escena principal del juego de la Paloma 3D
 * Maneja el renderizado 3D, la paloma, el terreno y los controles
 */
export class MainScene {
  // Three.js core
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;

  // Objetos del juego
  private pigeon: THREE.Group; // Contenedor para la paloma
  private ground: THREE.Mesh; // El terreno

  // Animación
  private mixer: THREE.AnimationMixer | null = null;
  private clock: THREE.Clock = new THREE.Clock();

  // Estado del movimiento
  private keys: { [key: string]: boolean } = {};
  private pigeonSpeed: number = 0.4;
  private pigeonRotationSpeed: number = 0.04;

  // Físicas de vuelo
  private verticalVelocity: number = 0;
  private maxVerticalSpeed: number = 0.4;
  private verticalAcceleration: number = 0.015;
  private velocityDamping: number = 0.96; // Fricción del aire

  // Posición y rotación de la paloma
  private pigeonVelocity: THREE.Vector3 = new THREE.Vector3();
  private pigeonDirection: number = 0; // Ángulo de rotación en Y

  // Configuración de la cámara
  private cameraDistance: number = 8;
  private cameraHeight: number = 3;
  private cameraLerpFactor: number = 0.08;

  constructor() {
    // Crear escena
    this.scene = new THREE.Scene();

    // Estilo Cartoon: Cielo azul vibrante
    const skyColor = 0x44aaff;
    this.scene.background = new THREE.Color(skyColor);
    this.scene.fog = new THREE.Fog(skyColor, 100, 900); // Niebla un poco más lejos

    // Crear cámara en perspectiva
    const aspectRatio = GameSettings.canvas.width / GameSettings.canvas.height;
    this.camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);

    // Crear renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(
      GameSettings.canvas.width,
      GameSettings.canvas.height
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Crear elementos del juego
    this.ground = this.createGround();
    this.pigeon = this.createPigeon();

    // Configurar iluminación
    this.setupLighting();

    // Configurar posición inicial de la cámara
    this.updateCamera();

    // Configurar controles de teclado
    this.setupControls();

    // Iniciar loop de animación
    this.animate();
  }

  /**
   * Crea el terreno/superficie del juego con ondulaciones
   */
  private createGround(): THREE.Mesh {
    // Aumentamos el tamaño y los segmentos para tener detalle en las colinas
    const groundGeometry = new THREE.PlaneGeometry(2000, 2000, 128, 128);

    // Generar colinas suaves modificando los vértices
    const positionAttribute = groundGeometry.attributes.position;
    for (let i = 0; i < positionAttribute.count; i++) {
      const x = positionAttribute.getX(i);
      const y = positionAttribute.getY(i); // En PlaneGeometry, Y es la profundidad antes de rotar

      // Fórmula simple de ruido para colinas suaves
      // Combinamos varias ondas seno/coseno con diferentes frecuencias
      const height =
        Math.sin(x * 0.01) * 10 +
        Math.cos(y * 0.01) * 10 +
        Math.sin(x * 0.03 + y * 0.03) * 5;

      positionAttribute.setZ(i, height); // Z es la altura local en PlaneGeometry
    }

    // Recalcular normales para que la luz interactúe correctamente con las colinas
    groundGeometry.computeVertexNormals();

    // Estilo Cartoon: MeshToonMaterial y colores vibrantes
    const groundMaterial = new THREE.MeshToonMaterial({
      color: 0x66dd66, // Verde brillante y saturado
      side: THREE.DoubleSide,
    });

    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2; // Rotar para que sea horizontal
    ground.position.y = -10; // Bajar un poco el terreno base
    ground.receiveShadow = true;

    this.scene.add(ground);
    return ground;
  }

  /**
   * Crea la paloma cargando el modelo animado
   */
  private createPigeon(): THREE.Group {
    const pigeonGroup = new THREE.Group();
    pigeonGroup.position.set(0, 5, 0);

    // 1. Crear un placeholder (esfera) mientras carga el modelo
    const placeholderGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const placeholderMaterial = new THREE.MeshLambertMaterial({
      color: 0x808080,
      transparent: true,
      opacity: 0.5,
    });
    const placeholder = new THREE.Mesh(
      placeholderGeometry,
      placeholderMaterial
    );
    pigeonGroup.add(placeholder);

    // 2. Cargar el modelo GLB animado
    const loader = new GLTFLoader();
    loader.load(
      "/animated_bird_pigeon.glb",
      (gltf) => {
        console.log("Modelo animado cargado correctamente");
        const model = gltf.scene;

        // Configurar sombras
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // Ajustar escala y rotación
        // Ajusta estos valores según cómo venga tu modelo
        model.scale.set(0.5, 0.5, 0.5);
        model.rotation.y = 0; // Corregido: mirar hacia adelante

        // Configurar animaciones
        if (gltf.animations && gltf.animations.length > 0) {
          console.log(`Encontradas ${gltf.animations.length} animaciones`);
          this.mixer = new THREE.AnimationMixer(model);

          // Reproducir la primera animación (normalmente "Fly" o "Idle")
          const action = this.mixer.clipAction(gltf.animations[0]);
          action.play();
        }

        // Reemplazar placeholder
        pigeonGroup.remove(placeholder);
        pigeonGroup.add(model);
      },
      undefined,
      (error) => {
        console.error("Error cargando el modelo animado:", error);
        placeholderMaterial.opacity = 1;
        placeholderMaterial.transparent = false;
      }
    );

    this.scene.add(pigeonGroup);
    return pigeonGroup;
  }

  /**
   * Configura la iluminación de la escena
   */
  private setupLighting(): void {
    // Luz hemisférica con colores cartoon contrastados
    const hemisphereLight = new THREE.HemisphereLight(0x44aaff, 0x66dd66, 0.7);
    this.scene.add(hemisphereLight);

    // Luz direccional (sol)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(100, 200, 100);
    directionalLight.castShadow = true;

    // Mejorar calidad de sombras para el terreno grande
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    const d = 200;
    directionalLight.shadow.camera.left = -d;
    directionalLight.shadow.camera.right = d;
    directionalLight.shadow.camera.top = d;
    directionalLight.shadow.camera.bottom = -d;
    directionalLight.shadow.camera.far = 1000;

    this.scene.add(directionalLight);
  }

  /**
   * Configura los controles de teclado
   */
  private setupControls(): void {
    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });
  }

  /**
   * Actualiza la posición de la cámara para seguir a la paloma desde atrás
   */
  private updateCamera(): void {
    // Calcular posición deseada de la cámara (detrás de la paloma)
    const targetCameraX =
      this.pigeon.position.x -
      Math.sin(this.pigeonDirection) * this.cameraDistance;
    const targetCameraZ =
      this.pigeon.position.z -
      Math.cos(this.pigeonDirection) * this.cameraDistance;
    const targetCameraY = this.pigeon.position.y + this.cameraHeight;

    // Interpolar suavemente hacia la posición deseada
    this.camera.position.x +=
      (targetCameraX - this.camera.position.x) * this.cameraLerpFactor;
    this.camera.position.y +=
      (targetCameraY - this.camera.position.y) * this.cameraLerpFactor;
    this.camera.position.z +=
      (targetCameraZ - this.camera.position.z) * this.cameraLerpFactor;

    // Mirar hacia la paloma
    this.camera.lookAt(this.pigeon.position);
  }

  /**
   * Procesa los controles de movimiento
   */
  private handleMovement(): void {
    // Rotación (A/D o Flechas izquierda/derecha)
    if (this.keys["KeyA"] || this.keys["ArrowLeft"]) {
      this.pigeonDirection += this.pigeonRotationSpeed;
    }
    if (this.keys["KeyD"] || this.keys["ArrowRight"]) {
      this.pigeonDirection -= this.pigeonRotationSpeed;
    }

    // Aplicar rotación a la paloma
    this.pigeon.rotation.y = this.pigeonDirection;

    // Movimiento adelante/atrás (W/S o Flechas arriba/abajo)
    let moveForward = 0;
    if (this.keys["KeyW"] || this.keys["ArrowUp"]) {
      moveForward = 1;
    }
    if (this.keys["KeyS"] || this.keys["ArrowDown"]) {
      moveForward = -1;
    }

    // Movimiento vertical (espacio para subir, shift para bajar) con inercia
    if (this.keys["Space"]) {
      this.verticalVelocity += this.verticalAcceleration;
    } else if (this.keys["ShiftLeft"] || this.keys["ShiftRight"]) {
      this.verticalVelocity -= this.verticalAcceleration;
    }

    // Aplicar fricción/damping para suavizar
    this.verticalVelocity *= this.velocityDamping;

    // Limitar velocidad vertical máxima
    this.verticalVelocity = Math.max(
      Math.min(this.verticalVelocity, this.maxVerticalSpeed),
      -this.maxVerticalSpeed
    );

    // Calcular y aplicar movimiento horizontal
    if (moveForward !== 0) {
      this.pigeon.position.x +=
        Math.sin(this.pigeonDirection) * this.pigeonSpeed * moveForward;
      this.pigeon.position.z +=
        Math.cos(this.pigeonDirection) * this.pigeonSpeed * moveForward;
    }

    // Aplicar movimiento vertical
    this.pigeon.position.y += this.verticalVelocity;

    // Inclinación visual (pitch) basada en la velocidad vertical
    // Si sube, el pico apunta arriba; si baja, apunta abajo
    const targetPitch = -this.verticalVelocity * 1.5;
    this.pigeon.rotation.x = targetPitch;

    // Actualizar animaciones del modelo si existen
    if (this.mixer) {
      const delta = this.clock.getDelta();
      this.mixer.update(delta);

      // Opcional: Modificar velocidad de animación según si sube o baja
      // Si sube rápido, animar más rápido
      const baseSpeed = 1.0;
      const speedMultiplier =
        1.0 + (this.verticalVelocity > 0 ? this.verticalVelocity * 2 : 0);
      this.mixer.timeScale = baseSpeed * speedMultiplier;
    }

    // Limitar altura mínima (suelo aproximado)
    // Nota: Idealmente calcularíamos la altura del terreno en (x,z)
    if (this.pigeon.position.y < 2) {
      this.pigeon.position.y = 2;
      this.verticalVelocity = 0;
    }
  }

  /**
   * Loop principal de animación
   */
  private animate = (): void => {
    requestAnimationFrame(this.animate);

    // Procesar movimiento
    this.handleMovement();

    // Actualizar cámara
    this.updateCamera();

    // Renderizar escena
    this.renderer.render(this.scene, this.camera);
  };

  /**
   * Obtiene el elemento DOM del renderer para añadirlo al documento
   */
  public getRendererElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /**
   * Limpia recursos cuando se destruye la escena
   */
  public destroy(): void {
    // Limpiar event listeners
    window.removeEventListener("keydown", () => {});
    window.removeEventListener("keyup", () => {});

    // Limpiar geometrías y materiales
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (object.material instanceof THREE.Material) {
          object.material.dispose();
        }
      }
    });

    // Limpiar renderer
    this.renderer.dispose();
  }
}
