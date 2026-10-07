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
- Win by reaching **6 Fire, 6 Gust and 6 Water progress**. Completing one element does not replace another.
- Each lane win adds +2 progress to the winning card's own element. Tied or lost lanes add nothing.
- The first two cards with no opposing card add +1 to their own elements. The third extra adds nothing, even if an earlier extra's element was already complete.
- Both sides retain their gains after every round. Each element stops at 6, including partial gains when only one point is needed.
- Resolve all lanes before checking victory. If both sides finish their goals in the same round, the duel is drawn.
- Rally gives +1 Power to the card committed directly before it. Rally in Lane 1 gives no bonus; the supported card can also earn its own role bonus.
- Every committed card returns to its owner's discard pile, including winning cards. There are no trophy claims or exiled cards in this mode.
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

The AI's deck preference rewards *active* Rally, Link or Finisher bonuses only when strategic choices are close. It does not force a bad formation to fit a theme. Its decisions use its own hand, public elemental progress, completed rounds and the public collection—not the player's custom deck, hidden hand or current selection. It avoids wasting gains on completed elements, considers denial and simultaneous completion, and weighs hand recovery against a push. Goal Hunter, Goal Denier, Momentum Rider, Counter Scholar and Score Reader use progress rather than trophy claims; Normal Play and its randomized habits are unchanged.

#### Phase 4 — balance audit and interface polish

The lobby uses separate deck and rival pages. The deck page presents four ready-to-play starters with short playstyle descriptions, alongside a distinct build-your-own path and saved-deck selector. Confirm Deck snapshots the selected list and opens the rival page; Back to Your Deck allows changes before launching. Returning from difficulty selection resumes the rival page without clearing the confirmed deck. The rules overview and 12-card showcase stay collapsed until requested.

The editor shows remaining cost and optional tips for unused budget, scarce goal elements and Finisher-heavy decks. Tips never make a legal deck invalid; omitted roles and unequal element counts remain permitted.

All four starter/rival decks were rebuilt for elemental progress. Each has eight cards of every element and all four roles; specialized starters include support alternatives rather than a rigid single-role lineup. Their costs are Balanced 119, Rally 119, Link 120 and Finisher 120. Existing saved custom decks, card stats, role bonuses and construction costs are unchanged.

Run the reproducible audit separately from the regression suite:

```bash
npm test
npm run audit:deckbuilding -- 8 48103
node scripts/audit-four-lane-ai.js 128 99123
```

The elemental-progress audit ran 4,896 simulated matches: 17 legal deck lists × four rivals × nine strategy probes × eight paired seeds. Lists included the starters, low-budget and premium-heavy builds, 16/4/4 element concentrations, omission of each role, and seeded random builds. Probes included adaptive play, fixed 1/2/3/4-card commitments (limited by the actual hand), push/recovery cycles, a strong first card with cheap support, and cheap pushes against single-card play. All matches finished within 31 rounds; card ownership/counts, complete recycling, draw limits, habit persistence, goal clipping and the two-extra-card cap were checked throughout.

In this cohort, repeated singles won 0%, repeated two-card play 14.9%, adaptive play 29.4%, and the 3/1 cycle 18.2%. These probe policies include intentionally weak decks and are not estimates of human win rates. No tested fixed rhythm dominated all matchups. A separate 2,048-match neutral-planner comparison tested starters in both seats: match scores including half a point for draws were Balanced 51.0%, Rally 52.4%, Link 46.2%, Finisher 50.3%. All finished within 23 rounds. Link remains slightly weaker in this sample; there is no claim of perfect balance or exhaustive exploit coverage.

Regression tests cover constructed decks and storage, all 108 habit combinations, all four roles, actual goal clipping, simultaneous completion, history snapshots and recycling. An independent oracle checks 10,000 randomized formations against production progress scoring and side reversal. Normal Play remains isolated from constructed decks and these changes.

Deckbuilding's four initial implementation phases are complete. Construction limits remain provisional and Four-Lane Mode remains work in progress, ready for human playtesting rather than progression/unlock systems.

## Deploy to GitHub Pages

The site is fully static. In the repository settings, open **Pages**, choose **Deploy from a branch**, then select the branch and `/ (root)` folder. It can also be deployed using a GitHub Actions workflow or the contents of `dist/` after running `npm run build`.

## Music

Main menu: “Nature Nurture” by [Quincas Moreira](https://www.quincasmoreira.com/music-and-sound-libraries), available through the YouTube Audio Library.

Duels: “Video Game Soldiers” by [Twin Musicom](https://www.twinmusicom.org/song/295/video-game-soldiers), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
