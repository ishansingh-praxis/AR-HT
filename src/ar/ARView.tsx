import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { ViroARSceneNavigator } from './viro';
import { PlacementScene, type SceneProps } from './PlacementScene';
import { CLOUD_ANCHORS } from '../config';
import type { ARSessionHandle } from './types';

export type ARViewProps = { sceneProps: Omit<SceneProps, 'bridge'>; high: boolean };

const ARView = forwardRef<ARSessionHandle, ARViewProps>(function ARView({ sceneProps, high }, ref) {
  const nav = useRef<any>(null);
  const bridge = useRef<any>(null); // set by PlacementScene: exposes hostCloudAnchor / resolveCloudAnchor

  useImperativeHandle(ref, () => ({
    takeScreenshot: (name, saveToGallery = true) => nav.current?._takeScreenshot(name, saveToGallery),
    startVideo: (name, onError) => nav.current?._startVideoRecording(name, true, onError),
    stopVideo: () => nav.current?._stopVideoRecording(),
    hostCloudAnchor: (id, ttl) => bridge.current?.hostCloudAnchor(id, ttl),
    resolveCloudAnchor: (id) => bridge.current?.resolveCloudAnchor(id),
  }), []);

  const viroAppProps = useMemo(() => ({ ...sceneProps, bridge }), [sceneProps]);
  return (
    <ViroARSceneNavigator
      ref={nav} provider={CLOUD_ANCHORS ? 'reactvision' : 'none'} autofocus shadowsEnabled={high} pbrEnabled hdrEnabled
      occlusionMode={high ? 'depthBased' : 'disabled'}
      initialScene={{ scene: PlacementScene as unknown as () => React.JSX.Element }}
      viroAppProps={viroAppProps} style={{ flex: 1 }}
    />
  );
});

export default ARView;
