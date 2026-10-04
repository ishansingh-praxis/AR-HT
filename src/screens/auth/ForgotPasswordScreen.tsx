import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/ui';
import { forgotPassword } from '../../services/account';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { authStyles, Field, FormError, messageOf, Para, Title } from './parts';
import { t } from '../../i18n';

export default function ForgotPasswordScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>) {
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true); setError(null);
    try { await forgotPassword(email); navigation.replace('ResetPassword', { email: email.trim() }); } catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  };
  return (
    <ScrollView style={authStyles.page} contentContainerStyle={authStyles.body} keyboardShouldPersistTaps="handled">
      <Title>{t('forgotPassword.resetYourPassword')}</Title>
      <Para>{t('forgotPassword.enterYourEmailIf')}</Para>
      <Field label={t('forgotPassword.email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" onSubmitEditing={submit} />
      <FormError text={error} />
      <Button label={busy ? t('auth.sending') : t('auth.sendCode')} disabled={busy || !email.includes('@')} onPress={submit} />
    </ScrollView>
  );
}
