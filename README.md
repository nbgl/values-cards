# Values Card Sort

A quiet little web app for the **Personal Values Card Sort** — sort 83 values into
*very important / important / not important / unsure*, jot notes on why, star and
rank your core values, then share a clean report with someone you trust
(a therapist, a friend, future-you).

**Use it here → https://nbgl.github.io/values-cards/**

On an iPad or iPhone: open the link in Safari, tap **Share → Add to Home Screen**,
and it becomes a full-screen app that works offline.

## Privacy

Everything stays on your device — there is no server, no account, no analytics.
Sorts and notes live in your browser's local storage. Sharing happens only when
you tap Share, through your own share sheet (AirDrop, Mail, Messages, …).
The **Backup file** button exports a JSON file you can restore on another device.

## Features

- One-card-at-a-time sorting with swipe gestures (→ very important, ↑ important,
  ← not important, ↓ unsure) or tap buttons; undo; resume any time
- Skip a card you're not ready to decide on — it returns at the end of the deck
  (keyboard: `s`)
- Notes on any card, during the sort or after
- Review board with all four piles; move cards between piles
- Star cards as **core values** and drag to rank them
- Add your own value cards
- Report view: share as text, print / save as PDF, copy, or export a backup
- Past sorts are archived so you can redo the sort over time and compare
- Works offline (PWA), light & dark mode, keyboard arrows supported

## Credits

The card deck is the *Personal Values Card Sort* by W.R. Miller, J. C'de Baca,
D.B. Matthews & P.L. Wilbourne (University of New Mexico, 2001), which is in the
public domain ("may be copied, adapted, and used without permission"). The
original PDF is in [`source/`](source/).

App code is MIT-licensed. No build step — it's plain HTML/CSS/JS; to develop,
serve the directory with any static server.
