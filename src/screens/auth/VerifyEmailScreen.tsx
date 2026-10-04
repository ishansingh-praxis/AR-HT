import React, { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/ui';
import { useAuth } from '../../store/authStore';
import { requestVerification, verifyEmail } from '../../services/account';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { authStyles, Field, FormError, messageOf, Para, Title } from './parts';
import { t } from '../../i18n';

const RESEND_SECONDS = 30;

export default function VerifyEmailScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'VerifyEmail'>) {
  const email = useAuth((a) => a.email);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(RESEND_SECONDS);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);

  const confirm = async () => {
    setBusy(true); setError(null);
    try { await verifyEmail(code); navigation.popToTop(); } catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  };
  const resend = async () => {
    setError(null); setNote(null);
    try { await requestVerification(); setWait(RESEND_SECONDS); setNote(t('auth.newCode')); } catch (e) { setError(messageOf(e)); }
  };
  return (
    <ScrollView style={authStyles.page} contentContainerStyle={authStyles.body} keyboardShouldPersistTaps="handled">
      <Title>{t('verifyEmail.checkYourEmail')}</Title>
      <Para>We sent a 6-digit code to {email ?? 'your email'}. It works for 15 minutes.</Para>
      <Field label={t('resetPassword.6DigitCode')} value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" maxLength={6} onSubmitEditing={confirm} />
      <FormError text={error ?? note} />
      <Button label={busy ? t('auth.checking') : t('auth.verify')} disabled={busy || code.length !== 6} onPress={confirm} />
      <Button label={wait > 0 ? t('auth.resendIn', { s: wait }) : t('auth.resend')} variant="outline" disabled={wait > 0} onPress={resend} style={{ marginTop: 10 }} />
      <Button label={t('verifyEmail.notNow')} variant="outline" onPress={() => navigation.popToTop()} style={{ marginTop: 10 }} />
      <Para>{t('verifyEmail.youCanUseThe')}</Para>
    </ScrollView>
  );
}
