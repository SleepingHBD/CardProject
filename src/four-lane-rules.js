(function exposeFourLaneRules(global) {
  "use strict";
  const normal = global.ClawRules;
  const { ELEMENTS, ELEMENT_EDGE_BONUS, TROPHIES_PER_ELEMENT } = normal;
  const MAX_COMMITMENT = 4;
  const HAND_SIZE = 7;
  const ROUND_DRAW = 3;
  const MAX_EXTRA_CARD_POINTS = 2;
  const PROGRESS_PER_ELEMENT = 6;
  const DRY_ROUND_WARNING = 4;
  const MAX_MATCH_ROUNDS = 150;
  // Personality breaks close strategic decisions, not clearly worse outcomes.
  const HABIT_SCORE_WINDOW = .75;
  // Placement is a readable tendency, not a promise to stay in losing lanes.
  const PLACEMENT_HABIT_RATE = .8;
  const PLACEMENT_ESCAPE_MARGIN = 1.5;
  const AI_PLACEMENT_TRAITS = Object.freeze([
    { id: "left-flank", label: "Left Flank", preferredLanes: [0, 1] },
    { id: "right-flank", label: "Right Flank", preferredLanes: [2, 3] },
    { id: "centre-guard", label: "Centre Guard", preferredLanes: [1, 2] },
    { id: "outer-guard", label: "Outer Guard", preferredLanes: [0, 3] },
  ].map(trait => Object.freeze({ ...trait, category: "placement",
    preferredLanes: Object.freeze(trait.preferredLanes),
    description: `Usually prioritises Lanes ${trait.preferredLanes[0] + 1} and ${trait.preferredLanes[1] + 1}. Can shift when those lanes are risky.`,
  })));
  const TACTICS = Object.freeze({
    ...normal.TACTICS,
    vanguard: Object.freeze({ ...normal.TACTICS.vanguard,
      description: "Vanguard: +1 Power when it is your leftmost card and you commit at least two cards." }),
    link: Object.freeze({ ...normal.TACTICS.link,
      description: "Link: +1 Power when the lane immediately to its left holds your card of a different element. An empty lane breaks the link." }),
    finisher: Object.freeze({ ...normal.TACTICS.finisher,
      description: "Finisher: +1 Power when it is your rightmost card and you commit at least two cards." }),
    rally: Object.freeze({ icon: "banner", label: "Rally",
      description: "Rally: Gives +1 Power to your card in the lane immediately to its left. It cannot boost across an empty lane." }),
  });

  const countFormationCards = cards => Array.isArray(cards) ? cards.filter(Boolean).length : 0;
  const getFormationMask = cards => Array.isArray(cards)
    ? cards.reduce((mask, card, lane) => mask | (card ? 1 << lane : 0), 0) : 0;
  function isPreferredPlacement(cards, trait) {
    const canonical = AI_PLACEMENT_TRAITS.find(template => template.id === (typeof trait === "string" ? trait : trait?.id));
    if (!canonical || !Array.isArray(cards) || cards.length > MAX_COMMITMENT) return false;
    const count = countFormationCards(cards), mask = getFormationMask(cards);
    if (!count) return false;
    const preferred = canonical.preferredLanes.reduce((value, lane) => value | 1 << lane, 0);
    return count <= 2 ? (mask & ~preferred) === 0 : (mask & preferred) === preferred;
  }
  function normalizeFormation(cards) {
    if (!Array.isArray(cards) || cards.length < 1 || cards.length > MAX_COMMITMENT) {
      throw new RangeError("A formation must occupy one to four of the four lanes.");
    }
    const slots = Array.from({ length: MAX_COMMITMENT }, (_, lane) => cards[lane] ?? null);
    if (!countFormationCards(slots) || slots.some(card => card !== null
      && (!ELEMENTS[card.element] || !Number.isFinite(card.power)))) {
      throw new RangeError("A formation needs at least one valid card; empty lanes use null.");
    }
    return slots;
  }

  function getTacticBonus(cards, index) {
    const card = cards[index];
    if (!card) return 0;
    if (card.tactic === "vanguard") return countFormationCards(cards) >= 2 && index === cards.findIndex(Boolean) ? 1 : 0;
    if (card.tactic === "link") return cards[index - 1] && cards[index - 1].element !== card.element ? 1 : 0;
    if (card.tactic === "finisher") return countFormationCards(cards) >= 2 && index === cards.findLastIndex(Boolean) ? 1 : 0;
    return 0;
  }

  function getRallyBonus(cards, index) {
    // Each Rally supports the preceding card by exactly +1, even if boosted itself.
    return index >= 0 && cards[index] && cards[index + 1]?.tactic === "rally" ? 1 : 0;
  }

  function scoreClash(playerCard, aiCard, playerTactic = 0, aiTactic = 0, playerRally = 0, aiRally = 0) {
    const scoring = normal.scoreClash(playerCard, aiCard, playerTactic, aiTactic);
    for (const [side, card, rally] of [["player", playerCard, playerRally], ["ai", aiCard, aiRally]]) {
      scoring[side].tacticName = TACTICS[card.tactic]?.label || "Role";
      scoring[side].rally = rally;
      scoring[side].total += rally;
    }
    return scoring;
  }

  function getExtraCardPoints(cards, opposingCards, laneWins = 0) {
    const unopposed = Array.isArray(cards) && Array.isArray(opposingCards)
      ? cards.filter((card, lane) => card && !opposingCards[lane]).length
      : Math.max(0, Number(cards) - Number(opposingCards));
    return Math.min(MAX_EXTRA_CARD_POINTS, Math.max(0, laneWins), unopposed);
  }

  function getExtraCardLanePoints(index, opposingCards, cards = [], laneWins = 0) {
    if (!Array.isArray(opposingCards) || !Array.isArray(cards) || !cards[index] || opposingCards[index]) return 0;
    const unopposed = cards.flatMap((card, lane) => card && !opposingCards[lane] ? [lane] : []);
    return unopposed.indexOf(index) >= 0 && unopposed.indexOf(index) < Math.min(MAX_EXTRA_CARD_POINTS, laneWins) ? 1 : 0;
  }

  function createProgress() { return { ember: 0, gust: 0, tide: 0 }; }

  function getElementProgress(progress = {}) {
    // Arrays are accepted for older caller fixtures, never used as live trophies.
    const counts = Array.isArray(progress) ? normal.getElementTrophyCounts(progress) : progress;
    return Object.fromEntries(Object.keys(ELEMENTS).map(element => [element,
      Math.min(PROGRESS_PER_ELEMENT, Math.max(0, Math.floor(Number(counts?.[element]) || 0)))]));
  }

  function getProgressTotal(progress) {
    return Object.values(getElementProgress(progress)).reduce((sum, value) => sum + value, 0);
  }

  function getProgressMatchWinner(player, ai) {
    const complete = progress => Object.values(getElementProgress(progress)).every(value => value === PROGRESS_PER_ELEMENT);
    const p = complete(player), a = complete(ai);
    return p && a ? "draw" : p ? "player" : a ? "ai" : null;
  }

  function resolveClashes(playerCards, aiCards) {
    const player = normalizeFormation(playerCards), ai = normalizeFormation(aiCards);
    const results = Array(MAX_COMMITMENT).fill("empty");
    const lanes = player.map((card, index) => {
      if (!card || !ai[index]) {
        results[index] = card ? "player-extra" : ai[index] ? "ai-extra" : "empty";
        return null;
      }
      const scoring = scoreClash(card, ai[index],
        getTacticBonus(player, index), getTacticBonus(ai, index),
        getRallyBonus(player, index), getRallyBonus(ai, index));
      const winner = scoring.player.total === scoring.ai.total ? "draw"
        : scoring.player.total > scoring.ai.total ? "player" : "ai";
      results[index] = winner;
      return { ...scoring, winner, lane: index };
    });
    const laneWins = { player: 0, ai: 0, draw: 0 };
    lanes.forEach(lane => { if (lane) laneWins[lane.winner]++; });
    const lanePoints = { player: laneWins.player * 2, ai: laneWins.ai * 2 };
    const extraCardPoints = {
      player: getExtraCardPoints(player, ai, laneWins.player),
      ai: getExtraCardPoints(ai, player, laneWins.ai),
    };
    const score = { player: lanePoints.player + extraCardPoints.player,
      ai: lanePoints.ai + extraCardPoints.ai, draw: laneWins.draw };
    const winner = score.player === score.ai ? "draw" : score.player > score.ai ? "player" : "ai";
    const loser = winner === "player" ? "ai" : "player";
    const decidedBy = winner === "draw" ? "draw"
      : lanePoints[winner] <= lanePoints[loser] ? "extra-cards" : "clashes";
    const extraCardLanePoints = {
      player: player.map((_, lane) => getExtraCardLanePoints(lane, ai, player, laneWins.player)),
      ai: ai.map((_, lane) => getExtraCardLanePoints(lane, player, ai, laneWins.ai)),
    };
    return { results, lanes, laneWins, lanePoints, extraCardPoints, extraCardLanePoints, score, winner, decidedBy,
      commitments: { player: countFormationCards(player), ai: countFormationCards(ai) } };
  }

  function resolveProgress(playerCards, aiCards, playerProgress = {}, aiProgress = {}, resolution = resolveClashes(playerCards, aiCards)) {
    const progressBefore = { player: getElementProgress(playerProgress), ai: getElementProgress(aiProgress) };
    const progressAfter = { player: { ...progressBefore.player }, ai: { ...progressBefore.ai } };
    const progressGains = { player: createProgress(), ai: createProgress() };
    const player = normalizeFormation(playerCards), ai = normalizeFormation(aiCards);
    const laneProgress = { player: Array(MAX_COMMITMENT).fill(0), ai: Array(MAX_COMMITMENT).fill(0) };
    const extraCardPoints = { player: 0, ai: 0 };
    const extraCardLanePoints = { player: Array(MAX_COMMITMENT).fill(0), ai: Array(MAX_COMMITMENT).fill(0) };
    for (const [side, cards, other] of [["player", player, ai], ["ai", ai, player]]) {
      const award = (card, lane, raw) => {
        const gain = Math.min(raw, PROGRESS_PER_ELEMENT - progressAfter[side][card.element]);
        laneProgress[side][lane] = gain;
        progressAfter[side][card.element] += gain;
        progressGains[side][card.element] += gain;
        return gain;
      };
      // Resolve every battle first so a later win can unlock an earlier escort.
      cards.forEach((card, lane) => {
        if (card && other[lane] && resolution.results[lane] === side) award(card, lane, 2);
      });
      let remaining = Math.min(MAX_EXTRA_CARD_POINTS, resolution.laneWins[side]);
      cards.forEach((card, lane) => {
        if (!remaining || !card || other[lane] || progressAfter[side][card.element] === PROGRESS_PER_ELEMENT) return;
        extraCardLanePoints[side][lane] = award(card, lane, 1);
        extraCardPoints[side] += extraCardLanePoints[side][lane];
        remaining--;
      });
    }
    const score = { player: getProgressTotal(progressGains.player), ai: getProgressTotal(progressGains.ai), draw: resolution.laneWins.draw };
    return { ...resolution, score, winner: score.player === score.ai ? "draw" : score.player > score.ai ? "player" : "ai",
      progressBefore, progressAfter, progressGains, laneProgress, extraCardPoints, extraCardLanePoints,
      matchWinner: getProgressMatchWinner(progressAfter.player, progressAfter.ai) };
  }

  // Four-Lane trophies are automatic counters; no card is removed as a trophy.
  function getFormationRewardOptions() { return []; }

  function replenishHand(deck, discardPile, hand, drawLimit = ROUND_DRAW, random = Math.random) {
    let reshuffled = false;
    let drawn = 0;
    const amount = Math.min(HAND_SIZE - hand.length, Math.max(0, Math.floor(drawLimit)));
    for (let index = 0; index < amount; index++) {
      reshuffled = normal.reshuffleDiscardPile(deck, discardPile, random) || reshuffled;
      const card = deck.pop();
      if (!card) break;
      hand.push(card);
      drawn++;
    }
    return { drawn, reshuffled };
  }

  function buildTellClues(cards, difficulty = "guided") {
    return Array.from({ length: MAX_COMMITMENT }, (_, index) =>
      difficulty === "instinct" || difficulty === "blind" ? "sealed"
        : (Array.isArray(cards) ? cards[index] : index < cards) ? "full" : "empty");
  }

  function createAiTraits(random = Math.random, pools = null) {
    const descriptions = {
      "trophy-hunter": "Favors elements he still needs to finish.",
      "trophy-denier": "Favors counters to elements you are close to finishing.",
      "counter-scholar": "Favors counters to the element of your last card that earned trophies.",
      "momentum-rider": "Favors the element of his last card that earned trophies.",
      "score-reader": "Favors committing more cards when behind on trophies, and fewer when ahead.",
      "solo-gambler": "Favors committing 1 card to rebuild his hand, but can commit more to earn trophies.",
      "measured-planner": "Favors committing 2 cards, leaving room to rebuild his hand.",
      "full-formation": "Favors 4-card pushes, then smaller formations to rebuild his hand.",
      "strong-opener": "Places his highest-Power committed card in Lane 1.",
      "late-striker": "Places his highest-Power committed card in his rightmost occupied lane.",
      "tactic-planner": "Favors formations that activate role bonuses.",
    };
    if (pools !== null && (typeof pools !== "object" || Array.isArray(pools)
      || Object.hasOwn(pools, "formation"))) {
      throw new RangeError("WIP habit pools must use motive, placement and commitment categories.");
    }
    const pick = (templates, category) => {
      const ids = pools === null ? templates.map(trait => trait.id) : pools[category];
      if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length
        || Array.from(ids).some(id => !templates.some(trait => trait.id === id))) {
        throw new RangeError(`Invalid ${category} habit pool.`);
      }
      const roll = random();
      if (!Number.isFinite(roll)) throw new TypeError("A habit roll must be finite.");
      return { ...templates.find(trait => trait.id === ids[Math.floor(Math.min(.999999, Math.max(0, roll)) * ids.length)]) };
    };
    const traits = [pick(normal.AI_MOTIVE_TRAITS, "motive"), pick(AI_PLACEMENT_TRAITS, "placement"),
      pick(normal.AI_COMMITMENT_TRAITS, "commitment")];
    if (traits[0].id === "element-loyalist") {
      const roll = random();
      if (!Number.isFinite(roll)) throw new TypeError("An element roll must be finite.");
      const element = Object.keys(ELEMENTS)[Math.floor(Math.min(.999999, Math.max(0, roll)) * 3)];
      Object.assign(traits[0], { element, label: `${ELEMENTS[element].label} Loyalist`,
        description: `Favors ${ELEMENTS[element].label} cards whenever available.` });
    }
    const labels = { "trophy-hunter": "Goal Hunter", "trophy-denier": "Goal Denier" };
    return traits.map(trait => Object.freeze({ ...trait, label: labels[trait.id] || trait.label,
      description: descriptions[trait.id] || trait.description,
    }));
  }

  function getCommitmentWeights(handLength, playerWins, aiWins, traits = [], previous = {}) {
    const maximum = Math.min(MAX_COMMITMENT, handLength);
    const has = id => traits.some(trait => trait.id === id);
    let weights = [.15, .25, .4, .2];
    if (has("solo-gambler")) weights = handLength < HAND_SIZE
      ? [.7, .2, .08, .02] : [.15, .4, .35, .1];
    if (has("measured-planner")) weights = [.1, .65, .2, .05];
    if (has("full-formation")) weights = [.04, .1, .16, .7];
    if (has("score-reader")) {
      const gap = getProgressTotal(playerWins) - getProgressTotal(aiWins);
      weights = gap > 0 ? [.05, .15, .35, .45] : gap < 0 ? [.4, .35, .2, .05] : [.1, .4, .35, .15];
    }
    if (has("echo-tactician") && Number.isInteger(previous.player) && previous.player >= 1 && previous.player <= 4) {
      weights = [.07, .07, .07, .07];
      weights[previous.player - 1] = .79;
    }
    if (has("restless-dealer") && Number.isInteger(previous.ai) && previous.ai >= 1 && previous.ai <= 4) {
      weights = [.28, .28, .28, .28];
      weights[previous.ai - 1] = .16;
    }
    // Recovery is a tendency, not an extra rule or a guaranteed tell.
    if (handLength <= 4) {
      weights[0] *= 1.6;
      weights[1] *= 2.5;
      weights[3] *= .15;
    }
    return weights.slice(0, maximum);
  }

  function chooseAiCommitment(handLength, playerWins, aiWins, random = Math.random, traits = [], previous = {}) {
    const maximum = Math.min(MAX_COMMITMENT, handLength);
    if (maximum <= 1) return maximum;
    const weights = getCommitmentWeights(handLength, playerWins, aiWins, traits, previous);
    const roll = Math.min(.999999, Math.max(0, random()));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let threshold = roll * total;
    for (let index = 0; index < maximum; index++) {
      threshold -= weights[index];
      if (threshold < 0) return index + 1;
    }
    return maximum;
  }

  function permutations(cards) {
    if (cards.length < 2) return [[...cards]];
    return cards.flatMap((card, index) => permutations(cards.filter((_, other) => other !== index))
      .map(rest => [card, ...rest]));
  }

  function orderAiFormation(cards, random = Math.random, traits = []) {
    if (cards.length < 2) return [...cards];
    const has = id => traits.some(trait => trait.id === id);
    const strongest = Math.max(...cards.map(card => card.power));
    return permutations(cards).map(formation => {
      const bonuses = formation.reduce((sum, _, index) => sum + getTacticBonus(formation, index) + getRallyBonus(formation, index), 0);
      let score = bonuses * (has("tactic-planner") ? 5 : 1.2) + random() * 1.2;
      if (has("strong-opener") && formation[0].power === strongest) score += 4.5;
      if (has("late-striker") && formation.at(-1).power === strongest) score += 4.5;
      return { formation, score };
    }).sort((a, b) => b.score - a.score)[0].formation;
  }

  function chooseAiCards(hand, count, playerWins, aiWins, random = Math.random, traits = []) {
    const available = [...hand];
    const chosen = [];
    const amount = Math.min(MAX_COMMITMENT, Math.max(1, count), available.length);
    const own = getElementProgress(aiWins), other = getElementProgress(playerWins);
    const has = id => traits.some(trait => trait.id === id);
    const loyal = traits.find(trait => trait.id === "element-loyalist")?.element;
    while (chosen.length < amount) {
      // Lightweight fixed-count selector for diagnostics. Live play uses the
      // joint planner below; neither selector receives a private player hand.
      const card = available.map(value => ({ card: value, score: value.power
        + (own[value.element] < PROGRESS_PER_ELEMENT ? 2 : 0)
        + (has("trophy-hunter") && own[value.element] < PROGRESS_PER_ELEMENT ? 2 : 0)
        + (value.element === loyal ? 2 : 0)
        + (has("trophy-denier") && other[ELEMENTS[value.element].beats] >= PROGRESS_PER_ELEMENT - 2 ? 2 : 0)
        + (has("power-seeker") ? value.power * .3 : 0) + random() }))
        .sort((a, b) => b.score - a.score)[0].card;
      chosen.push(card);
      available.splice(available.indexOf(card), 1);
    }
    return orderAiFormation(chosen, random, traits);
  }

  // These reads are beliefs, not access to the player's live hand or selection.
  // Completed rounds are the only player formations accepted by the planner.
  function readPlayerHistory(history = []) {
    const rounds = [];
    let estimatedHand = HAND_SIZE;
    for (const round of history) {
      const cards = round?.playerCards;
      if (!Array.isArray(cards) || cards.length < 1 || cards.length > MAX_COMMITMENT
        || !countFormationCards(cards) || Array.from(cards).some(card => card !== null
          && (!ELEMENTS[card?.element] || !Number.isFinite(card.power)))) continue;
      estimatedHand = Math.min(HAND_SIZE, Math.max(0, estimatedHand - countFormationCards(cards)) + ROUND_DRAW);
      rounds.push(Array.from({ length: MAX_COMMITMENT }, (_, lane) => cards[lane]
        ? { art: cards[lane].art, element: cards[lane].element, power: cards[lane].power, tactic: cards[lane].tactic } : null));
    }
    const counts = rounds.map(countFormationCards);
    const weights = [.22, .36, .24, .18];
    const recent = counts.slice(-12);
    recent.forEach((count, index) => { weights[count - 1] += .3 + .7 * (index + 1) / recent.length; });
    // Conditional transitions learn push/recovery patterns without assuming every
    // one-card play means the next round will also contain one card.
    for (let depth = 1; depth <= 2; depth++) {
      if (counts.length <= depth) continue;
      const tail = counts.slice(-depth);
      for (let index = Math.max(depth, counts.length - 14); index < counts.length; index++) {
        if (tail.every((count, offset) => counts[index - depth + offset] === count)) {
          weights[counts[index] - 1] += depth === 2 ? 3 : 1.2;
        }
      }
    }
    let repeatedCount = null;
    // Check longer cycles first: two recovery singles are not evidence that a
    // known four/single/single cycle has become an endless run of singles.
    for (let period = 3; period >= 1; period--) {
      if (counts.length < period * 2) continue;
      const tail = counts.slice(-period * 2);
      if (tail.slice(0, period).every((count, index) => count === tail[index + period])) {
        repeatedCount = tail[0];
        weights[repeatedCount - 1] += 9;
        break;
      }
    }
    const maximum = Math.min(MAX_COMMITMENT, estimatedHand);
    weights.forEach((_, index) => { if (index >= maximum) weights[index] = 0; });
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    // Revealed copies remain in discard until the public draw count reaches
    // the next recycle. The opponent never reads the player's actual deck.
    let drawPile = 24 - HAND_SIZE, handSize = HAND_SIZE, unavailable = {};
    for (const cards of rounds) {
      cards.forEach(card => { if (card?.art) unavailable[card.art] = (unavailable[card.art] || 0) + 1; });
      handSize = Math.max(0, handSize - countFormationCards(cards));
      for (let draw = 0, amount = Math.min(ROUND_DRAW, HAND_SIZE - handSize); draw < amount; draw++) {
        if (!drawPile) { drawPile = 24 - handSize; unavailable = {}; }
        drawPile--; handSize++;
      }
    }
    const commitmentProbabilities = weights.map(weight => weight / total);
    const observedMasks = rounds.map(getFormationMask);
    const maskProbabilities = Array(16).fill(0);
    for (let count = 1; count <= MAX_COMMITMENT; count++) {
      const shapes = FORMATION_SHAPES.filter(shape => shape.count === count);
      const recentMasks = observedMasks.filter(mask => countMaskCards(mask) === count).slice(-12);
      const shapeWeights = shapes.map(shape => {
        let weight = 1;
        recentMasks.forEach((mask, index) => { if (mask === shape.mask) weight += .5 + (index + 1) / recentMasks.length; });
        // Position transitions are learned only from publicly finished rounds.
        for (let index = Math.max(1, observedMasks.length - 14); index < observedMasks.length; index++) {
          if (observedMasks[index - 1] === observedMasks.at(-1) && observedMasks[index] === shape.mask) weight += 2;
        }
        return weight;
      });
      const shapeTotal = shapeWeights.reduce((sum, value) => sum + value, 0);
      shapes.forEach((shape, index) => { maskProbabilities[shape.mask] = commitmentProbabilities[count - 1] * shapeWeights[index] / shapeTotal; });
    }
    return { rounds: rounds.slice(-16), estimatedHand, estimatedDrawPile: drawPile, repeatedCount, unavailable,
      commitmentProbabilities, maskProbabilities };
  }

  const countMaskCards = mask => [0, 1, 2, 3].filter(lane => mask & (1 << lane)).length;
  const FORMATION_SHAPES = Object.freeze(Array.from({ length: 15 }, (_, index) => {
    const mask = index + 1, lanes = [0, 1, 2, 3].filter(lane => mask & (1 << lane));
    return Object.freeze({ mask, count: lanes.length, lanes: Object.freeze(lanes) });
  }));

  function planFormation(cards) {
    const count = countFormationCards(cards), last = cards.findLastIndex(Boolean);
    const bonuses = cards.map((card, lane) => card ? getTacticBonus(cards, lane) + getRallyBonus(cards, lane) : 0);
    return { cards, count, last, mask: getFormationMask(cards), bonuses,
      totals: cards.map((card, lane) => card ? card.power + bonuses[lane] : 0) };
  }

  function enumerateFormations(hand) {
    const formations = [], slots = Array(MAX_COMMITMENT).fill(null), used = new Set();
    const visit = lane => {
      if (lane === MAX_COMMITMENT) {
        if (used.size) formations.push([...slots]);
        return;
      }
      slots[lane] = null; visit(lane + 1);
      for (let index = 0; index < hand.length; index++) {
        if (used.has(index)) continue;
        used.add(index); slots[lane] = hand[index]; visit(lane + 1); used.delete(index);
      }
      slots[lane] = null;
    };
    visit(0);
    return formations;
  }

  function orderForLanes(cards, lanes) {
    let best, score = -Infinity;
    for (const order of permutations(cards)) {
      const slots = Array(MAX_COMMITMENT).fill(null);
      lanes.forEach((lane, index) => { slots[lane] = order[index]; });
      const plan = planFormation(slots), value = plan.bonuses.reduce((sum, bonus) => sum + bonus, 0);
      if (value > score) { score = value; best = plan; }
    }
    return best;
  }

  function buildPlayerScenarios(read, publicCards = [], random = Math.random) {
    const fallback = Object.keys(ELEMENTS).flatMap(element =>
      [3, 4, 5, 6, 8, 9].map((power, index) => ({ element, power,
        tactic: ["rally", "link", "vanguard", "finisher"][index % 4] })));
    const copies = card => card.rarity === "common" || card.rarity === "uncommon" ? 2 : 1;
    const definitions = publicCards.length ? publicCards : fallback;
    const pool = definitions.flatMap(card => Array(Math.max(0, copies(card) - (read.unavailable?.[card.art] || 0))).fill(card));
    const roll = () => Math.min(.999999, Math.max(0, random()));
    const scenarios = [];
    for (let count = 1; count <= MAX_COMMITMENT; count++) {
      const probability = read.commitmentProbabilities[count - 1];
      if (!probability) continue;
      const shapes = FORMATION_SHAPES.filter(shape => shape.count === count);
      const observed = read.rounds.filter(cards => countFormationCards(cards) === count).slice(-12);
      for (let sample = 0; sample < 4; sample++) {
        const available = [...pool], sampleHand = [];
        while (available.length && sampleHand.length < Math.max(count, read.estimatedHand)) {
          sampleHand.push(available.splice(Math.floor(roll() * available.length), 1)[0]);
        }
        sampleHand.sort((a, b) => b.power - a.power);
        // Include cheap pushes as well as power-heavy formations, without
        // inspecting the player's current hand, deck, or selected lanes.
        const cards = sample === 3 && count > 2 ? sampleHand.slice(-count) : sampleHand.slice(0, count);
        if (cards.length !== count) continue;
        shapes.forEach(shape => {
          let plan;
          const matching = observed.filter(reference => getFormationMask(reference) === shape.mask).slice(-5);
          if (matching.length && sample < 2) {
            const reference = matching[Math.floor(roll() * matching.length)], counts = {};
            const possible = reference.filter(Boolean).every(card => {
              if (!card.art) return true;
              counts[card.art] = (counts[card.art] || 0) + 1;
              return counts[card.art] <= pool.filter(candidate => candidate.art === card.art).length;
            });
            if (possible) plan = planFormation(reference.map(card => card ? { ...card } : null));
          }
          plan ||= orderForLanes(cards, shape.lanes);
          scenarios.push({ ...plan, weight: (read.maskProbabilities?.[shape.mask] ?? probability / shapes.length) / 4 });
        });
      }
    }
    const total = scenarios.reduce((sum, scenario) => sum + scenario.weight, 0);
    return total ? scenarios.map(scenario => ({ ...scenario, weight: scenario.weight / total })) : [];
  }

  function selectCloseHabitPlan(plans, bestScore) {
    let preferred;
    for (const candidate of plans) {
      if (candidate.score < bestScore - HABIT_SCORE_WINDOW) continue;
      if (!preferred || candidate.preference > preferred.preference
        || (candidate.preference === preferred.preference && candidate.score > preferred.score)) preferred = candidate;
    }
    return preferred?.cards;
  }

  function chooseAiFormation(hand, playerWins, aiWins, random = Math.random, traits = [], publicInfo = {}, preferredRole = null) {
    if (!hand.length) return [];
    const read = readPlayerHistory(publicInfo.history || []);
    const scenarios = buildPlayerScenarios(read, publicInfo.cardLibrary || [], random);
    const previousRound = publicInfo.history?.at(-1);
    const previous = { player: countFormationCards(previousRound?.playerCards), ai: countFormationCards(previousRound?.aiCards) };
    const prior = getCommitmentWeights(hand.length, playerWins, aiWins, traits, previous);
    const ownCounts = getElementProgress(aiWins), playerCounts = getElementProgress(playerWins);
    const has = id => traits.some(trait => trait.id === id);
    const roleFocus = ["rally", "link", "finisher"].includes(preferredRole) ? preferredRole : null;
    const loyalElement = traits.find(trait => trait.id === "element-loyalist")?.element;
    const lastElement = side => {
      for (const round of [...(publicInfo.history || [])].reverse()) {
        const cards = side === "player" ? round.playerCards : round.aiCards;
        for (let lane = (cards?.length || 0) - 1; lane >= 0; lane--) {
          if (cards?.[lane] && round.laneProgress?.[side]?.[lane] > 0) return cards[lane].element;
        }
      }
      return null;
    };
    const lastOwn = lastElement("ai"), lastPlayer = lastElement("player");
    const keys = Object.keys(ELEMENTS), own = keys.map(key => ownCounts[key]), other = keys.map(key => playerCounts[key]);
    const ownWeights = own.map(value => 1 + (Math.max(...own) - value) * .07);
    const otherWeights = other.map(value => 1 + (Math.max(...other) - value) * .07);
    const edgeMargins = keys.map(element => keys.map(opposing =>
      (ELEMENTS[element].beats === opposing ? ELEMENT_EDGE_BONUS : 0)
      - (ELEMENTS[opposing].beats === element ? ELEMENT_EDGE_BONUS : 0)));
    const prepare = plan => ({ ...plan, elements: plan.cards.map(card => card ? keys.indexOf(card.element) : -1) });
    const beliefs = scenarios.map(prepare);
    const placement = AI_PLACEMENT_TRAITS.find(template => traits.some(trait => trait.id === template.id));
    const placementRoll = placement ? random() : null;
    if (placement && !Number.isFinite(placementRoll)) throw new TypeError("A placement habit roll must be finite.");
    const anchored = placement && Math.min(.999999, Math.max(0, placementRoll)) < PLACEMENT_HABIT_RATE;
    // Solo Gambler places more value on hand recovery, but the match-winning
    // utility still outweighs conservation. This is an AI preference, not a rule.
    const recoveryValue = has("solo-gambler") && hand.length < HAND_SIZE ? 2 : 1;
    const penalty = count => recoveryValue * [0, 3.1, 1.8, .85, .3, .08, 0, 0][Math.min(HAND_SIZE, hand.length - count + ROUND_DRAW)] + count * .035;
    const preference = plan => {
      const { cards, count } = plan;
      let value = prior[count - 1] / Math.max(...prior) * .5;
      cards.forEach((card, lane) => {
        if (!card) return;
        if (has("trophy-hunter") && ownCounts[card.element] < PROGRESS_PER_ELEMENT) value += .4 / count;
        if (card.element === loyalElement) value += .4 / count;
        if (has("counter-scholar") && ELEMENTS[card.element].beats === lastPlayer) value += .4 / count;
        if (has("momentum-rider") && card.element === lastOwn) value += .4 / count;
        if (has("trophy-denier") && playerCounts[ELEMENTS[card.element].beats] >= PROGRESS_PER_ELEMENT - 2
          && playerCounts[ELEMENTS[card.element].beats] < PROGRESS_PER_ELEMENT) value += .4 / count;
        if (has("power-seeker")) value += (card.power - 3) / (6 * count);
        if (has("tactic-planner")) value += plan.bonuses[lane] / (2 * count);
        if (roleFocus) value += .5 * (roleFocus === "rally" ? getRallyBonus(cards, lane)
          : card.tactic === roleFocus ? getTacticBonus(cards, lane) : 0) / count;
      });
      return value;
    };
    // Exact scoring for every legal position/card assignment. A lane-only
    // shortlist cannot safely approximate victory-gated escort rewards.
    // Numeric forecasts avoid allocating presentation objects in this hot loop.
    const evaluateForecast = (plan, belief) => {
      const after = own.slice(), opposingAfter = other.slice();
      let wins = 0, opposingWins = 0;
      for (let lane = 0; lane < MAX_COMMITMENT; lane++) {
        const element = plan.elements[lane], opposingElement = belief.elements[lane];
        if (element < 0 || opposingElement < 0) continue;
        const margin = plan.totals[lane] - belief.totals[lane] + edgeMargins[element][opposingElement];
        if (margin > 0) { wins++; after[element] = Math.min(PROGRESS_PER_ELEMENT, after[element] + 2); }
        else if (margin < 0) { opposingWins++; opposingAfter[opposingElement] = Math.min(PROGRESS_PER_ELEMENT, opposingAfter[opposingElement] + 2); }
      }
      for (let lane = 0; lane < MAX_COMMITMENT; lane++) {
        const element = plan.elements[lane], opposingElement = belief.elements[lane];
        if (wins && element >= 0 && opposingElement < 0 && after[element] < PROGRESS_PER_ELEMENT) { after[element]++; wins--; }
        if (opposingWins && opposingElement >= 0 && element < 0 && opposingAfter[opposingElement] < PROGRESS_PER_ELEMENT) { opposingAfter[opposingElement]++; opposingWins--; }
      }
      let value = 0, complete = true, opposingComplete = true;
      for (let element = 0; element < keys.length; element++) {
        value += (after[element] - own[element]) * ownWeights[element]
          + Number(own[element] < PROGRESS_PER_ELEMENT && after[element] === PROGRESS_PER_ELEMENT);
        value -= ((opposingAfter[element] - other[element]) * otherWeights[element]
          + Number(other[element] < PROGRESS_PER_ELEMENT && opposingAfter[element] === PROGRESS_PER_ELEMENT)) * .8;
        complete &&= after[element] === PROGRESS_PER_ELEMENT;
        opposingComplete &&= opposingAfter[element] === PROGRESS_PER_ELEMENT;
      }
      return value + (complete && !opposingComplete ? 15 : opposingComplete && !complete ? -15 : 0);
    };
    const closePlans = [];
    let bestScore = -Infinity, preferredBestScore = -Infinity;
    for (const cards of enumerateFormations(hand)) {
      const plan = prepare(planFormation(cards));
      const strongest = Math.max(...cards.filter(Boolean).map(card => card.power));
      if (has("strong-opener") && cards[0]?.power !== strongest) continue;
      if (has("late-striker") && cards[plan.last].power !== strongest) continue;
      let score = -penalty(plan.count);
      for (const belief of beliefs) score += belief.weight * evaluateForecast(plan, belief);
      score += Math.min(.999999, Math.max(0, random())) * .025;
      bestScore = Math.max(bestScore, score);
      const preferred = placement && isPreferredPlacement(cards, placement);
      if (preferred) preferredBestScore = Math.max(preferredBestScore, score);
      closePlans.push({ cards, score, preference: preference(plan), preferred });
    }
    if (anchored && preferredBestScore > -Infinity && bestScore - preferredBestScore <= PLACEMENT_ESCAPE_MARGIN) {
      return selectCloseHabitPlan(closePlans.filter(plan => plan.preferred), preferredBestScore) || [];
    }
    return selectCloseHabitPlan(closePlans, bestScore) || [];
  }

  global.ClawFourLaneRules = Object.freeze({ ELEMENTS, ELEMENT_EDGE_BONUS, TROPHIES_PER_ELEMENT,
    TACTICS, MAX_COMMITMENT, HAND_SIZE, ROUND_DRAW, MAX_EXTRA_CARD_POINTS, LANE_WIN_POINTS: 2, EXTRA_CARD_POINTS: 1,
    PROGRESS_PER_ELEMENT, DRY_ROUND_WARNING, MAX_MATCH_ROUNDS, MAX_ROUNDS: MAX_MATCH_ROUNDS,
    countFormationCards, getFormationMask, normalizeFormation, isPreferredPlacement,
    AI_PLACEMENT_TRAITS, PLACEMENT_HABIT_RATE, PLACEMENT_ESCAPE_MARGIN,
    createProgress, getElementProgress, getProgressTotal, getProgressMatchWinner, resolveProgress,
    getTacticBonus, getRallyBonus, getExtraCardPoints, getExtraCardLanePoints, scoreClash, resolveClashes, getFormationRewardOptions,
    replenishHand, buildTellClues, createAiTraits, chooseAiCommitment, chooseAiCards, orderAiFormation,
    readPlayerHistory, buildPlayerScenarios, enumerateFormations, chooseAiFormation });
})(globalThis);
