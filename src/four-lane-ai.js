(function exposeFourLaneAi(global) {
  "use strict";

  const rules = global.ClawFourLaneRules;
  const elements = Object.keys(rules.ELEMENTS);
  const elementIndex = Object.fromEntries(elements.map((element, index) => [element, index]));
  const edge = elements.map(own => elements.map(other => own === other ? 0
    : rules.ELEMENTS[own].beats === other ? rules.ELEMENT_EDGE_BONUS : -rules.ELEMENT_EDGE_BONUS));
  const CANDIDATES_PER_MASK = 12;
  const SOLVER_ITERATIONS = 900;
  const RESPONSE_ADDITIONS = 6;

  function checkHand(hand) {
    if (!Array.isArray(hand) || hand.length < 1 || hand.length > rules.HAND_SIZE
      || new Set(hand).size !== hand.length || Array.from(hand).some(card => !card
        || !Object.hasOwn(elementIndex, card.element) || !Number.isFinite(card.power))) {
      throw new RangeError("A public hand must contain one to seven distinct, valid cards.");
    }
  }

  function roll(random) {
    const value = random();
    if (!Number.isFinite(value)) throw new TypeError("A strategy roll must be finite.");
    return Math.max(0, Math.min(.999999999, value));
  }

  function prepareFormation(cards) {
    const slots = rules.normalizeFormation(cards);
    const count = slots.filter(Boolean).length;
    const powers = new Float64Array(4), types = new Int8Array(4).fill(-1);
    let mask = 0, rawPower = 0, bonuses = 0, elementMask = 0;
    slots.forEach((card, lane) => {
      if (!card) return;
      types[lane] = elementIndex[card.element];
      const bonus = rules.getTacticBonus(slots, lane) + rules.getRallyBonus(slots, lane);
      powers[lane] = card.power + bonus;
      bonuses += bonus;
      rawPower += card.power;
      elementMask |= 1 << types[lane];
      mask |= 1 << lane;
    });
    return { cards: slots, count, powers, types, mask, rawPower, bonuses,
      diversity: [0, 1, 1, 2, 1, 2, 2, 3][elementMask] };
  }

  function enumerate(hand, battleLane) {
    const plans = [], slots = Array(4).fill(null);
    function visit(lane, used, count) {
      if (lane === 4) {
        if (count && slots[battleLane]) plans.push(prepareFormation(slots));
        return;
      }
      if (lane !== battleLane) visit(lane + 1, used, count);
      if (count === 4) return;
      for (let index = 0; index < hand.length; index++) {
        if (used & (1 << index)) continue;
        slots[lane] = hand[index];
        visit(lane + 1, used | (1 << index), count + 1);
      }
      slots[lane] = null;
    }
    visit(0, 0, 0);
    return plans;
  }

  function resourceCost(plan, handLength, round) {
    if (round >= rules.MAX_MATCH_ROUNDS) return 0;
    const nextHand = Math.min(rules.HAND_SIZE, handLength - plan.count + rules.ROUND_DRAW);
    // Three-card turns are sustainable. Fourth cards draw down the options
    // available next turn; tiny costs also preserve low-Power utility cards.
    return [0, 3.1, 1.8, .85, .3, .08, 0, 0][nextHand] + plan.count * .035;
  }

  function shortlist(plans, progress, battleLane) {
    const buckets = new Map(), selected = new Set();
    const max = Math.max(...progress), weight = progress.map(value => 1 + .07 * (max - value));
    const rank = plan => plan.powers.reduce((sum, power, lane) => sum
      + (plan.types[lane] < 0 ? 0 : power * weight[plan.types[lane]]), 0);
    for (const plan of plans) {
      if (!buckets.has(plan.mask)) buckets.set(plan.mask, []);
      buckets.get(plan.mask).push(plan);
    }
    for (const group of buckets.values()) {
      if (group.length <= CANDIDATES_PER_MASK || group[0].count === 1) {
        group.forEach(plan => selected.add(plan));
        continue;
      }
      // Each occupancy pattern keeps cheap, role-efficient, diverse and
      // element-specific plans, not only the largest raw-Power formation.
      const addTop = (metric, amount = 1) => [...group].sort((a, b) => metric(b) - metric(a))
        .slice(0, amount).forEach(plan => selected.add(plan));
      addTop(rank, 3);
      addTop(plan => plan.bonuses * 5 + rank(plan), 2);
      addTop(plan => plan.diversity * 20 + rank(plan));
      addTop(plan => -plan.rawPower);
      for (let type = 0; type < elements.length; type++) {
        addTop(plan => plan.types.reduce((sum, value, lane) => sum
          + (value === type ? plan.powers[lane] : 0), 0));
      }
      addTop(plan => plan.powers[battleLane] * 10 + rank(plan));
      addTop(plan => -plan.powers[battleLane] * 10 + rank(plan));
    }
    return [...selected];
  }

  const counts = progress => elements.map(element => rules.getElementProgress(progress)[element]);
  const score = progress => progress[0] + progress[1] + progress[2]
    + rules.SET_BONUS * Math.min(progress[0], progress[1], progress[2]);

  function pairValue(own, other, ownBefore, otherBefore, ownCost = 0, otherCost = 0) {
    const after = ownBefore.slice(), opposingAfter = otherBefore.slice();
    let wins = 0, opposingWins = 0;
    for (let lane = 0; lane < 4; lane++) {
      const type = own.types[lane], opposingType = other.types[lane];
      if (type < 0 || opposingType < 0) continue;
      const margin = own.powers[lane] - other.powers[lane] + edge[type][opposingType];
      if (margin > 0) { after[type] += rules.LANE_WIN_POINTS; wins++; }
      else if (margin < 0) { opposingAfter[opposingType] += rules.LANE_WIN_POINTS; opposingWins++; }
    }
    wins = Math.min(rules.MAX_EXTRA_CARD_POINTS, wins);
    opposingWins = Math.min(rules.MAX_EXTRA_CARD_POINTS, opposingWins);
    for (let lane = 0; lane < 4; lane++) {
      const type = own.types[lane], opposingType = other.types[lane];
      if (wins && type >= 0 && opposingType < 0) { after[type] += rules.EXTRA_CARD_POINTS; wins--; }
      if (opposingWins && opposingType >= 0 && type < 0) {
        opposingAfter[opposingType] += rules.EXTRA_CARD_POINTS; opposingWins--;
      }
    }
    return score(after) - score(ownBefore) - score(opposingAfter) + score(otherBefore) - ownCost + otherCost;
  }

  function solve(own, other, evaluate, random) {
    const rows = own.length, columns = other.length;
    const matrix = own.map(plan => Float64Array.from(other, opponent => evaluate(plan, opponent)));
    const rowTotals = new Float64Array(rows), columnTotals = new Float64Array(columns);
    const rowCounts = new Float64Array(rows), columnCounts = new Float64Array(columns);
    let row = Math.floor(roll(random) * rows), column = Math.floor(roll(random) * columns);
    // Simultaneous fictitious play produces mixed plans. Choosing a single
    // best response to one guessed formation would expose a repeatable target.
    for (let iteration = 0; iteration < SOLVER_ITERATIONS; iteration++) {
      rowCounts[row]++; columnCounts[column]++;
      let nextRow = 0, nextColumn = 0;
      for (let index = 0; index < rows; index++) {
        rowTotals[index] += matrix[index][column];
        if (rowTotals[index] > rowTotals[nextRow]) nextRow = index;
      }
      for (let index = 0; index < columns; index++) {
        columnTotals[index] += matrix[row][index];
        if (columnTotals[index] < columnTotals[nextColumn]) nextColumn = index;
      }
      row = nextRow; column = nextColumn;
    }
    const probabilities = Array.from(rowCounts, value => value / SOLVER_ITERATIONS);
    const opponentProbabilities = Array.from(columnCounts, value => value / SOLVER_ITERATIONS);
    const upper = Math.max(...rowTotals) / SOLVER_ITERATIONS;
    const lower = Math.min(...columnTotals) / SOLVER_ITERATIONS;
    return { probabilities, opponentProbabilities, gap: upper - lower, lower, upper };
  }

  function addResponses(all, selected, opposing, probabilities, evaluate, maximize) {
    const existing = new Set(selected), support = opposing.flatMap((plan, index) =>
      probabilities[index] > 0 ? [{ plan, weight: probabilities[index] }] : []);
    const ranked = [];
    for (const plan of all) {
      if (existing.has(plan)) continue;
      const value = support.reduce((sum, entry) => sum + entry.weight * (maximize
        ? evaluate(plan, entry.plan) : evaluate(entry.plan, plan)), 0);
      ranked.push({ plan, value });
    }
    ranked.sort((a, b) => maximize ? b.value - a.value : a.value - b.value);
    ranked.slice(0, RESPONSE_ADDITIONS).forEach(entry => selected.push(entry.plan));
  }

  function analyse(ownHand, opponentPublicHand, ownProgress = {}, opponentProgress = {}, round = 1, random = Math.random) {
    checkHand(ownHand); checkHand(opponentPublicHand);
    if (!Number.isInteger(round) || round < 1 || round > rules.MAX_MATCH_ROUNDS) {
      throw new RangeError("The round must be within this match.");
    }
    if (typeof random !== "function") throw new TypeError("A strategy roll function is required.");
    const battleLane = rules.getBattleLane(round), ownBefore = counts(ownProgress), otherBefore = counts(opponentProgress);
    const allOwn = enumerate(ownHand, battleLane), allOther = enumerate(opponentPublicHand, battleLane);
    const own = shortlist(allOwn, ownBefore, battleLane), other = shortlist(allOther, otherBefore, battleLane);
    const evaluate = (plan, opponent) => pairValue(plan, opponent, ownBefore, otherBefore,
      resourceCost(plan, ownHand.length, round), resourceCost(opponent, opponentPublicHand.length, round));
    let strategy = solve(own, other, evaluate, random);
    // One oracle pass checks every legal formation against the first mixture.
    // Its strongest omitted responses are added before the final solve. This
    // bounds work without pretending the pruned, one-round game is an exact
    // equilibrium of the full eight-round match.
    addResponses(allOwn, own, other, strategy.opponentProbabilities, evaluate, true);
    addResponses(allOther, other, own.slice(0, strategy.probabilities.length), strategy.probabilities, evaluate, false);
    strategy = solve(own, other, evaluate, random);
    return { plans: own.map(plan => plan.cards), probabilities: strategy.probabilities,
      candidateCounts: [own.length, other.length], legalCounts: [allOwn.length, allOther.length],
      gap: strategy.gap, battleLane };
  }

  function chooseFormation(ownHand, opponentPublicHand, ownProgress = {}, opponentProgress = {}, round = 1, random = Math.random) {
    const strategy = analyse(ownHand, opponentPublicHand, ownProgress, opponentProgress, round, random);
    let target = roll(random);
    for (let index = 0; index < strategy.plans.length; index++) {
      target -= strategy.probabilities[index];
      if (target <= 0) return strategy.plans[index].slice();
    }
    return strategy.plans.at(-1).slice();
  }

  // Diagnostic scoring shares the numeric production planner, allowing tests
  // to compare it against the presentation-rich live rules independently.
  function evaluateFormation(ownCards, otherCards, ownProgress = {}, opponentProgress = {}) {
    return pairValue(prepareFormation(ownCards), prepareFormation(otherCards), counts(ownProgress), counts(opponentProgress));
  }

  global.ClawFourLaneAi = Object.freeze({ chooseFormation, analyse, evaluateFormation });
})(globalThis);
