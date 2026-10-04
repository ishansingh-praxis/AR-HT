import { Alert, Platform, Share } from 'react-native';
import { request } from './http';
import { runSync, canSync } from './sync';
import { track } from './events';
import { getFurniture } from '../data/furniture';
import { useRooms } from '../store/roomStore';
import { uploadThumbnail } from './thumbnails';
import { shareMessage } from '../utils/links';
import type { SavedDesign } from '../types/furniture';
import { t } from '../i18n';

/**
 * Share a design. Signed-in and synced: a link to the web page (plan, products, preview card) plus the photo where the OS allows.
 * Guests (or offline): the photo and the product list as text, no link.
 */
export async function shareDesign(d: SavedDesign): Promise<void> {
  const pieceNames = d.items.map((i) => getFurniture(i.productId)?.name ?? 'Item');
  let url: string | undefined;
  if (canSync()) {
    try {
      let cloudId = useRooms.getState().designs.find((x) => x.id === d.id)?.cloudId;
      if (!cloudId) { await runSync(); cloudId = useRooms.getState().designs.find((x) => x.id === d.id)?.cloudId; }
      const local = useRooms.getState().designs.find((x) => x.id === d.id);
      // Sharing is the user's choice to publish this design, so its photo is uploaded now (even with "Back up design photos" off).
      if (cloudId && local?.thumbnailUri && !local.thumbnailKey) {
        try {
          const key = await uploadThumbnail(local as never, true);
          if (key) { await request(`/designs/${cloudId}`, { method: 'PATCH', body: { name: local.name, thumbnailKey: key } }); useRooms.setState((s) => ({ designs: s.designs.map((x) => (x.id === d.id ? { ...x, thumbnailKey: key } : x)) })); }
        } catch { /* share without a picture */ }
      }
      if (cloudId) url = (await request<{ url: string }>(`/designs/${cloudId}/share`, { method: 'POST' })).url;
    } catch { /* offline: fall back to the plain text share */ }
  }
  const message = shareMessage({ name: d.name, roomType: d.roomType, pieceNames, url });
  try {
    // iOS can attach the photo next to the text. On Android the link's preview card (made from the web page) shows the picture.
    await Share.share(Platform.OS === 'ios' && d.thumbnailUri ? { message, url: d.thumbnailUri } : { message });
    track('design_saved', { shared: 1 });
  } catch (e) { Alert.alert(t('share.couldNotShare'), e instanceof Error ? e.message : 'Try again.'); }
}
