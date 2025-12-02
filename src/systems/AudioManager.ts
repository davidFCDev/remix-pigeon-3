export class AudioManager {
  private collectSound: HTMLAudioElement;
  private powerUpSound: HTMLAudioElement;
  private musicTracks: string[];
  private currentTrackIndex: number = 0;
  private musicPlayer: HTMLAudioElement;
  private isMusicPlaying: boolean = false;

  constructor() {
    // SFX - Sonido de "Ding" al coger donut
    this.collectSound = new Audio(
      "https://remix.gg/blob/fb09d2b3-365a-4008-a339-895b07e1fcb8/ding-65Fby49xt1IWgfqbAptxlYM0EpgwSx.mp3?mo7R"
    );
    this.collectSound.volume = 0.4; // Volumen moderado para el efecto

    // SFX - Sonido de Power-up (Aro) - "Wind"
    this.powerUpSound = new Audio(
      "https://remix.gg/blob/fb09d2b3-365a-4008-a339-895b07e1fcb8/wind-hV7dAD5Sv2fVqKFhSEX7rdgcnLnVFh.mp3?WvSR"
    );
    this.powerUpSound.volume = 0.5;

    // Música de fondo - Playlist
    this.musicTracks = [
      "https://remix.gg/blob/fb09d2b3-365a-4008-a339-895b07e1fcb8/music1-3Qi9aRaEBUzcg1z8HaLMBWkOddhPFo.mp3?iB5y",
      "https://remix.gg/blob/fb09d2b3-365a-4008-a339-895b07e1fcb8/music2-4plbvbDdRUTrPDc0k2qhKYfs7zMExi.mp3?AyFb",
      "https://remix.gg/blob/fb09d2b3-365a-4008-a339-895b07e1fcb8/music3-xIkd3wjbGPWBMZ774DE8We2lzXyBo2.mp3?xIFL",
    ];

    this.musicPlayer = new Audio();
    this.musicPlayer.volume = 0.1; // "Muy suave de fondo" (10%)

    // Cuando termine una canción, pasar a la siguiente
    this.musicPlayer.addEventListener("ended", () => this.playNextTrack());
  }

  /**
   * Reproduce el sonido de recolección
   */
  public playCollectSound(): void {
    // Clonamos el nodo para permitir sonidos superpuestos si se recogen rápido
    const sound = this.collectSound.cloneNode() as HTMLAudioElement;
    sound.volume = 0.4;
    sound.play().catch((e) => console.warn("No se pudo reproducir SFX:", e));
  }

  /**
   * Reproduce el sonido de recolección de Power-up
   */
  public playPowerUpSound(): void {
    if (this.powerUpSound) {
      this.powerUpSound.currentTime = 0;
      this.powerUpSound.play().catch((e) => console.warn("Audio error:", e));
    }
  }

  /**
   * Inicia la música de fondo (debe llamarse tras una interacción del usuario)
   */
  public startMusic(): void {
    if (this.isMusicPlaying) return;

    this.playNextTrack();
    this.isMusicPlaying = true;
  }

  private playNextTrack(): void {
    // Cargar siguiente pista
    this.musicPlayer.src = this.musicTracks[this.currentTrackIndex];

    // Reproducir
    this.musicPlayer.play().catch((e) => {
      console.warn(
        "No se pudo reproducir música (posiblemente falta interacción):",
        e
      );
      this.isMusicPlaying = false; // Reintentar luego
    });

    // Avanzar índice para la próxima
    this.currentTrackIndex =
      (this.currentTrackIndex + 1) % this.musicTracks.length;
  }
}
