// Pure "Will it fit?" logic (no React / RN imports).
import { checkFit, type Fit } from './geometry.ts';

export interface FitInput { widthCm: number; depthCm: number }
export interface FitAnswer {
  fit: Fit | null;
  /** Width the input was prefilled with (the scanned room's longest wall), when known. */
  prefillCm: number | null;
  /** Footprint of the piece vs the free floor, when the room area is known. */
  footprintM2: number;
  freeFloorM2: number | null;
  message: string;
  /** The same message as a translation key + values, so the app can show it in the user's language (`message` stays English for tests). */
  msg: { key: string; vars: Record<string, string | number> };
}

/** `freeWidthCm`: what the user typed (wins) or the scanned longest wall (prefill). `areaM2`/`usedM2`: scanned or preset room and what is placed. */
export function willItFit(p: FitInput, opts: { freeWidthCm?: number | null; scanLongestWallCm?: number | null; areaM2?: number | null; usedM2?: number }): FitAnswer {
  const prefillCm = opts.scanLongestWallCm ?? null;
  const width = opts.freeWidthCm ?? prefillCm;
  const fit = width && width > 0 ? checkFit(p.widthCm, width) : null;
  const footprintM2 = (p.widthCm * p.depthCm) / 1e4;
  const freeFloorM2 = opts.areaM2 ? Math.max(0, opts.areaM2 - (opts.usedM2 ?? 0)) : null;
  let message = 'Enter the free width to check.';
  let msg: FitAnswer['msg'] = { key: 'fit.enter', vars: {} };
  const fromScan = opts.freeWidthCm == null && prefillCm != null;
  if (fit?.status === 'fits') {
    message = fromScan ? `Fits along your longest wall (${(prefillCm! / 100).toFixed(1)} m).` : `Fits, with ${Math.round(fit.spareCm)} cm to spare.`;
    msg = fromScan ? { key: 'fit.fitsWall', vars: { m: (prefillCm! / 100).toFixed(1) } } : { key: 'fit.fits', vars: { cm: Math.round(fit.spareCm) } };
  } else if (fit?.status === 'tight') { message = `Tight: only ${Math.round(fit.spareCm)} cm spare in total.`; msg = { key: 'fit.tight', vars: { cm: Math.round(fit.spareCm) } }; }
  else if (fit?.status === 'no') { message = `Too wide by ${Math.round(fit.shortByCm)} cm.`; msg = { key: 'fit.tooWide', vars: { cm: Math.round(fit.shortByCm) } }; }
  return { fit, prefillCm, footprintM2, freeFloorM2, message, msg };
}
