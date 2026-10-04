# Maestro flows (UI tests that need a phone or emulator)

These cover everything except AR (the camera cannot run in an emulator). Install Maestro (https://maestro.mobile.dev), start an Android emulator
or connect a phone with the **dev build** installed, then:

```bash
maestro test .maestro/onboarding-browse.yaml
maestro test .maestro/save-furniture.yaml
maestro test .maestro/plan-view.yaml
maestro test -e EMAIL=you@example.com -e PASSWORD='your-password' .maestro/sign-in.yaml   # needs EXPO_PUBLIC_API_URL set in the build
maestro test .maestro                                    # all of them (sign-in is skipped without EMAIL)
```
English strings are used for taps. Use a phone/emulator set to English.
