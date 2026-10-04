import React, { useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/ui';
import { signIn } from '../../services/account';
import { colors } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { authStyles, Field, FormError, messageOf, Para, Title } from './parts';
import { SocialButtons } from './SocialButtons';
import { t } from '../../i18n';

export default function SignInScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'SignIn'>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = () => navigation.goBack();
  const submit = async () => {
    setBusy(true); setError(null);
    try { const u = await signIn(email, password); if (u.emailVerified) done(); else navigation.replace('VerifyEmail'); }
    catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  };
  return (
    <ScrollView style={authStyles.page} contentContainerStyle={authStyles.body} keyboardShouldPersistTaps="handled">
      <Title>{t('accountSection.signIn')}</Title>
      <Para>{t('signIn.backUpYourDesigns')}</Para>
      <Field label={t('forgotPassword.email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <Field label={t('signIn.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={submit} />
      <FormError text={error} />
      <Button label={busy ? t('auth.signingIn') : t('nav.signIn')} disabled={busy || !email || !password} onPress={submit} />
      <Pressable accessibilityRole="link" accessibilityLabel={t('signIn.forgotPassword')} onPress={() => navigation.navigate('ForgotPassword', { email })} style={{ padding: 14, alignItems: 'center' }}>
        <Text style={{ color: colors.accent, fontWeight: '600' }}>{t('signIn.forgotPassword2')}</Text>
      </Pressable>
      <Button label={t('signIn.createAccount')} variant="outline" onPress={() => navigation.replace('SignUp')} />
      <SocialButtons onDone={done} />
    </ScrollView>
  );
}
