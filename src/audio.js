(function exposeClawAudio(global) {
  let context = null;
  let master = null;
  let noiseBuffer = null;
  let enabled = true;

  function createContext() {
    if (!enabled) return null;
    const AudioContextClass = global.AudioContext || global.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!context) {
      context = new AudioContextClass();
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -20;
      compressor.knee.value = 16;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.18;

      master = context.createGain();
      master.gain.value = 0.72;
      master.connect(compressor).connect(context.destination);
    }

    if (context.state === "suspended") context.resume().catch(() => {});
    return context;
  }

  function getNoiseBuffer(audioContext) {
    if (noiseBuffer) return noiseBuffer;
    const length = audioContext.sampleRate;
    noiseBuffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
    const channel = noiseBuffer.getChannelData(0);

    let brown = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      brown = (brown + 0.02 * white) / 1.02;
      channel[index] = white * 0.78 + brown * 0.9;
    }
    return noiseBuffer;
  }

  function outputFor(audioContext, pan = 0) {
    if (typeof audioContext.createStereoPanner !== "function") return master;
    const panner = audioContext.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(master);
    return panner;
  }

  function noise({
    when = 0,
    duration = 0.1,
    volume = 0.1,
    frequency = 1600,
    endFrequency = frequency,
    filterType = "bandpass",
    q = 0.8,
    pan = 0,
    attack = 0.004,
  } = {}) {
    const audioContext = createContext();
    if (!audioContext) return;
    const start = audioContext.currentTime + when;
    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();

    source.buffer = getNoiseBuffer(audioContext);
    filter.type = filterType;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(Math.max(30, frequency), start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + Math.min(attack, duration * 0.3));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    const output = outputFor(audioContext, pan);
    source.connect(filter).connect(gain).connect(output);
    source.addEventListener("ended", () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      if (output !== master) output.disconnect();
    }, { once: true });
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  function oscillator({
    when = 0,
    duration = 0.1,
    volume = 0.08,
    frequency = 440,
    endFrequency = frequency,
    type = "sine",
    pan = 0,
    attack = 0.003,
  } = {}) {
    const audioContext = createContext();
    if (!audioContext) return;
    const start = audioContext.currentTime + when;
    const source = audioContext.createOscillator();
    const gain = audioContext.createGain();

    source.type = type;
    source.frequency.setValueAtTime(Math.max(20, frequency), start);
    source.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + Math.min(attack, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    const output = outputFor(audioContext, pan);
    source.connect(gain).connect(output);
    source.addEventListener("ended", () => {
      source.disconnect();
      gain.disconnect();
      if (output !== master) output.disconnect();
    }, { once: true });
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  function cardFlip(selected = true, order = 1) {
    if (!createContext()) return;
    const pitchLift = Math.max(0, order - 1) * 90;

    noise({
      duration: 0.065,
      volume: 0.14,
      frequency: selected ? 1250 : 2100,
      endFrequency: selected ? 4300 : 900,
      filterType: "bandpass",
      q: 0.65,
      pan: -0.08,
    });
    noise({
      when: 0.042,
      duration: 0.032,
      volume: 0.12,
      frequency: 5200,
      endFrequency: 2600,
      filterType: "highpass",
      pan: 0.1,
    });
    oscillator({
      when: 0.036,
      duration: 0.055,
      volume: 0.075,
      frequency: selected ? 420 + pitchLift : 460,
      endFrequency: selected ? 760 + pitchLift : 230,
      type: "triangle",
    });
  }

  function denied() {
    oscillator({ duration: 0.09, volume: 0.09, frequency: 170, endFrequency: 125, type: "square" });
    oscillator({ when: 0.09, duration: 0.1, volume: 0.07, frequency: 145, endFrequency: 105, type: "square" });
    noise({ duration: 0.045, volume: 0.07, frequency: 550, filterType: "lowpass" });
  }

  function commit(cardCount = 1) {
    for (let index = 0; index < cardCount; index += 1) {
      noise({
        when: index * 0.035,
        duration: 0.055,
        volume: 0.09,
        frequency: 2400,
        endFrequency: 900,
        filterType: "bandpass",
        pan: (index - (cardCount - 1) / 2) * 0.18,
      });
    }
    const landing = cardCount * 0.035 + 0.02;
    oscillator({
      when: landing,
      duration: 0.14,
      volume: 0.16,
      frequency: 115 + cardCount * 8,
      endFrequency: 52,
      type: "sine",
    });
    noise({
      when: landing,
      duration: 0.075,
      volume: 0.14,
      frequency: 720,
      endFrequency: 260,
      filterType: "lowpass",
    });
  }

  function reveal(cardCount = 1) {
    for (let index = 0; index < cardCount; index += 1) {
      const when = index * 0.055;
      noise({
        when,
        duration: 0.06,
        volume: 0.08,
        frequency: 1100,
        endFrequency: 3800,
        filterType: "bandpass",
        pan: (index - (cardCount - 1) / 2) * 0.25,
      });
      oscillator({
        when: when + 0.025,
        duration: 0.06,
        volume: 0.045,
        frequency: 390 + index * 80,
        endFrequency: 650 + index * 90,
        type: "triangle",
      });
    }
  }

  function elementalSound(element, when, pan, intensity = 1, charge = false) {
    if (element === "ember") {
      if (charge) {
        noise({
          when,
          duration: 0.2,
          volume: 0.07 * intensity,
          frequency: 700,
          endFrequency: 2600,
          filterType: "bandpass",
          pan,
          attack: 0.09,
        });
        return;
      }
      oscillator({
        when,
        duration: 0.22,
        volume: 0.11 * intensity,
        frequency: 150,
        endFrequency: 48,
        type: "sawtooth",
        pan,
      });
      [0.012, 0.055, 0.097, 0.145].forEach((offset, index) => {
        noise({
          when: when + offset,
          duration: 0.025 + index * 0.004,
          volume: (0.08 - index * 0.009) * intensity,
          frequency: 2600 + index * 550,
          endFrequency: 950,
          filterType: "bandpass",
          q: 1.4,
          pan,
        });
      });
      return;
    }

    if (element === "gust") {
      noise({
        when,
        duration: charge ? 0.22 : 0.3,
        volume: (charge ? 0.07 : 0.13) * intensity,
        frequency: charge ? 450 : 4200,
        endFrequency: charge ? 2600 : 550,
        filterType: "bandpass",
        q: 0.55,
        pan,
        attack: charge ? 0.1 : 0.012,
      });
      oscillator({
        when: when + (charge ? 0.05 : 0.015),
        duration: charge ? 0.15 : 0.2,
        volume: (charge ? 0.025 : 0.045) * intensity,
        frequency: charge ? 520 : 1050,
        endFrequency: charge ? 900 : 430,
        type: "sine",
        pan,
      });
      return;
    }

    if (charge) {
      noise({
        when,
        duration: 0.2,
        volume: 0.065 * intensity,
        frequency: 380,
        endFrequency: 1250,
        filterType: "lowpass",
        pan,
        attack: 0.1,
      });
      oscillator({
        when: when + 0.04,
        duration: 0.14,
        volume: 0.035 * intensity,
        frequency: 180,
        endFrequency: 330,
        pan,
      });
      return;
    }

    noise({
      when,
      duration: 0.28,
      volume: 0.15 * intensity,
      frequency: 1800,
      endFrequency: 320,
      filterType: "lowpass",
      pan,
    });
    [0.025, 0.075, 0.13].forEach((offset, index) => {
      oscillator({
        when: when + offset,
        duration: 0.09,
        volume: (0.055 - index * 0.008) * intensity,
        frequency: 920 + index * 240,
        endFrequency: 420 + index * 90,
        type: "sine",
        pan,
      });
    });
  }

  function clashApproach(playerElement, aiElement) {
    if (!createContext()) return;
    noise({
      duration: 0.21,
      volume: 0.095,
      frequency: 320,
      endFrequency: 3200,
      filterType: "bandpass",
      q: 0.55,
      attack: 0.13,
    });
    elementalSound(playerElement, 0, -0.38, 0.8, true);
    elementalSound(aiElement, 0, 0.38, 0.8, true);
  }

  function impactCrunch(when = 0) {
    oscillator({
      when,
      duration: 0.24,
      volume: 0.24,
      frequency: 120,
      endFrequency: 38,
      type: "sine",
    });
    noise({
      when,
      duration: 0.16,
      volume: 0.22,
      frequency: 680,
      endFrequency: 140,
      filterType: "lowpass",
    });
    [0, 0.027, 0.061].forEach((offset, index) => {
      noise({
        when: when + offset,
        duration: 0.038 + index * 0.012,
        volume: 0.17 - index * 0.025,
        frequency: 2200 - index * 380,
        endFrequency: 520,
        filterType: "bandpass",
        q: 0.9,
        pan: index === 1 ? -0.12 : index === 2 ? 0.12 : 0,
      });
    });
  }

  function clashImpact(playerElement, aiElement, winner) {
    if (!createContext()) return;
    impactCrunch();
    const playerIntensity = winner === "player" ? 1 : winner === "draw" ? 0.78 : 0.58;
    const aiIntensity = winner === "ai" ? 1 : winner === "draw" ? 0.78 : 0.58;
    elementalSound(playerElement, 0.012, -0.34, playerIntensity);
    elementalSound(aiElement, 0.012, 0.34, aiIntensity);
  }

  function roundResult(result) {
    const notes = result === "win"
      ? [392, 523.25, 659.25]
      : result === "loss"
        ? [293.66, 233.08, 174.61]
        : [349.23, 392, 349.23];
    notes.forEach((frequency, index) => {
      oscillator({
        when: index * 0.075,
        duration: 0.18,
        volume: 0.07,
        frequency,
        endFrequency: frequency * (result === "loss" ? 0.88 : 1.02),
        type: "triangle",
      });
    });
  }

  function matchResult(won) {
    const notes = won
      ? [261.63, 329.63, 392, 523.25]
      : [293.66, 246.94, 196, 146.83];
    notes.forEach((frequency, index) => {
      oscillator({
        when: index * 0.11,
        duration: 0.32,
        volume: 0.085,
        frequency,
        endFrequency: frequency * (won ? 1.015 : 0.94),
        type: won ? "triangle" : "sine",
      });
    });
  }

  function setEnabled(nextEnabled) {
    enabled = Boolean(nextEnabled);
    if (enabled) {
      cardFlip(true, 1);
    } else if (context?.state === "running") {
      context.suspend().catch(() => {});
    }
  }

  global.ClawAudio = Object.freeze({
    cardFlip,
    denied,
    commit,
    reveal,
    clashApproach,
    clashImpact,
    roundResult,
    matchResult,
    setEnabled,
  });
})(globalThis);
