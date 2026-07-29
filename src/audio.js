(function exposeClawAudio(global) {
  let context = null;
  let master = null;
  let effectsBus = null;
  let noiseBuffer = null;
  let enabled = true;
  const musicTracks = new Map();
  let requestedMusicTrack = null;
  let activeMusicTrack = null;
  let musicTransition = 0;
  const destructionBuffers = new Map();
  const destructionByteLoads = new Map();
  const destructionLoads = new Map();
  const clashHitBuffers = new Map();
  const clashHitByteLoads = new Map();
  const clashHitLoads = new Map();
  const cardSoundBuffers = new Map();
  const cardSoundByteLoads = new Map();
  const cardSoundLoads = new Map();
  const roundResultBuffers = new Map();
  const roundResultByteLoads = new Map();
  const roundResultLoads = new Map();
  const nextCardSample = new Map();
  let nextClashHit = 0;
  const musicSources = Object.freeze({
    menu: Object.freeze({
      source: "./assets/audio/music/nature-nurture.mp3",
      trim: 0.82,
    }),
    duel: Object.freeze({
      source: "./assets/audio/music/video-game-soldiers.mp3",
      trim: 1,
    }),
  });
  const volumeLevels = {
    master: 0.72,
    music: 0.12,
    effects: 1,
  };
  const destructionSources = Object.freeze({
    ember: "./assets/audio/clash/ember-destroy.wav",
    tide: "./assets/audio/clash/tide-destroy.wav",
    gust: "./assets/audio/clash/gust-destroy.wav",
  });
  const destructionGains = Object.freeze({
    ember: 0.62,
    tide: 0.36,
    gust: 0.4,
  });
  const clashHitSources = Object.freeze([
    "./assets/audio/clash/card-impact-1.wav",
    "./assets/audio/clash/card-impact-2.wav",
    "./assets/audio/clash/card-impact-3.wav",
  ]);
  const CLASH_HIT_GAIN = 0.64;
  const CARD_HOVER_SOUND_ENABLED = true;
  const cardSoundSources = Object.freeze({
    hover: Object.freeze(["./assets/audio/cards/hover-1.wav?v=foley-2"]),
    select: Object.freeze([
      "./assets/audio/cards/select-1.wav?v=foley-1",
      "./assets/audio/cards/select-2.wav?v=foley-1",
    ]),
    remove: Object.freeze([
      "./assets/audio/cards/remove-1.wav?v=foley-1",
      "./assets/audio/cards/remove-2.wav?v=foley-1",
    ]),
    deal: Object.freeze([
      "./assets/audio/cards/deal-1.wav?v=foley-1",
      "./assets/audio/cards/deal-2.wav?v=foley-1",
      "./assets/audio/cards/deal-3.wav?v=foley-1",
    ]),
    shuffleOpen: Object.freeze(["./assets/audio/cards/shuffle-open.wav?v=foley-1"]),
    shuffleClose: Object.freeze(["./assets/audio/cards/shuffle-close.wav?v=foley-1"]),
    commit1: Object.freeze(["./assets/audio/cards/commit-1.wav?v=foley-1"]),
    commit2: Object.freeze(["./assets/audio/cards/commit-2.wav?v=foley-1"]),
    commit3: Object.freeze(["./assets/audio/cards/commit-3.wav?v=foley-1"]),
    reveal1: Object.freeze(["./assets/audio/cards/reveal-1.wav?v=foley-1"]),
    reveal2: Object.freeze(["./assets/audio/cards/reveal-2.wav?v=foley-1"]),
    reveal3: Object.freeze(["./assets/audio/cards/reveal-3.wav?v=foley-1"]),
  });
  const cardSoundGains = Object.freeze({
    hover: 0.12,
    select: 0.5,
    remove: 0.46,
    deal: 0.52,
    shuffleOpen: 0.6,
    shuffleClose: 0.58,
    commit1: 0.62,
    commit2: 0.62,
    commit3: 0.62,
    reveal1: 0.54,
    reveal2: 0.54,
    reveal3: 0.54,
  });
  const roundResultSources = Object.freeze({
    win: "./assets/audio/results/round-win.wav",
    loss: "./assets/audio/results/round-loss.wav",
    draw: "./assets/audio/results/round-draw.wav",
  });
  const roundResultGains = Object.freeze({
    win: 0.72,
    loss: 0.7,
    draw: 0.66,
  });
  const cardSoundCount = Object.values(cardSoundSources)
    .reduce((total, sources) => total + sources.length, 0);

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
      master.gain.value = volumeLevels.master;
      master.connect(compressor).connect(context.destination);

      effectsBus = context.createGain();
      effectsBus.gain.value = volumeLevels.effects;
      effectsBus.connect(master);
      preloadDestructionSounds(context);
      preloadClashHitSounds(context);
      preloadCardSounds(context);
      preloadRoundResultSounds(context);
    }

    if (context.state === "suspended") {
      context.resume()
        .then(() => resumeRequestedMusic())
        .catch(() => {});
    }
    return context;
  }

  function clampVolume(value, fallback) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return fallback;
    return Math.max(0, Math.min(1, numericValue));
  }

  function updateGain(gainNode, value) {
    if (!gainNode) return;
    if (!context || context.state === "closed") {
      gainNode.gain.value = value;
      return;
    }

    const now = context.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setTargetAtTime(value, now, 0.025);
  }

  function setVolumes(nextVolumes = {}) {
    volumeLevels.master = clampVolume(nextVolumes.master, volumeLevels.master);
    volumeLevels.music = clampVolume(nextVolumes.music, volumeLevels.music);
    volumeLevels.effects = clampVolume(nextVolumes.effects, volumeLevels.effects);
    updateGain(master, volumeLevels.master);
    updateGain(effectsBus, volumeLevels.effects);
    const activeTrack = musicTracks.get(activeMusicTrack);
    if (activeTrack) {
      updateGain(
        activeTrack.gain,
        volumeLevels.music * musicSources[activeMusicTrack].trim,
      );
    }
    return { ...volumeLevels };
  }

  function getVolumes() {
    return { ...volumeLevels };
  }

  function setMusicStatus(trackName, status) {
    const root = global.document?.documentElement;
    root?.setAttribute("data-music-track", trackName || "none");
    root?.setAttribute("data-music-state", status);
    if (trackName === "duel") root?.setAttribute("data-duel-music", status);
  }

  function ensureMusicTrack(audioContext, trackName) {
    const existingTrack = musicTracks.get(trackName);
    if (existingTrack) return existingTrack;
    const trackConfig = musicSources[trackName];
    if (!trackConfig) return null;
    const element = global.document?.createElement("audio");
    if (!element || typeof audioContext.createMediaElementSource !== "function") {
      return null;
    }

    element.src = trackConfig.source;
    element.loop = true;
    element.preload = "auto";
    element.setAttribute("playsinline", "");

    const source = audioContext.createMediaElementSource(element);
    const gain = audioContext.createGain();
    gain.gain.value = 0.0001;
    source.connect(gain).connect(master);
    const track = { element, source, gain };
    musicTracks.set(trackName, track);

    element.addEventListener("playing", () => {
      if (requestedMusicTrack === trackName) setMusicStatus(trackName, "playing");
    });
    element.addEventListener("waiting", () => {
      if (requestedMusicTrack === trackName) setMusicStatus(trackName, "loading");
    });
    element.addEventListener("error", () => {
      if (requestedMusicTrack === trackName) setMusicStatus(trackName, "error");
    });

    return track;
  }

  function startMusic(trackName) {
    if (!musicSources[trackName]) return;
    requestedMusicTrack = trackName;
    const transition = ++musicTransition;
    const audioContext = createContext();
    if (!audioContext) return;
    const nextTrack = ensureMusicTrack(audioContext, trackName);
    if (!nextTrack) return;

    const previousTrackName = activeMusicTrack;
    const previousTrack = previousTrackName
      ? musicTracks.get(previousTrackName)
      : null;
    activeMusicTrack = trackName;

    const now = audioContext.currentTime;
    nextTrack.gain.gain.cancelScheduledValues(now);
    nextTrack.gain.gain.setValueAtTime(
      Math.max(0.0001, nextTrack.gain.gain.value),
      now,
    );
    nextTrack.gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, volumeLevels.music * musicSources[trackName].trim),
      now + (previousTrackName && previousTrackName !== trackName ? 0.8 : 1.2),
    );
    setMusicStatus(trackName, "loading");
    nextTrack.element.play().catch(() => {
      if (requestedMusicTrack === trackName) setMusicStatus(trackName, "blocked");
    });

    if (!previousTrack || previousTrackName === trackName) return;
    previousTrack.gain.gain.cancelScheduledValues(now);
    previousTrack.gain.gain.setValueAtTime(
      Math.max(0.0001, previousTrack.gain.gain.value),
      now,
    );
    previousTrack.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
    global.setTimeout(() => {
      if (transition !== musicTransition || activeMusicTrack === previousTrackName) {
        return;
      }
      previousTrack.element.pause();
      previousTrack.element.currentTime = 0;
      previousTrack.gain.gain.value = 0.0001;
    }, 700);
  }

  function resumeRequestedMusic() {
    if (!enabled || !requestedMusicTrack || !context) return;
    const track = ensureMusicTrack(context, requestedMusicTrack);
    if (!track) return;
    const targetGain = volumeLevels.music * musicSources[requestedMusicTrack].trim;
    updateGain(track.gain, targetGain);
    track.element.play().catch(() => {
      setMusicStatus(requestedMusicTrack, "blocked");
    });
  }

  function startMainMenuMusic() {
    startMusic("menu");
  }

  function startDuelMusic() {
    startMusic("duel");
  }

  function stopDuelMusic() {
    if (requestedMusicTrack !== "duel") return;
    requestedMusicTrack = null;
    activeMusicTrack = null;
    musicTransition += 1;
    musicTracks.forEach((track) => {
      track.element.pause();
      track.element.currentTime = 0;
      track.gain.gain.value = 0.0001;
    });
    setMusicStatus(null, "stopped");
  }

  function requestDestructionBytes() {
    if (typeof global.fetch !== "function") return;
    Object.entries(destructionSources).forEach(([element, sourcePath]) => {
      if (destructionByteLoads.has(element)) return;
      const load = global.fetch(sourcePath)
        .then((response) => {
          if (!response.ok) throw new Error(`Audio request failed: ${response.status}`);
          return response.arrayBuffer();
        })
        .catch(() => null);
      destructionByteLoads.set(element, load);
    });
  }

  function preloadDestructionSounds(audioContext) {
    requestDestructionBytes();
    Object.keys(destructionSources).forEach((element) => {
      if (destructionBuffers.has(element) || destructionLoads.has(element)) return;
      const byteLoad = destructionByteLoads.get(element);
      if (!byteLoad) return;
      const load = byteLoad
        .then((bytes) => bytes ? audioContext.decodeAudioData(bytes.slice(0)) : null)
        .then((buffer) => {
          if (buffer) {
            destructionBuffers.set(element, buffer);
            global.document?.documentElement?.setAttribute(
              `data-${element}-destruction-audio`,
              "ready",
            );
          }
          return buffer;
        })
        .catch(() => null);
      destructionLoads.set(element, load);
    });
  }

  function requestClashHitBytes() {
    if (typeof global.fetch !== "function") return;
    clashHitSources.forEach((sourcePath, index) => {
      if (clashHitByteLoads.has(index)) return;
      const load = global.fetch(sourcePath)
        .then((response) => {
          if (!response.ok) throw new Error(`Audio request failed: ${response.status}`);
          return response.arrayBuffer();
        })
        .catch(() => null);
      clashHitByteLoads.set(index, load);
    });
  }

  function preloadClashHitSounds(audioContext) {
    requestClashHitBytes();
    clashHitSources.forEach((sourcePath, index) => {
      if (clashHitBuffers.has(index) || clashHitLoads.has(index)) return;
      const byteLoad = clashHitByteLoads.get(index);
      if (!byteLoad) return;
      const load = byteLoad
        .then((bytes) => bytes ? audioContext.decodeAudioData(bytes.slice(0)) : null)
        .then((buffer) => {
          if (buffer) {
            clashHitBuffers.set(index, buffer);
            if (clashHitBuffers.size === clashHitSources.length) {
              global.document?.documentElement?.setAttribute(
                "data-clash-impact-audio",
                "ready",
              );
            }
          }
          return buffer;
        })
        .catch(() => null);
      clashHitLoads.set(index, load);
    });
  }

  function requestCardSoundBytes() {
    if (typeof global.fetch !== "function") return;
    Object.entries(cardSoundSources).forEach(([bank, sources]) => {
      sources.forEach((sourcePath, index) => {
        const key = `${bank}:${index}`;
        if (cardSoundByteLoads.has(key)) return;
        const load = global.fetch(sourcePath)
          .then((response) => {
            if (!response.ok) throw new Error(`Audio request failed: ${response.status}`);
            return response.arrayBuffer();
          })
          .catch(() => null);
        cardSoundByteLoads.set(key, load);
      });
    });
  }

  function preloadCardSounds(audioContext) {
    requestCardSoundBytes();
    Object.entries(cardSoundSources).forEach(([bank, sources]) => {
      sources.forEach((sourcePath, index) => {
        const key = `${bank}:${index}`;
        if (cardSoundBuffers.has(key) || cardSoundLoads.has(key)) return;
        const byteLoad = cardSoundByteLoads.get(key);
        if (!byteLoad) return;
        const load = byteLoad
          .then((bytes) => bytes ? audioContext.decodeAudioData(bytes.slice(0)) : null)
          .then((buffer) => {
            if (buffer) {
              cardSoundBuffers.set(key, buffer);
              if (cardSoundBuffers.size === cardSoundCount) {
                global.document?.documentElement?.setAttribute(
                  "data-card-audio",
                  "ready",
                );
              }
            }
            return buffer;
          })
          .catch(() => null);
        cardSoundLoads.set(key, load);
      });
    });
  }

  function requestRoundResultBytes() {
    if (typeof global.fetch !== "function") return;
    Object.entries(roundResultSources).forEach(([result, sourcePath]) => {
      if (roundResultByteLoads.has(result)) return;
      const load = global.fetch(sourcePath)
        .then((response) => {
          if (!response.ok) throw new Error(`Audio request failed: ${response.status}`);
          return response.arrayBuffer();
        })
        .catch(() => null);
      roundResultByteLoads.set(result, load);
    });
  }

  function preloadRoundResultSounds(audioContext) {
    requestRoundResultBytes();
    Object.keys(roundResultSources).forEach((result) => {
      if (roundResultBuffers.has(result) || roundResultLoads.has(result)) return;
      const byteLoad = roundResultByteLoads.get(result);
      if (!byteLoad) return;
      const load = byteLoad
        .then((bytes) => bytes ? audioContext.decodeAudioData(bytes.slice(0)) : null)
        .then((buffer) => {
          if (buffer) {
            roundResultBuffers.set(result, buffer);
            if (roundResultBuffers.size === Object.keys(roundResultSources).length) {
              global.document?.documentElement?.setAttribute(
                "data-round-result-audio",
                "ready",
              );
            }
          }
          return buffer;
        })
        .catch(() => null);
      roundResultLoads.set(result, load);
    });
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
    if (typeof audioContext.createStereoPanner !== "function") return effectsBus;
    const panner = audioContext.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(effectsBus);
    return panner;
  }

  function playCardSample(bank, pan = 0) {
    const audioContext = createContext();
    const sources = cardSoundSources[bank];
    if (!audioContext || !sources?.length) return false;

    const preferredIndex = (nextCardSample.get(bank) || 0) % sources.length;
    const readyIndices = sources
      .map((sourcePath, index) => index)
      .filter((index) => cardSoundBuffers.has(`${bank}:${index}`));
    if (readyIndices.length === 0) return false;

    const selectedIndex = readyIndices.includes(preferredIndex)
      ? preferredIndex
      : readyIndices[0];
    const buffer = cardSoundBuffers.get(`${bank}:${selectedIndex}`);
    if (!buffer) return false;

    nextCardSample.set(bank, (selectedIndex + 1) % sources.length);
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    const output = outputFor(audioContext, pan);
    source.buffer = buffer;
    gain.gain.value = cardSoundGains[bank] ?? 0.5;
    source.connect(gain).connect(output);
    source.addEventListener("ended", () => {
      source.disconnect();
      gain.disconnect();
      if (output !== effectsBus) output.disconnect();
    }, { once: true });
    global.document?.documentElement?.setAttribute(
      "data-last-card-audio",
      `${bank}-file-${selectedIndex + 1}`,
    );
    source.start();
    return true;
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
      if (output !== effectsBus) output.disconnect();
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
      if (output !== effectsBus) output.disconnect();
    }, { once: true });
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  function cardFlip(selected = true, order = 1) {
    if (!createContext()) return;
    const cardBank = selected ? "select" : "remove";
    if (playCardSample(cardBank)) return;
    global.document?.documentElement?.setAttribute(
      "data-last-card-audio",
      `${cardBank}-fallback`,
    );
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

  function cardHover() {
    if (!CARD_HOVER_SOUND_ENABLED) return;
    if (!createContext()) return;
    if (playCardSample("hover")) return;
    global.document?.documentElement?.setAttribute(
      "data-last-card-audio",
      "hover-fallback",
    );

    noise({
      duration: 0.045,
      volume: 0.035,
      frequency: 1800,
      endFrequency: 4200,
      filterType: "bandpass",
      q: 0.8,
      pan: -0.03,
      attack: 0.002,
    });
    oscillator({
      when: 0.018,
      duration: 0.045,
      volume: 0.022,
      frequency: 540,
      endFrequency: 720,
      type: "triangle",
      pan: 0.03,
    });
  }

  function roundAdvance() {
    if (!createContext()) return;

    noise({
      duration: 0.085,
      volume: 0.065,
      frequency: 3600,
      endFrequency: 1100,
      filterType: "bandpass",
      q: 0.7,
      pan: -0.08,
    });
    oscillator({
      when: 0.035,
      duration: 0.13,
      volume: 0.055,
      frequency: 330,
      endFrequency: 495,
      type: "triangle",
      pan: 0.08,
    });
    noise({
      when: 0.075,
      duration: 0.055,
      volume: 0.05,
      frequency: 620,
      endFrequency: 240,
      filterType: "lowpass",
    });
  }

  function buttonPress() {
    if (!createContext()) return;

    noise({
      duration: 0.038,
      volume: 0.045,
      frequency: 3100,
      endFrequency: 1250,
      filterType: "bandpass",
      q: 1.1,
      pan: -0.04,
      attack: 0.001,
    });
    oscillator({
      when: 0.008,
      duration: 0.065,
      volume: 0.038,
      frequency: 470,
      endFrequency: 280,
      type: "triangle",
      pan: 0.04,
      attack: 0.001,
    });
    oscillator({
      when: 0.022,
      duration: 0.045,
      volume: 0.022,
      frequency: 940,
      endFrequency: 620,
      type: "sine",
    });
  }

  function deckShuffle(closing = false) {
    if (!createContext()) return;
    const cardBank = closing ? "shuffleClose" : "shuffleOpen";
    if (playCardSample(cardBank)) return;
    global.document?.documentElement?.setAttribute(
      "data-last-card-audio",
      `${cardBank}-fallback`,
    );

    for (let index = 0; index < 7; index += 1) {
      const fromLeft = index % 2 === 0;
      noise({
        when: index * 0.075,
        duration: 0.085,
        volume: closing ? 0.06 : 0.075,
        frequency: fromLeft ? 3300 : 2700,
        endFrequency: fromLeft ? 950 : 1250,
        filterType: "bandpass",
        q: 0.75,
        pan: fromLeft ? -0.24 : 0.24,
        attack: 0.002,
      });
    }
    oscillator({
      when: 0.5,
      duration: 0.16,
      volume: 0.055,
      frequency: closing ? 260 : 320,
      endFrequency: closing ? 120 : 180,
      type: "triangle",
    });
  }

  function cardDeal(order = 0) {
    if (!createContext()) return;
    const pan = Math.max(-0.45, Math.min(0.45, (order - 2.5) * 0.16));
    if (playCardSample("deal", pan)) return;
    global.document?.documentElement?.setAttribute(
      "data-last-card-audio",
      "deal-fallback",
    );

    noise({
      duration: 0.055,
      volume: 0.055,
      frequency: 2400,
      endFrequency: 760,
      filterType: "bandpass",
      q: 0.7,
      pan,
      attack: 0.001,
    });
    oscillator({
      when: 0.026,
      duration: 0.055,
      volume: 0.03,
      frequency: 390 + order * 18,
      endFrequency: 240 + order * 12,
      type: "triangle",
      pan,
    });
  }

  function denied() {
    oscillator({ duration: 0.09, volume: 0.09, frequency: 170, endFrequency: 125, type: "square" });
    oscillator({ when: 0.09, duration: 0.1, volume: 0.07, frequency: 145, endFrequency: 105, type: "square" });
    noise({ duration: 0.045, volume: 0.07, frequency: 550, filterType: "lowpass" });
  }

  function commit(cardCount = 1) {
    if (!createContext()) return;
    const boundedCardCount = Math.max(1, Math.min(3, cardCount));
    const cardBank = `commit${boundedCardCount}`;
    if (playCardSample(cardBank)) return;
    global.document?.documentElement?.setAttribute(
      "data-last-card-audio",
      `${cardBank}-fallback`,
    );

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
    if (!createContext()) return;
    const boundedCardCount = Math.max(1, Math.min(3, cardCount));
    const cardBank = `reveal${boundedCardCount}`;
    if (playCardSample(cardBank)) return;
    global.document?.documentElement?.setAttribute(
      "data-last-card-audio",
      `${cardBank}-fallback`,
    );

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

  function clashHit() {
    const audioContext = createContext();
    if (!audioContext || clashHitBuffers.size === 0) return false;

    let selectedIndex = nextClashHit % clashHitSources.length;
    if (!clashHitBuffers.has(selectedIndex)) {
      selectedIndex = [...clashHitBuffers.keys()][0];
    }
    const buffer = clashHitBuffers.get(selectedIndex);
    if (!buffer) return false;

    nextClashHit = (selectedIndex + 1) % clashHitSources.length;
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    source.buffer = buffer;
    gain.gain.value = CLASH_HIT_GAIN;
    source.connect(gain).connect(effectsBus);
    source.addEventListener("ended", () => {
      source.disconnect();
      gain.disconnect();
    }, { once: true });
    global.document?.documentElement?.setAttribute(
      "data-last-clash-impact-audio",
      `file-${selectedIndex + 1}`,
    );
    source.start();
    return true;
  }

  function clashImpact(playerElement, aiElement, winner, cinematic = false) {
    if (!createContext()) return;
    if (!clashHit()) {
      global.document?.documentElement?.setAttribute(
        "data-last-clash-impact-audio",
        "fallback",
      );
      impactCrunch();
    }
    const playerIntensity = winner === "player" ? 1 : winner === "draw" ? 0.78 : 0.58;
    const aiIntensity = winner === "ai" ? 1 : winner === "draw" ? 0.78 : 0.58;
    const customPlayerDestruction = (
      cinematic
      && winner === "player"
      && Object.hasOwn(destructionSources, playerElement)
    );
    const customAiDestruction = (
      cinematic
      && winner === "ai"
      && Object.hasOwn(destructionSources, aiElement)
    );
    if (!customPlayerDestruction) {
      elementalSound(playerElement, 0.012, -0.34, playerIntensity);
    }
    if (!customAiDestruction) {
      elementalSound(aiElement, 0.012, 0.34, aiIntensity);
    }
  }

  function cardDestruction(element, pan = 0) {
    const audioContext = createContext();
    if (!audioContext) return;
    const buffer = destructionBuffers.get(element);

    if (!buffer) {
      global.document?.documentElement?.setAttribute(
        "data-last-destruction-audio",
        `${element}-fallback`,
      );
      elementalSound(element, 0, pan, 0.78);
      return;
    }

    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    const output = outputFor(audioContext, pan);
    source.buffer = buffer;
    gain.gain.value = destructionGains[element] ?? 0.62;
    source.connect(gain).connect(output);
    source.addEventListener("ended", () => {
      source.disconnect();
      gain.disconnect();
      if (output !== effectsBus) output.disconnect();
    }, { once: true });
    global.document?.documentElement?.setAttribute(
      "data-last-destruction-audio",
      `${element}-file`,
    );
    source.start();
  }

  function playRoundResultSample(result) {
    const audioContext = createContext();
    const buffer = roundResultBuffers.get(result);
    if (!audioContext || !buffer) return false;

    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    source.buffer = buffer;
    gain.gain.value = roundResultGains[result] ?? 0.68;
    source.connect(gain).connect(effectsBus);
    source.addEventListener("ended", () => {
      source.disconnect();
      gain.disconnect();
    }, { once: true });
    global.document?.documentElement?.setAttribute(
      "data-last-round-result-audio",
      `${result}-file`,
    );
    source.start();
    return true;
  }

  function roundResult(result) {
    if (playRoundResultSample(result)) return;
    global.document?.documentElement?.setAttribute(
      "data-last-round-result-audio",
      `${result}-fallback`,
    );
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
      resumeRequestedMusic();
      cardFlip(true, 1);
    } else if (context?.state === "running") {
      context.suspend().catch(() => {});
    }
  }

  requestDestructionBytes();
  requestClashHitBytes();
  requestCardSoundBytes();
  requestRoundResultBytes();

  global.ClawAudio = Object.freeze({
    cardFlip,
    cardHover,
    buttonPress,
    deckShuffle,
    cardDeal,
    roundAdvance,
    denied,
    commit,
    reveal,
    clashApproach,
    clashImpact,
    cardDestruction,
    roundResult,
    matchResult,
    startMainMenuMusic,
    startDuelMusic,
    stopDuelMusic,
    setVolumes,
    getVolumes,
    setEnabled,
  });
})(globalThis);
