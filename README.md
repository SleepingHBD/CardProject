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

#### Deckbuilding — editor and constructed duels

Open **Four-Lane Mode** from the main menu, choose a starter or saved deck, or select **Build a Deck**. The editor includes live validation, search and element/role/rarity filters. Save a valid deck to select it for your next duel. Starting from a starter list creates your own copy; the original starter cannot be changed or deleted. Normal Play stays unchanged.

- Exactly 24 cards, with a maximum deck cost of 120.
- At least 4 Fire, 4 Gust and 4 Water cards; equal element counts are not required.
- Up to 2 copies of each Common/Uncommon card, and 1 of each Rare/Epic/Legendary.
- Cost is printed Power plus a rarity surcharge: Common/Uncommon +0, Rare +1, Epic +4, Legendary +6. Cost is for deck construction only and never changes combat Power.
- No role quotas. A deck can omit Link, Rally, Vanguard or Finisher entirely.
- Four legal starter lists: Balanced Formation, Rally Company, Element Weavers and Last Light. Each uses 24 cards, but focuses on a different mix of roles.
- Deck definitions store stable card identifiers, not editable Power values or image paths. Validation and runtime instances use the canonical game card library.
- Up to 12 custom decks are saved in this browser's local storage, not on an account or server. Clearing site data removes them. If storage is blocked/full, decks remain usable for the session and the interface reports that they could not be persisted.
- Restarting a duel or changing its difficulty keeps its selected deck, rival deck and habit set. Enter a new duel from the lobby to choose another rival or roll new habits.

#### Phase 3 — rival decks and playstyles

The lobby now offers **Random Rival** (the default) or four specific opponents. Each follows the same 24-card, 120-cost, element-minimum and copy-limit rules as the player. These initial rivals use the corresponding legal starter lists, not stronger exclusive cards:

- **Versatile Duelist** — Balanced Formation: an even role mix and the full habit pool.
- **Banner Captain** — Rally Company: Vanguards supported by Rally, with opener/role-planning habits and measured, push or trophy-responsive commitments.
- **Cycle Weaver** — Element Weavers: a Link-heavy deck, Role Planner and measured, echo or changing formation sizes.
- **Twilight Duelist** — Last Light: a Finisher-heavy deck, late-strike/role-planning habits and recovery, measured or trophy-responsive commitments.

Each rival rolls one motive, one formation habit and one commitment habit from deck-appropriate pools. All three remain fixed during a duel. The opponent uses these habits in every difficulty; Guided reveals live clues, Instinct reveals habits, and Blind hides both plus the in-game rival identity. Choosing a specific rival still tells you its deck theme; use Random Rival for a mystery matchup.

The AI's deck preference rewards *active* Rally, Link or Finisher bonuses only when strategic choices are close. It does not force a bad formation to fit a theme. Its decisions use its own hand, public trophies, completed rounds and the public collection—not the player's custom deck, hidden hand or current selection. Normal Play and its randomized habits are unchanged.

#### Phase 4 — balance audit and interface polish

The lobby uses separate deck and rival pages. The deck page presents four ready-to-play starters with short playstyle descriptions, alongside a distinct build-your-own path and saved-deck selector. Confirm Deck snapshots the selected list and opens the rival page; Back to Your Deck allows changes before launching. Returning from difficulty selection resumes the rival page without clearing the confirmed deck. The rules overview and 12-card showcase stay collapsed until requested.

The editor shows remaining cost and optional tips for unused budget, scarce trophy elements and Finisher-heavy decks. Tips never make a legal deck invalid; omitted roles and unequal element counts remain permitted.

Last Light's starter/rival list was adjusted after it underperformed: one Legendary rather than two, stronger supporting Links/Vanguards, and a second Belfry Bobtail. It retains 24 cards, 118 cost, eight of each element and 12 Finishers. Card stats, scoring, role rules and saved custom lists were not changed.

Run the reproducible audit separately from the regression suite:

```bash
npm test
npm run audit:deckbuilding -- 8 48103
```

The final audit ran 4,896 simulated matches: 17 legal deck lists × four rivals × nine strategy probes × eight paired seeds. Lists included the starters, low-budget and premium-heavy builds, 16/4/4 element concentrations, omission of each role, and seeded random builds. Probes included adaptive play, fixed 1/2/3/4-card commitments (limited by the actual hand), push/recovery cycles, a strong first card with cheap support, and cheap pushes against single-card play. All matches finished within 48 rounds; card ownership/counts, trophy removal, draw limits, habit persistence and the two-point extra-card cap were checked throughout.

In this cohort, repeated singles won 4.0%, repeated two-card play 35.8%, adaptive play 41.4%, and the 3/1 cycle 44.3%. These are benchmark-policy results, not estimates of human win rates. No tested repeatable exploit dominated all matchups. Rally Company remains a strong starter/rival; Last Light now performs closer to the other decks. There is no claim of perfect balance or exhaustive exploit coverage.

Browser QA covered custom-deck editing, saving/reloading, safe text handling, discarded-edit protection, live bonuses, four-lane history, restart/difficulty persistence, Blind information hiding, and a completed ten-round custom-deck duel. Lobby/editor layouts were checked at 1440×900, 1024×768, 844×390, 568×320, 390×844 and 320×740. Normal Play remains isolated from constructed decks and these changes.

Deckbuilding's four initial implementation phases are complete. Construction limits remain provisional and Four-Lane Mode remains work in progress, ready for human playtesting rather than progression/unlock systems.

## Deploy to GitHub Pages

The site is fully static. In the repository settings, open **Pages**, choose **Deploy from a branch**, then select the branch and `/ (root)` folder. It can also be deployed using a GitHub Actions workflow or the contents of `dist/` after running `npm run build`.

## Music

Main menu: “Nature Nurture” by [Quincas Moreira](https://www.quincasmoreira.com/music-and-sound-libraries), available through the YouTube Audio Library.

Duels: “Video Game Soldiers” by [Twin Musicom](https://www.twinmusicom.org/song/295/video-game-soldiers), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
