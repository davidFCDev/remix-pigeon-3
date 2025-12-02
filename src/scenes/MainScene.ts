import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { AudioManager } from "../systems/AudioManager";

/**
 * MainScene - Escena principal del juego de la Paloma 3D
 * Maneja el renderizado 3D, la paloma, el terreno y los controles
 */
export class MainScene {
  // Three.js core
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;

  // Audio
  private audioManager: AudioManager;

  // Objetos del juego
  private pigeon: THREE.Group; // Contenedor para la paloma
  private ground: THREE.Object3D; // El terreno (ahora puede ser un Group del GLB)
  private sky: THREE.Mesh | null = null; // El cielo

  // Sistema de puntuación (Donuts)
  private donuts: THREE.Group[] = [];
  private donutModel: THREE.Group | null = null;
  private score: number = 0;
  private scoreElement: HTMLElement | null = null;

  // Sistema de Hambre
  private maxHunger: number = 100;
  private currentHunger: number = 100;
  private hungerDepletionRate: number = 3.0; // Puntos por segundo (Reducido para que dure más)
  private hungerBarElement: HTMLElement | null = null;
  private isGameOver: boolean = false;

  // Enemigos (Flamingos)
  private flamingos: {
    mesh: THREE.Group;
    speed: number;
    targetIndex: number | null;
  }[] = [];
  private flamingoModel: THREE.Group | null = null;
  private flamingoMixers: THREE.AnimationMixer[] = [];

  // Sistema de Power-ups (Aros)
  private powerUps: THREE.Mesh[] = [];
  private powerUpGeometry!: THREE.TorusGeometry;
  private powerUpMaterial!: THREE.MeshToonMaterial;
  private ringEffects: THREE.Mesh[] = []; // Efectos visuales de aros
  private particles: THREE.Mesh[] = []; // Partículas para efectos (Donuts)

  // Assets cargados
  private assetsLoaded: boolean = false;
  private mapPopulated: boolean = false;

  // Obstáculos para evitar colisiones al colocar edificios
  private obstacles: THREE.Vector3[] = [];

  // Power-ups y Efectos
  // private powerUps: THREE.Mesh[] = []; // Eliminado
  // private powerUpGeometry!: THREE.SphereGeometry; // Eliminado
  // private powerUpMaterial!: THREE.MeshToonMaterial; // Eliminado
  private explosionGeometry!: THREE.TorusGeometry;
  private isSpeedBoostActive: boolean = false;
  private speedBoostTimer: number = 0;
  private baseSpeed: number = 25.0;
  private boostSpeed: number = 80.0; // Ultravelocidad
  private trailParticles: THREE.Mesh[] = [];

  // Animación
  private mixer: THREE.AnimationMixer | null = null;
  private clock: THREE.Clock = new THREE.Clock();

  // Estado del movimiento
  private keys: { [key: string]: boolean } = {};
  private mousePosition: THREE.Vector2 = new THREE.Vector2();
  private targetMousePosition: THREE.Vector2 = new THREE.Vector2(); // Para suavizado
  private isMouseDown: boolean = false;
  private pigeonSpeed: number = 25.0; // Unidades por segundo (antes 0.4 por frame)
  private pigeonRotationSpeed: number = 2.0; // Radianes por segundo (antes 0.04 por frame)
  private mouseSensitivity: number = 0.0008; // Sensibilidad del ratón reducida drásticamente

  // Físicas de vuelo
  private verticalVelocity: number = 0;
  private maxVerticalSpeed: number = 0.4;
  private verticalAcceleration: number = 0.015;
  private velocityDamping: number = 0.96; // Fricción del aire

  // Suavizado de rotación (Inercia)
  private currentYawSpeed: number = 0;
  private currentPitchSpeed: number = 0;
  private yawAcceleration: number = 3.0; // Aceleración de giro
  private pitchAcceleration: number = 2.0; // Aceleración de inclinación
  private rotationDamping: number = 2.0; // Frenado natural

  // Posición y rotación de la paloma
  private pigeonVelocity: THREE.Vector3 = new THREE.Vector3();
  private pigeonDirection: number = 0; // Ángulo de rotación en Y
  private ringPathDirection: THREE.Vector3 = new THREE.Vector3(0, 0, 1); // Dirección general de los aros

  // Configuración de la cámara
  private cameraDistance: number = 8;
  private cameraHeight: number = 3;
  private cameraLerpFactor: number = 0.08;

  // Límites del mapa (Iniciales más conservadores)
  private mapBounds = {
    minX: -400,
    maxX: 400,
    minZ: -400,
    maxZ: 400,
  };
  private mapRadius: number = 400; // Radio seguro circular

  // Controles Móviles
  private isTurningLeft: boolean = false;
  private isTurningRight: boolean = false;
  private currentTurnSpeed: number = 0; // Para suavizar el giro en móvil

  private assets: { [key: string]: any };

  constructor(assets: { [key: string]: any }) {
    this.assets = assets;
    // Crear escena
    this.scene = new THREE.Scene();

    // Estilo Cartoon: Cielo azul vibrante
    // const skyColor = 0x44AAFF
    // this.scene.background = new THREE.Color(skyColor)
    // this.scene.fog = new THREE.Fog(skyColor, 100, 900) // Niebla un poco más lejos

    // Crear cámara en perspectiva
    // Usar dimensiones de la ventana en lugar de GameSettings fijo
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspectRatio = width / height;

    // Aumentamos el plano lejano (far) a 4000 para evitar clipping con el cielo
    this.camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 4000);

