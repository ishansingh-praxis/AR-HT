// One-off third pass of the string move: screen-level dynamic strings. Each row: [file, exact old source, new source, { key: English text }].
import fs from 'node:fs';
import path from 'node:path';

const EN = path.resolve('src/i18n/en.json');
const en = JSON.parse(fs.readFileSync(EN, 'utf8'));
const setKey = (k, v) => { const [g, ...rest] = k.split('.'); (en[g] ??= {})[rest.join('.')] = v; };

const ROWS = [
  ['src/components/AccountSection.tsx', "t('account.keepData')", "t('account.keepData')", { 'account.keepData': 'Keep my data', 'account.deleteEverything': 'Delete everything', 'common.cancel': 'Cancel', 'common.continue': 'Continue' }],
  // AR screen
  ['src/screens/ARScreen.tsx', "dropped ? 'The camera view was slowing down, so AR quality was switched to Standard.'", "dropped ? t('ar.qualityDropped')", { 'ar.qualityDropped': 'The camera view was slowing down, so AR quality was switched to Standard.' }],
  ['src/screens/ARScreen.tsx', "`Scan: aim at a floor corner and tap Mark corner (${scan.corners.length} marked, need 3+).`", "t('ar.statusScan', { n: scan.corners.length })", { 'ar.statusScan': 'Scan: aim at a floor corner and tap Mark corner ({{n}} marked, need 3+).' }],
  ['src/screens/ARScreen.tsx', "`Tap where the wall meets the floor: one end, then the other (${wall.points.length}/2).`", "t('ar.statusWall', { n: wall.points.length })", { 'ar.statusWall': 'Tap where the wall meets the floor: one end, then the other ({{n}}/2).' }],
  ['src/screens/ARScreen.tsx', "'Pieces overlap. Drag one clear of the red outline.'", "t('ar.statusOverlap')", { 'ar.statusOverlap': 'Pieces overlap. Drag one clear of the red outline.' }],
  ['src/screens/ARScreen.tsx', "'Gap under 60 cm between pieces. Hard to walk through: consider moving one.'", "t('ar.statusNarrow')", { 'ar.statusNarrow': 'Gap under 60 cm between pieces. Hard to walk through: consider moving one.' }],
  ['src/screens/ARScreen.tsx', "'Tracking lost. Point back at where you were and move slowly.'", "t('ar.statusLost')", { 'ar.statusLost': 'Tracking lost. Point back at where you were and move slowly.' }],
  ['src/screens/ARScreen.tsx', "`Floor found. Placing ${product?.name ?? 'your piece'}…`", "t('ar.statusPlacing', { name: product?.name ?? t('ar.yourPiece') })", { 'ar.statusPlacing': 'Floor found. Placing {{name}}…', 'ar.yourPiece': 'your piece' }],
  ['src/screens/ARScreen.tsx', "'Floor found. Aim the dot where you want it.'", "t('ar.statusFound')", { 'ar.statusFound': 'Floor found. Aim the dot where you want it.' }],
  ['src/screens/ARScreen.tsx', "'Move your phone slowly to scan the floor.'", "t('ar.statusScanFloor')", { 'ar.statusScanFloor': 'Move your phone slowly to scan the floor.' }],
  ['src/screens/ARScreen.tsx', "`Room ${(scan.box.widthCm / 100).toFixed(1)} × ${(scan.box.depthCm / 100).toFixed(1)} m · ${scan.box.areaM2.toFixed(1)} m² · ${Math.max(0, scan.box.areaM2 - usedM2).toFixed(1)} m² free`", "t('ar.roomLine', { w: (scan.box.widthCm / 100).toFixed(1), d: (scan.box.depthCm / 100).toFixed(1), area: scan.box.areaM2.toFixed(1), free: Math.max(0, scan.box.areaM2 - usedM2).toFixed(1) })", { 'ar.roomLine': 'Room {{w}} × {{d}} m · {{area}} m² · {{free}} m² free' }],
  ['src/screens/ARScreen.tsx', "`${selectedProduct.name} · ${sizeLabel(selectedProduct)}${!selectedProduct.model3D ? ' · simplified shape' : ''}${selected.scale !== 1 ? ` · ${Math.round(selected.scale * 100)}% size` : ''}`", "`${selectedProduct.name} · ${sizeLabel(selectedProduct)}${!selectedProduct.model3D ? ` · ${t('ar.simplifiedShape')}` : ''}${selected.scale !== 1 ? ` · ${t('ar.sizePercent', { pct: Math.round(selected.scale * 100) })}` : ''}`", { 'ar.simplifiedShape': 'simplified shape', 'ar.sizePercent': '{{pct}}% size' }],
  ['src/screens/ARScreen.tsx', "`Place ${product?.name ?? 'furniture'}`", "t('ar.placeProduct', { name: product?.name ?? t('ar.furniture') })", { 'ar.placeProduct': 'Place {{name}}', 'ar.furniture': 'furniture' }],
  ['src/screens/ARScreen.tsx', "[{ text: 'Not now', style: 'cancel' }, { text: 'Sign in', onPress:", "[{ text: t('common.notNow'), style: 'cancel' }, { text: t('nav.signIn'), onPress:", { 'common.notNow': 'Not now', 'nav.signIn': 'Sign in' }],
  // auth screens
  ['src/screens/auth/ForgotPasswordScreen.tsx', "busy ? 'Sending…' : 'Send code'", "busy ? t('auth.sending') : t('auth.sendCode')", { 'auth.sending': 'Sending…', 'auth.sendCode': 'Send code' }],
  ['src/screens/auth/parts.tsx', "'Something went wrong. Try again.'", "t('common.wentWrong')", { 'common.wentWrong': 'Something went wrong. Try again.' }],
  ['src/screens/auth/ResetPasswordScreen.tsx', "busy ? 'Saving…' : 'Change password'", "busy ? t('auth.saving') : t('auth.changePassword')", { 'auth.saving': 'Saving…', 'auth.changePassword': 'Change password' }],
  ['src/screens/auth/SignInScreen.tsx', "busy ? 'Signing in…' : 'Sign in'", "busy ? t('auth.signingIn') : t('nav.signIn')", { 'auth.signingIn': 'Signing in…', 'nav.signIn': 'Sign in' }],
  ['src/screens/auth/SignUpScreen.tsx', "busy ? 'Creating…' : 'Create account'", "busy ? t('auth.creating') : t('nav.signUp')", { 'auth.creating': 'Creating…', 'nav.signUp': 'Create account' }],
  ['src/screens/auth/SocialButtons.tsx', "busy ? 'Signing in…' : 'Continue with Google'", "busy ? t('auth.signingIn') : t('auth.google')", { 'auth.google': 'Continue with Google' }],
  ['src/screens/auth/SocialButtons.tsx', "label=\"Continue with Apple\"", "label={t('auth.apple')}", { 'auth.apple': 'Continue with Apple' }],
  ['src/screens/auth/VerifyEmailScreen.tsx', "setNote('A new code is on its way.')", "setNote(t('auth.newCode'))", { 'auth.newCode': 'A new code is on its way.' }],
  ['src/screens/auth/VerifyEmailScreen.tsx', "busy ? 'Checking…' : 'Verify'", "busy ? t('auth.checking') : t('auth.verify')", { 'auth.checking': 'Checking…', 'auth.verify': 'Verify' }],
  ['src/screens/auth/VerifyEmailScreen.tsx', "wait > 0 ? `Send a new code (${wait}s)` : 'Send a new code'", "wait > 0 ? t('auth.resendIn', { s: wait }) : t('auth.resend')", { 'auth.resendIn': 'Send a new code ({{s}}s)', 'auth.resend': 'Send a new code' }],
  // screens
  ['src/screens/DesignsScreen.tsx', "`Open ${p.name}`", "t('designs.open', { name: p.name })", { 'designs.open': 'Open {{name}}' }],
  ['src/screens/DesignsScreen.tsx', "`Photo of ${d.name}`", "t('designs.photoOf', { name: d.name })", { 'designs.photoOf': 'Photo of {{name}}' }],
  ['src/screens/DesignsScreen.tsx', "synced: ['☁ ✓', 'Backed up'], pending: ['☁ …', 'Waiting to back up'], local: ['📱', 'On this phone only']", "synced: ['☁ ✓', 'designs.synced'], pending: ['☁ …', 'designs.pending'], local: ['📱', 'designs.local']", { 'designs.synced': 'Backed up', 'designs.pending': 'Waiting to back up', 'designs.local': 'On this phone only' }],
  ['src/screens/DesignsScreen.tsx', "accessibilityLabel={BADGE[state][1]}", "accessibilityLabel={t(BADGE[state][1])}", {}],
  ['src/screens/DesignsScreen.tsx', "[{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: () => remove(d.id) }]", "[{ text: t('common.cancel') }, { text: t('designs.delete'), style: 'destructive', onPress: () => remove(d.id) }]", {}],
  ['src/screens/ItemScreen.tsx', "`Show ${v.name}`", "t('item.show', { name: v.name })", { 'item.show': 'Show {{name}}' }],
  ['src/screens/LibraryScreen.tsx', "`Category ${c ?? 'All'}`", "t('picker.category', { name: c ?? t('picker.all') })", { 'picker.category': 'Category {{name}}', 'picker.all': 'All' }],
  ['src/screens/LibraryScreen.tsx', "{c ?? 'All'}", "{c ?? t('picker.all')}", {}],
  ['src/screens/LibraryScreen.tsx', "item.demo ? 'Demo model' : item.model3D ? 'AR ready' : item.proxy ? 'AR · simplified shape' : 'Size under review'", "item.demo ? t('library.badgeDemo') : item.model3D ? t('library.badgeReady') : item.proxy ? t('library.badgeShape') : t('library.badgeReview')", { 'library.badgeDemo': 'Demo model', 'library.badgeReady': 'AR ready', 'library.badgeShape': 'AR · simplified shape', 'library.badgeReview': 'Size under review' }],
  ['src/screens/PlanScreen.tsx', "colliding.length ? 'Pieces overlap. Drag one clear of the red outline.' : narrow.length ? 'A gap under 60 cm between big pieces is hard to walk through.' : p.pieces.length ? 'Looks good. Drag a piece to move it.' : 'Add a piece to start.'", "colliding.length ? t('ar.statusOverlap') : narrow.length ? t('plan.statusNarrow') : p.pieces.length ? t('plan.statusGood') : t('plan.statusEmpty')", { 'plan.statusNarrow': 'A gap under 60 cm between big pieces is hard to walk through.', 'plan.statusGood': 'Looks good. Drag a piece to move it.', 'plan.statusEmpty': 'Add a piece to start.' }],
  ['src/screens/PlanScreen.tsx', "adding ? 'Close list' : 'Add piece'", "adding ? t('plan.closeList') : t('plan.addPiece')", { 'plan.closeList': 'Close list', 'plan.addPiece': 'Add piece' }],
  ['src/screens/PlanScreen.tsx', "[{ text: 'Stay here' }, { text: 'Go to Saved', onPress:", "[{ text: t('plan.stayHere') }, { text: t('plan.goToSaved'), onPress:", { 'plan.stayHere': 'Stay here', 'plan.goToSaved': 'Go to Saved' }],
  ['src/screens/RoomDetailScreen.tsx', "fitsScanned(room, scan) ? 'Fits your scanned room' : 'Larger than your scanned room'", "fitsScanned(room, scan) ? t('rooms.fits') : t('rooms.largerScanned')", { 'rooms.fits': 'Fits your scanned room', 'rooms.largerScanned': 'Larger than your scanned room', 'rooms.larger': 'Larger than your room' }],
  ['src/screens/RoomDetailScreen.tsx', "`Open ${product.name}`", "t('designs.open', { name: product.name })", {}],
  ['src/screens/RoomsScreen.tsx', "`Show ${t ? ROOM_LABEL[t] : 'all'} rooms`", "t('rooms.showType', { type: tp ? ROOM_LABEL[tp] : t('picker.all') })", { 'rooms.showType': 'Show {{type}} rooms' }],
  ['src/screens/RoomsScreen.tsx', "`Open ${r.title}`", "t('designs.open', { name: r.title })", {}],
  ['src/screens/RoomsScreen.tsx', "fitsScanned(r, scan) ? 'Fits your scanned room' : 'Larger than your room'", "fitsScanned(r, scan) ? t('rooms.fits') : t('rooms.larger')", {}],
  ['src/screens/SettingsScreen.tsx', "{qualityAuto ? ` We chose ${quality === 'high' ? 'High' : 'Standard'} for this phone.` : ''}", "{qualityAuto ? ` ${t('settings.autoChose', { quality: quality === 'high' ? t('settings.high') : t('settings.standard') })}` : ''}", { 'settings.autoChose': 'We chose {{quality}} for this phone.', 'settings.high': 'High', 'settings.standard': 'Standard' }],
  ['src/screens/SharedDesignScreen.tsx', "e instanceof Error ? e.message : 'Could not open this link.'", "e instanceof Error ? e.message : t('shared.openFailed')", { 'shared.openFailed': 'Could not open this link.' }],
  ['src/screens/SharedDesignScreen.tsx', "error === 'This link is no longer available' ? 'This shared design is no longer available. The owner may have stopped sharing it.' : error", "error === 'This link is no longer available' ? t('shared.gone') : error", { 'shared.gone': 'This shared design is no longer available. The owner may have stopped sharing it.' }],
  ['src/screens/SharedDesignScreen.tsx', "`Photo of ${shared.name}`", "t('designs.photoOf', { name: shared.name })", {}],
  ['src/screens/WelcomeScreen.tsx', "`Small · about ${PRESET_AREA.small} m²`", "t('welcome.sizeSmall', { area: PRESET_AREA.small })", { 'welcome.sizeSmall': 'Small · about {{area}} m²' }],
  ['src/screens/WelcomeScreen.tsx', "`Medium · about ${PRESET_AREA.medium} m²`", "t('welcome.sizeMedium', { area: PRESET_AREA.medium })", { 'welcome.sizeMedium': 'Medium · about {{area}} m²' }],
  ['src/screens/WelcomeScreen.tsx', "`Large · about ${PRESET_AREA.large} m²`", "t('welcome.sizeLarge', { area: PRESET_AREA.large })", { 'welcome.sizeLarge': 'Large · about {{area}} m²' }],
  ['src/screens/WelcomeScreen.tsx', "arSupported === false ? 'This phone cannot do AR, so you will draw your room on a plan instead.' : 'A camera scan replaces this guess with measured numbers.'", "arSupported === false ? t('welcome.noAr') : t('welcome.scanNote')", { 'welcome.noAr': 'This phone cannot do AR, so you will draw your room on a plan instead.', 'welcome.scanNote': 'A camera scan replaces this guess with measured numbers.' }],
  ['src/screens/WelcomeScreen.tsx', "arSupported === false ? 'Plan my room' : 'Scan my room'", "arSupported === false ? t('welcome.planRoom') : t('welcome.scanRoom')", { 'welcome.planRoom': 'Plan my room', 'welcome.scanRoom': 'Scan my room' }],
];

for (const [file, from, to, keys] of ROWS) {
  const f = path.resolve(file);
  let src = fs.readFileSync(f, 'utf8');
  for (const [k, v] of Object.entries(keys)) setKey(k, v);
  if (from === to) continue; // key-only row
  if (!src.includes(from) && src.includes(to)) continue; // already done
  if (!src.includes(from)) { console.error(`NOT FOUND in ${file}: ${from.slice(0, 90)}`); process.exitCode = 1; continue; }
  fs.writeFileSync(f, src.split(from).join(to));
}
fs.writeFileSync(EN, JSON.stringify(en, null, 2) + '\n');
console.log(`${ROWS.length} rows`);
