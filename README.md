# Claw & Order

A single-player, cat-themed elemental card game built with HTML, CSS, and JavaScript.

## Play locally

```bash
npm install
npm run dev
```

## Rules

- Ember beats Gust.
- Gust beats Tide.
- Tide beats Ember.
- Matching elements compare power.
- Win by collecting two Ember trophies, two Gust trophies, and two Tide trophies.
- Non-trophy cards enter the discard pile and reshuffle into the draw pile when needed.

## Deploy to GitHub Pages

The site is fully static. In the repository settings, open **Pages**, choose **Deploy from a branch**, then select the branch and `/ (root)` folder. It can also be deployed using a GitHub Actions workflow or the contents of `dist/` after running `npm run build`.
