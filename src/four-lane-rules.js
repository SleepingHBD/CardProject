(function exposeFourLaneRules(global) {
  "use strict";
  const normal = global.ClawRules;
  const { ELEMENTS, ELEMENT_EDGE_BONUS, TROPHIES_PER_ELEMENT } = normal;
  const MAX_COMMITMENT = 4;
  const HAND_SIZE = 7;
  const ROUND_DRAW = 3;
  const TACTICS = Object.freeze({
    ...normal.TACTICS,
    link: Object.freeze({ ...normal.TACTICS.link,
      description: "Link: +1 in Lane 2, 3 or 4 when the card directly before it has a different element." }),
    finisher: Object.freeze({ ...normal.TACTICS.finisher,
      description: "Finisher: +1 when committed last in a formation of at least two cards." }),
    rally: Object.freeze({ icon: "banner", label: "Rally",
      description: "Rally: Gives +1 Power to the card committed directly after it. No following card means no bonus." }),
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
    // Incoming support never amplifies what another Rally passes forward.
    return index > 0 && cards[index] && cards[index - 1]?.tactic === "rally" ? 1 : 0;
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
      player: Math.max(0, playerCards.length - aiCards.length),
      ai: Math.max(0, aiCards.length - playerCards.length),
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
    return normal.createAiTraits(random).map(trait => Object.freeze({ ...trait,
      description: trait.id === "full-formation"
        ? "Favors 4-card pushes, then smaller formations to rebuild the opponent's hand."
        : trait.id === "solo-gambler"
          ? "Often commits 1 card to conserve cards or rebuild the opponent's hand; vulnerable to large formations."
          : trait.id === "tactic-planner"
            ? "Orders cards to activate their roles and use Rally to strengthen the next card."
            : trait.description,
    }));
  }

  function chooseAiCommitment(handLength, playerWins, aiWins, random = Math.random, traits = [], previous = {}) {
    const maximum = Math.min(MAX_COMMITMENT, handLength);
    if (maximum <= 1) return maximum;
    const has = id => traits.some(trait => trait.id === id);
    const roll = Math.min(.999999, Math.max(0, random()));
    let weights = [.15, .25, .4, .2];
    if (has("solo-gambler")) weights = [.5, .3, .15, .05];
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
    const total = weights.slice(0, maximum).reduce((sum, weight) => sum + weight, 0);
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

  global.ClawFourLaneRules = Object.freeze({ ELEMENTS, ELEMENT_EDGE_BONUS, TROPHIES_PER_ELEMENT,
    TACTICS, MAX_COMMITMENT, HAND_SIZE, ROUND_DRAW, LANE_WIN_POINTS: 2, EXTRA_CARD_POINTS: 1,
    getTacticBonus, getRallyBonus, scoreClash, resolveClashes, getFormationRewardOptions,
    replenishHand, buildTellClues, createAiTraits, chooseAiCommitment, chooseAiCards, orderAiFormation });
})(globalThis);
