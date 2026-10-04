# Beta test

## Who and how
- 15 to 30 testers: a mix of Android (including 2 older phones) and iPhone, some with small rooms, some with glossy floors, a few with no AR support.
- Android: Play Console, Testing, Internal testing (up to 100 testers by email); the CI release submits there. iPhone: TestFlight internal testers (needs an Apple ID), then external with a public link after the first review.
- Run for 2 weeks. Release a build only if the previous one is installed by most testers.

## What to send testers (copy and paste)
> Thanks for helping test HomeTown AR! Please try, in a room at home:
> 1. Open the app, choose your room type and size, tap **Scan my room**, and mark each floor corner. Is the size roughly what you measured?
> 2. Open a sofa or bed, tap **View in my room**. Does it land on the floor at a believable size? Check one measurement with a tape.
> 3. Place 3 or more pieces, drag them, turn them, and look at the warnings. Tap **Save**.
> 4. Share the design to WhatsApp. Does the preview look right? Open the link on another phone.
> 5. Open the **Saved** tab and try **Plan** on the design. Edit it there, then open it in AR.
> 6. Turn on airplane mode and open your saved designs.
> If something looks wrong, take a screenshot and tell us your phone model.
> Feedback form: [link]

## Feedback form questions
1. Phone model and OS version
2. Did the camera open and find the floor within 10 seconds? (yes / slowly / no)
3. Room scan: how close was the size to your tape measure? (within 3 % / 3 to 10 % / worse / could not scan)
4. Did placed furniture look the right size? (yes / too big / too small / floating or sunk)
5. Did anything get hot, slow or crash? What were you doing?
6. Which feature did you use most? Which one was confusing?
7. Would you use this before buying furniture? (1 to 5) and why
8. Did sharing, saving and signing in work? What went wrong?
9. Anything in Hindi that read oddly? (only if the phone is set to Hindi)
10. One thing we should fix first

## What to measure (admin Analytics page + Sentry)
| Measure | Where | Target to leave beta |
|---|---|---|
| Scan success: sessions that ended with a scanned room ÷ AR sessions | Analytics | above 50 % |
| Placements per AR session | Analytics (placements ÷ AR sessions) | above 3 |
| Saved designs per active device | Server: `designs` per user, and `design_saved` events | above 0.5 |
| Share rate | `design_saved` with `shared`, share links created (`designs.share_slug` not null) | above 10 % of savers |
| Suggestions placed rate | Analytics | above 10 % |
| Crash-free sessions | Sentry | above 99 % |
| Quality auto-drops | `ar.qualityDropped` message reports from testers | below 5 % of sessions on High |
| Floor found within 10 s | Form question 2 | above 80 % "yes" |