    // Crear renderer - Optimizado para móviles
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
    this.renderer = new THREE.WebGLRenderer({
      antialias: !isMobile, // Desactivar antialiasing en móviles
      powerPreference: "high-performance",
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      isMobile ? 1 : Math.min(window.devicePixelRatio, 2)
    ); // Reducir resolución en móviles
    this.renderer.shadowMap.enabled = !isMobile; // Desactivar sombras en móviles
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Manejar redimensionamiento de ventana
    window.addEventListener("resize", this.handleResize);

    // Inicializar Audio
    this.audioManager = new AudioManager();

    // Crear elementos del juego
    this.createSky(); // Cielo mejorado

    // Inicializar ground temporalmente para evitar errores antes de la carga
    this.ground = new THREE.Group();
    this.scene.add(this.ground);

    this.createGround(); // Carga el mapa GLB asíncronamente
    // this.createTrees(); // Se mueven al callback de createGround
    // this.createRocks(); // Se mueven al callback de createGround
    this.pigeon = this.createPigeon();

    // Inicializar objetos del juego
    this.initGameObjects();

    // Configurar iluminación
    this.setupLighting();

    // Configurar posición inicial de la cámara
    this.updateCamera(true);

    // Configurar controles de teclado
    this.setupControls();
    this.setupMobileControls();

    // Obtener referencia al elemento de puntuación
    this.scoreElement = document.getElementById("score-value");
    // if (this.scoreElement) this.scoreElement.style.display = "none"; // Mostrar score

    // Obtener referencia a la barra de hambre
    this.hungerBarElement = document.getElementById("hunger-bar");

    // Iniciar loop de animación
    this.animate();
  }

  /**
   * Maneja el redimensionamiento de la ventana
   */
  private handleResize = (): void => {
    if (!this.camera || !this.renderer) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  };

  /**
   * Inicializa todos los objetos interactivos (Donuts y Power-ups)
   */
  private initGameObjects(): void {
    // Optimización: Geometría de explosión reutilizable
    this.explosionGeometry = new THREE.TorusGeometry(3, 0.3, 16, 32);

    this.initPowerUps();
    this.initDonuts();
    this.initFlamingos();
  }

