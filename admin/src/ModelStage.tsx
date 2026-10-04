import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Review stage for a 3D model: the model on a floor grid, the LISTED size drawn as an orange box, and a 1 m reference cube
 * beside it. If the model does not fill the box (or sticks out of it) the size, orientation or origin is wrong.
 */
export function ModelStage({ url, dims }: { url: string; dims: { w: number; d: number; h: number } }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ loading: boolean; error?: string; size?: [number, number, number] }>({ loading: true });

  useEffect(() => {
    const el = host.current!;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#E7ECEA');
    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight('#ffffff', '#8899aa', 2.2));
    const sun = new THREE.DirectionalLight('#ffffff', 2); sun.position.set(2, 4, 3); scene.add(sun);
    scene.add(new THREE.GridHelper(6, 12, '#9aa8a4', '#c9d3d0'));

    const [w, d, h] = [dims.w / 100, dims.d / 100, dims.h / 100];
    const line = (geo: THREE.BufferGeometry, color: string) => new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color }));
    const listed = line(new THREE.BoxGeometry(w, h, d), '#E8761A'); listed.position.set(0, h / 2, 0); scene.add(listed);
    const ref = line(new THREE.BoxGeometry(1, 1, 1), '#2F6F5E'); ref.position.set(-(w / 2 + 0.9), 0.5, 0); scene.add(ref);

    const span = Math.max(w, d, h, 1.5);
    camera.position.set(span * 1.6, span * 1.1, span * 1.8);
    controls.target.set(-0.2, h / 3, 0);

    let live = true;
    new GLTFLoader().load(url, (gltf) => {
      if (!live) return;
      scene.add(gltf.scene);
      const b = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
      setState({ loading: false, size: [b.x * 100, b.z * 100, b.y * 100] });
    }, undefined, () => live && setState({ loading: false, error: 'Could not load this model.' }));

    const resize = () => { const r = el.getBoundingClientRect(); renderer.setSize(r.width, r.height); camera.aspect = r.width / Math.max(r.height, 1); camera.updateProjectionMatrix(); };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(el);
    let raf = 0;
    const tick = () => { raf = requestAnimationFrame(tick); controls.update(); renderer.render(scene, camera); };
    tick();
    return () => {
      live = false; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose();
      scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); });
      el.removeChild(renderer.domElement);
    };
  }, [url, dims.w, dims.d, dims.h]);

  return (
    <div className="stage">
      <div ref={host} className="stage-canvas" role="img" aria-label="3D model next to its listed size box and a one metre cube" />
      <div className="stage-legend">
        <span className="swatch" style={{ background: '#E8761A' }} /> listed size {dims.w} × {dims.d} × {dims.h} cm &nbsp;
        <span className="swatch" style={{ background: '#2F6F5E' }} /> 1 m cube
        {state.loading && <div className="muted">Loading model…</div>}
        {state.error && <div className="error">{state.error}</div>}
        {state.size && <div>Model measures {state.size.map((n) => n.toFixed(0)).join(' × ')} cm (W × D × H)</div>}
      </div>
    </div>
  );
}
