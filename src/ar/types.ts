export type Vec3 = [number, number, number];

/** Raw Viro hit-test result entry (only the fields the app reads). */
export interface HitResult { type: string; transform: { position: Vec3 } }

/** 1 = unavailable, 2 = limited, 3 = normal (Viro tracking states). */
export type TrackingState = number;

export interface AnchorInfo { anchorId: string; position: Vec3; rotation?: Vec3; [k: string]: unknown }

export interface ShotResult { success: boolean; url?: string }
export interface CloudResult { success: boolean; state?: string; error?: string; cloudAnchorId?: string; anchor?: AnchorInfo }

/** What a screen can ask of a running AR session. */
export interface ARSessionHandle {
  /** `saveToGallery` false = a private file (used for design thumbnails). */
  takeScreenshot(name: string, saveToGallery?: boolean): Promise<ShotResult>;
  startVideo(name: string, onError: () => void): void;
  stopVideo(): Promise<ShotResult>;
  hostCloudAnchor(anchorId: string, ttlDays: number): Promise<CloudResult>;
  resolveCloudAnchor(cloudAnchorId: string): Promise<CloudResult>;
}
