(function exposeFourLaneRules(global) {
  "use strict";
  const normal = global.ClawRules;
  const { ELEMENTS, ELEMENT_EDGE_BONUS, TROPHIES_PER_ELEMENT } = normal;
  const MAX_COMMITMENT = 4;
  const HAND_SIZE = 7;
  const ROUND_DRAW = 2;
  const MAX_EXTRA_CARD_POINTS = 2;
  const PROGRESS_PER_ELEMENT = 6;
  // Personality breaks close strategic decisions, not clearly worse outcomes.
  const HABIT_SCORE_WINDOW = .75;
  const TACTICS = Object.freeze({
    ...normal.TACTICS,
    link: Object.freeze({ ...normal.TACTICS.link,
      description: "Link: +1 in Lane 2, 3 or 4 when the card directly before it has a different element." }),
    finisher: Object.freeze({ ...normal.TACTICS.finisher,
      description: "Finisher: +1 when committed last in a formation of at least two cards." }),
    rally: Object.freeze({ icon: "banner", label: "Rally",
      description: "Rally: Gives +1 Power to the card committed directly before it. In Lane 1, Rally gives no bonus." }),
  });

  function getTacticBonus(cards, index) {
    const card = cards[index];
    if (!card) return 0;
    if (card.tactic === "vanguard") return index === 0 ? 1 : 0;
    if (card.tactic === "link") return index > 0 && cards[index - 1].element !== card.element ? 1 : 0;
    if (card.tactic === "finisher") return cards.length >= 2 && index === cards.length - 1 ? 1 : 0;
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

  function getExtraCardPoints(cardCount, opposingCount) {
    return Math.min(MAX_EXTRA_CARD_POINTS, Math.max(0, cardCount - opposingCount));
  }

  function getExtraCardLanePoints(index, opposingCount) {
    return index >= opposingCount && index < opposingCount + MAX_EXTRA_CARD_POINTS ? 1 : 0;
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
    for (const formation of [playerCards, aiCards]) {
      if (!Array.isArray(formation) || formation.length < 1 || formation.length > MAX_COMMITMENT) {
        throw new RangeError("Four-Lane formations must contain one to four cards.");
      }
    }
    const clashCount = Math.min(playerCards.length, aiCards.length);
    const lanes = playerCards.slice(0, clashCount).map((card, index) => {
      const scoring = scoreClash(card, aiCards[index],
        getTacticBonus(playerCards, index), getTacticBonus(aiCards, index),
        getRallyBonus(playerCards, index), getRallyBonus(aiCards, index));
      const winner = scoring.player.total === scoring.ai.total ? "draw"
        : scoring.player.total > scoring.ai.total ? "player" : "ai";
      return { ...scoring, winner };
    });
    const results = lanes.map(lane => lane.winner);
    const laneWins = { player: 0, ai: 0, draw: 0 };
    results.forEach(winner => { laneWins[winner]++; });
    const lanePoints = { player: laneWins.player * 2, ai: laneWins.ai * 2 };
    const extraCardPoints = {
      player: getExtraCardPoints(playerCards.length, aiCards.length),
      ai: getExtraCardPoints(aiCards.length, playerCards.length),
    };
    const score = { player: lanePoints.player + extraCardPoints.player,
      ai: lanePoints.ai + extraCardPoints.ai, draw: laneWins.draw };
    const winner = score.player === score.ai ? "draw" : score.player > score.ai ? "player" : "ai";
    const loser = winner === "player" ? "ai" : "player";
    const decidedBy = winner === "draw" ? "draw"
      : lanePoints[winner] <= lanePoints[loser] ? "extra-cards" : "clashes";
    return { results, lanes, laneWins, lanePoints, extraCardPoints, score, winner, decidedBy,
      commitments: { player: playerCards.length, ai: aiCards.length } };
  }

  function resolveProgress(playerCards, aiCards, playerProgress = {}, aiProgress = {}, resolution = resolveClashes(playerCards, aiCards)) {
    const progressBefore = { player: getElementProgress(playerProgress), ai: getElementProgress(aiProgress) };
    const progressAfter = { player: { ...progressBefore.player }, ai: { ...progressBefore.ai } };
    const progressGains = { player: createProgress(), ai: createProgress() };
    const laneProgress = { player: [], ai: [] };
    for (const [side, cards, other] of [["player", playerCards, aiCards], ["ai", aiCards, playerCards]]) {
      cards.forEach((card, lane) => {
        const raw = lane < other.length ? resolution.results[lane] === side ? 2 : 0
          : getExtraCardLanePoints(lane, other.length);
        const gain = Math.min(raw, PROGRESS_PER_ELEMENT - progressAfter[side][card.element]);
        laneProgress[side][lane] = gain;
        progressAfter[side][card.element] += gain;
        progressGains[side][card.element] += gain;
      });
    }
    const score = { player: getProgressTotal(progressGains.player), ai: getProgressTotal(progressGains.ai), draw: resolution.laneWins.draw };
    return { ...resolution, score, winner: score.player === score.ai ? "draw" : score.player > score.ai ? "player" : "ai",
      progressBefore, progressAfter, progressGains, laneProgress,
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

  function buildTellClues(cardCount, difficulty = "guided") {
    return Array.from({ length: MAX_COMMITMENT }, (_, index) =>
      difficulty === "instinct" || difficulty === "blind" ? "sealed"
        : index < cardCount ? "full" : "empty");
  }

  function createAiTraits(random = Math.random, pools = null) {
    const descriptions = {
      "trophy-hunter": "Favors elements he still needs to finish.",
      "trophy-denier": "Favors counters to elements you are close to finishing.",
      "counter-scholar": "Favors counters to the element of your last card that earned trophies.",
      "momentum-rider": "Favors the element of his last card that earned trophies.",
      "score-reader": "Favors committing more cards when behind on trophies, and fewer when ahead.",
      "solo-gambler": "Favors committing 1 card to rebuild his hand, but can commit more to earn trophies.",
      "measured-planner": "Favors committing 2 cards to earn trophies without shrinking his hand.",
      "full-formation": "Favors 4-card pushes, then smaller formations to rebuild the opponent's hand.",
    };
    let traits;
    if (pools === null) traits = normal.createAiTraits(random);
    else {
      const pick = (templates, category) => {
        const ids = pools[category];
        if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length
          || Array.from(ids).some(id => !templates.some(trait => trait.id === id))) {
          throw new RangeError(`Invalid ${category} habit pool.`);
        }
        const roll = random();
        if (!Number.isFinite(roll)) throw new TypeError("A habit roll must be finite.");
        return { ...templates.find(trait => trait.id === ids[Math.floor(Math.min(.999999, Math.max(0, roll)) * ids.length)]) };
      };
      traits = [pick(normal.AI_MOTIVE_TRAITS, "motive"), pick(normal.AI_FORMATION_TRAITS, "formation"),
        pick(normal.AI_COMMITMENT_TRAITS, "commitment")];
      if (traits[0].id === "element-loyalist") {
        const roll = random();
        if (!Number.isFinite(roll)) throw new TypeError("An element roll must be finite.");
        const element = Object.keys(ELEMENTS)[Math.floor(Math.min(.999999, Math.max(0, roll)) * 3)];
        Object.assign(traits[0], { element, label: `${ELEMENTS[element].label} Loyalist`,
          description: `Favors ${ELEMENTS[element].label} cards whenever available.` });
      }
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
        || cards.some(card => !ELEMENTS[card?.element] || !Number.isFinite(card.power))) continue;
      estimatedHand = Math.min(HAND_SIZE, Math.max(0, estimatedHand - cards.length) + ROUND_DRAW);
      rounds.push(cards.map(card => ({ art: card.art, element: card.element, power: card.power, tactic: card.tactic })));
    }
    const counts = rounds.map(cards => cards.length);
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
      cards.forEach(card => { if (card.art) unavailable[card.art] = (unavailable[card.art] || 0) + 1; });
      handSize -= cards.length;
      for (let draw = 0, amount = Math.min(ROUND_DRAW, HAND_SIZE - handSize); draw < amount; draw++) {
        if (!drawPile) { drawPile = 24 - handSize; unavailable = {}; }
        drawPile--; handSize++;
      }
    }
    return { rounds: rounds.slice(-16), estimatedHand, repeatedCount, unavailable,
      commitmentProbabilities: weights.map(weight => weight / total) };
  }

  function buildPlayerScenarios(read, publicCards, random) {
    const fallback = Object.keys(ELEMENTS).flatMap(element =>
      [3, 4, 5, 6, 8, 9].map((power, index) => ({ element, power,
        tactic: ["rally", "link", "vanguard", "finisher"][index % 4] })));
    const copies = card => card.rarity === "common" || card.rarity === "uncommon" ? 2 : 1;
    const definitions = publicCards.length ? publicCards : fallback;
    const pool = definitions.flatMap(card => Array(Math.max(0, copies(card) - (read.unavailable[card.art] || 0))).fill(card));
    const roll = () => Math.min(.999999, Math.max(0, random()));
    const scenarios = [];
    for (let count = 1; count <= MAX_COMMITMENT; count++) {
      const probability = read.commitmentProbabilities[count - 1];
      if (!probability) continue;
      const observed = read.rounds.filter(cards => cards.length === count).slice(-5);
      for (let sample = 0; sample < 4; sample++) {
        let cards;
        if (observed.length && sample < 2) {
          const reference = observed[Math.floor(roll() * observed.length)];
          const counts = {};
          const possible = reference.every(card => {
            if (!card.art) return true;
            counts[card.art] = (counts[card.art] || 0) + 1;
            return counts[card.art] <= pool.filter(candidate => candidate.art === card.art).length;
          });
          if (possible) cards = reference.map(card => ({ ...card }));
        }
        if (!cards) {
          const available = [...pool];
          const sampleHand = [];
          while (available.length && sampleHand.length < Math.max(count, read.estimatedHand)) {
            sampleHand.push(available.splice(Math.floor(roll() * available.length), 1)[0]);
          }
          sampleHand.sort((a, b) => b.power - a.power);
          // Include conserved/cheap pushes as well as power-heavy formations.
          cards = (sample === 3 && count > 2 ? sampleHand.slice(-count) : sampleHand.slice(0, count));
          cards = orderAiFormation(cards, roll, [{ id: "tactic-planner" }]);
        }
        if (cards.length !== count) continue;
        scenarios.push({ cards, weight: probability / 4,
          totals: cards.map((card, index) => card.power + getTacticBonus(cards, index) + getRallyBonus(cards, index)) });
      }
    }
    return scenarios;
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
    const previous = { player: previousRound?.playerCards?.length, ai: previousRound?.aiCards?.length };
    const prior = getCommitmentWeights(hand.length, playerWins, aiWins, traits, previous);
    const ownCounts = getElementProgress(aiWins), playerCounts = getElementProgress(playerWins);
    const has = id => traits.some(trait => trait.id === id);
    const roleFocus = ["rally", "link", "finisher"].includes(preferredRole) ? preferredRole : null;
    const loyalElement = traits.find(trait => trait.id === "element-loyalist")?.element;
    const lastElement = side => {
      for (const round of [...(publicInfo.history || [])].reverse()) {
        const cards = side === "player" ? round.playerCards : round.aiCards;
        for (let lane = (cards?.length || 0) - 1; lane >= 0; lane--) {
          if (round.laneProgress?.[side]?.[lane] > 0) return cards[lane].element;
        }
      }
      return null;
    };
    const lastOwn = lastElement("ai"), lastPlayer = lastElement("player");
    const utility = (gains, counts) => Object.keys(ELEMENTS).reduce((sum, element) => {
      const deficit = PROGRESS_PER_ELEMENT - counts[element];
      return sum + Math.min(deficit, gains[element]) * (1 + (Math.max(...Object.values(counts)) - counts[element]) * .07)
        + Number(deficit > 0 && gains[element] >= deficit);
    }, 0);
    // Solo Gambler places more value on hand recovery, but the match-winning
    // utility still outweighs conservation. This is an AI preference, not a rule.
    const recoveryValue = has("solo-gambler") && hand.length < HAND_SIZE ? 2 : 1;
    const penalty = count => recoveryValue * [0, 3.1, 1.8, .85, .3, .08, 0, 0][Math.min(HAND_SIZE, hand.length - count + ROUND_DRAW)] + count * .035;
    const preference = cards => {
      let value = prior[cards.length - 1] / Math.max(...prior) * .5;
      cards.forEach((card, lane) => {
        if (has("trophy-hunter") && ownCounts[card.element] < PROGRESS_PER_ELEMENT) value += .4 / cards.length;
        if (card.element === loyalElement) value += .4 / cards.length;
        if (has("counter-scholar") && ELEMENTS[card.element].beats === lastPlayer) value += .4 / cards.length;
        if (has("momentum-rider") && card.element === lastOwn) value += .4 / cards.length;
        if (has("trophy-denier") && playerCounts[ELEMENTS[card.element].beats] >= PROGRESS_PER_ELEMENT - 2
          && playerCounts[ELEMENTS[card.element].beats] < PROGRESS_PER_ELEMENT) value += .4 / cards.length;
        if (has("power-seeker")) value += (card.power - 3) / (6 * cards.length);
        if (has("tactic-planner")) value += (getTacticBonus(cards, lane) + getRallyBonus(cards, lane)) / (2 * cards.length);
        if (roleFocus) value += .5 * (roleFocus === "rally" ? getRallyBonus(cards, lane)
          : card.tactic === roleFocus ? getTacticBonus(cards, lane) : 0) / cards.length;
      });
      return value;
    };
    // Factorized lane expectations shortlist four candidates per commitment.
    // The finalists then use exact goal clipping, denial and simultaneous finish.
    const estimates = hand.map(card => Array.from({ length: 4 }, (_, lane) => Array.from({ length: 3 }, (_, bonus) => {
      let value = 0;
      for (const scenario of scenarios) {
        const other = scenario.cards[lane];
        if (!other) {
          if (getExtraCardLanePoints(lane, scenario.cards.length) && ownCounts[card.element] < PROGRESS_PER_ELEMENT) value += scenario.weight;
          continue;
        }
        const margin = card.power + bonus - scenario.totals[lane]
          + (ELEMENTS[card.element].beats === other.element ? 2 : 0)
          - (ELEMENTS[other.element].beats === card.element ? 2 : 0);
        if (margin > 0) value += scenario.weight * Math.min(2, PROGRESS_PER_ELEMENT - ownCounts[card.element]);
        if (margin < 0) value -= scenario.weight * Math.min(2, PROGRESS_PER_ELEMENT - playerCounts[other.element]) * .8;
      }
      return value;
    })));
    const shortlist = Array.from({ length: 4 }, () => []);
    const closePlans = [];
    const indices = [], used = new Set();
    const evaluate = () => {
      const cards = indices.map(index => hand[index]);
      const count = cards.length;
      const strongest = Math.max(...cards.map(card => card.power));
      if (has("strong-opener") && cards[0].power !== strongest) return;
      if (has("late-striker") && cards[count - 1].power !== strongest) return;
      const score = indices.reduce((sum, index, lane) => sum + estimates[index][lane][getTacticBonus(cards, lane) + getRallyBonus(cards, lane)], 0)
        - penalty(count) + preference(cards) * .1;
      const list = shortlist[count - 1];
      if (list.length < 4 || score > list.at(-1).score) {
        list.push({ cards, score }); list.sort((a, b) => b.score - a.score);
        if (list.length > 4) list.pop();
      }
    };
    const visit = () => {
      if (indices.length) evaluate();
      if (indices.length === Math.min(MAX_COMMITMENT, hand.length)) return;
      for (let index = 0; index < hand.length; index++) {
        if (used.has(index)) continue;
        used.add(index); indices.push(index); visit(); indices.pop(); used.delete(index);
      }
    };
    visit();
    let bestScore = -Infinity;
    for (const { cards } of shortlist.flat()) {
      let score = -penalty(cards.length);
      for (const scenario of scenarios) {
        const result = resolveProgress(cards, scenario.cards, ownCounts, playerCounts);
        score += scenario.weight * (utility(result.progressGains.player, ownCounts)
          - utility(result.progressGains.ai, playerCounts) * .8
          + (result.matchWinner === "player" ? 15 : result.matchWinner === "ai" ? -15 : 0));
      }
      score += Math.min(.999999, Math.max(0, random())) * .025;
      bestScore = Math.max(bestScore, score);
      closePlans.push({ cards, score, preference: preference(cards) });
    }
    return selectCloseHabitPlan(closePlans, bestScore) || [];
  }

  global.ClawFourLaneRules = Object.freeze({ ELEMENTS, ELEMENT_EDGE_BONUS, TROPHIES_PER_ELEMENT,
    TACTICS, MAX_COMMITMENT, HAND_SIZE, ROUND_DRAW, MAX_EXTRA_CARD_POINTS, LANE_WIN_POINTS: 2, EXTRA_CARD_POINTS: 1,
    PROGRESS_PER_ELEMENT, createProgress, getElementProgress, getProgressTotal, getProgressMatchWinner, resolveProgress,
    getTacticBonus, getRallyBonus, getExtraCardPoints, getExtraCardLanePoints, scoreClash, resolveClashes, getFormationRewardOptions,
    replenishHand, buildTellClues, createAiTraits, chooseAiCommitment, chooseAiCards, orderAiFormation,
    readPlayerHistory, chooseAiFormation });
})(globalThis);
