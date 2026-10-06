# Project: Prowl

A single-player, cat-themed elemental card game built with HTML, CSS, and JavaScript.

## Play locally

```bash
npm install
npm run dev
```

## Rules

- Fire beats Gust.
- Gust beats Water.
- Water beats Fire.
- Matching elements compare power.
- Win by collecting two Fire trophies, two Gust trophies, and two Water trophies.
- Non-trophy cards enter the discard pile and reshuffle into the draw pile when needed.

### Four-Lane Mode (work in progress)

- Each player has a separate 36-card deck and discard pile.
- Start with 7 cards and commit 1–4 cards per round.
- Between rounds, draw up to 2 cards, without exceeding 7 cards in hand.
- Two-card formations maintain hand size; three- and four-card formations spend reserves. One-card formations rebuild reserves when below the hand limit.
- A lane win scores 2 Round Points; each extra card with no opposing card scores 1. Higher Round Points wins the round.
- Vanguard, Link, Finisher and Rally bonuses, trophy rules, and the two-trophies-per-element match goal are unchanged.
- Normal Play retains its three lanes, six-card hands and shared-deck refill rules.

## Deploy to GitHub Pages

The site is fully static. In the repository settings, open **Pages**, choose **Deploy from a branch**, then select the branch and `/ (root)` folder. It can also be deployed using a GitHub Actions workflow or the contents of `dist/` after running `npm run build`.

## Music

Main menu: “Nature Nurture” by [Quincas Moreira](https://www.quincasmoreira.com/music-and-sound-libraries), available through the YouTube Audio Library.

Duels: “Video Game Soldiers” by [Twin Musicom](https://www.twinmusicom.org/song/295/video-game-soldiers), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
