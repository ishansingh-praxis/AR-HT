import { useState } from 'react';
import { Alert, Platform, Share } from 'react-native';
import { track } from '../../services/events';
import type { ARSessionHandle } from '../../ar/types';
import { t } from '../../i18n';

/** Photo and video capture through the AR session. */
export function useCapture(session: { current: ARSessionHandle | null }) {
  const [recording, setRecording] = useState(false);
  const photo = async () => {
    const r = await session.current?.takeScreenshot(`hometown-${Date.now()}`);
    if (!r?.success) return Alert.alert(t('useCapture.couldNotTakePhoto'), t('useCapture.checkPhotoPermissionsAnd'));
    track('photo_taken');
    Share.share(Platform.OS === 'ios' ? { message: t('capture.myRoomDesign'), url: r.url } : { message: t('capture.myRoomDesign'), url: r.url }).catch(() => {});
  };
  const toggleVideo = async () => {
    if (!recording) {
      setRecording(true);
      session.current?.startVideo(`hometown-${Date.now()}`, () => { setRecording(false); Alert.alert(t('useCapture.recordingFailed'), t('useCapture.checkStorageAndMicrophone')); });
    } else {
      setRecording(false);
      const r = await session.current?.stopVideo();
      if (r?.success) track('video_recorded');
      Alert.alert(r?.success ? t('capture.videoSaved') : t('capture.videoFailed'));
    }
  };
  return { recording, photo, toggleVideo };
}
