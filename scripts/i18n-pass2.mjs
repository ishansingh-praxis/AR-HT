// One-off second pass of the string move (see extract-strings.mjs): the dynamic strings (ternaries, template literals) that need
// a human to decide the key and the {{placeholders}}. Each row: [file, exact old source, new source, { key: English text }].
import fs from 'node:fs';
import path from 'node:path';

const EN = path.resolve('src/i18n/en.json');
const en = JSON.parse(fs.readFileSync(EN, 'utf8'));
const setKey = (k, v) => { const [g, ...rest] = k.split('.'); (en[g] ??= {})[rest.join('.')] = v; };

const ROWS = [
  // AR bottom sheet
  ['src/features/ar/components/BottomSheet.tsx', "p.scan.box ? 'Re-scan' : 'Scan room'", "p.scan.box ? t('sheet.rescan') : t('sheet.scanRoom')", { 'sheet.rescan': 'Re-scan', 'sheet.scanRoom': 'Scan room' }],
  ['src/features/ar/components/BottomSheet.tsx', "p.tools.thinking ? 'Thinking…' : 'AI layout'", "p.tools.thinking ? t('sheet.thinking') : t('sheet.aiLayout')", { 'sheet.thinking': 'Thinking…', 'sheet.aiLayout': 'AI layout' }],
  ['src/features/ar/components/BottomSheet.tsx', "p.tools.thinking ? 'Working…' : 'Pin to room'", "p.tools.thinking ? t('sheet.working') : t('sheet.pinToRoom')", { 'sheet.working': 'Working…', 'sheet.pinToRoom': 'Pin to room' }],
  ['src/features/ar/components/BottomSheet.tsx', "`Add wall point (${wall.points.length + 1}/2)`", "t('sheet.addWallPoint', { n: wall.points.length + 1 })", { 'sheet.addWallPoint': 'Add wall point ({{n}}/2)' }],
  ['src/features/ar/components/BottomSheet.tsx', "`Place sample room ${r.title}`", "t('sheet.placeSampleRoom', { title: r.title })", { 'sheet.placeSampleRoom': 'Place sample room {{title}}' }],
  ['src/features/ar/components/BottomSheet.tsx', "TABS.map((t) =>", "TABS.map((name) =>", {}],
  ['src/features/ar/components/BottomSheet.tsx', "key={t} accessibilityRole=\"tab\" accessibilityLabel={t} accessibilityState={{ selected: tab === t }} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabOn]}", "key={name} accessibilityRole=\"tab\" accessibilityLabel={t(`sheet.tab${name}`)} accessibilityState={{ selected: tab === name }} onPress={() => setTab(name)} style={[s.tab, tab === name && s.tabOn]}", { 'sheet.tabSuggested': 'Suggested', 'sheet.tabAll': 'All', 'sheet.tabRooms': 'Rooms', 'sheet.tabTools': 'Tools' }],
  ['src/features/ar/components/BottomSheet.tsx', "<Text style={[s.tabText, tab === t && { color: colors.accentInk }]}>{t}</Text>", "<Text style={[s.tabText, tab === name && { color: colors.accentInk }]}>{t(`sheet.tab${name}`)}</Text>", {}],
  ['src/features/ar/components/CoachingOverlay.tsx', "{lost ? 'Lost your place' : 'Scan your floor'}", "{lost ? t('coaching.lost') : t('coaching.scanFloor')}", { 'coaching.lost': 'Lost your place', 'coaching.scanFloor': 'Scan your floor' }],
  ['src/features/ar/components/PermissionGate.tsx', "{state === 'checking' ? 'Starting camera…' : 'Camera access is needed'}", "{state === 'checking' ? t('permissionGate.starting') : t('permissionGate.needed')}", { 'permissionGate.starting': 'Starting camera…', 'permissionGate.needed': 'Camera access is needed' }],
  ['src/features/ar/components/ProductPicker.tsx', "`Category ${c ?? 'All'}`", "t('picker.category', { name: c ?? t('picker.all') })", { 'picker.category': 'Category {{name}}', 'picker.all': 'All' }],
  ['src/features/ar/components/ProductPicker.tsx', "{c ?? 'All'}", "{c ?? t('picker.all')}", {}],
  ['src/features/ar/components/ProductPicker.tsx', "`Select ${f.name}`", "t('picker.select', { name: f.name })", { 'picker.select': 'Select {{name}}' }],
  ['src/features/ar/components/SelectionActions.tsx', "`Option: ${variantLabel(p, selected)}`", "t('selection.option', { name: variantLabel(p, selected) })", { 'selection.option': 'Option: {{name}}' }],
  ['src/features/ar/components/SelectionActions.tsx', "`Pairs with: ${p.name}`", "t('selection.pairsWith', { name: p.name })", { 'selection.pairsWith': 'Pairs with: {{name}}' }],
  ['src/features/ar/components/SelectionActions.tsx', "`Swap: ${p.name}`", "t('selection.swap', { name: p.name })", { 'selection.swap': 'Swap: {{name}}' }],
  ['src/features/ar/components/SuggestionChips.tsx', "`Select ${r.product.name}. ${r.reasons[0]}`", "t('suggestions.select', { name: r.product.name, reason: r.reasons[0] })", { 'suggestions.select': 'Select {{name}}. {{reason}}' }],
  ['src/features/ar/components/TopBar.tsx', "recording ? 'Stop' : 'Record'", "recording ? t('topBar.stop') : t('topBar.record')", { 'topBar.stop': 'Stop', 'topBar.record': 'Record' }],
  ['src/features/ar/useCapture.ts', "{ message: 'My room design', url: r.url }", "{ message: t('capture.myRoomDesign'), url: r.url }", { 'capture.myRoomDesign': 'My room design' }],
  ['src/features/ar/useCapture.ts', "r?.success ? 'Video saved to Photos' : 'Could not save video'", "r?.success ? t('capture.videoSaved') : t('capture.videoFailed')", { 'capture.videoSaved': 'Video saved to Photos', 'capture.videoFailed': 'Could not save video' }],
  ['src/features/ar/useDesignIO.ts', "new Error('No usable suggestions this time.')", "new Error(t('designIO.noSuggestions'))", { 'designIO.noSuggestions': 'No usable suggestions this time.' }],
  ['src/features/ar/useDesignIO.ts', "ErrorNotAuthorized: 'Cloud anchors are not set up in this build (check the ReactVision key).', ErrorHostingDatasetProcessingFailed: 'Move around the room more so the phone sees enough of it, then try again.', ErrorResourceExhausted: 'The cloud-anchor quota is used up. Try again later.'", "ErrorNotAuthorized: t('designIO.anchorNotAuthorized'), ErrorHostingDatasetProcessingFailed: t('designIO.anchorMoveMore'), ErrorResourceExhausted: t('designIO.anchorQuota')", { 'designIO.anchorNotAuthorized': 'Cloud anchors are not set up in this build (check the ReactVision key).', 'designIO.anchorMoveMore': 'Move around the room more so the phone sees enough of it, then try again.', 'designIO.anchorQuota': 'The cloud-anchor quota is used up. Try again later.' }],
  ['src/features/ar/useDesignIO.ts', "?? 'Hosting failed.'", "?? t('designIO.hostingFailed')", { 'designIO.hostingFailed': 'Hosting failed.' }],
  ['src/features/ar/useDesignIO.ts', "active?.cloudAnchorId ? 'Find my room & place' : 'Place at reference points') : curated ? `Place ${curated.title}` : 'Place layout'", "active?.cloudAnchorId ? t('designIO.findRoomPlace') : t('designIO.placeAtReference')) : curated ? t('designIO.placeRoom', { title: curated.title }) : t('designIO.placeLayout')", { 'designIO.findRoomPlace': 'Find my room & place', 'designIO.placeAtReference': 'Place at reference points', 'designIO.placeRoom': 'Place {{title}}', 'designIO.placeLayout': 'Place layout' }],
  ['src/features/ar/useDesignIO.ts', "`${made.length} pieces around ${anchor.name}. Aim at the floor and tap Place layout.`", "t('designIO.layoutReadyBody', { count: made.length, name: anchor.name })", { 'designIO.layoutReadyBody': '{{count}} pieces around {{name}}. Aim at the floor and tap Place layout.' }],
  ['src/features/ar/useDesignIO.ts', "{ text: 'Cancel', style: 'cancel' }, { text: 'Place anyway', onPress: go }", "{ text: t('common.cancel'), style: 'cancel' }, { text: t('designIO.placeAnyway'), onPress: go }", { 'common.cancel': 'Cancel', 'designIO.placeAnyway': 'Place anyway' }],
  ['src/features/ar/useScan.ts', "`The marked area is under ${MIN_ROOM_M2} m². Undo and mark the real floor corners.`", "t('scan.tooSmallBody', { area: MIN_ROOM_M2 })", { 'scan.tooSmallBody': 'The marked area is under {{area}} m². Undo and mark the real floor corners.' }],
  ['src/features/ar/useScan.ts', "`${(b.widthCm / 100).toFixed(1)} × ${(b.depthCm / 100).toFixed(1)} m · ${b.areaM2.toFixed(1)} m².` +\n      (b.rectangularity < MIN_RECTANGULARITY ? '\\nThis room is not a simple rectangle, so layouts are fitted to its bounding box. Check walkways by eye.' : '') +\n      '\\nTip: start the scan from the same corner next time to restore a saved design here.',",
   "t('scan.scannedBody', { w: (b.widthCm / 100).toFixed(1), d: (b.depthCm / 100).toFixed(1), area: b.areaM2.toFixed(1) }) +\n      (b.rectangularity < MIN_RECTANGULARITY ? '\\n' + t('scan.notRectangle') : '') +\n      '\\n' + t('scan.tip'),",
   { 'scan.scannedBody': '{{w}} × {{d}} m · {{area}} m².', 'scan.notRectangle': 'This room is not a simple rectangle, so layouts are fitted to its bounding box. Check walkways by eye.', 'scan.tip': 'Tip: start the scan from the same corner next time to restore a saved design here.' }],
  ['src/features/ar/usePlacement.ts', "`Up to ${MAX_PIECES} pieces can be placed at once so the camera stays smooth. Delete one to add another.`", "t('placement.limitBody', { max: MAX_PIECES })", { 'placement.limitBody': 'Up to {{max}} pieces can be placed at once so the camera stays smooth. Delete one to add another.' }],
  ['src/features/ar/usePlacement.ts', "`Up to ${MAX_PIECES} pieces can be placed at once.`", "t('placement.limitShort', { max: MAX_PIECES })", { 'placement.limitShort': 'Up to {{max}} pieces can be placed at once.' }],
  ['src/features/plan/PieceList.tsx', "label: 'Move north'", "label: t('plan.moveNorth')", { 'plan.moveNorth': 'Move north' }],
  ['src/features/plan/PieceList.tsx', "label: 'Move south'", "label: t('plan.moveSouth')", { 'plan.moveSouth': 'Move south' }],
  ['src/features/plan/PieceList.tsx', "label: 'Move west'", "label: t('plan.moveWest')", { 'plan.moveWest': 'Move west' }],
  ['src/features/plan/PieceList.tsx', "label: 'Move east'", "label: t('plan.moveEast')", { 'plan.moveEast': 'Move east' }],
  ['src/features/plan/PieceList.tsx', "label: 'Turn 90 degrees right'", "label: t('plan.turnRight')", { 'plan.turnRight': 'Turn 90 degrees right' }],
  ['src/features/plan/PieceList.tsx', "label: 'Turn 90 degrees left'", "label: t('plan.turnLeft')", { 'plan.turnLeft': 'Turn 90 degrees left' }],
  ['src/features/plan/PieceList.tsx', "label: 'Remove piece'", "label: t('plan.removePiece')", { 'plan.removePiece': 'Remove piece' }],
  ['src/features/plan/PlanCanvas.tsx', "`Plan of your room, ${Math.round(room.w)} by ${Math.round(room.d)} centimetres`", "t('plan.canvasTitle', { w: Math.round(room.w), d: Math.round(room.d) })", { 'plan.canvasTitle': 'Plan of your room, {{w}} by {{d}} centimetres' }],
  ['src/features/plan/PlanCanvas.tsx', "`Room plan, ${Math.round(room.w)} by ${Math.round(room.d)} centimetres. Use the list below to move pieces with a screen reader.`", "t('plan.canvasLabel', { w: Math.round(room.w), d: Math.round(room.d) })", { 'plan.canvasLabel': 'Room plan, {{w}} by {{d}} centimetres. Use the list below to move pieces with a screen reader.' }],
  // components
  ['src/components/AccountSection.tsx', "{syncing ? 'Syncing…' : `Last synced ${ago(lastSyncedAt)}`} · {outbox.length === 0 ? 'nothing waiting' : `${outbox.length} change${outbox.length === 1 ? '' : 's'} waiting`}", "{syncing ? t('account.syncing') : t('account.lastSynced', { when: ago(lastSyncedAt) })} · {outbox.length === 0 ? t('account.nothingWaiting') : t('account.changesWaiting', { count: outbox.length })}", { 'account.syncing': 'Syncing…', 'account.lastSynced': 'Last synced {{when}}', 'account.nothingWaiting': 'nothing waiting', 'account.changesWaiting_one': '{{count}} change waiting', 'account.changesWaiting_other': '{{count}} changes waiting' }],
  ['src/components/AccountSection.tsx', "syncing ? 'Syncing…' : 'Sync now'", "syncing ? t('account.syncing') : t('account.syncNow')", { 'account.syncNow': 'Sync now' }],
  ['src/components/AccountSection.tsx', "token ? 'This deletes your account, saved designs and saved furniture from our server and from this phone. It cannot be undone.' : 'This deletes every saved design and setting on this phone. It cannot be undone.'", "token ? t('account.deleteBodySignedIn') : t('account.deleteBodyGuest')", { 'account.deleteBodySignedIn': 'This deletes your account, saved designs and saved furniture from our server and from this phone. It cannot be undone.', 'account.deleteBodyGuest': 'This deletes every saved design and setting on this phone. It cannot be undone.' }],
  ['src/components/AccountSection.tsx', "{ text: 'Cancel', style: 'cancel' }, {\n      text: 'Continue', style: 'destructive',", "{ text: t('common.cancel'), style: 'cancel' }, {\n      text: t('common.continue'), style: 'destructive',", { 'common.continue': 'Continue' }],
  ['src/components/AccountSection.tsx', "{ text: 'Keep my data', style: 'cancel' },\n        { text: 'Delete everything', style: 'destructive',", "{ text: t('account.keepData'), style: 'cancel' },\n        { text: t('account.deleteEverything'), style: 'destructive',", { 'account.keepData': 'Keep my data', 'account.deleteEverything': 'Delete everything' }],
  ['src/components/AccountSection.tsx', "e instanceof Error ? e.message : 'Check your connection and try again.'", "e instanceof Error ? e.message : t('common.checkConnection')", { 'common.checkConnection': 'Check your connection and try again.' }],
  ['src/components/AccountSection.tsx', "busy ? 'Deleting…' : 'Delete my data'", "busy ? t('account.deleting') : t('account.deleteMyData')", { 'account.deleting': 'Deleting…', 'account.deleteMyData': 'Delete my data' }],
  ['src/components/FitCalculator.tsx', "answer.prefillCm ? `Free width in cm (your longest wall: ${Math.round(answer.prefillCm)})` : 'Free width in cm'", "answer.prefillCm ? t('fit.placeholderWall', { cm: Math.round(answer.prefillCm) }) : t('fit.placeholder')", { 'fit.placeholderWall': 'Free width in cm (your longest wall: {{cm}})', 'fit.placeholder': 'Free width in cm' }],
  ['src/components/Product360.tsx', "{item.model3D ? 'Drag to turn it around' : photo ? '360° preview: true size, product photo wrapped on' : 'Simplified shape at real size'}", "{item.model3D ? t('p360.drag') : photo ? t('p360.photoWrap') : t('p360.shape')}", { 'p360.drag': 'Drag to turn it around', 'p360.photoWrap': '360° preview: true size, product photo wrapped on', 'p360.shape': 'Simplified shape at real size' }],
  ['src/components/Product360.tsx', "{m === '360' ? '360° view' : `Photos (${item.images.length})`}", "{m === '360' ? t('p360.tab360') : t('p360.tabPhotos', { count: item.images.length })}", { 'p360.tab360': '360° view', 'p360.tabPhotos': 'Photos ({{count}})' }],
  ['src/components/Product360.tsx', "m === '360' ? '360 degree view' : 'Photos'", "m === '360' ? t('p360.label360') : t('p360.labelPhotos')", { 'p360.label360': '360 degree view', 'p360.labelPhotos': 'Photos' }],
  ['src/components/Product360.tsx', "`${item.name}, photo ${i + 1} of ${item.images.length}`", "t('p360.photoLabel', { name: item.name, n: i + 1, total: item.images.length })", { 'p360.photoLabel': '{{name}}, photo {{n}} of {{total}}' }],
  ['src/components/RoomPlan.tsx', "room ? `Plan of ${room.title}, ${room.roomCm.w} by ${room.roomCm.d} centimetres` : `Plan of your design, ${plan.roomCm.w} by ${plan.roomCm.d} centimetres`", "room ? t('roomPlan.room', { title: room.title, w: room.roomCm.w, d: room.roomCm.d }) : t('roomPlan.design', { w: plan.roomCm.w, d: plan.roomCm.d })", { 'roomPlan.room': 'Plan of {{title}}, {{w}} by {{d}} centimetres', 'roomPlan.design': 'Plan of your design, {{w}} by {{d}} centimetres' }],
  ['src/components/ui.tsx', "saved ? 'Remove from saved furniture' : 'Save for later'", "saved ? t('ui.removeSaved') : t('ui.saveForLater')", { 'ui.removeSaved': 'Remove from saved furniture', 'ui.saveForLater': 'Save for later' }],
  // navigation titles
  ['src/navigation/AppNavigator.tsx', "{ title: 'Plan view' }", "{ title: t('nav.plan') }", { 'nav.plan': 'Plan view' }],
  ['src/navigation/AppNavigator.tsx', "{ title: 'Shared design' }", "{ title: t('nav.shared') }", { 'nav.shared': 'Shared design' }],
  ['src/navigation/AppNavigator.tsx', "{ title: 'Sign in' }", "{ title: t('nav.signIn') }", { 'nav.signIn': 'Sign in' }],
  ['src/navigation/AppNavigator.tsx', "{ title: 'Create account' }", "{ title: t('nav.signUp') }", { 'nav.signUp': 'Create account' }],
  ['src/navigation/AppNavigator.tsx', "{ title: 'Verify email' }", "{ title: t('nav.verify') }", { 'nav.verify': 'Verify email' }],
  ['src/navigation/AppNavigator.tsx', "{ title: 'Forgot password' }", "{ title: t('nav.forgot') }", { 'nav.forgot': 'Forgot password' }],
  ['src/navigation/AppNavigator.tsx', "{ title: 'New password' }", "{ title: t('nav.reset') }", { 'nav.reset': 'New password' }],
  ['src/navigation/AppNavigator.tsx', "{ title: 'Room' }", "{ title: t('nav.room') }", { 'nav.room': 'Room' }],
];

