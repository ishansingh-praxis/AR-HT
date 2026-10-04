import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/ui';
import { signUp } from '../../services/account';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { authStyles, Field, FormError, messageOf, Para, Title } from './parts';
import { SocialButtons } from './SocialButtons';
import { t } from '../../i18n';

export default function SignUpScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'SignUp'>) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true); setError(null);
    try { await signUp(email, password, name); navigation.replace('VerifyEmail'); }
    catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  };
  return (
    <ScrollView style={authStyles.page} contentContainerStyle={authStyles.body} keyboardShouldPersistTaps="handled">
      <Title>{t('signIn.createAccount')}</Title>
      <Para>{t('signUp.weWillEmailYou')}</Para>
      <Field label={t('signUp.nameOptional')} value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
      <Field label={t('forgotPassword.email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <Field label={t('signUp.password8CharactersNot')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" onSubmitEditing={submit} />
      <FormError text={error} />
      <Button label={busy ? t('auth.creating') : t('nav.signUp')} disabled={busy || !email || password.length < 8} onPress={submit} />
      <Button label={t('signUp.iAlreadyHaveAn')} variant="outline" onPress={() => navigation.replace('SignIn')} style={{ marginTop: 10 }} />
      <SocialButtons onDone={() => navigation.goBack()} />
    </ScrollView>
  );
}
