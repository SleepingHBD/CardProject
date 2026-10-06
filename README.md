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

- Each player has a separate 24-card deck and discard pile, chosen from a 36-card collection.
- Start with 7 cards and commit 1–4 cards per round.
- Between rounds, draw up to 2 cards, without exceeding 7 cards in hand.
- Two-card formations maintain hand size; three- and four-card formations spend reserves. One-card formations rebuild reserves when below the hand limit.
- A lane win scores 2 Round Points; extra cards with no opposing cards score 1 each, up to 2 extra-card points per side per round. Higher Round Points wins the round.
- Rally gives +1 Power to the card committed directly before it. Rally in Lane 1 gives no bonus; the supported card can also earn its own role bonus.
- A round winner claims one lane-winning card as a trophy, or the first extra card if no lanes were won. A drawn round awards no trophy. Collect two trophies of each element to win the match.
- Normal Play retains its three lanes, six-card hands and shared-deck refill rules.

#### Deckbuilding — Phase 2 editor and constructed duels

Open **Four-Lane Mode** from the main menu, choose a starter or saved deck, or select **Build a Deck**. The editor includes live validation, search and element/role/rarity filters. Save a valid deck to select it for your next duel. Starting from a starter list creates your own copy; the original starter cannot be changed or deleted. Normal Play stays unchanged.

- Exactly 24 cards, with a maximum deck cost of 120.
- At least 4 Fire, 4 Gust and 4 Water cards; equal element counts are not required.
- Up to 2 copies of each Common/Uncommon card, and 1 of each Rare/Epic/Legendary.
- Cost is printed Power plus a rarity surcharge: Common/Uncommon +0, Rare +1, Epic +4, Legendary +6. Cost is for deck construction only and never changes combat Power.
- No role quotas. A deck can omit Link, Rally, Vanguard or Finisher entirely.
- Four legal starter lists: Balanced Formation, Rally Company, Element Weavers and Last Light. Each uses 24 cards, but focuses on a different mix of roles.
- Deck definitions store stable card identifiers, not editable Power values or image paths. Validation and runtime instances use the canonical game card library.
- Up to 12 custom decks are saved in this browser's local storage, not on an account or server. Clearing site data removes them. If storage is blocked/full, decks remain usable for the session and the interface reports that they could not be persisted.
- Restarting a duel or changing its difficulty keeps its selected deck. The opponent currently uses the legal Balanced Formation starter deck, with existing Guided/Instinct/Blind behavior. Distinct rival decks and archetypes are the next phase.

These limits are provisional, not a claim that every custom deck is balanced. Constructed duels remain part of the work-in-progress Four-Lane Mode; broader balance and exploit testing with varied decks and opponent archetypes is the next phase.

## Deploy to GitHub Pages

The site is fully static. In the repository settings, open **Pages**, choose **Deploy from a branch**, then select the branch and `/ (root)` folder. It can also be deployed using a GitHub Actions workflow or the contents of `dist/` after running `npm run build`.

## Music

Main menu: “Nature Nurture” by [Quincas Moreira](https://www.quincasmoreira.com/music-and-sound-libraries), available through the YouTube Audio Library.

Duels: “Video Game Soldiers” by [Twin Musicom](https://www.twinmusicom.org/song/295/video-game-soldiers), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
