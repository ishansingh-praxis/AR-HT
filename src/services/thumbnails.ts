import { Directory, File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { request } from './http';
import { useRooms } from '../store/roomStore';
import { useSettings } from '../store/settingsStore';
import type { ARSessionHandle } from '../ar/types';
import type { LocalDesign } from '../sync/engine';

const WIDTH = 720;

/** Takes a private screenshot of the AR view, shrinks it to a 720 px wide JPEG and keeps it with the design. Never throws. */
export async function captureThumbnail(session: { current: ARSessionHandle | null }, designId: string): Promise<void> {
  try {
    const shot = await session.current?.takeScreenshot(`thumb-${designId}`, false); // not saved to the photo gallery
    if (!shot?.success || !shot.url) return;
    const small = await manipulateAsync(shot.url, [{ resize: { width: WIDTH } }], { compress: 0.8, format: SaveFormat.JPEG });
    const dir = new Directory(Paths.document, 'thumbs');
    if (!dir.exists) dir.create();
    const dest = new File(dir, `${designId}-${Date.now().toString(36)}.jpg`);
    new File(small.uri).copy(dest);
    useRooms.getState().setThumbnail(designId, dest.uri);
  } catch { /* a missing thumbnail must never break saving */ }
}

/**
 * Uploads the local thumbnail through a signed link and returns its storage key.
 * The picture shows the user's room, so sync only uploads it when "Back up design photos" is on; `force` is for the user's own Share action.
 */
export async function uploadThumbnail(d: LocalDesign, force = false): Promise<string | undefined> {
  if (!d.thumbnailUri) return undefined;
  if (!force && !useSettings.getState().backupPhotos) return undefined;
  const { key, uploadUrl } = await request<{ key: string; uploadUrl: string }>('/thumbnails/upload-url', { method: 'POST', body: { clientId: d.id } });
  const bytes = await new File(d.thumbnailUri).bytes();
  const res = await fetch(uploadUrl, { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: bytes });
  if (!res.ok) throw new Error(`Thumbnail upload failed (${res.status})`);
  return key;
}
