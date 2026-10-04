# Step 11 — Accounts in the app + offline-safe sync

Read `CLAUDE.md` first. This is step 11. Do only this step.

## Tasks
1. **API client** `src/services/http.ts`: base URL from config, 10 s timeout, JSON errors → typed `ApiError`,
   automatic access-token refresh on 401 (single in-flight refresh), sign-out on refresh failure. Tokens in
   `expo-secure-store`.
2. **Auth store** `src/store/authStore.ts`: `user`, `status` (guest | signedIn | unverified), actions signIn, signUp,
   signInWithGoogle, signInWithApple, verifyEmail, forgotPassword, resetPassword, signOut, deleteAccount.
3. **Screens** (stack `Auth`): Sign in, Create account, Verify email (code input), Forgot password, Reset password.
   Google via `expo-auth-session` / `@react-native-google-signin/google-signin`; Apple via
   `expo-apple-authentication` (iOS only; required by App Store when Google is offered). Guest mode stays the default;
   entry points: Settings → Account, and a prompt after the 2nd saved design "Back up your designs?".
4. **Sync engine** `src/sync/` (pure, tested): a local outbox of operations (design create/update/delete,
   wishlist add/remove) persisted to storage; `sync()` = push outbox in order → pull `/v1/designs?since=` and
   `/v1/wishlist` → merge (last-write-wins by `updatedAt`, tombstones win over stale updates, local unsynced edits are
   never overwritten). Designs get a client-generated uuid so offline creates don't duplicate. Triggers: sign-in,
   app foreground, 3 s after any change (debounced), pull-to-refresh on Saved. Replace `services/sync.ts` and the
   step-03 queue with this.
5. **Conflicts:** server 409 on PATCH → keep both: rename the local copy "<name> (this phone)".
6. **UI:** sync status row in Settings (last synced, pending count, error), small cloud icon on design cards
   (synced / pending / local only).
7. **Delete my data:** signed in → server delete then local wipe; guest → local wipe. Confirm twice.
8. **Tests:** `scripts/sync.test.ts` with a fake server: offline create then online, delete while offline,
   concurrent edit from two phones, wishlist round trip, refresh-token retry in http client.

## Done when
`npm run check` passes. Explain how to test sign-in on a phone against my staging server (env + Google/Apple setup).
