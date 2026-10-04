import { t } from '../../i18n';
import React, { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Button } from '../../components/ui';
import { GOOGLE_ANDROID_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '../../config';
import { signInWithApple, signInWithGoogle } from '../../services/account';
import { colors } from '../../theme';
import { FormError, messageOf } from './parts';

WebBrowser.maybeCompleteAuthSession();

const googleConfigured = !!(GOOGLE_WEB_CLIENT_ID || GOOGLE_ANDROID_CLIENT_ID || GOOGLE_IOS_CLIENT_ID);

// The Google hook throws when no client id is set, so it lives in its own component that is only rendered when configured.
function GoogleButton({ onDone, onError }: { onDone: () => void; onError: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [, , prompt] = Google.useIdTokenAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID || undefined, androidClientId: GOOGLE_ANDROID_CLIENT_ID || undefined, iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
  });
  const press = async () => {
    setBusy(true);
    try {
      const r = await prompt();
      if (r.type === 'success') {
        const idToken = r.params?.id_token;
        if (!idToken) throw new Error('Google did not return a sign-in token.');
        await signInWithGoogle(idToken);
        onDone();
      } else if (r.type === 'error') onError('Google sign-in failed. Try again.');
    } catch (e) { onError(messageOf(e)); } finally { setBusy(false); }
  };
  return <Button label={busy ? t('auth.signingIn') : t('auth.google')} variant="outline" disabled={busy} onPress={press} />;
}

function AppleButton({ onDone, onError }: { onDone: () => void; onError: (m: string) => void }) {
  const press = async () => {
    try {
      const c = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL] });
      if (!c.identityToken) throw new Error('Apple did not return a sign-in token.');
      // Apple only shares the name the first time, so send it now.
      const name = [c.fullName?.givenName, c.fullName?.familyName].filter(Boolean).join(' ') || undefined;
      await signInWithApple(c.identityToken, name);
      onDone();
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') onError(messageOf(e));
    }
  };
  return <Button label={t('socialButtons.continueWithApple')} variant="outline" onPress={press} />;
}

/** Google (when client ids are configured) and Apple (iOS only). Renders nothing when neither is available. */
export function SocialButtons({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [apple, setApple] = useState(false);
  useEffect(() => { if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setApple).catch(() => {}); }, []);
  if (!googleConfigured && !apple) return null;
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={{ color: colors.muted, textAlign: 'center', marginBottom: 10 }}>or</Text>
      <FormError text={error} />
      {googleConfigured && <GoogleButton onDone={onDone} onError={setError} />}
      {apple && <View style={{ marginTop: 8 }}><AppleButton onDone={onDone} onError={setError} /></View>}
    </View>
  );
}