  /**
   * Inicializa los Flamingos (Enemigos)
   */
  private initFlamingos(): void {
    const gltf = this.assets["flamingo"];
    if (gltf) {
      console.log("Flamingo model loaded from cache");
      this.flamingoModel = gltf.scene;

      // Configurar sombras
      this.flamingoModel!.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          // FORZAR MATERIAL ROSA (Fix visual)
          const pinkMaterial = new THREE.MeshToonMaterial({
            color: 0xff88aa, // Rosa flamingo
            emissive: 0x442222, // Un poco de brillo propio
            side: THREE.DoubleSide,
          });
          child.material = pinkMaterial;
        }
      });

      // Ajustar escala
      this.flamingoModel!.scale.set(0.03, 0.03, 0.03);

      // Generar 8 flamingos iniciales
      for (let i = 0; i < 8; i++) {
        this.spawnFlamingo(gltf.animations);
      }
    } else {
      console.error("Flamingo asset not found in cache");
    }
  }

  /**
   * Crea un nuevo Flamingo
   */
  private spawnFlamingo(animations: THREE.AnimationClip[]): void {
    if (!this.flamingoModel) return;

    const flamingo = SkeletonUtils.clone(this.flamingoModel) as THREE.Group;

    // Posición aleatoria dispersa (usando casi todo el mapa)
    // Usamos 0.48 para cubrir el 96% del mapa y evitar que se agrupen en el centro
    const rangeX = (this.mapBounds.maxX - this.mapBounds.minX) * 0.48;
    const rangeZ = (this.mapBounds.maxZ - this.mapBounds.minZ) * 0.48;

    const x = (Math.random() - 0.5) * 2 * rangeX;
    const z = (Math.random() - 0.5) * 2 * rangeZ;
    const y = 20 + Math.random() * 30; // Altura de vuelo

    flamingo.position.set(x, y, z);

    this.scene.add(flamingo);

    // Configurar animación
    if (animations && animations.length > 0) {
      const mixer = new THREE.AnimationMixer(flamingo);
      const action = mixer.clipAction(animations[0]);
      action.play();
      // Velocidad de animación aleatoria para que no vayan sincronizados
      mixer.timeScale = 0.8 + Math.random() * 0.4;
      this.flamingoMixers.push(mixer);
    }

    this.flamingos.push({
      mesh: flamingo,
      speed: 15.0 + Math.random() * 10.0, // Velocidad entre 15 y 25
      targetIndex: null,
    });
  }

  /**
   * Inicializa los Power-ups (Aros amarillos para velocidad)
   */
  private initPowerUps(): void {
    // Geometría circular
    this.powerUpGeometry = new THREE.TorusGeometry(4, 0.5, 16, 32);

    // Material para los aros (Amarillo brillante)
    this.powerUpMaterial = new THREE.MeshToonMaterial({
      color: 0xffff00,
      emissive: 0xaa6600,
      emissiveIntensity: 0.8,
    });

    // Generar 15 Power-ups dispersos
    for (let i = 0; i < 15; i++) {
      this.spawnRandomPowerUp();
    }
  }

  /**
   * Inicializa los Donuts (Puntos)
   */
  private initDonuts(): void {
    const gltf = this.assets["donut"];
    if (gltf) {
      console.log("Donut model loaded from cache");
      this.donutModel = gltf.scene;

      // Configurar sombras para el modelo base
      this.donutModel!.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Ajustar escala base
      this.donutModel!.scale.set(3, 3, 3);

      // Generar los donuts iniciales
      for (let i = 0; i < 30; i++) {
        this.spawnRandomDonut();
      }
    } else {
      console.error("Donut asset not found in cache, using fallback");
      this.createFallbackDonutModel();
      for (let i = 0; i < 30; i++) {
        this.spawnRandomDonut();
      }
    }
  }

  private createFallbackDonutModel(): void {
    const group = new THREE.Group();
    const geometry = new THREE.TorusGeometry(2, 1, 16, 32);
    const material = new THREE.MeshToonMaterial({ color: 0xff69b4 }); // Hot pink
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    group.add(mesh);
    this.donutModel = group;
  }

  /**
   * Genera una posición aleatoria dentro de los límites del mapa
   */
  private generateRandomPosition(): THREE.Vector3 {
    // Usamos un 96% del mapa para distribuir mejor los objetos y evitar acumulaciones
    const rangeX = (this.mapBounds.maxX - this.mapBounds.minX) * 0.48;
    const rangeZ = (this.mapBounds.maxZ - this.mapBounds.minZ) * 0.48;

    const x = (Math.random() - 0.5) * 2 * rangeX;
    const z = (Math.random() - 0.5) * 2 * rangeZ;

    // Altura FIJA para coincidir con la paloma
    const y = 20;

    return new THREE.Vector3(x, y, z);
  }

  /**
   * Crea un nuevo Power-up en una posición aleatoria
   */
  private spawnRandomPowerUp(): void {
    const pos = this.generateRandomPosition();
    this.spawnPowerUp(pos);
  }

  /**
   * Crea un nuevo Donut en una posición aleatoria
   */
  private spawnRandomDonut(): void {
    const pos = this.generateRandomPosition();
    this.spawnDonut(pos);
  }

  /**
   * Crea un nuevo Power-up (Aro) en la posición dada
   */
  private spawnPowerUp(position: THREE.Vector3): void {
    const powerUp = new THREE.Mesh(this.powerUpGeometry, this.powerUpMaterial);
    powerUp.position.copy(position);
    powerUp.castShadow = true;

    // Apuntar siempre al centro del mapa (0, Y, 0)
    powerUp.lookAt(0, position.y, 0);

    // Animación flotante (userData)
    powerUp.userData = {
      initialY: position.y,
      floatSpeed: 1.0 + Math.random(),
      floatOffset: Math.random() * Math.PI * 2,
      rotationSpeed: 0, // Ya no rotan sobre sí mismos para mantener la orientación al centro
    };

    this.scene.add(powerUp);
    this.powerUps.push(powerUp);
  }

  /**
   * Crea un nuevo Donut en la posición dada
   */
  private spawnDonut(position: THREE.Vector3): void {
    if (!this.donutModel) return;

    const donut = this.donutModel.clone();
    donut.position.copy(position);

    // Orientación aleatoria inicial
    donut.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);

    // Animación flotante (userData)
    donut.userData = {
      initialY: position.y,
      floatSpeed: 1.0 + Math.random(),
      floatOffset: Math.random() * Math.PI * 2,
      rotationSpeed: new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        0
      ),
    };

    this.scene.add(donut);
    this.donuts.push(donut);

    // Añadir Aura (Brillo rosa)
    // Usamos una esfera simple con material aditivo transparente
    // Ajustamos el radio para que sea un poco más grande que el donut
    // El donut tiene escala 3, así que una esfera de radio 0.8 será radio real 2.4
    const auraGeo = new THREE.SphereGeometry(0.8, 16, 16);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0xff69b4, // Hot Pink
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide, // Solo visible por fuera
      depthWrite: false, // No escribir en el buffer de profundidad para evitar oclusión rara
    });
    const aura = new THREE.Mesh(auraGeo, auraMat);
    donut.add(aura); // Añadir como hijo para que herede posición y movimiento
  }

  /**
   * Comprueba colisiones con Power-ups y Donuts
   */
  private checkCollisions(): void {
    // 1. Power-ups (Aros)
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const powerUp = this.powerUps[i];
      const distance = this.pigeon.position.distanceTo(powerUp.position);

      if (distance < 6) {
        this.collectPowerUp(i);
      }
    }

    // 2. Donuts (Puntos)
    for (let i = this.donuts.length - 1; i >= 0; i--) {
      const donut = this.donuts[i];
      const distance = this.pigeon.position.distanceTo(donut.position);

      if (distance < 6) {
        this.collectDonut(i);
      }
    }
  }

  /**
   * Gestiona la recolección de un Power-up (Velocidad)
   */
  private collectPowerUp(index: number): void {
    const collectedPowerUp = this.powerUps[index];

    // Reproducir sonido
    this.audioManager.playPowerUpSound();

    // Efecto visual
    this.createRingExplosion(
      collectedPowerUp.position,
      collectedPowerUp.rotation
    );

    // Eliminar
    this.scene.remove(collectedPowerUp);
    this.powerUps.splice(index, 1);

    // Activar Turbo
    this.activateSpeedBoost();

    // Reponer Power-up
    this.spawnRandomPowerUp();
  }

  /**
   * Gestiona la recolección de un Donut (Puntos)
   */
  private collectDonut(index: number): void {
    const collectedDonut = this.donuts[index];

    // Reproducir sonido
    this.audioManager.playCollectSound();

    // Efecto visual: Explosión de partículas rosa suave
    this.createDonutExplosion(collectedDonut.position);

    // Eliminar
    this.scene.remove(collectedDonut);
    this.donuts.splice(index, 1);

    // Incrementar puntuación
    this.score++;
    if (this.scoreElement) {
      this.scoreElement.innerText = this.score.toString();
    }

    // Restaurar hambre (Comer)
    this.currentHunger = Math.min(this.maxHunger, this.currentHunger + 15);

    // Reponer Donut
    this.spawnRandomDonut();
  }

  /**
   * Crea una explosión de partículas suaves (estilo confeti/magia)
   */
  private createDonutExplosion(position: THREE.Vector3): void {
    const particleCount = 15;
    // Usamos cubos pequeños o esferas low poly
    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);

    for (let i = 0; i < particleCount; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xff69b4, // Rosa
        transparent: true,
        opacity: 0.8,
      });

      const particle = new THREE.Mesh(geometry, material);
      particle.position.copy(position);

      // Velocidad aleatoria en todas direcciones
      particle.userData = {
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 15,
          (Math.random() - 0.5) * 15,
          (Math.random() - 0.5) * 15
        ),
        rotationSpeed: new THREE.Vector3(
          Math.random() * 4,
          Math.random() * 4,
          Math.random() * 4
        ),
        life: 1.0, // Vida útil
      };

      this.scene.add(particle);
      this.particles.push(particle);
    }
  }

  /**
   * Crea un efecto visual de explosión al recoger un aro
   */
  private createRingExplosion(
    position: THREE.Vector3,
    rotation: THREE.Euler
  ): void {
    // Crear un anillo que se expande y desvanece (misma forma que el original)
    // Usamos la geometría reutilizada para optimizar
    const material = new THREE.MeshBasicMaterial({
      color: 0xffff00, // Amarillo brillante al explotar
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });

    const effect = new THREE.Mesh(this.explosionGeometry, material);
    effect.position.copy(position);
    effect.rotation.copy(rotation);

    // Añadir datos personalizados para la animación
    effect.userData = {
      scaleSpeed: 2.0,
      fadeSpeed: 2.0, // Desvanecer un poco más rápido
      life: 1.0,
    };

    this.scene.add(effect);
    this.ringEffects.push(effect);
  }

  // Eliminado: spawnPowerUp
  // Eliminado: checkPowerUpCollisions

  /**
   * Activa el turbo
   */
  private activateSpeedBoost(): void {
    this.isSpeedBoostActive = true;
    this.speedBoostTimer = 2.0; // Reducido a 2 segundos
    // La velocidad se ajusta suavemente en handleMovement
  }

  /**
   * Crea un cielo con gradiente suave
   */
  private createSky(): void {
    // Color de fondo base (por si acaso)
    this.scene.background = new THREE.Color(0x87ceeb);

    // Niebla más suave y lejana para que no se vea "borroso" cerca
    // Ajustamos la niebla para que coincida mejor con la nueva distancia de visión
    this.scene.fog = new THREE.Fog(0x87ceeb, 500, 3000);

    // Crear un domo gigante para el cielo con gradiente
    // Usamos coordenadas locales (position) en lugar de mundiales para que el gradiente
    // se mantenga constante al mover la esfera con el jugador.
    const vertexShader = `
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }
    `;

    const fragmentShader = `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vPosition;
      void main() {
        // Usamos vPosition + offset en Y para ajustar el horizonte
        float h = normalize( vPosition + vec3(0, offset, 0) ).y;
        gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h , 0.0), exponent ), 0.0 ) ), 1.0 );
      }
    `;

    const uniforms = {
      topColor: { value: new THREE.Color(0x0077ff) }, // Azul intenso arriba
      bottomColor: { value: new THREE.Color(0x87ceeb) }, // Azul cielo en el horizonte (coincide con niebla)
      offset: { value: 33 },
      exponent: { value: 0.6 },
    };

    // Aumentamos el radio del cielo para asegurar que siempre esté "lejos"
    const skyGeo = new THREE.SphereGeometry(3000, 32, 15);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      side: THREE.BackSide,
    });

    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.sky);
  }

  /**
   * Carga el mapa desde un archivo GLB
   */
  private createGround(): void {
    const gltf = this.assets["map"];
    if (gltf) {
      const mapModel = gltf.scene.clone(); // Clone to avoid modifying cached asset if reused

      // Ajustar posición y escala si es necesario
      mapModel.position.y = -15;
      mapModel.scale.set(150, 150, 150);

      mapModel.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(mapModel);

      const maxLimit = 500;
      this.mapBounds.minX = Math.max(box.min.x + 50, -maxLimit);
      this.mapBounds.maxX = Math.min(box.max.x - 50, maxLimit);
      this.mapBounds.minZ = Math.max(box.min.z + 50, -maxLimit);
      this.mapBounds.maxZ = Math.min(box.max.z - 50, maxLimit);

      this.mapRadius = Math.min(
        Math.abs(this.mapBounds.minX),
        Math.abs(this.mapBounds.maxX),
        Math.abs(this.mapBounds.minZ),
        Math.abs(this.mapBounds.maxZ)
      );

      console.log(
        "Límites del mapa calculados:",
        this.mapBounds,
        "Radio:",
        this.mapRadius
      );

      mapModel.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.receiveShadow = true;
          child.castShadow = false;
          if (child.material) {
            child.material.side = THREE.DoubleSide;
            if (child.material instanceof THREE.MeshStandardMaterial) {
              child.material.roughness = 0.8;
            }
          }
        }
      });

      this.scene.remove(this.ground);
      this.ground = mapModel;
      this.scene.add(this.ground);

      console.log("Mapa GLB cargado correctamente from cache");
      this.mapPopulated = true;
    } else {
      console.error("Map asset not found in cache");
    }
  }

  /**
   * Crea la paloma cargando el modelo animado
   */
  private createPigeon(): THREE.Group {
    const pigeonGroup = new THREE.Group();
    pigeonGroup.rotation.order = "YXZ";
    pigeonGroup.position.set(0, 40, 0);

    const gltf = this.assets["pigeon"];
    if (gltf) {
      console.log("Modelo animado cargado correctamente from cache");
      // Usar SkeletonUtils.clone para clonar correctamente SkinnedMeshes
      const model = SkeletonUtils.clone(gltf.scene);

      // Configurar sombras
      model.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      model.scale.set(0.5, 0.5, 0.5);
      model.rotation.y = 0;

      if (gltf.animations && gltf.animations.length > 0) {
        console.log(`Encontradas ${gltf.animations.length} animaciones`);
        this.mixer = new THREE.AnimationMixer(model);
        const action = this.mixer.clipAction(gltf.animations[0]);
        action.play();
      }

      pigeonGroup.add(model);
    } else {
      console.error("Pigeon asset not found in cache");
      // Fallback placeholder
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
    }

    this.scene.add(pigeonGroup);
    return pigeonGroup;
  }

  /**
   * Carga y distribuye árboles por el mapa
   */
  private createTrees(): void {
    const loader = new GLTFLoader();

    // Cargar primer árbol (Low Poly)
    loader.load(
      "/arbol_low_poly.glb",
      (gltf1) => {
        const treeModel1 = gltf1.scene;
        this.setupModelShadows(treeModel1);

        // Cargar segundo árbol (Leafy)
        loader.load(
          "/leafy_tree.glb",
          (gltf2) => {
            const treeModel2 = gltf2.scene;
            this.setupModelShadows(treeModel2);

            // Distribuir mezclando ambos tipos
            // Reducido a 300 para móviles
            this.distributeObjects([treeModel1, treeModel2], 300, 900);
            console.log("Árboles generados (mezcla)");
          },
          undefined,
          (err) => {
            console.error("Error cargando leafy_tree:", err);
            // Si falla el segundo, distribuimos solo el primero
            this.distributeObjects([treeModel1], 500, 900);
          }
        );
      },
      undefined,
      (error) => {
        console.error("Error cargando arbol_low_poly:", error);
      }
    );
  }

  /**
   * Carga y distribuye rocas por el mapa
   */
  private createRocks(): void {
    const loader = new GLTFLoader();
    loader.load(
      "/low_poly_rocks.glb",
      (gltf) => {
        const rockModel = gltf.scene;
        this.setupModelShadows(rockModel);

        // Menos rocas que árboles (ej. 80)
        // Aumentada la escala de 2.0 a 5.0 para que sean más visibles
        // Reducido a 150 para móviles
        this.distributeObjects([rockModel], 150, 900, 2.0, 5.0);
        console.log("Rocas generadas");

        // Marcar mapa como poblado
        this.mapPopulated = true;
      },
      undefined,
      (err) => console.error("Error cargando rocas:", err)
    );
  }

  /**
   * Configura sombras y materiales para un modelo
   */
  private setupModelShadows(model: THREE.Group): void {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.side = THREE.DoubleSide;
        }
      }
    });
  }

  /**
   * Distribuye objetos aleatoriamente sobre el terreno usando Raycasting
   */
  private distributeObjects(
    models: THREE.Group[],
    count: number,
    range: number,
    minScale: number = 0.8,
    maxScale: number = 1.6
  ): void {
    const raycaster = new THREE.Raycaster();
    const downDirection = new THREE.Vector3(0, -1, 0);

    for (let i = 0; i < count; i++) {
      // Elegir modelo aleatorio de la lista
      const modelTemplate = models[Math.floor(Math.random() * models.length)];
      const instance = modelTemplate.clone();

      // Posición aleatoria
      const x = (Math.random() - 0.5) * 2 * range;
      const z = (Math.random() - 0.5) * 2 * range;

      // Raycasting para encontrar altura del suelo
      raycaster.set(new THREE.Vector3(x, 200, z), downDirection);
      // IMPORTANTE: recursive: true para que funcione con Grupos (GLB)
      const intersects = raycaster.intersectObject(this.ground, true);

      if (intersects.length > 0) {
        const groundPoint = intersects[0].point;
        instance.position.copy(groundPoint);

        // Registrar como obstáculo para evitar que las misiones aparezcan encima
        this.obstacles.push(groundPoint.clone());

        // Variación aleatoria
        const scale = minScale + Math.random() * (maxScale - minScale);
        instance.scale.set(scale, scale, scale);
        instance.rotation.y = Math.random() * Math.PI * 2;

        this.scene.add(instance);
      }
    }
  }

  /**
   * Configura la iluminación de la escena
   */
  private setupLighting(): void {
    // Luz hemisférica con colores cartoon contrastados
    // Aumentada la intensidad para que los modelos se vean mejor
    const hemisphereLight = new THREE.HemisphereLight(0x44aaff, 0x66dd66, 1.0);
    this.scene.add(hemisphereLight);

    // Luz ambiental extra para rellenar sombras oscuras
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Luz direccional (sol)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(100, 200, 100);
    directionalLight.castShadow = true;

    // Mejorar calidad de sombras para el terreno grande
    // Optimizado para móviles: 1024x1024 es suficiente y más rápido
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    const d = 200;
    directionalLight.shadow.camera.left = -d;
    directionalLight.shadow.camera.right = d;
    directionalLight.shadow.camera.top = d;
    directionalLight.shadow.camera.bottom = -d;
    directionalLight.shadow.camera.far = 1000;

    this.scene.add(directionalLight);
  }

  /**
   * Configura los controles de teclado y ratón
   */
  private setupControls(): void {
    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });

    // Detectar si el ratón está pulsado (Control principal)
    window.addEventListener("mousedown", () => {
      this.isMouseDown = true;
      // Iniciar música con la primera interacción del usuario
      this.audioManager.startMusic();
    });

    window.addEventListener("mouseup", () => {
      this.isMouseDown = false;
    });

    // Eliminado: requestPointerLock para evitar errores en iframes sandboxed
    // El control ahora es exclusivamente "Drag to Fly" (Arrastrar para volar)

    window.addEventListener("mousemove", (e) => {
      // Permitir control SOLO si se arrastra el ratón
      if (this.isMouseDown) {
        // Sensibilidad ajustada para que sea suave
        const sensitivity = 0.002;

        // Eje Y: Pitch (Mirar arriba/abajo)
        // Invertimos: mover ratón abajo -> mirar abajo (positivo)
        this.targetMousePosition.y += e.movementY * sensitivity;
        // Limitamos el ángulo (aprox 60 grados)
        this.targetMousePosition.y = Math.max(
          -1.0,
          Math.min(1.0, this.targetMousePosition.y)
        );

        // Eje X: Yaw (Girar izquierda/derecha)
        // Acumulamos el movimiento horizontal como delta para este frame
        // Mover izquierda (negativo) -> girar izquierda (positivo)
        this.targetMousePosition.x -= e.movementX * sensitivity;
      }
    });
  }

  /**
   * Configura los controles táctiles para móviles (Hold Left/Right)
   */
  private setupMobileControls(): void {
    const canvas = this.renderer.domElement;

    // Touch Start: Detectar lado de la pantalla
    canvas.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        this.audioManager.startMusic(); // Iniciar música al tocar

        for (let i = 0; i < e.touches.length; i++) {
          const touch = e.touches[i];
          const halfWidth = window.innerWidth / 2;

          if (touch.clientX < halfWidth) {
            this.isTurningLeft = true;
            this.isTurningRight = false; // Prioridad al último toque o lógica exclusiva
          } else {
            this.isTurningRight = true;
            this.isTurningLeft = false;
          }
        }
      },
      { passive: false }
    );

    // Touch End: Detener giro
    const endTouch = (e: TouchEvent) => {
      e.preventDefault();
      // Si no hay toques, reseteamos todo.
      // Si hay toques, podríamos recalcular, pero para simplificar:
      if (e.touches.length === 0) {
        this.isTurningLeft = false;
        this.isTurningRight = false;
      }
    };

    canvas.addEventListener("touchend", endTouch);
    canvas.addEventListener("touchcancel", endTouch);
  }

  // Variables reutilizables para la cámara (evitar crear objetos cada frame)
  private cameraTargetPos: THREE.Vector3 = new THREE.Vector3();
  private cameraLookAtTarget: THREE.Vector3 = new THREE.Vector3();
  private cameraOffset: THREE.Vector3 = new THREE.Vector3();

  /**
   * Actualiza la posición de la cámara para seguir a la paloma (Optimizado)
   */
  private updateCamera(snap: boolean = false): void {
    // Cámara fija detrás de la paloma - Sin lerp para evitar vibraciones
    const angle = this.pigeon.rotation.y;

    // Calcular offset usando trigonometría directa (más eficiente)
    // La cámara debe estar DETRÁS de la paloma (en -Z relativo a su rotación)
    const distance = 8; // Más cerca
    const height = 4; // Más bajo para ver mejor la paloma

    // Sin(angle) y Cos(angle) para posición DETRÁS de la paloma
    // Cuando angle=0, paloma mira a +Z, cámara debe estar en -Z (detrás)
    this.cameraOffset.set(
      -Math.sin(angle) * distance, // Invertido para estar detrás
      height,
      -Math.cos(angle) * distance // Negativo para estar detrás
    );

    // Posición de la cámara = posición paloma + offset
    this.cameraTargetPos.copy(this.pigeon.position).add(this.cameraOffset);

    // Aplicar posición directamente (sin lerp = sin vibración)
    this.camera.position.copy(this.cameraTargetPos);

    // Mirar directamente a la paloma (sin offset complicado)
    this.cameraLookAtTarget.copy(this.pigeon.position);
    this.cameraLookAtTarget.y += 1; // Ligeramente arriba del centro

    this.camera.lookAt(this.cameraLookAtTarget);
  }

  /**
   * Procesa los controles de movimiento con físicas simplificadas (Arcade)
   */
  private handleMovement(delta: number): void {
    const FIXED_HEIGHT = 20;

    // 1. Rotación (Yaw) - RATÓN + TECLADO + MÓVIL
    let turnSpeed = 0;

    // Ratón: Giro directo
    turnSpeed += this.targetMousePosition.x * 2.0; // Factor de velocidad
    this.targetMousePosition.x = 0; // Reset

    // Teclado
    if (this.keys["KeyA"] || this.keys["ArrowLeft"]) {
      turnSpeed += this.pigeonRotationSpeed * delta;
    } else if (this.keys["KeyD"] || this.keys["ArrowRight"]) {
      turnSpeed -= this.pigeonRotationSpeed * delta;
    }

    // Móvil (Hold Left/Right) - Giro progresivo
    let targetTurnSpeed = 0;
    if (this.isTurningLeft) {
      targetTurnSpeed = this.pigeonRotationSpeed * delta * 1.2;
    } else if (this.isTurningRight) {
      targetTurnSpeed = -this.pigeonRotationSpeed * delta * 1.2;
    }

    // Suavizar el giro en móvil (aceleración/deceleración progresiva)
    this.currentTurnSpeed = THREE.MathUtils.lerp(
      this.currentTurnSpeed,
      targetTurnSpeed,
      delta * 8 // Velocidad de transición
    );
    turnSpeed += this.currentTurnSpeed;

    this.pigeonDirection += turnSpeed;
    this.pigeon.rotation.y = this.pigeonDirection;

    // Efecto visual de Roll (Balanceo) al girar - Simplificado
    this.pigeon.rotation.z = THREE.MathUtils.clamp(turnSpeed * 5.0, -0.3, 0.3);

    // Pitch siempre a 0 (horizontal)
    this.pigeon.rotation.x = 0;

    // 2. Movimiento Constante
    // Suavizado de velocidad (Turbo)
    const targetSpeed = this.isSpeedBoostActive
      ? this.boostSpeed
      : this.baseSpeed;
    this.pigeonSpeed = THREE.MathUtils.lerp(
      this.pigeonSpeed,
      targetSpeed,
      delta * 2.0
    );

    const moveSpeed = this.pigeonSpeed * delta;

    // Siempre avanzar hacia adelante
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyEuler(this.pigeon.rotation);
    this.pigeon.position.add(forward.multiplyScalar(moveSpeed));

    // 3. Altura Fija (Sin Lerp para evitar vibraciones)
    this.pigeon.position.y = FIXED_HEIGHT;

    // Actualizar animaciones del modelo
    if (this.mixer) {
      this.mixer.update(delta);
      const animSpeed = this.isSpeedBoostActive ? 2.5 : 1.0;
      this.mixer.timeScale = animSpeed;
    }

    // Animar efectos de aros
    for (let i = this.ringEffects.length - 1; i >= 0; i--) {
      const effect = this.ringEffects[i];
      effect.scale.multiplyScalar(1 + effect.userData.scaleSpeed * delta);

      if (effect.material instanceof THREE.Material) {
        effect.material.opacity -= effect.userData.fadeSpeed * delta;
      }

      if (
        effect.material instanceof THREE.Material &&
        effect.material.opacity <= 0
      ) {
        this.scene.remove(effect);
        effect.geometry.dispose();
        effect.material.dispose();
        this.ringEffects.splice(i, 1);
      }
    }

    // Actualizar partículas (Donuts)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Mover
      p.position.add(p.userData.velocity.clone().multiplyScalar(delta));

      // Rotar
      p.rotation.x += p.userData.rotationSpeed.x * delta;
      p.rotation.y += p.userData.rotationSpeed.y * delta;

      // Desvanecer
      if (p.material instanceof THREE.Material) {
        p.material.opacity -= delta * 1.5;

        if (p.material.opacity <= 0) {
          this.scene.remove(p);
          p.geometry.dispose();
          p.material.dispose();
          this.particles.splice(i, 1);
        }
      }
    }

    // Rotar los Power-ups
    this.powerUps.forEach((pu) => {
      if (pu.userData.rotationSpeed) {
        pu.rotation.y += 2.0 * delta; // Rotación simple para aros
      }
      // Flotar (Muy sutil alrededor de la altura fija)
      if (pu.userData.initialY) {
        pu.position.y =
          pu.userData.initialY +
          Math.sin(
            this.clock.getElapsedTime() * 1.5 + pu.userData.floatOffset
          ) *
            0.5; // Reducido amplitud
      }
    });

    // Rotar los Donuts
    this.donuts.forEach((donut) => {
      if (donut.userData.rotationSpeed) {
        donut.rotation.x += donut.userData.rotationSpeed.x * delta;
        donut.rotation.y += donut.userData.rotationSpeed.y * delta;
      }
      // Flotar
      if (donut.userData.initialY) {
        donut.position.y =
          donut.userData.initialY +
          Math.sin(
            this.clock.getElapsedTime() * donut.userData.floatSpeed +
              donut.userData.floatOffset
          ) *
            0.5; // Reducido amplitud
      }
    });

    // Comprobar colisiones
    this.checkCollisions();

    // Gestionar Turbo
    if (this.isSpeedBoostActive) {
      this.speedBoostTimer -= delta;
      if (this.speedBoostTimer <= 0) {
        this.isSpeedBoostActive = false;
      }

      // Generar estela de velocidad
      if (Math.random() < 0.5) {
        const trailGeo = new THREE.BoxGeometry(0.2, 0.2, 8);
        const trailMat = new THREE.MeshBasicMaterial({
          color: 0x00ffff,
          transparent: true,
          opacity: 0.6,
        });
        const trail = new THREE.Mesh(trailGeo, trailMat);

        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 6,
          -2
        );
        offset.applyEuler(this.pigeon.rotation);
        trail.position.copy(this.pigeon.position).add(offset);
        trail.rotation.copy(this.pigeon.rotation);

        this.scene.add(trail);
        this.trailParticles.push(trail);
      }
    }

    // Actualizar partículas de estela
    for (let i = this.trailParticles.length - 1; i >= 0; i--) {
      const p = this.trailParticles[i];
      const backward = new THREE.Vector3(0, 0, 1)
        .applyEuler(p.rotation)
        .multiplyScalar(delta * 5);
      p.position.sub(backward);

      if (p.material instanceof THREE.Material) {
        p.material.opacity -= delta * 2.0;
        if (p.material.opacity <= 0) {
          this.scene.remove(p);
          p.geometry.dispose();
          p.material.dispose();
          this.trailParticles.splice(i, 1);
        }
      }
    }

    // Efecto FOV dinámico
    const targetFOV = this.isSpeedBoostActive ? 85 : 75;
    this.camera.fov = THREE.MathUtils.lerp(
      this.camera.fov,
      targetFOV,
      delta * 1.0
    );
    this.camera.updateProjectionMatrix();

    // Limitar movimiento dentro de los bordes del mapa
    if (this.pigeon.position.x < this.mapBounds.minX)
      this.pigeon.position.x = this.mapBounds.minX;
    if (this.pigeon.position.x > this.mapBounds.maxX)
      this.pigeon.position.x = this.mapBounds.maxX;
    if (this.pigeon.position.z < this.mapBounds.minZ)
      this.pigeon.position.z = this.mapBounds.minZ;
    if (this.pigeon.position.z > this.mapBounds.maxZ)
      this.pigeon.position.z = this.mapBounds.maxZ;
  }

  /**
   * Actualiza la lógica de los Flamingos
   */
  private updateFlamingos(delta: number): void {
    // Actualizar animaciones
    this.flamingoMixers.forEach((mixer) => mixer.update(delta));

    this.flamingos.forEach((flamingo) => {
      // 1. Buscar objetivo si no tiene o si ya no existe
      if (flamingo.targetIndex === null || !this.donuts[flamingo.targetIndex]) {
        flamingo.targetIndex = this.findNearestDonut(flamingo.mesh.position);
      }

      // Si no hay donuts, volar en círculos o aleatoriamente
      if (flamingo.targetIndex === null) {
        flamingo.mesh.rotation.y += delta * 0.5;
        flamingo.mesh.translateZ(flamingo.speed * delta);
        return;
      }

      // 2. Moverse hacia el objetivo
      const targetDonut = this.donuts[flamingo.targetIndex];

      // Mirar suavemente hacia el objetivo
      const targetPos = targetDonut.position.clone();
      const direction = targetPos.sub(flamingo.mesh.position).normalize();

      // Calcular rotación objetivo (LookAt manual suave)
      const dummy = new THREE.Object3D();
      dummy.position.copy(flamingo.mesh.position);
      dummy.lookAt(targetDonut.position);

      flamingo.mesh.quaternion.slerp(dummy.quaternion, delta * 2.0);

      // Avanzar
      flamingo.mesh.translateZ(flamingo.speed * delta);

      // 3. Comprobar si se come el donut
      if (flamingo.mesh.position.distanceTo(targetDonut.position) < 5) {
        this.flamingoEatsDonut(flamingo.targetIndex);
        flamingo.targetIndex = null; // Buscar nuevo objetivo
      }
    });
  }

  /**
   * Encuentra el índice del donut más cercano a una posición
   */
  private findNearestDonut(position: THREE.Vector3): number | null {
    if (this.donuts.length === 0) return null;

    let nearestIndex = -1;
    let minDistance = Infinity;

    for (let i = 0; i < this.donuts.length; i++) {
      const dist = position.distanceTo(this.donuts[i].position);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIndex = i;
      }
    }

    return nearestIndex;
  }

  /**
   * Un flamingo se come un donut
   */
  private flamingoEatsDonut(index: number): void {
    if (!this.donuts[index]) return;

    const eatenDonut = this.donuts[index];

    // Efecto visual diferente (ej. partículas rojas o simplemente desaparecer)
    // Reutilizamos la explosión pero podríamos cambiar el color si quisiéramos
    this.createDonutExplosion(eatenDonut.position);

    // Eliminar donut
    this.scene.remove(eatenDonut);
    this.donuts.splice(index, 1);

    // IMPORTANTE: Actualizar índices de los otros flamingos si apuntaban a índices superiores
    // Esto es complejo, así que simplemente reseteamos los objetivos de todos los flamingos
    // para que recalculen en el siguiente frame. Es menos eficiente pero más seguro.
    this.flamingos.forEach((f) => (f.targetIndex = null));

    // Reponer Donut en otro sitio (para mantener el juego infinito)
    this.spawnRandomDonut();
  }

  /**
   * Actualiza la lógica del hambre
   */
  private updateHunger(delta: number): void {
    if (this.isGameOver) return;

    // Reducir hambre
    this.currentHunger -= this.hungerDepletionRate * delta;

    // Comprobar Game Over
    if (this.currentHunger <= 0) {
      this.currentHunger = 0;
      this.gameOver();
    }

    // Actualizar UI
    if (this.hungerBarElement) {
      const percentage = (this.currentHunger / this.maxHunger) * 100;

      // Determinar color
      let color = "#00ff00"; // Verde
      if (percentage < 50) color = "#ffff00"; // Amarillo
      if (percentage < 20) color = "#ff0000"; // Rojo

      // Actualizar gradiente cónico
      this.hungerBarElement.style.background = `conic-gradient(${color} ${percentage}%, transparent 0)`;
    }
  }

  private gameOver(): void {
    this.isGameOver = true;
    alert(
      `¡Juego Terminado! Tu paloma tiene demasiada hambre.\nPuntuación final: ${this.score}`
    );
    location.reload();
  }

  /**
   * Loop principal de animación
   */
  private animate = (): void => {
    if (this.isGameOver) return;

    requestAnimationFrame(this.animate);

    // Calcular delta time (tiempo transcurrido desde el último frame en segundos)
    const delta = this.clock.getDelta();

    // Actualizar hambre
    this.updateHunger(delta);

    // Actualizar Flamingos
    this.updateFlamingos(delta);

    // Procesar movimiento pasando delta
    this.handleMovement(delta);

    // Actualizar cámara
    this.updateCamera();

    // Mover el cielo con la paloma para dar sensación de infinito
    // Esto evita que nos salgamos de la esfera del cielo o veamos artefactos
    if (this.sky) {
      this.sky.position.copy(this.pigeon.position);
    }

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
    window.removeEventListener("resize", this.handleResize);

    // Limpiar geometrías y materiales
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (object.material instanceof THREE.Material) {
          object.material.dispose();
        }
      }
    });

    // Dispose renderer
    this.renderer.dispose();
  }
}
