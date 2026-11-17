# Project: Prowl

A single-player, cat-themed elemental card game built with HTML, CSS, and JavaScript.

## Play locally

```bash
npm install
npm run dev
```

## Rules

- Commit one to three cards into consecutive lanes, starting with Lane 1. Lane 1 fights Lane 1, Lane 2 fights Lane 2, and Lane 3 fights Lane 3.
- Fire beats Gust, Gust beats Water, and Water beats Fire. Element Edge adds 2 Power; it is not an automatic victory.
- Clash Total is printed Power + active role bonus + received Rally support + Element Edge. Higher total wins the lane; equal totals draw.
- Each won lane earns 2 Round Points. Each extra card with no opposing card earns 1 Round Point. Higher Round Points wins the round; equal points draw.
- A round victory awards one trophy. Collect two Fire, two Gust and two Water trophies to win the match.
- Cards not claimed as trophies enter the shared discard pile. Hands refill to six, and the discard pile reshuffles when the draw pile is empty.

### Four formation roles

- **Vanguard:** gains +1 Power in Lane 1.
- **Link:** gains +1 Power when the card committed directly before it has a different element from the Link card.
- **Finisher:** gains +1 Power when it is the final card in a two- or three-card formation.
- **Rally:** gives +1 Power to the card committed directly before it, not itself. Rally in Lane 2 supports Lane 1; Rally in Lane 3 supports Lane 2. Rally in Lane 1 provides no support.

A card can be committed in any available lane regardless of role. The card receiving Rally can also earn its own active role bonus and Element Edge. Rally support works even when no opponent faces the Rally card. A boosted Rally still gives only +1 to the card before it; received bonuses do not cascade.

### Card collection and shuffle

All **36 characters** are available in Normal Play, including Hareth, Megwyn, Deshone, Charmae, Aakith, Sajrin, Lucan, Jyawaye, Siewen, Shazmir, Hidayn and Isai.

The shared shuffle contains **60 cards**:

- Two copies of each Common and Uncommon character.
- One copy of each Rare, Epic and Legendary character.
- Twenty cards of each element and fifteen cards of each role.

Both players draw from the same pile. There is no deck editor, custom-deck mode, or separate experimental mode.

### Difficulty and learning

- **Guided:** reveals live information about the opponent's planned cards.
- **Instinct:** hides the current formation and reveals persistent opponent habits.
- **Blind:** hides the current formation and habits. Use Previous Rounds History to infer patterns.
- **Tutorial Mode:** offers a complete walkthrough or individual sections. The Duel Codex and Rulebook explain scoring, roles and trophy collection during play.

Difficulty changes available information, not card strength or scoring. Previous Rounds History is available in every difficulty. Illustrated artwork is the active card style.

## Story Preview

The separate **Story Preview** main-menu button opens Willowgate Courtyard, a first playable exploration area. Walk with WASD or the arrow keys and interact with E, Space or Enter. On touch screens, use the on-screen directional controls and Interact button.

In dialogue, use any arrow key to move between choices and **E** to select the highlighted choice. Choices wrap at either end. Enter/Space and Tab/Shift+Tab also work, and Escape closes the dialogue.

- Meet Hareth for a normal duel. Winning opens the north gate; losing or retreating does not award completion.
- Meet Lucan for an optional one-round tactical puzzle. Any winning formation of at most two cards is accepted.
- Encounters use the existing card combat and return to the same courtyard position afterwards. Walk through the opened north gate to finish the area.
- Position, selected duel difficulty and completed encounters save in this browser. Story progress does not sync between devices. Clearing site data removes it; unavailable storage is reported in the interface.
- Returning from an unfinished battle keeps the map checkpoint but does not save or award that battle. Normal Play and Tutorial Mode remain separate.

The preview is one area, not a full campaign. Its artwork briefs and sprite-sheet layout are recorded in `assets/story/artwork.json`.

## Verification

```bash
npm test
npm run build
```

Regression coverage includes lane scoring, role and Rally interactions, opponent decisions, trophy selection and recycling, tutorial behavior, artwork framing, history, board themes and responsive controls.

## Deploy to GitHub Pages

The site is fully static. In the repository settings, open **Pages**, choose **Deploy from a branch**, then select the branch and `/ (root)` folder. It can also be deployed using a GitHub Actions workflow or the contents of `dist/` after running `npm run build`.

## Music

Main menu: “Nature Nurture” by [Quincas Moreira](https://www.quincasmoreira.com/music-and-sound-libraries), available through the YouTube Audio Library.

Duels: “Video Game Soldiers” by [Twin Musicom](https://www.twinmusicom.org/song/295/video-game-soldiers), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
