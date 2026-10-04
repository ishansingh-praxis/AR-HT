import { OAuth2Client } from 'google-auth-library';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { err } from './http.mjs';

/**
 * Verifies a Google ID token against our client ids. Returns { subject, email, emailVerified, name }.
 * Tests replace this function; production uses Google's public keys through google-auth-library.
 */
export function googleVerifier(clientIds) {
  const client = new OAuth2Client();
  return async (idToken) => {
    if (!clientIds.length) throw err(501, 'Google sign-in is not set up on this server');
    let p;
    try { p = (await client.verifyIdToken({ idToken, audience: clientIds })).getPayload(); } catch { throw err(401, 'Google sign-in could not be verified'); }
    if (!p?.sub) throw err(401, 'Google sign-in could not be verified');
    return { subject: p.sub, email: p.email?.toLowerCase(), emailVerified: p.email_verified === true, name: p.name };
  };
}

/**
 * Verifies an Apple identity token against Apple's published keys (JWKS). Apple only sends the email on the very first
 * sign-in, and the email may be a private relay address; `emailVerified` comes as a boolean or the string "true".
 */
export function appleVerifier(audiences) {
  const jwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
  return async (identityToken) => {
    if (!audiences.length) throw err(501, 'Apple sign-in is not set up on this server');
    let p;
    try { p = (await jwtVerify(identityToken, jwks, { issuer: 'https://appleid.apple.com', audience: audiences })).payload; } catch { throw err(401, 'Apple sign-in could not be verified'); }
    if (!p.sub) throw err(401, 'Apple sign-in could not be verified');
    return { subject: String(p.sub), email: typeof p.email === 'string' ? p.email.toLowerCase() : undefined, emailVerified: p.email_verified === true || p.email_verified === 'true', name: undefined };
  };
}
