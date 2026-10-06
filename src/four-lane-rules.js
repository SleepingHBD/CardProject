(function exposeFourLaneRules(global) {
  "use strict";
  const normal = global.ClawRules;
  const { ELEMENTS, ELEMENT_EDGE_BONUS, TROPHIES_PER_ELEMENT } = normal;
  const MAX_COMMITMENT = 4;
  const HAND_SIZE = 7;
  const ROUND_DRAW = 2;
  const MAX_EXTRA_CARD_POINTS = 2;
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

  function getFormationRewardOptions(playerCards, aiCards, resolution) {
    if (resolution.winner === "draw") return [];
    const winner = resolution.winner;
    const cards = winner === "player" ? playerCards : aiCards;
    const wonLanes = resolution.results.flatMap((result, lane) => result === winner
      ? [{ winner, card: cards[lane], lane, fixed: false }] : []);
    // A lane-winning trophy is required even if extra points tipped the round.
    if (wonLanes.length) return wonLanes;
    const lane = Math.min(playerCards.length, aiCards.length);
    return cards[lane] ? [{ winner, card: cards[lane], lane, fixed: true }] : [];
  }

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

  function createAiTraits(random = Math.random) {
    const descriptions = {
      "solo-gambler": "Favors committing 1 card when his hand needs rebuilding, but can commit more to avoid giving away rounds.",
      "measured-planner": "Favors 2-card formations when they offer a good chance to win.",
      "full-formation": "Favors 4-card pushes, then smaller formations to rebuild the opponent's hand.",
    };
    return normal.createAiTraits(random).map(trait => Object.freeze({ ...trait,
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
      const gap = normal.getTrophyProgress(playerWins) - normal.getTrophyProgress(aiWins);
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
    while (chosen.length < amount) {
      // Only the opponent's own hand, trophies and public history are supplied.
      const card = normal.chooseAiCard(available, playerWins, aiWins, random, chosen.at(-1), traits);
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
      rounds.push(cards.map(card => ({ element: card.element, power: card.power, tactic: card.tactic })));
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
    return { rounds: rounds.slice(-16), estimatedHand, repeatedCount,
      commitmentProbabilities: weights.map(weight => weight / total) };
  }

  function buildPlayerScenarios(read, publicCards, random) {
    const fallback = Object.keys(ELEMENTS).flatMap(element =>
      [3, 4, 5, 6, 8, 9].map((power, index) => ({ element, power,
        tactic: ["rally", "link", "vanguard", "finisher"][index % 4] })));
    const pool = publicCards.length ? publicCards : fallback;
    const roll = () => Math.min(.999999, Math.max(0, random()));
    const scenarios = [];
    for (let count = 1; count <= MAX_COMMITMENT; count++) {
      const probability = read.commitmentProbabilities[count - 1];
      if (!probability) continue;
      const observed = read.rounds.filter(cards => cards.length === count).slice(-5);
      for (let sample = 0; sample < 6; sample++) {
        let cards;
        if (observed.length && sample < 4) {
          // Recalled cards describe a tendency, never a guaranteed repeat. Power
          // and elements are varied so one lucky reveal does not become a tell.
          const reference = observed[Math.floor(roll() * observed.length)];
          cards = reference.map(card => ({ ...card,
            power: Math.max(3, Math.min(9, card.power + Math.floor(roll() * 3) - 1)),
            element: roll() < .2 ? pool[Math.floor(roll() * pool.length)].element : card.element }));
        } else {
          const available = [...pool];
          const sampleHand = [];
          while (available.length && sampleHand.length < Math.max(count, read.estimatedHand)) {
            sampleHand.push(available.splice(Math.floor(roll() * available.length), 1)[0]);
          }
          sampleHand.sort((a, b) => b.power - a.power);
          // Include conserved/cheap pushes as well as power-heavy formations.
          cards = (sample === 5 && count > 2 ? sampleHand.slice(-count) : sampleHand.slice(0, count));
          cards = orderAiFormation(cards, roll, [{ id: "tactic-planner" }]);
        }
        if (cards.length !== count) continue;
        scenarios.push({ cards, weight: probability / 6,
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

  function chooseAiFormation(hand, playerWins, aiWins, random = Math.random, traits = [], publicInfo = {}) {
    if (!hand.length) return [];
    const read = readPlayerHistory(publicInfo.history || []);
    // The library is public card definitions, not a list of live player cards.
    const scenarios = buildPlayerScenarios(read, publicInfo.cardLibrary || [], random);
    const previousRound = publicInfo.history?.at(-1);
    const previous = { player: previousRound?.playerCards?.length, ai: previousRound?.aiCards?.length };
    const prior = getCommitmentWeights(hand.length, playerWins, aiWins, traits, previous);
    const ownCounts = normal.getElementTrophyCounts(aiWins);
    const playerCounts = normal.getElementTrophyCounts(playerWins);
    const has = id => traits.some(trait => trait.id === id);
    const seeksPower = has("power-seeker");
    const plansRoles = has("tactic-planner");
    const rebuilding = has("solo-gambler") && hand.length < HAND_SIZE;
    const hasRefinedPreference = seeksPower || plansRoles || rebuilding;
    const loyalElement = traits.find(trait => trait.id === "element-loyalist")?.element;
    const need = counts => Object.keys(ELEMENTS).reduce((sum, element) =>
      sum + Math.max(0, TROPHIES_PER_ELEMENT - counts[element]), 0);
    const rewardValue = (card, counts, remaining) => counts[card.element] >= TROPHIES_PER_ELEMENT
      ? .1 : 2.5 + counts[card.element] * .7 + (remaining === 1 ? 6 : 0);
    const ownNeed = need(ownCounts), playerNeed = need(playerCounts);
    const ownRewards = hand.map(card => rewardValue(card, ownCounts, ownNeed));
    scenarios.forEach(scenario => {
      scenario.rewards = scenario.cards.map(card => rewardValue(card, playerCounts, playerNeed));
      // Cache pair/bonus comparisons: every candidate uses the same public beliefs.
      scenario.matchups = hand.map(card => scenario.cards.map((other, lane) =>
        card.power - scenario.totals[lane]
        + (ELEMENTS[card.element].beats === other.element ? ELEMENT_EDGE_BONUS : 0)
        - (ELEMENTS[other.element].beats === card.element ? ELEMENT_EDGE_BONUS : 0)));
    });
    let best = [], bestScore = -Infinity;
    const closePlans = [];
    const indices = [], used = new Set();
    const evaluate = () => {
      const cards = indices.map(index => hand[index]);
      const count = cards.length;
      const strongest = Math.max(...cards.map(card => card.power));
      // Explicit ordering habits are promises. Strategy may change the subset,
      // but it must not quietly place that subset's strongest card elsewhere.
      if (has("strong-opener") && cards[0].power !== strongest) return;
      if (has("late-striker") && cards[count - 1].power !== strongest) return;
      const bonuses = cards.map((_, lane) => getTacticBonus(cards, lane) + getRallyBonus(cards, lane));
      let score = 0;
      for (const scenario of scenarios) {
        const paired = Math.min(count, scenario.cards.length);
        let ownPoints = getExtraCardPoints(count, paired), playerPoints = getExtraCardPoints(scenario.cards.length, paired);
        let ownReward = 0, playerReward = 0;
        for (let lane = 0; lane < paired; lane++) {
          const margin = scenario.matchups[indices[lane]][lane] + bonuses[lane];
          if (margin > 0) { ownPoints += 2; ownReward = Math.max(ownReward, ownRewards[indices[lane]]); }
          if (margin < 0) { playerPoints += 2; playerReward = Math.max(playerReward, scenario.rewards[lane]); }
        }
        // With no lane victory, only the first extra card is trophy-eligible.
        if (!ownReward && count > paired) ownReward = ownRewards[indices[paired]];
        if (!playerReward && scenario.cards.length > paired) playerReward = scenario.rewards[paired];
        score += scenario.weight * (ownPoints > playerPoints ? 4 + ownReward
          : ownPoints < playerPoints ? -4 - playerReward : -.25);
      }
      const nextHand = Math.min(HAND_SIZE, hand.length - count + ROUND_DRAW);
      // Cards spent now constrain later pushes. Do not burn the whole hand for
      // a small gain, or waste a premium card on an unopposed extra lane.
      score -= [0, 3.5, 2.5, 1.4, .65, .2, 0, 0][nextHand] + count * .12;
      score -= cards.reduce((sum, card) => sum + (card.power - 3) * .1, 0);
      score += 1.25 * Math.log(prior[count - 1] / Math.max(...prior));
      let motive = 0;
      for (const card of cards) {
        if (has("trophy-hunter") && ownCounts[card.element] < TROPHIES_PER_ELEMENT) motive += .8;
        if (card.element === loyalElement) motive += 1.1;
        if (has("counter-scholar") && ELEMENTS[card.element].beats === playerWins.at(-1)?.element) motive += 1;
        if (has("momentum-rider") && card.element === aiWins.at(-1)?.element) motive += 1;
        if (has("trophy-denier") && playerCounts[ELEMENTS[card.element].beats] === TROPHIES_PER_ELEMENT - 1) motive += 1;
      }
      score += motive / count;
      score += Math.min(.999999, Math.max(0, random())) * .35;
      if (score > bestScore) { best = cards; bestScore = score; }
      if (hasRefinedPreference) {
        // Mean Power and bonuses per card avoid rewarding wasteful larger plays.
        // Rally received is included in role combinations, without changing its rules.
        const powerPreference = seeksPower
          ? cards.reduce((sum, card) => sum + card.power - 3, 0) / (6 * count) : 0;
        const rolePreference = plansRoles
          ? bonuses.reduce((sum, bonus) => sum + bonus, 0) / (2 * count) : 0;
        const recoveryPreference = rebuilding ? (MAX_COMMITMENT - count) / (MAX_COMMITMENT - 1) : 0;
        closePlans.push({ cards, score, preference: powerPreference + rolePreference + recoveryPreference });
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
    if (hasRefinedPreference) {
      return selectCloseHabitPlan(closePlans, bestScore) || best;
    }
    return best;
  }

  global.ClawFourLaneRules = Object.freeze({ ELEMENTS, ELEMENT_EDGE_BONUS, TROPHIES_PER_ELEMENT,
    TACTICS, MAX_COMMITMENT, HAND_SIZE, ROUND_DRAW, MAX_EXTRA_CARD_POINTS, LANE_WIN_POINTS: 2, EXTRA_CARD_POINTS: 1,
    getTacticBonus, getRallyBonus, getExtraCardPoints, getExtraCardLanePoints, scoreClash, resolveClashes, getFormationRewardOptions,
    replenishHand, buildTellClues, createAiTraits, chooseAiCommitment, chooseAiCards, orderAiFormation,
    readPlayerHistory, chooseAiFormation });
})(globalThis);
