import React, { useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/ui';
import { resetPassword } from '../../services/account';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { authStyles, Field, FormError, messageOf, Para, Title } from './parts';
import { t } from '../../i18n';

export default function ResetPasswordScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'ResetPassword'>) {
  const { email } = route.params;
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await resetPassword(email, code, password);
      Alert.alert(t('resetPassword.passwordChanged'), t('resetPassword.signInWithYour'));
      navigation.replace('SignIn');
    } catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  };
  return (
    <ScrollView style={authStyles.page} contentContainerStyle={authStyles.body} keyboardShouldPersistTaps="handled">
      <Title>{t('resetPassword.chooseANewPassword')}</Title>
      <Para>Enter the 6-digit code we sent to {email} and a new password.</Para>
      <Field label={t('resetPassword.6DigitCode')} value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={6} />
      <Field label={t('resetPassword.newPassword8Characters')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" onSubmitEditing={submit} />
      <FormError text={error} />
      <Button label={busy ? t('auth.saving') : t('auth.changePassword')} disabled={busy || code.length !== 6 || password.length < 8} onPress={submit} />
    </ScrollView>
  );
}
