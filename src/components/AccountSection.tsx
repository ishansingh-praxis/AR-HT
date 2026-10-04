import { t } from '../i18n';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button } from './ui';
import { useAuth, useAuthStatus } from '../store/authStore';
import { useSync } from '../store/syncStore';
import { cloud } from '../services/api';
import { runSync } from '../services/sync';
import { deleteEverything, signOut } from '../services/account';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ago = (t: number | null) => {
  if (!t) return 'never';
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

/** "Verify your email" notice: unverified accounts can use the app, but cloud sync waits for the code. */
export function VerifyBanner() {
  const status = useAuthStatus();
  const nav = useNavigation<Nav>();
  if (status !== 'unverified') return null;
  return (
    <View style={s.banner} accessibilityRole="alert">
      <Text style={s.bannerText}>{t('accountSection.verifyYourEmailTo')}</Text>
      <Button label={t('accountSection.enterCode')} variant="outline" onPress={() => nav.navigate('VerifyEmail')} />
    </View>
  );
}

/** Sync row: last synced, how many changes are waiting, and the last error. */
export function SyncStatusRow() {
  const { lastSyncedAt, syncing, error, outbox } = useSync();
  const status = useAuthStatus();
  if (status !== 'signedIn') return null;
  return (
    <View style={s.sync} accessibilityLabel={t('accountSection.syncStatus')}>
      <Text style={s.p}>
        {syncing ? t('account.syncing') : t('account.lastSynced', { when: ago(lastSyncedAt) })} · {outbox.length === 0 ? t('account.nothingWaiting') : t('account.changesWaiting', { count: outbox.length })}
      </Text>
      {error ? <Text style={[s.p, { color: colors.danger }]}>Last problem: {error}</Text> : null}
      <Button label={syncing ? t('account.syncing') : t('account.syncNow')} variant="outline" disabled={syncing} onPress={() => { runSync(); }} />
    </View>
  );
}

export function AccountSection() {
  const nav = useNavigation<Nav>();
  const user = useAuth((a) => a.user);
  const token = useAuth((a) => a.token);
  const status = useAuthStatus();
  const [busy, setBusy] = useState(false);

  const confirmDelete = () => Alert.alert(t('accountSection.deleteAllData'),
    token ? t('account.deleteBodySignedIn') : t('account.deleteBodyGuest'),
    [{ text: t('common.cancel'), style: 'cancel' }, {
      text: t('common.continue'), style: 'destructive',
      onPress: () => Alert.alert(t('accountSection.areYouAbsolutelySure'), t('accountSection.lastChanceEverythingWill'), [
        { text: t('account.keepData'), style: 'cancel' },
        { text: t('account.deleteEverything'), style: 'destructive', onPress: async () => {
          setBusy(true);
          try { await deleteEverything(); Alert.alert(t('accountSection.done'), t('accountSection.yourDataWasDeleted')); }
          catch (e) { Alert.alert(t('accountSection.couldNotDeleteYour'), e instanceof Error ? e.message : t('common.checkConnection')); }
          finally { setBusy(false); }
        } },
      ]),
    }],
  );

  return (
    <View>
      <Text style={s.h}>{t('accountSection.accountOptional')}</Text>
      {!cloud.enabled ? (
        <Text style={s.p}>{t('accountSection.cloudSavingIsNot')}</Text>
      ) : status === 'guest' ? (
        <>
          <Text style={s.p}>{t('accountSection.youAreUsingThe')}</Text>
          <View style={s.row}>
            <Button label={t('accountSection.signIn')} onPress={() => nav.navigate('SignIn')} style={s.flex} />
            <Button label={t('signIn.createAccount')} variant="outline" onPress={() => nav.navigate('SignUp')} style={s.flex} />
          </View>
        </>
      ) : (
        <>
          <Text style={s.p}>Signed in as {user?.email ?? 'your account'}{user?.name ? ` (${user.name})` : ''}.</Text>
          <VerifyBanner />
          <SyncStatusRow />
          <Button label={t('accountSection.signOut')} variant="outline" onPress={() => Alert.alert(t('accountSection.signOut2'), t('accountSection.yourDesignsStayOn'), [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', onPress: () => { signOut(); } }])} style={{ marginTop: 8 }} />
        </>
      )}
      <Text style={s.h}>{t('accountSection.yourData')}</Text>
      <Text style={s.p}>Designs are stored on this phone{token ? ' and in your account' : ''}. You can delete everything at any time.</Text>
      <Button label={busy ? t('account.deleting') : t('account.deleteMyData')} variant="danger" disabled={busy} onPress={confirmDelete} />
    </View>
  );
}

const s = StyleSheet.create({
  h: { fontSize: 17, fontWeight: '700', color: colors.ink, marginTop: 22, marginBottom: 6 },
  p: { color: colors.muted, lineHeight: 20, marginBottom: 12 },
  row: { flexDirection: 'row' },
  flex: { flex: 1, marginHorizontal: 3 },
  banner: { backgroundColor: '#FFF4E0', borderRadius: 10, padding: 12, marginBottom: 12 },
  bannerText: { color: colors.ink, marginBottom: 8, lineHeight: 20 },
  sync: { backgroundColor: colors.surface, borderRadius: 10, padding: 12, marginBottom: 6 },
});