let changed = new Set();
for (const [file, from, to, keys] of ROWS) {
  const f = path.resolve(file);
  let src = fs.readFileSync(f, 'utf8');
  if (!src.includes(from) && src.includes(to)) { for (const [k, v] of Object.entries(keys)) setKey(k, v); continue; }
  if (!src.includes(from)) { console.error(`NOT FOUND in ${file}: ${from.slice(0, 80)}`); process.exitCode = 1; continue; }
  src = src.split(from).join(to);
  for (const [k, v] of Object.entries(keys)) setKey(k, v);
  fs.writeFileSync(f, src);
  changed.add(file);
}
for (const file of changed) {
  let src = fs.readFileSync(file, 'utf8');
  if (!/from '(\.\.?\/)+i18n'/.test(src)) {
    const rel = path.relative(path.dirname(file), path.resolve('src/i18n')).split(path.sep).join('/');
    const imp = `import { t } from '${rel.startsWith('.') ? rel : './' + rel}';\n`;
    const last = [...src.matchAll(/^import .*;\n/gm)].pop();
    src = src.slice(0, last.index + last[0].length) + imp + src.slice(last.index + last[0].length);
    fs.writeFileSync(file, src);
  }
}
fs.writeFileSync(EN, JSON.stringify(en, null, 2) + '\n');
console.log(`${ROWS.length} rows, ${changed.size} files`);
