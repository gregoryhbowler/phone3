// SYNTH ENGINE - The hidden machinery
// No labels, no explanations, only transformation
// Inspired by: Buchla, Serge, Krell patches, Just Intonation,
// Reich phasing, Radigue drones, Basinski decay

class PatchUnknown {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.limiter = null;
        this.cells = new Array(64).fill(null);
        this.connections = new Map();
        this.workletReady = false;
        this.isRunning = false;

        // Krell state - autonomous self-playing
        this.krellActive = true;
        this.krellTimer = null;
        this.krellEventRate = 8000; // ms between events
        this.krellDensity = 0.3;    // probability of event

        // Just Intonation ratios (Partch, La Monte Young, Terry Riley)
        this.justRatios = {
            unison: 1/1,
            minorSecond: 16/15,
            majorSecond: 9/8,
            minorThird: 6/5,
            majorThird: 5/4,
            fourth: 4/3,
            tritone: 7/5,      // Septimal tritone
            fifth: 3/2,
            minorSixth: 8/5,
            majorSixth: 5/3,
            harmonicSeventh: 7/4,  // Barbershop seventh
            majorSeventh: 15/8,
            octave: 2/1
        };

        // Harmonic series partials (for spectral work)
        this.harmonicSeries = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

        // Extended Just Intonation scales (Ben Johnston, Harry Partch)
        this.scales = {
            // La Monte Young Dream House
            dreamHouse: [1/1, 9/8, 5/4, 4/3, 3/2, 27/16, 15/8],
            // Terry Riley Persian Surgery Dervishes
            persian: [1/1, 16/15, 5/4, 4/3, 3/2, 8/5, 15/8],
            // Harry Partch 11-limit
            partch: [1/1, 12/11, 11/10, 10/9, 9/8, 8/7, 7/6, 6/5, 11/9, 5/4, 14/11, 9/7, 4/3, 11/8, 7/5, 10/7, 3/2],
            // Simple harmonics (Caterina Barbieri-style)
            harmonic: [1/1, 9/8, 5/4, 11/8, 3/2, 13/8, 7/4, 15/8],
            // Kali Malone organ drones
            drone: [1/1, 3/2, 2/1, 3/1, 4/1, 5/1, 6/1, 8/1],
            // Pure fifths stack (Pythagorean)
            fifths: [1/1, 3/2, 9/4, 27/8, 81/16].map(r => r > 2 ? r / Math.pow(2, Math.floor(Math.log2(r))) : r),
            // Spectral (overtone singing, Radigue)
            spectral: [1/1, 2/1, 3/1, 4/1, 5/1, 6/1, 7/1, 8/1].map(r => r / Math.pow(2, Math.floor(Math.log2(r) || 0))),
            // Pentatonic JI
            pentatonic: [1/1, 9/8, 5/4, 3/2, 5/3],

            // ============== TRADITIONAL WESTERN SCALES (12-TET) ==============
            // Using equal temperament ratios: 2^(n/12)
            major: [1, 1.122462, 1.259921, 1.334840, 1.498307, 1.681793, 1.887749], // W-W-H-W-W-W-H
            minor: [1, 1.122462, 1.189207, 1.334840, 1.498307, 1.587401, 1.781797], // natural minor
            dorian: [1, 1.122462, 1.189207, 1.334840, 1.498307, 1.681793, 1.781797],
            phrygian: [1, 1.059463, 1.189207, 1.334840, 1.498307, 1.587401, 1.781797],
            lydian: [1, 1.122462, 1.259921, 1.414214, 1.498307, 1.681793, 1.887749],
            mixolydian: [1, 1.122462, 1.259921, 1.334840, 1.498307, 1.681793, 1.781797],
            locrian: [1, 1.059463, 1.189207, 1.334840, 1.414214, 1.587401, 1.781797],
            // Harmonic minor (raised 7th)
            harmonicMinor: [1, 1.122462, 1.189207, 1.334840, 1.498307, 1.587401, 1.887749],
            // Melodic minor (raised 6th and 7th)
            melodicMinor: [1, 1.122462, 1.189207, 1.334840, 1.498307, 1.681793, 1.887749],
            // Blues scale
            blues: [1, 1.189207, 1.334840, 1.414214, 1.498307, 1.781797],
            // Whole tone
            wholeTone: [1, 1.122462, 1.259921, 1.414214, 1.587401, 1.781797],
            // Chromatic (all 12 notes)
            chromatic: [1, 1.059463, 1.122462, 1.189207, 1.259921, 1.334840, 1.414214, 1.498307, 1.587401, 1.681793, 1.781797, 1.887749]
        };

        this.currentScale = 'dreamHouse';
        this.rootNote = 55; // Low A (La Monte Young's "eternal music")
        this.chaosLevel = 0.2;
        this.driftAmount = 0.0003; // Glacial drift rate

        // Reich-style phasing state
        this.phasingPairs = [];

        // Basinski-style decay tracking
        this.decayRate = 0.9997; // Very slow degradation
        this.loopMemory = new Map(); // Remember cell states

        // Timbral variety settings
        this.waveformTypes = ['sine', 'triangle', 'sawtooth', 'square', 'pulse'];
        this.currentWaveformBias = 0.5; // 0 = sine-heavy, 1 = complex-heavy
        this.globalFilterCutoff = 1.0; // 0-1, normalized
        this.globalFilterResonance = 0.2; // 0-1
        this.globalFMDepth = 0; // 0-1
        this.globalDistortion = 0; // 0-1

        // Spectral analyzer for self-listening
        this.analyser = null;
        this.spectralData = null;

        // ============== PHRASE GENERATOR STATE ==============
        this.phraseActive = true;
        this.currentPhrase = null;
        this.phrasePosition = 0;
        this.phraseTempo = 90 + Math.random() * 60; // 90-150 BPM
        this.phraseTimer = null;
        this.phraseLengthBars = 4;
        this.beatsPerBar = 4;

        // Musical influence levels (0-1)
        this.harmonyLevel = 0.5;      // 0 = sparse, 1 = rich chords
        this.minimalismLevel = 0.5;   // 0 = varied, 1 = repetitive/phasing

        // Drone mode - whether cell voices produce continuous sound
        this.droneEnabled = Math.random() < 0.5; // 50% chance on init

        // Song mode - 25% chance of more tonal, melodious, song-ready patches
        this.songMode = Math.random() < 0.25;

        // Tintinnabuli mode
        this.tintinnabuliEnabled = false;
        this.tintinnabuliMode = 'above'; // 'above', 'below', 'alternating'

        // Voice pools for phrase playback
        this.melodyVoicePool = [];
        this.tVoicePool = [];
        this.chordVoicePool = [];
        this.voiceIndex = 0;
    }

    async init() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 44100,
            latencyHint: 'playback' // Longer buffer for stability
        });

        // Spectral analysis for feedback/listening
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.8;
        this.spectralData = new Uint8Array(this.analyser.frequencyBinCount);

        // Master output chain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.6;

        // Envelope VCA - sits after master for keyboard envelope shaping
        // This allows the envelope to shape ALL audio output
        this.envelopeVCA = this.ctx.createGain();
        this.envelopeVCA.gain.value = 1.0; // Unity gain when envelope disabled

        // Limiter to prevent clipping
        this.limiter = this.ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -6;
        this.limiter.knee.value = 6;
        this.limiter.ratio.value = 12;
        this.limiter.attack.value = 0.003;
        this.limiter.release.value = 0.25;

        // Long reverb for drone work (Radigue, Eliane)
        this.reverb = await this.createReverb();

        // Subtle saturation for warmth
        this.saturation = this.createSaturation();

        // Signal path: masterGain -> envelopeVCA -> saturation -> analyser -> limiter -> destination
        this.masterGain.connect(this.envelopeVCA);
        this.envelopeVCA.connect(this.saturation);
        this.saturation.connect(this.analyser);
        this.analyser.connect(this.limiter);
        this.limiter.connect(this.ctx.destination);

        // Reverb send (from before envelope VCA, so reverb tail sustains after note)
        const reverbSend = this.ctx.createGain();
        reverbSend.gain.value = 0.25;
        this.masterGain.connect(reverbSend);
        reverbSend.connect(this.reverb);
        this.reverb.connect(this.limiter);

        // Load AudioWorklets
        try {
            await this.ctx.audioWorklet.addModule('worklets/processors.js');
            this.workletReady = true;

            // Create pitch quantizer worklet node
            this.pitchQuantizer = new AudioWorkletNode(this.ctx, 'pitch-quantizer');
            this.pitchQuantizer.parameters.get('root').value = this.rootNote;
            this.pitchQuantizer.parameters.get('glide').value = 0.005;

            // Send initial scale ratios to the quantizer
            this.updateQuantizerScale();
        } catch (e) {
            console.log('Worklets not available, using fallback');
            this.workletReady = false;
            this.pitchQuantizer = null;
        }

        // Store reverb send for later access
        this.reverbSend = reverbSend;

        // Initialize with random patch
        this.randomize();
        this.isRunning = true;

        // Initialize voice pools for phrase generation
        this.initializeVoicePools();

        // Start Krell autonomous behavior (adapted for phrase variation)
        this.startKrell();

        // Start glacial drift
        this.startDrift();

        // Start spectral listening
        this.startListening();

        // Start phrase generation
        this.startPhrasePlayback();

        return this;
    }

    // Long reverb tail (5+ seconds, Radigue-style)
    async createReverb() {
        const convolver = this.ctx.createConvolver();
        const length = this.ctx.sampleRate * 5; // 5 second tail
        const buffer = this.ctx.createBuffer(2, length, this.ctx.sampleRate);

        for (let c = 0; c < 2; c++) {
            const data = buffer.getChannelData(c);
            for (let i = 0; i < length; i++) {
                // Early reflections + exponential decay
                const earlyReflection = i < this.ctx.sampleRate * 0.1 ?
                    (Math.random() * 2 - 1) * 0.3 * Math.exp(-i / (this.ctx.sampleRate * 0.03)) : 0;
                const lateDecay = Math.exp(-i / (length * 0.4));
                const diffusion = (Math.random() * 2 - 1);
                // Add subtle modulation for shimmer
                const shimmer = Math.sin(i / this.ctx.sampleRate * 0.5 * Math.PI * 2) * 0.1;
                data[i] = (earlyReflection + diffusion * lateDecay * 0.4) * (1 + shimmer);
            }
        }

        convolver.buffer = buffer;
        return convolver;
    }

    // Subtle tape-style saturation
    createSaturation() {
        const shaper = this.ctx.createWaveShaper();
        const curve = new Float32Array(65536);
        for (let i = 0; i < 65536; i++) {
            const x = (i - 32768) / 32768;
            // Soft saturation curve (tape-like)
            curve[i] = Math.tanh(x * 1.2) * 0.95;
        }
        shaper.curve = curve;
        shaper.oversample = '2x';
        return shaper;
    }

    // ============== TIMBRAL VARIETY TOOLS ==============

    // Create a per-voice waveshaper for distortion
    createVoiceDistortion(amount = 0.3) {
        const shaper = this.ctx.createWaveShaper();
        const curve = new Float32Array(65536);
        const drive = 1 + amount * 10; // 1-11x drive

        for (let i = 0; i < 65536; i++) {
            const x = (i - 32768) / 32768;
            // Soft clipping with variable drive
            curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
        }
        shaper.curve = curve;
        shaper.oversample = '2x';
        return shaper;
    }

    // Create a per-voice filter with modulation capability
    createVoiceFilter(type = 'lowpass', cutoff = 2000, resonance = 1) {
        const filter = this.ctx.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = cutoff;
        filter.Q.value = resonance;
        return filter;
    }

    // Create pulse wave with PWM (dual sawtooth technique)
    createPulseOscillator(freq) {
        // Pulse wave = saw1 - saw2 with phase offset
        const saw1 = this.ctx.createOscillator();
        saw1.type = 'sawtooth';
        saw1.frequency.value = freq;

        const saw2 = this.ctx.createOscillator();
        saw2.type = 'sawtooth';
        saw2.frequency.value = freq;

        // Inverter for saw2
        const inverter = this.ctx.createGain();
        inverter.gain.value = -1;

        // Delay for pulse width (phase shift)
        // Using a constant source + gain to offset the second saw
        const widthControl = this.ctx.createConstantSource();
        widthControl.offset.value = 0;

        // Mix node
        const mixer = this.ctx.createGain();
        mixer.gain.value = 0.5;

        saw1.connect(mixer);
        saw2.connect(inverter);
        inverter.connect(mixer);

        // PWM via detuning saw2 - creates phase drift = pulse width modulation
        // For static width, we use delay. For PWM, we modulate this
        const pwmLfo = this.ctx.createOscillator();
        pwmLfo.type = 'sine';
        pwmLfo.frequency.value = 0.5; // Slow PWM

        const pwmDepth = this.ctx.createGain();
        pwmDepth.gain.value = 10; // Cents of detune for PWM effect

        pwmLfo.connect(pwmDepth);
        pwmDepth.connect(saw2.detune);

        saw1.start();
        saw2.start();
        pwmLfo.start();
        widthControl.start();

        return {
            node: mixer,
            osc: saw1,
            osc2: saw2,
            pwmLfo,
            pwmDepth,
            params: {
                freq: saw1.frequency,
                pwmRate: pwmLfo.frequency,
                pwmDepth: pwmDepth.gain
            },
            setFrequency: (f) => {
                saw1.frequency.value = f;
                saw2.frequency.value = f;
            }
        };
    }

    // Create FM pair (carrier + modulator)
    createFMOscillator(carrierFreq, modRatio = 2, modDepth = 100) {
        const carrier = this.ctx.createOscillator();
        carrier.type = 'sine';
        carrier.frequency.value = carrierFreq;

        const modulator = this.ctx.createOscillator();
        modulator.type = 'sine';
        modulator.frequency.value = carrierFreq * modRatio;

        const modGain = this.ctx.createGain();
        modGain.gain.value = modDepth; // Hz of frequency deviation

        modulator.connect(modGain);
        modGain.connect(carrier.frequency);

        carrier.start();
        modulator.start();

        return {
            node: carrier,
            osc: carrier,
            modulator,
            modGain,
            params: {
                freq: carrier.frequency,
                modRatio: { value: modRatio }, // Pseudo-param
                modDepth: modGain.gain
            },
            setFrequency: (f) => {
                carrier.frequency.value = f;
                modulator.frequency.value = f * modRatio;
            }
        };
    }

    // Create a complete voice with optional filter, distortion, and FM
    createRichVoice(freq, options = {}) {
        const {
            waveform = 'sine',
            filterCutoff = 4000,
            filterQ = 1,
            filterType = 'lowpass',
            distortion = 0,
            fmDepth = 0,
            fmRatio = 2,
            pwmRate = 0.5,
            pwmDepth = 10
        } = options;

        let oscNode, oscRef, modulator, osc2;

        // Choose oscillator type
        if (waveform === 'pulse') {
            const pulse = this.createPulseOscillator(freq, 0.5);
            oscNode = pulse.node;
            oscRef = pulse.osc;
            osc2 = pulse.osc2;
            pulse.pwmLfo.frequency.value = pwmRate;
            pulse.pwmDepth.gain.value = pwmDepth;
        } else if (fmDepth > 0) {
            const fm = this.createFMOscillator(freq, fmRatio, fmDepth);
            oscNode = fm.node;
            oscRef = fm.osc;
            modulator = fm.modulator;
        } else {
            const osc = this.ctx.createOscillator();
            osc.type = waveform;
            osc.frequency.value = freq;
            osc.start();
            oscNode = osc;
            oscRef = osc;
        }

        // Create signal chain: osc -> filter -> distortion -> gain
        const filter = this.createVoiceFilter(filterType, filterCutoff, filterQ);
        const distortionNode = distortion > 0 ? this.createVoiceDistortion(distortion) : null;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.1;

        // Wire up
        if (distortionNode) {
            oscNode.connect(filter);
            filter.connect(distortionNode);
            distortionNode.connect(gain);
        } else {
            oscNode.connect(filter);
            filter.connect(gain);
        }

        return {
            node: gain,
            osc: oscRef,
            osc2,
            modulator,
            filter,
            distortion: distortionNode,
            category: 'osc',
            waveform,
            params: {
                freq: oscRef.frequency,
                gain: gain.gain,
                filterFreq: filter.frequency,
                filterQ: filter.Q,
                fmDepth: modulator ? { value: fmDepth } : null,
                distAmount: { value: distortion }
            }
        };
    }

    // Get a random waveform based on bias
    getRandomWaveform() {
        const r = Math.random();
        const bias = this.currentWaveformBias;

        if (r < 0.15 + (1 - bias) * 0.35) return 'sine';
        if (r < 0.30 + (1 - bias) * 0.20) return 'triangle';
        if (r < 0.55 + bias * 0.15) return 'sawtooth';
        if (r < 0.80 + bias * 0.10) return 'square';
        return 'pulse';
    }

    // Update distortion curve for a voice
    updateVoiceDistortion(shaper, amount) {
        const curve = new Float32Array(65536);
        const drive = 1 + amount * 10;

        for (let i = 0; i < 65536; i++) {
            const x = (i - 32768) / 32768;
            curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
        }
        shaper.curve = curve;
    }

    // Krell patch - autonomous self-playing (Todd Barton, Subotnick)
    startKrell() {
        if (!this.krellActive) return;

        const krellEvent = () => {
            if (!this.isRunning || !this.krellActive) return;

            // Probabilistic event triggering
            if (Math.random() < this.krellDensity) {
                this.krellAction();
            }

            // Variable timing (organic, not metronomic)
            const nextTime = this.krellEventRate * (0.3 + Math.random() * 1.4);
            this.krellTimer = setTimeout(krellEvent, nextTime);
        };

        // Initial delay before first event
        this.krellTimer = setTimeout(krellEvent, 2000);
    }

    krellAction() {
        const actions = [
            () => this.krellModulate(),        // Modulate existing cells
            () => this.krellToggle(),          // Toggle a cell
            () => this.krellDrift(),           // Drift frequencies
            () => this.krellPhase(),           // Adjust phase relationships
            () => this.krellDecay(),           // Apply decay to a cell
            () => this.krellHarmonicShift(),   // Shift to related harmonic
            () => this.krellPhraseVariation(), // Add variation to current phrase
            () => this.krellTempoNudge(),      // Subtle tempo changes
        ];

        // Weight toward modulation, drift, and phrase variation
        const weights = [0.2, 0.1, 0.2, 0.08, 0.08, 0.08, 0.15, 0.11];
        let r = Math.random();
        let cumulative = 0;
        for (let i = 0; i < actions.length; i++) {
            cumulative += weights[i];
            if (r < cumulative) {
                actions[i]();
                break;
            }
        }
    }

    // Add subtle variation to current phrase
    krellPhraseVariation() {
        if (!this.currentPhrase) return;

        // Occasionally transpose a note
        if (this.currentPhrase.notes.length > 0 && Math.random() < 0.3) {
            const idx = Math.floor(Math.random() * this.currentPhrase.notes.length);
            const note = this.currentPhrase.notes[idx];
            note.degree += Math.random() < 0.5 ? 1 : -1;
            note.degree = Math.max(0, note.degree);
        }

        // Occasionally adjust velocity
        if (this.currentPhrase.notes.length > 0 && Math.random() < 0.25) {
            const idx = Math.floor(Math.random() * this.currentPhrase.notes.length);
            const note = this.currentPhrase.notes[idx];
            note.velocity = Math.max(0.2, Math.min(0.8, note.velocity + (Math.random() - 0.5) * 0.1));
        }

        // Subtle harmony/minimalism level drift
        if (Math.random() < 0.15) {
            this.harmonyLevel = Math.max(0.1, Math.min(0.9, this.harmonyLevel + (Math.random() - 0.5) * 0.05));
        }
        if (Math.random() < 0.15) {
            this.minimalismLevel = Math.max(0.1, Math.min(0.9, this.minimalismLevel + (Math.random() - 0.5) * 0.05));
        }
    }

    // Subtle tempo drift
    krellTempoNudge() {
        // Very subtle tempo variation for organic feel
        this.phraseTempo += (Math.random() - 0.5) * 2;
        this.phraseTempo = Math.max(50, Math.min(160, this.phraseTempo));
    }

    krellModulate() {
        const activeCells = this.cells
            .map((c, i) => ({ cell: c, index: i }))
            .filter(c => c.cell !== null);

        if (activeCells.length === 0) return;

        const target = activeCells[Math.floor(Math.random() * activeCells.length)];
        if (!target.cell.params) return;

        const paramNames = Object.keys(target.cell.params);
        if (paramNames.length === 0) return;

        const paramName = paramNames[Math.floor(Math.random() * paramNames.length)];
        const param = target.cell.params[paramName];

        if (param && param.setTargetAtTime) {
            const current = param.value;
            // Very gentle modulation (Radigue-style subtlety)
            const variation = current * (0.95 + Math.random() * 0.1);
            const timeConstant = 2 + Math.random() * 8; // Slow transitions
            param.setTargetAtTime(Math.max(0.001, variation), this.ctx.currentTime, timeConstant);
        }
    }

    krellToggle() {
        // Low probability of actually toggling
        if (Math.random() > 0.3) return;

        const index = Math.floor(Math.random() * 62); // Avoid special cells
        if (index === 7 || index === 63) return;

        // Prefer activating over deactivating (build up texture)
        if (!this.cells[index] && Math.random() < 0.6) {
            this.activateCell(index);
        } else if (this.cells[index] && Math.random() < 0.2) {
            this.deactivateCell(index);
        }
    }

    krellDrift() {
        // Apply glacial frequency drift to oscillators
        this.cells.forEach((cell, i) => {
            if (!cell || cell.category !== 'osc' || !cell.params || !cell.params.freq) return;

            const current = cell.params.freq.value;
            // Microtonal drift (< 1 cent)
            const drift = current * (1 + (Math.random() - 0.5) * 0.001);
            cell.params.freq.setTargetAtTime(drift, this.ctx.currentTime, 4);
        });
    }

    krellPhase() {
        // Create Reich-style phase relationships between similar oscillators
        const oscs = this.cells
            .map((c, i) => ({ cell: c, index: i }))
            .filter(c => c.cell && c.cell.category === 'osc' && c.cell.params && c.cell.params.freq);

        if (oscs.length < 2) return;

        // Pick two oscillators
        const a = oscs[Math.floor(Math.random() * oscs.length)];
        let b = oscs[Math.floor(Math.random() * oscs.length)];
        while (b.index === a.index && oscs.length > 1) {
            b = oscs[Math.floor(Math.random() * oscs.length)];
        }

        // Set them to related frequencies with slight offset for phasing
        const baseFreq = a.cell.params.freq.value;
        const ratio = this.getJustRatio();

        // Very slight detuning for beating/phasing (Reich technique)
        const detune = 1 + (Math.random() - 0.5) * 0.002;
        b.cell.params.freq.setTargetAtTime(baseFreq * ratio * detune, this.ctx.currentTime, 3);
    }

    krellDecay() {
        // Basinski-style slow decay on a random cell
        const activeCells = this.cells
            .map((c, i) => ({ cell: c, index: i }))
            .filter(c => c.cell !== null && c.cell.params && c.cell.params.gain);

        if (activeCells.length === 0) return;

        const target = activeCells[Math.floor(Math.random() * activeCells.length)];
        const currentGain = target.cell.params.gain.value;
        const decayed = currentGain * this.decayRate;

        // If gain drops too low, either boost it back or remove
        if (decayed < 0.01) {
            if (Math.random() < 0.7) {
                // Tape loop: restore with slight variation
                target.cell.params.gain.setTargetAtTime(0.1 + Math.random() * 0.15, this.ctx.currentTime, 2);
            } else {
                // Let it fade completely
                this.deactivateCell(target.index);
            }
        } else {
            target.cell.params.gain.setTargetAtTime(decayed, this.ctx.currentTime, 5);
        }
    }

    krellHarmonicShift() {
        // Move an oscillator to a harmonically related frequency
        const oscs = this.cells
            .filter(c => c && c.category === 'osc' && c.params && c.params.freq);

        if (oscs.length === 0) return;

        const target = oscs[Math.floor(Math.random() * oscs.length)];
        const current = target.params.freq.value;

        // Choose harmonic movement
        const movements = [
            current * 2,      // Up octave
            current / 2,      // Down octave
            current * 3/2,    // Up fifth
            current * 2/3,    // Down fifth
            current * 5/4,    // Up major third
            current * 4/5,    // Down major third
            current * 4/3,    // Up fourth
            current * 3/4,    // Down fourth
        ];

        let newFreq = movements[Math.floor(Math.random() * movements.length)];

        // Keep in reasonable range
        while (newFreq > 2000) newFreq /= 2;
        while (newFreq < 30) newFreq *= 2;

        target.params.freq.setTargetAtTime(newFreq, this.ctx.currentTime, 4);
    }

    // Glacial drift (Eliane Radigue, Kali Malone)
    startDrift() {
        const drift = () => {
            if (!this.isRunning) return;

            this.cells.forEach((cell, i) => {
                if (!cell || !cell.params) return;

                // Drift frequencies imperceptibly
                if (cell.params.freq) {
                    const current = cell.params.freq.value;
                    const drifted = current * (1 + (Math.random() - 0.5) * this.driftAmount);
                    cell.params.freq.setTargetAtTime(drifted, this.ctx.currentTime, 10);
                }

                // Drift gains very slowly
                if (cell.params.gain) {
                    const current = cell.params.gain.value;
                    const drifted = current * (1 + (Math.random() - 0.5) * this.driftAmount * 0.5);
                    cell.params.gain.setTargetAtTime(Math.max(0.01, drifted), this.ctx.currentTime, 15);
                }
            });

            setTimeout(drift, 5000); // Every 5 seconds
        };

        setTimeout(drift, 5000);
    }

    // Self-listening for emergent behavior
    startListening() {
        const listen = () => {
            if (!this.isRunning || !this.analyser) return;

            this.analyser.getByteFrequencyData(this.spectralData);

            // Calculate spectral centroid (brightness)
            let sum = 0;
            let weightedSum = 0;
            for (let i = 0; i < this.spectralData.length; i++) {
                sum += this.spectralData[i];
                weightedSum += this.spectralData[i] * i;
            }
            const centroid = sum > 0 ? weightedSum / sum : 0;

            // Calculate overall energy
            const energy = sum / (this.spectralData.length * 255);

            // Respond to spectral state
            this.respondToSpectrum(centroid, energy);

            setTimeout(listen, 2000);
        };

        setTimeout(listen, 3000);
    }

    respondToSpectrum(centroid, energy) {
        // If too bright, darken (add low-pass, reduce high oscillators)
        // If too quiet, add energy
        // If too dense, thin out

        if (energy > 0.4) {
            // Too loud - reduce gains
            this.cells.forEach(cell => {
                if (cell && cell.params && cell.params.gain) {
                    const current = cell.params.gain.value;
                    cell.params.gain.setTargetAtTime(current * 0.85, this.ctx.currentTime, 3);
                }
            });
        } else if (energy < 0.05 && this.cells.filter(c => c !== null).length < 3) {
            // Too quiet - activate something
            const emptyIndex = Math.floor(Math.random() * 62);
            if (!this.cells[emptyIndex]) {
                this.activateCell(emptyIndex);
            }
        }

        // Adjust Krell density based on energy
        this.krellDensity = 0.2 + (1 - energy) * 0.3;
    }

    // Get Just Intonation ratio
    getJustRatio() {
        const scale = this.scales[this.currentScale];
        return scale[Math.floor(Math.random() * scale.length)];
    }

    // Get a frequency using Just Intonation
    getMusicalFrequency() {
        const ratio = this.getJustRatio();
        const octave = Math.floor(Math.random() * 3); // 0-2 octaves up
        return this.rootNote * ratio * Math.pow(2, octave);
    }

    // Create a module based on cryptic type index
    createModule(typeIndex) {
        const categories = ['osc', 'mod', 'fx', 'seq', 'logic', 'util'];
        // Favor oscillators and modulators for this generative context
        const weights = [0.35, 0.25, 0.2, 0.08, 0.06, 0.06];

        let category;
        const rand = Math.random();
        let cumulative = 0;
        for (let i = 0; i < categories.length; i++) {
            cumulative += weights[i];
            if (rand < cumulative) {
                category = categories[i];
                break;
            }
        }

        const moduleNames = getModulesByCategory(category);
        const moduleName = moduleNames[Math.floor(Math.random() * moduleNames.length)];
        const moduleType = MODULE_TYPES[moduleName];

        try {
            const module = moduleType.create(this.ctx);
            module.category = category;
            module.typeName = moduleName;

            // Set initial frequency to Just Intonation if oscillator
            if (module.category === 'osc' && module.params && module.params.freq) {
                module.params.freq.value = this.getMusicalFrequency();
            }

            return module;
        } catch (e) {
            return this.createFallbackModule();
        }
    }

    createFallbackModule() {
        const freq = this.getMusicalFrequency();
        const waveform = this.getRandomWaveform();

        // Determine timbral features based on global settings and randomness
        const useFilter = Math.random() < 0.7; // 70% chance of filter
        const useFM = waveform === 'sine' && Math.random() < this.globalFMDepth + 0.1;
        const useDistortion = Math.random() < this.globalDistortion + 0.05;

        const options = {
            waveform: useFM ? 'sine' : waveform, // FM only on sine carriers
            filterCutoff: 200 + Math.random() * 4000 * this.globalFilterCutoff,
            filterQ: 0.5 + Math.random() * 8 * this.globalFilterResonance,
            filterType: useFilter ? 'lowpass' : 'allpass',
            distortion: useDistortion ? 0.1 + Math.random() * 0.4 : 0,
            fmDepth: useFM ? 50 + Math.random() * 200 : 0,
            fmRatio: [1, 2, 3, 4, 5, 7][Math.floor(Math.random() * 6)],
            pwmRate: 0.1 + Math.random() * 2,
            pwmDepth: 5 + Math.random() * 20
        };

        const voice = this.createRichVoice(freq, options);
        voice.typeName = `voice_${waveform}`;

        // Connect to master
        voice.node.connect(this.masterGain);

        return voice;
    }

    // Activate/deactivate a cell
    toggleCell(index) {
        if (this.cells[index]) {
            this.deactivateCell(index);
            return false;
        } else {
            this.activateCell(index);
            return true;
        }
    }

    activateCell(index) {
        if (this.cells[index]) return;

        const module = this.createModule(index);
        this.cells[index] = module;

        // If drones are disabled, mute the cell voice immediately
        if (!this.droneEnabled && module.params && module.params.gain) {
            module.params.gain.setValueAtTime(0, this.ctx.currentTime);
        }

        // Remember for Basinski-style memory
        this.loopMemory.set(index, {
            activated: this.ctx.currentTime,
            initialGain: this.droneEnabled ? (module.params?.gain?.value || 0.1) : 0
        });

        this.rewireConnections();
    }

    deactivateCell(index) {
        const module = this.cells[index];
        if (!module) return;

        // Fade out gracefully (no clicks)
        if (module.params && module.params.gain) {
            module.params.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
        }
        // Also fade partial gains for drone voices
        if (module.partialGains) {
            module.partialGains.forEach(g => {
                try { g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3); } catch (e) {}
            });
        }

        // Schedule actual disconnection
        setTimeout(() => {
            try {
                if (module.node) module.node.disconnect();
                if (module.osc) module.osc.stop();
                if (module.osc2) module.osc2.stop();
                if (module.oscs) module.oscs.forEach(o => o.osc ? o.osc.stop() : o.stop());
                if (module.source) module.source.stop();
                if (module.lfo) module.lfo.stop();
                if (module.modulator) module.modulator.stop();
                if (module.pwmLfo) module.pwmLfo.stop();
                // Handle partials for drone voices
                if (module.partials) module.partials.forEach(p => { try { p.stop(); } catch (e) {} });
                if (module.partialGains) module.partialGains.forEach(g => { try { g.disconnect(); } catch (e) {} });
                // Handle filters and distortion
                if (module.filter) { try { module.filter.disconnect(); } catch (e) {} }
                if (module.distortion) { try { module.distortion.disconnect(); } catch (e) {} }
            } catch (e) {}
        }, 500);

        this.cells[index] = null;
        this.loopMemory.delete(index);
        this.rewireConnections();
    }

    // Hidden connection logic - the arcane heart of the system
    rewireConnections() {
        this.connections.clear();

        const activeCells = this.cells
            .map((cell, i) => ({ cell, index: i }))
            .filter(c => c.cell !== null);

        if (activeCells.length === 0) return;

        // Separate by type
        const sources = activeCells.filter(c =>
            c.cell.category === 'osc' || c.cell.category === 'seq'
        );
        const processors = activeCells.filter(c =>
            c.cell.category === 'fx' || c.cell.category === 'util'
        );
        const modulators = activeCells.filter(c =>
            c.cell.category === 'mod' || c.cell.isModulator
        );
        const logic = activeCells.filter(c => c.cell.category === 'logic');

        // If no sources, make some things sources
        if (sources.length === 0) {
            sources.push(...activeCells.slice(0, Math.max(1, Math.floor(activeCells.length / 2))));
        }

        // Build connection chains
        sources.forEach(source => {
            let currentNode = source.cell.node;

            // Route through random processors
            const chainLength = Math.floor(Math.random() * Math.min(processors.length, 2));
            const shuffledProcessors = [...processors].sort(() => Math.random() - 0.5);

            for (let i = 0; i < chainLength; i++) {
                const processor = shuffledProcessors[i];
                if (processor && processor.cell.node) {
                    try {
                        currentNode.connect(processor.cell.node);
                        currentNode = processor.cell.output || processor.cell.node;
                        this.connections.set(`${source.index}->${processor.index}`, true);
                    } catch (e) {}
                }
            }

            // Connect to master
            try {
                currentNode.connect(this.masterGain);
            } catch (e) {}
        });

        // Wire up modulators
        modulators.forEach(mod => {
            const targets = [...sources, ...processors].filter(t => t.cell);
            if (targets.length === 0) return;

            const target = targets[Math.floor(Math.random() * targets.length)];

            if (target.cell.modInput && Math.random() < 0.4) {
                try {
                    mod.cell.node.connect(target.cell.modInput);
                    this.connections.set(`${mod.index}~>FM~>${target.index}`, true);
                } catch (e) {}
                return;
            }

            if (!target.cell.params) return;

            const safeParams = Object.keys(target.cell.params).filter(name => {
                const lower = name.toLowerCase();
                return (lower === 'moddepth' || lower === 'gain' || lower === 'depth' ||
                        lower === 'time' || lower === 'pan' || lower === 'rate' || lower === 'feedback');
            });
            if (safeParams.length === 0) return;

            const paramName = safeParams[Math.floor(Math.random() * safeParams.length)];
            const param = target.cell.params[paramName];

            if (param && param.setValueAtTime) {
                try {
                    const attenuator = this.ctx.createGain();
                    attenuator.gain.value = 0.05; // Very subtle modulation
                    mod.cell.node.connect(attenuator);
                    attenuator.connect(param);
                    this.connections.set(`${mod.index}~>${target.index}.${paramName}`, true);
                } catch (e) {}
            }
        });

        // Logic modules
        logic.forEach(log => {
            try {
                log.cell.node.connect(this.masterGain);
            } catch (e) {}
        });
    }

    // Nudge toward melodic/arpeggiating character (upper left cell)
    // Barbieri, Glass, Reich, Pärt - yearning arpeggios fighting against circuitry
    nudgeMelodic() {
        const nudgeAmount = 0.25; // 25% influence per tap

        // More likely to shift toward melodic/harmonic scales
        if (Math.random() < nudgeAmount * 1.5) {
            const melodicScales = ['harmonic', 'dreamHouse', 'pentatonic', 'fifths'];
            this.setScale(melodicScales[Math.floor(Math.random() * melodicScales.length)]);
        }

        // Nudge oscillators toward arpeggio-like behavior
        this.cells.forEach((cell) => {
            if (!cell || !cell.params) return;

            // For oscillators: create stepping/arpeggiating quality
            if (cell.category === 'osc' && cell.params.freq) {
                // Higher chance to snap to harmonically related frequency (tintinnabuli-like)
                if (Math.random() < nudgeAmount * 1.2) {
                    // Pärt's tintinnabuli: melody note + triad tone
                    const triadRatios = [1, 5/4, 3/2, 2]; // Major triad + octave
                    const ratio = triadRatios[Math.floor(Math.random() * triadRatios.length)];
                    const newFreq = this.rootNote * ratio * Math.pow(2, Math.floor(Math.random() * 3));
                    cell.params.freq.setTargetAtTime(newFreq, this.ctx.currentTime, 1.5);
                }

                // Slight gain variation to create more articulation
                if (cell.params.gain && Math.random() < nudgeAmount) {
                    const current = cell.params.gain.value;
                    const variation = current * (0.85 + Math.random() * 0.3);
                    cell.params.gain.setTargetAtTime(variation, this.ctx.currentTime, 0.3);
                }
            }

            // For modulators: nudge toward more rhythmic/stepped modulation
            if (cell.category === 'mod') {
                // Push modulation rate toward arpeggio speeds (2-8 Hz)
                if (cell.params.freq && Math.random() < nudgeAmount * 1.5) {
                    const currentRate = cell.params.freq.value;
                    // Nudge toward musical divisions (quarter notes, eighths at ~120bpm = 2-4 Hz)
                    const targetRate = 2 + Math.random() * 4;
                    const nudgedRate = currentRate + (targetRate - currentRate) * nudgeAmount * 1.5;
                    cell.params.freq.setTargetAtTime(nudgedRate, this.ctx.currentTime, 0.8);
                }

                // Reduce depth for more subtle melodic movement
                if (cell.params.depth && Math.random() < nudgeAmount) {
                    const current = cell.params.depth.value;
                    cell.params.depth.setTargetAtTime(current * 0.85, this.ctx.currentTime, 0.8);
                }
            }
        });

        // Reduce chaos/Krell intensity (let melody breathe)
        this.krellDensity = Math.max(0.08, this.krellDensity - nudgeAmount * 0.15);

        // Nudge Krell toward more harmonic movements (slower, more deliberate)
        this.krellEventRate = Math.min(15000, this.krellEventRate * (1 + nudgeAmount * 0.8));

        // Good chance to introduce phasing relationships (Reich)
        if (Math.random() < nudgeAmount * 1.5) {
            this.krellPhase();
        }

        // Drift reduction (more stable pitches for melody)
        this.driftAmount = Math.max(0.00005, this.driftAmount * (1 - nudgeAmount * 0.4));
    }

    // Nudge toward rhythmic pulse (lower left cell)
    // Push toward more defined pulse, fighting against the chaos
    nudgeRhythmic() {
        const nudgeAmount = 0.25; // 25% influence per tap

        this.cells.forEach((cell) => {
            if (!cell || !cell.params) return;

            // For modulators: nudge toward more defined rhythmic rates
            if (cell.category === 'mod' || cell.isModulator) {
                if (cell.params.freq) {
                    const currentRate = cell.params.freq.value;
                    // Nudge toward rhythmic subdivisions (1, 2, 4, 8 Hz - like tempo divisions)
                    const rhythmicRates = [0.5, 1, 2, 4, 8];
                    const nearestRhythmic = rhythmicRates.reduce((prev, curr) =>
                        Math.abs(curr - currentRate) < Math.abs(prev - currentRate) ? curr : prev
                    );
                    const nudgedRate = currentRate + (nearestRhythmic - currentRate) * nudgeAmount * 1.5;
                    cell.params.freq.setTargetAtTime(nudgedRate, this.ctx.currentTime, 0.5);
                }

                // Increase modulation depth for more pronounced rhythm
                if (cell.params.depth && Math.random() < nudgeAmount * 1.5) {
                    const current = cell.params.depth.value;
                    cell.params.depth.setTargetAtTime(current * 1.15, this.ctx.currentTime, 0.5);
                }
            }

            // For sequencers: nudge toward more regular timing
            if (cell.category === 'seq') {
                if (cell.params.rate) {
                    const currentRate = cell.params.rate.value;
                    // Nudge toward more regular clock divisions
                    const clockRates = [1, 2, 3, 4, 6, 8];
                    const nearestClock = clockRates.reduce((prev, curr) =>
                        Math.abs(curr - currentRate) < Math.abs(prev - currentRate) ? curr : prev
                    );
                    const nudgedRate = currentRate + (nearestClock - currentRate) * nudgeAmount * 1.5;
                    cell.params.rate.setTargetAtTime(nudgedRate, this.ctx.currentTime, 0.5);
                }
            }
        });

        // Increase Krell density (more events = more rhythm)
        this.krellDensity = Math.min(0.55, this.krellDensity + nudgeAmount * 0.2);

        // Faster Krell events for more rhythmic feel
        this.krellEventRate = Math.max(2500, this.krellEventRate * (1 - nudgeAmount * 0.4));

        // Higher chance to activate a clock or sequencer if none active
        const hasSequencer = this.cells.some(c => c && (c.category === 'seq' || c.isClock));
        if (!hasSequencer && Math.random() < nudgeAmount * 2.5) {
            // Find an empty cell and add a clock
            const emptyIndex = this.cells.findIndex((c, idx) => c === null && idx !== 0 && idx !== 7 && idx !== 56 && idx !== 63);
            if (emptyIndex !== -1) {
                // Create a simple rhythmic clock
                const osc = this.ctx.createOscillator();
                osc.type = 'square';
                osc.frequency.value = 1 + Math.random() * 3; // 1-4 Hz
                const gain = this.ctx.createGain();
                gain.gain.value = 20;
                osc.connect(gain);
                osc.start();
                this.cells[emptyIndex] = {
                    node: gain,
                    osc,
                    category: 'seq',
                    isClock: true,
                    isModulator: true,
                    params: { freq: osc.frequency, depth: gain.gain }
                };
                this.rewireConnections();
            }
        }
    }

    // Evolve toward consonance (upper right cell)
    evolve() {
        // Shift to more consonant scale
        const consonantScales = ['dreamHouse', 'drone', 'pentatonic', 'fifths'];
        this.setScale(consonantScales[Math.floor(Math.random() * consonantScales.length)]);

        // Increase Krell calmness
        this.krellEventRate = Math.min(15000, this.krellEventRate * 1.3);
        this.krellDensity = Math.max(0.1, this.krellDensity - 0.05);
        this.driftAmount = Math.max(0.0001, this.driftAmount * 0.8);

        // Move oscillators toward Just Intonation relationships
        this.cells.forEach((cell, i) => {
            if (cell && cell.category === 'osc' && cell.params && cell.params.freq) {
                const newFreq = this.getMusicalFrequency();
                cell.params.freq.setTargetAtTime(newFreq, this.ctx.currentTime, 4);
            }
        });

        // Reduce noise
        this.cells.forEach((cell, i) => {
            if (cell && cell.category === 'osc' && cell.params && cell.params.gain) {
                const isNoise = cell.typeName && cell.typeName.includes('noise');
                if (isNoise) {
                    const current = cell.params.gain.value;
                    cell.params.gain.setTargetAtTime(current * 0.5, this.ctx.currentTime, 2);
                }
            }
        });

        // Slow down modulators
        this.cells.forEach((cell, i) => {
            if (cell && cell.category === 'mod') {
                if (cell.params.depth) {
                    const current = cell.params.depth.value;
                    cell.params.depth.setTargetAtTime(current * 0.6, this.ctx.currentTime, 3);
                }
                if (cell.params.freq && cell.params.freq.value > 1) {
                    cell.params.freq.setTargetAtTime(cell.params.freq.value * 0.5, this.ctx.currentTime, 3);
                }
            }
        });
    }

    // Total randomization (lower right cell)
    // 70% pure chaos, 10% melodic-biased, 10% evolve-biased, 10% rhythmic-biased
    randomize() {
        const roll = Math.random();

        // Clear everything gracefully first
        this.cells.forEach((_, i) => {
            if (this.cells[i]) {
                this.deactivateCell(i);
            }
        });

        // Reset phrase generator state
        this.harmonyLevel = 0.3 + Math.random() * 0.4;
        this.minimalismLevel = 0.3 + Math.random() * 0.4;
        this.phraseTempo = 70 + Math.random() * 80;
        this.phrasePosition = 0;

        if (roll < 0.70) {
            // 70% - Pure chaos randomization
            this.randomizeChaos();
        } else if (roll < 0.80) {
            // 10% - Melodic-biased (upper left)
            this.randomizeMelodic();
        } else if (roll < 0.90) {
            // 10% - Evolve-biased (upper right)
            this.randomizeConsonant();
        } else {
            // 10% - Rhythmic-biased (lower left)
            this.randomizeRhythmic();
        }

        // Generate new phrase immediately
        this.generatePhrase();
    }

    // Pure chaos randomization (original behavior)
    randomizeChaos() {
        // Pick new scale
        const scaleNames = Object.keys(this.scales);
        this.currentScale = scaleNames[Math.floor(Math.random() * scaleNames.length)];

        // Random root in low register (27.5 to 110 Hz)
        this.rootNote = 27.5 * Math.pow(2, Math.random() * 2);

        // Update quantizer with new scale and root
        this.updateQuantizerScale();

        // Reset Krell parameters
        this.krellEventRate = 4000 + Math.random() * 8000;
        this.krellDensity = 0.2 + Math.random() * 0.3;
        this.driftAmount = 0.0001 + Math.random() * 0.0004;

        // Activate random cells (sparse to start - let Krell build up)
        const numCells = 3 + Math.floor(Math.random() * 5);
        this.activateRandomCells(numCells);
    }

    // Melodic-biased randomization (Barbieri, Glass, Reich, Pärt)
    // Creates patches that are deeply melodic/arpeggiating from birth
    randomizeMelodic() {
        // Melodic scales only - weighted toward most tintinnabuli-friendly
        const melodicScales = ['harmonic', 'harmonic', 'dreamHouse', 'pentatonic', 'fifths'];
        this.currentScale = melodicScales[Math.floor(Math.random() * melodicScales.length)];

        // Root in melodic register (65-165 Hz - C2 to E3 range, good for arpeggios)
        this.rootNote = 65 * Math.pow(2, Math.random() * 1.35);

        // Update quantizer with new scale and root
        this.updateQuantizerScale();

        // Very slow, deliberate Krell - let melodies breathe (Pärt-like stillness)
        this.krellEventRate = 10000 + Math.random() * 10000; // 10-20 seconds between events
        this.krellDensity = 0.08 + Math.random() * 0.12; // Very sparse
        this.driftAmount = 0.00002 + Math.random() * 0.00005; // Minimal drift - stable pitches

        // Activate cells with melodic bias
        const numCells = 3 + Math.floor(Math.random() * 3);
        this.activateMelodicCells(numCells);
    }

    // Helper to activate cells with melodic characteristics
    activateMelodicCells(numCells) {
        const cellIndices = Array.from({ length: 64 }, (_, i) => i)
            .filter(i => i !== 0 && i !== 7 && i !== 56 && i !== 63)
            .sort(() => Math.random() - 0.5)
            .slice(0, numCells);

        cellIndices.forEach((index, i) => {
            setTimeout(() => {
                if (!this.isRunning) return;

                // Create melodic oscillators with timbral variety
                const triadRatios = [1, 5/4, 4/3, 3/2, 5/3, 2, 5/2, 3]; // Extended major with 6th
                const ratio = triadRatios[Math.floor(Math.random() * triadRatios.length)];
                const octave = Math.pow(2, Math.floor(Math.random() * 3));
                const freq = this.rootNote * ratio * octave;

                // Choose waveform with melodic bias (mostly pure, occasionally rich)
                const waveforms = ['sine', 'sine', 'triangle', 'triangle', 'sawtooth', 'pulse'];
                const waveform = waveforms[Math.floor(Math.random() * waveforms.length)];

                // Create rich voice with filter for timbral shaping
                const useFM = waveform === 'sine' && Math.random() < 0.2; // 20% FM on sine
                const voice = this.createRichVoice(freq, {
                    waveform: useFM ? 'sine' : waveform,
                    filterCutoff: 800 + Math.random() * 3000, // Melodic = brighter
                    filterQ: 0.5 + Math.random() * 2,
                    filterType: 'lowpass',
                    distortion: Math.random() < 0.1 ? 0.1 : 0, // Rare subtle distortion
                    fmDepth: useFM ? 30 + Math.random() * 80 : 0,
                    fmRatio: [1, 2, 3][Math.floor(Math.random() * 3)],
                    pwmRate: 0.1 + Math.random() * 0.5,
                    pwmDepth: 5 + Math.random() * 10
                });

                voice.node.gain.value = 0.08 + Math.random() * 0.08;

                // Slow amplitude envelope for tintinnabuli breathing
                const lfo = this.ctx.createOscillator();
                lfo.type = 'sine';
                lfo.frequency.value = 0.05 + Math.random() * 0.15;
                const lfoGain = this.ctx.createGain();
                lfoGain.gain.value = voice.node.gain.value * 0.3;

                lfo.connect(lfoGain);
                lfoGain.connect(voice.node.gain);
                voice.node.connect(this.masterGain);

                lfo.start();

                voice.lfo = lfo;
                voice.typeName = 'melodicVoice';
                voice.params.lfoFreq = lfo.frequency;

                this.cells[index] = voice;

                // Reich-style: slight detuning between voices for phasing
                if (i > 0 && Math.random() < 0.6 && voice.osc.detune) {
                    const detune = (Math.random() - 0.5) * 1.5;
                    voice.osc.detune.value = detune;
                }
            }, i * 300);
        });
    }

    // Consonant/evolve-biased randomization (Radigue, Young, deep drones)
    // Creates patches that are deeply meditative/consonant from birth
    randomizeConsonant() {
        // Drone-friendly scales - pure intervals
        const consonantScales = ['dreamHouse', 'dreamHouse', 'drone', 'fifths'];
        this.currentScale = consonantScales[Math.floor(Math.random() * consonantScales.length)];

        // Very deep root for drones (27.5-45 Hz - A0 to F#1)
        this.rootNote = 27.5 * Math.pow(2, Math.random() * 0.7);

        // Update quantizer with new scale and root
        this.updateQuantizerScale();

        // Extremely slow Krell - glacial Radigue-style evolution
        this.krellEventRate = 20000 + Math.random() * 20000; // 20-40 seconds between events
        this.krellDensity = 0.05 + Math.random() * 0.08; // Extremely sparse
        this.driftAmount = 0.00008 + Math.random() * 0.00015; // Slow drift for beating

        // Activate cells with drone characteristics
        const numCells = 2 + Math.floor(Math.random() * 2);
        this.activateDroneCells(numCells);
    }

    // Helper to activate cells with drone characteristics
    activateDroneCells(numCells) {
        const cellIndices = Array.from({ length: 64 }, (_, i) => i)
            .filter(i => i !== 0 && i !== 7 && i !== 56 && i !== 63)
            .sort(() => Math.random() - 0.5)
            .slice(0, numCells);

        cellIndices.forEach((index, i) => {
            setTimeout(() => {
                if (!this.isRunning) return;

                // Pure interval ratios for drone work (La Monte Young style)
                const droneRatios = [1, 3/2, 2, 3, 4, 9/8, 4/3]; // Perfect intervals + 9:8
                const ratio = droneRatios[Math.floor(Math.random() * droneRatios.length)];
                const freq = this.rootNote * ratio;

                // Occasionally use rich waveforms for textural variety
                const useRichWaveform = Math.random() < 0.3;
                const waveform = useRichWaveform ?
                    ['triangle', 'sawtooth', 'pulse'][Math.floor(Math.random() * 3)] : 'sine';

                // Create main voice with optional filter for timbral shaping
                const useFilter = Math.random() < 0.5;
                const voice = this.createRichVoice(freq, {
                    waveform,
                    filterCutoff: 200 + Math.random() * 1000, // Dark drones
                    filterQ: 1 + Math.random() * 4,
                    filterType: useFilter ? 'lowpass' : 'allpass',
                    distortion: Math.random() < 0.15 ? 0.05 + Math.random() * 0.15 : 0,
                    fmDepth: waveform === 'sine' && Math.random() < 0.25 ? 20 + Math.random() * 60 : 0,
                    fmRatio: [1, 2, 3, 4][Math.floor(Math.random() * 4)],
                    pwmRate: 0.02 + Math.random() * 0.1, // Very slow PWM for drones
                    pwmDepth: 3 + Math.random() * 8
                });

                voice.node.gain.value = 0.12 + Math.random() * 0.06;

                // Create additional partials for harmonic richness
                const partial2 = this.ctx.createOscillator();
                partial2.type = 'sine';
                partial2.frequency.value = freq * 2;
                partial2.detune.value = (Math.random() - 0.5) * 4;

                const partial3 = this.ctx.createOscillator();
                partial3.type = 'sine';
                partial3.frequency.value = freq * 3;
                partial3.detune.value = (Math.random() - 0.5) * 6;

                const gain2 = this.ctx.createGain();
                gain2.gain.value = voice.node.gain.value * 0.4;

                const gain3 = this.ctx.createGain();
                gain3.gain.value = voice.node.gain.value * 0.2;

                // Glacial amplitude drift
                const driftLfo = this.ctx.createOscillator();
                driftLfo.type = 'sine';
                driftLfo.frequency.value = 0.01 + Math.random() * 0.03;
                const driftGain = this.ctx.createGain();
                driftGain.gain.value = voice.node.gain.value * 0.2;

                driftLfo.connect(driftGain);
                driftGain.connect(voice.node.gain);

                partial2.connect(gain2);
                partial3.connect(gain3);
                voice.node.connect(this.masterGain);
                gain2.connect(this.masterGain);
                gain3.connect(this.masterGain);

                partial2.start();
                partial3.start();
                driftLfo.start();

                voice.partials = [partial2, partial3];
                voice.partialGains = [gain2, gain3];
                voice.lfo = driftLfo;
                voice.typeName = 'droneVoice';

                this.cells[index] = voice;
            }, i * 500);
        });
    }

    // Rhythmic-biased randomization (Holden, motorik, polyrhythm)
    // Creates patches with strong pulse and groove from birth
    randomizeRhythmic() {
        // Scales that work well with rhythm - percussive friendly
        const rhythmicScales = ['pentatonic', 'pentatonic', 'harmonic', 'partch'];
        this.currentScale = rhythmicScales[Math.floor(Math.random() * rhythmicScales.length)];

        // Mid-range root for punchy bass (40-80 Hz)
        this.rootNote = 40 * Math.pow(2, Math.random());

        // Update quantizer with new scale and root
        this.updateQuantizerScale();

        // Fast, dense Krell - lots of rhythmic activity
        this.krellEventRate = 1500 + Math.random() * 2500; // 1.5-4 seconds between events
        this.krellDensity = 0.45 + Math.random() * 0.2; // Dense
        this.driftAmount = 0.0002 + Math.random() * 0.0003; // Some drift for groove variation

        // Activate cells with rhythmic characteristics
        const numCells = 4 + Math.floor(Math.random() * 3);
        this.activateRhythmicCells(numCells);
    }

    // Helper to activate cells with rhythmic characteristics
    activateRhythmicCells(numCells) {
        const cellIndices = Array.from({ length: 64 }, (_, i) => i)
            .filter(i => i !== 0 && i !== 7 && i !== 56 && i !== 63)
            .sort(() => Math.random() - 0.5)
            .slice(0, numCells);

        // Always create a master clock first
        const clockIndex = cellIndices[0];
        setTimeout(() => {
            if (!this.isRunning) return;

            // Master clock - quantized to musical rates
            const clockRates = [1, 1.5, 2, 3, 4]; // Hz - 60, 90, 120, 180, 240 BPM equivalent
            const clockRate = clockRates[Math.floor(Math.random() * clockRates.length)];

            const clock = this.ctx.createOscillator();
            clock.type = 'square';
            clock.frequency.value = clockRate;

            const clockGain = this.ctx.createGain();
            clockGain.gain.value = 30; // Strong modulation signal

            clock.connect(clockGain);
            clock.start();

            this.cells[clockIndex] = {
                node: clockGain,
                osc: clock,
                category: 'seq',
                isClock: true,
                isModulator: true,
                typeName: 'masterClock',
                params: { freq: clock.frequency, depth: clockGain.gain }
            };
        }, 100);

        // Create rhythmic oscillators with amplitude modulation synced to clock
        cellIndices.slice(1).forEach((index, i) => {
            setTimeout(() => {
                if (!this.isRunning) return;

                const isPercussive = Math.random() < 0.4;
                const freq = this.rootNote * Math.pow(2, Math.floor(Math.random() * 4));

                if (isPercussive) {
                    // Percussive click/blip voice - use rich waveforms with distortion
                    const waveforms = ['square', 'sawtooth', 'pulse', 'triangle'];
                    const waveform = waveforms[Math.floor(Math.random() * waveforms.length)];

                    const voice = this.createRichVoice(freq, {
                        waveform,
                        filterCutoff: freq * 2 + Math.random() * 2000,
                        filterQ: 3 + Math.random() * 10, // Resonant for percussive edge
                        filterType: 'bandpass',
                        distortion: Math.random() < 0.5 ? 0.2 + Math.random() * 0.4 : 0, // 50% distortion
                        fmDepth: Math.random() < 0.3 ? 50 + Math.random() * 150 : 0, // 30% FM
                        fmRatio: [1, 2, 3, 5, 7][Math.floor(Math.random() * 5)],
                        pwmRate: 2 + Math.random() * 6, // Fast PWM for percussive
                        pwmDepth: 10 + Math.random() * 30
                    });

                    voice.node.gain.value = 0.1;

                    // Rhythmic amplitude gate
                    const ampLfo = this.ctx.createOscillator();
                    ampLfo.type = 'square';
                    const rhythmMultipliers = [0.5, 1, 1.5, 2, 3, 4];
                    const baseRate = 2;
                    ampLfo.frequency.value = baseRate * rhythmMultipliers[Math.floor(Math.random() * rhythmMultipliers.length)];

                    const ampDepth = this.ctx.createGain();
                    ampDepth.gain.value = 0.15;

                    ampLfo.connect(ampDepth);
                    ampDepth.connect(voice.node.gain);
                    voice.node.connect(this.masterGain);

                    ampLfo.start();

                    voice.lfo = ampLfo;
                    voice.typeName = 'percussiveVoice';
                    voice.params.lfoFreq = ampLfo.frequency;

                    this.cells[index] = voice;
                } else {
                    // Pulsing bass/tone voice with rich harmonics
                    const waveforms = ['sawtooth', 'square', 'pulse'];
                    const waveform = waveforms[Math.floor(Math.random() * waveforms.length)];
                    const bassFreq = this.rootNote * (Math.random() < 0.5 ? 1 : 2);

                    const voice = this.createRichVoice(bassFreq, {
                        waveform,
                        filterCutoff: 400 + Math.random() * 800,
                        filterQ: 4 + Math.random() * 8,
                        filterType: 'lowpass',
                        distortion: Math.random() < 0.4 ? 0.1 + Math.random() * 0.3 : 0,
                        fmDepth: 0, // No FM on bass usually
                        pwmRate: 0.5 + Math.random() * 2,
                        pwmDepth: 8 + Math.random() * 15
                    });

                    voice.node.gain.value = 0.12 + Math.random() * 0.06;

                    // Rhythmic filter sweep LFO
                    const filterLfo = this.ctx.createOscillator();
                    filterLfo.type = 'sine';
                    const rhythmRates = [0.5, 1, 2, 4];
                    filterLfo.frequency.value = rhythmRates[Math.floor(Math.random() * rhythmRates.length)];

                    const filterDepth = this.ctx.createGain();
                    filterDepth.gain.value = 300 + Math.random() * 500;

                    filterLfo.connect(filterDepth);
                    filterDepth.connect(voice.filter.frequency);
                    voice.node.connect(this.masterGain);

                    filterLfo.start();

                    voice.lfo = filterLfo;
                    voice.typeName = 'pulsingVoice';
                    voice.params.lfoFreq = filterLfo.frequency;

                    this.cells[index] = voice;
                }
            }, i * 150 + 200);
        });
    }

    // Helper to activate random cells
    activateRandomCells(numCells) {
        const cellIndices = Array.from({ length: 64 }, (_, i) => i)
            .filter(i => i !== 0 && i !== 7 && i !== 56 && i !== 63) // Skip corner cells
            .sort(() => Math.random() - 0.5)
            .slice(0, numCells);

        // Schedule activation with slight delays for organic feel
        cellIndices.forEach((index, i) => {
            setTimeout(() => {
                if (this.isRunning) {
                    this.activateCell(index);
                }
            }, i * 200);
        });

        // Ensure at least one oscillator
        setTimeout(() => {
            const hasOsc = this.cells.some(c => c && c.category === 'osc');
            if (!hasOsc) {
                const emptyIndex = this.cells.findIndex((c, idx) =>
                    c === null && idx !== 0 && idx !== 7 && idx !== 56 && idx !== 63
                );
                if (emptyIndex !== -1) {
                    const osc = this.ctx.createOscillator();
                    osc.type = 'sine';
                    osc.frequency.value = this.getMusicalFrequency();
                    const gain = this.ctx.createGain();
                    gain.gain.value = 0.15;
                    osc.connect(gain);
                    osc.start();
                    this.cells[emptyIndex] = {
                        node: gain,
                        osc,
                        category: 'osc',
                        params: { freq: osc.frequency, gain: gain.gain }
                    };
                    this.rewireConnections();
                }
            }
        }, numCells * 200 + 100);
    }

    // Touch interaction
    touchCell(index, intensity = 1) {
        const cell = this.cells[index];
        if (!cell || !cell.params) return;

        const paramNames = Object.keys(cell.params);
        if (paramNames.length === 0) return;

        const paramName = paramNames[Math.floor(Math.random() * paramNames.length)];
        const param = cell.params[paramName];

        if (param && param.setTargetAtTime) {
            const currentValue = param.value;
            // Gentle variation
            const variation = (Math.random() - 0.5) * intensity * currentValue * 0.15;
            param.setTargetAtTime(
                Math.max(0.001, currentValue + variation),
                this.ctx.currentTime,
                0.5
            );
        }
    }

    getActiveConnections() {
        return Array.from(this.connections.keys());
    }

    isCellActive(index) {
        return this.cells[index] !== null;
    }

    getCellCategory(index) {
        return this.cells[index]?.category || null;
    }

    suspend() {
        if (this.ctx && this.ctx.state === 'running') {
            this.ctx.suspend();
        }
        if (this.krellTimer) {
            clearTimeout(this.krellTimer);
        }
        if (this.phraseTimer) {
            clearTimeout(this.phraseTimer);
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
            this.startKrell();
            this.startPhrasePlayback();
        }
    }

    // ============== RECORDING (WAV) ==============

    startRecording() {
        if (this.isRecording) return;
        this.isRecording = true;

        // Use ScriptProcessorNode to capture raw samples (deprecated but widely supported)
        // Buffer size of 4096 for balance between latency and performance
        this.recordingBufferSize = 4096;
        this.recordedSamples = [[], []]; // Stereo: left, right

        // Create a script processor to capture audio
        this.recordingProcessor = this.ctx.createScriptProcessor(this.recordingBufferSize, 2, 2);

        this.recordingProcessor.onaudioprocess = (e) => {
            if (!this.isRecording) return;

            const left = e.inputBuffer.getChannelData(0);
            const right = e.inputBuffer.getChannelData(1);

            // Copy samples (input buffers are reused)
            this.recordedSamples[0].push(new Float32Array(left));
            this.recordedSamples[1].push(new Float32Array(right));
        };

        // Connect: limiter -> processor -> destination (processor needs output to work)
        this.limiter.connect(this.recordingProcessor);
        this.recordingProcessor.connect(this.ctx.destination);
    }

    stopRecording() {
        if (!this.isRecording) return;
        this.isRecording = false;

        // Disconnect recording processor
        if (this.recordingProcessor) {
            this.limiter.disconnect(this.recordingProcessor);
            this.recordingProcessor.disconnect();
            this.recordingProcessor = null;
        }

        // Flatten samples
        const leftSamples = this.flattenSamples(this.recordedSamples[0]);
        const rightSamples = this.flattenSamples(this.recordedSamples[1]);

        // Encode as WAV
        const wavBlob = this.encodeWAV(leftSamples, rightSamples, this.ctx.sampleRate);

        // Generate filename
        const filename = this.generateRecordingFilename();

        // Download
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Clear buffer
        this.recordedSamples = null;
    }

    // Generate recording filename with name, key, scale, tempo, random number
    generateRecordingFilename() {
        const names = [
            'karl', 'pierre', 'iannis', 'morton', 'john', 'la', 'paul', 'terry', 'steve', 'philip',
            'alvin', 'luciano', 'edgar', 'wendy', 'suzanne', 'laurie', 'pauline', 'maryanne', 'eliane',
            'beatriz', 'hildegard', 'delia', 'daphne', 'bebe', 'annea', 'éliane', 'meredith',
            'charlemagne', 'tod', 'james', 'brian', 'robert', 'daniel', 'harold', 'gavin', 'christian',
            'david', 'jon', 'aphex', 'richard', 'autechre', 'sean', 'rob', 'plaid', 'tom', 'mark',
            'geoff', 'andy', 'chris', 'vladislav', 'ryuichi', 'isao', 'hiroshi', 'susumu', 'fennesz',
            'rashad', 'kode9', 'burial', 'william', 'francisco', 'giorgio', 'vangelis', 'jean',
            'michel', 'raymond', 'bernard', 'edgard', 'olivier', 'tristan', 'karlheinz', 'helmut',
            'peter', 'fred', 'max', 'johann', 'arnold', 'györgy', 'krzysztof', 'henryk', 'wojciech',
            'robin', 'bruce', 'alan', 'don', 'roger', 'dave', 'bob', 'ross', 'rupert', 'tony', 'hugh',
            'ray', 'les', 'ikutaro', 'howard', 'edwin', 'walter', 'frank', 'leo', 'moog', 'donald',
            'herb', 'eurorack', 'dieter', 'makenoise', 'eric', 'michael', 'caterina', 'holly',
            'julianna', 'sarah', 'kaitlyn', 'jessica', 'emily', 'hildur', 'rival', 'ben', 'tim',
            'taylor', 'jlin', 'arca', 'sophie', 'oneohtrix', 'huerco', 'felicia', 'fatima', 'mica',
            'jenny', 'jóhann', 'rafael', 'nico', 'stewart', 'simon', 'julia', 'cosey', 'genesis',
            'throbbing', 'steven'
        ];

        const rootNotes = ['c', 'csharp', 'd', 'dsharp', 'e', 'f', 'fsharp', 'g', 'gsharp', 'a', 'asharp', 'b'];

        const name = names[Math.floor(Math.random() * names.length)];
        const root = rootNotes[this.currentRoot || 0];
        const scale = (this.currentScale || 'major').toLowerCase();
        const tempo = Math.round(this.phraseTempo || 120);
        const randomNum = String(Math.floor(Math.random() * 1000)).padStart(3, '0');

        return `${name}-${root}-${scale}-${tempo}bpm-${randomNum}.wav`;
    }

    flattenSamples(chunks) {
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }
        return result;
    }

    encodeWAV(leftSamples, rightSamples, sampleRate) {
        const numChannels = 2;
        const bitsPerSample = 16;
        const bytesPerSample = bitsPerSample / 8;
        const numSamples = leftSamples.length;
        const dataSize = numSamples * numChannels * bytesPerSample;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        // WAV header
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        this.writeString(view, 8, 'WAVE');
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // fmt chunk size
        view.setUint16(20, 1, true); // PCM format
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // byte rate
        view.setUint16(32, numChannels * bytesPerSample, true); // block align
        view.setUint16(34, bitsPerSample, true);
        this.writeString(view, 36, 'data');
        view.setUint32(40, dataSize, true);

        // Interleave and write samples
        let offset = 44;
        for (let i = 0; i < numSamples; i++) {
            // Left channel
            const leftSample = Math.max(-1, Math.min(1, leftSamples[i]));
            view.setInt16(offset, leftSample < 0 ? leftSample * 0x8000 : leftSample * 0x7FFF, true);
            offset += 2;

            // Right channel
            const rightSample = Math.max(-1, Math.min(1, rightSamples[i]));
            view.setInt16(offset, rightSample < 0 ? rightSample * 0x8000 : rightSample * 0x7FFF, true);
            offset += 2;
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    // ============== V/OCT PITCH CONTROL ==============
    // Instead of creating new oscillators, this controls the patch's existing oscillators
    // like a keyboard CV input on a modular synth

    // Store the base frequencies of all oscillators when entering play mode
    storeBaseFrequencies() {
        this.baseFrequencies = new Map();
        this.cells.forEach((cell, index) => {
            if (cell && cell.category === 'osc' && cell.params && cell.params.freq) {
                // Store the original frequency
                this.baseFrequencies.set(index, cell.params.freq.value);
            }
        });
    }

    // Set pitch CV - tunes ALL oscillators relative to their base pitch
    // ratio: the frequency multiplier (e.g., 2 = octave up, 0.5 = octave down)
    setPitchCV(ratio, glideTime = 0.05) {
        if (!this.baseFrequencies) {
            this.storeBaseFrequencies();
        }

        this.currentPitchRatio = ratio;

        this.cells.forEach((cell, index) => {
            if (!cell || cell.category !== 'osc' || !cell.params || !cell.params.freq) return;

            const baseFreq = this.baseFrequencies.get(index);
            if (baseFreq === undefined) return;

            // Calculate new frequency maintaining harmonic relationships
            const newFreq = baseFreq * ratio;

            // Clamp to reasonable range
            const clampedFreq = Math.max(20, Math.min(newFreq, 8000));

            // Smooth glide to new pitch
            cell.params.freq.setTargetAtTime(clampedFreq, this.ctx.currentTime, glideTime);

            // Also tune any partials (for drone voices)
            if (cell.partials) {
                cell.partials.forEach((partial, i) => {
                    const partialRatio = (i + 2); // 2nd, 3rd partial etc
                    partial.frequency.setTargetAtTime(
                        clampedFreq * partialRatio,
                        this.ctx.currentTime,
                        glideTime
                    );
                });
            }
        });
    }

    // Convert keyboard note to pitch ratio
    // keyIndex: 0-31 (32 keys)
    // scale: array of ratios
    // root: semitones from A (0-11)
    getKeyPitchRatio(keyIndex, scale, rootSemitones = 0) {
        const scaleLength = scale.length;
        const scaleIndex = keyIndex % scaleLength;
        const octaveOffset = Math.floor(keyIndex / scaleLength);

        // Root note offset (semitones to ratio)
        const rootRatio = Math.pow(2, rootSemitones / 12);

        // Scale degree ratio
        const scaleRatio = scale[scaleIndex];

        // Octave multiplier - start one octave lower (0.5x base)
        const octaveRatio = Math.pow(2, octaveOffset - 1);

        return rootRatio * scaleRatio * octaveRatio;
    }

    // AD Envelope settings
    // When enabled, notes have attack-decay shape instead of drone/hold
    setEnvelopeEnabled(enabled) {
        this.envelopeEnabled = enabled;
        // When disabling envelope, restore VCA to unity gain
        if (!enabled && this.envelopeVCA) {
            this.envelopeVCA.gain.cancelScheduledValues(this.ctx.currentTime);
            this.envelopeVCA.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.1);
        }
    }

    setEnvelopeAttack(attack) {
        this.envelopeAttack = Math.max(0.001, Math.min(2, attack));
    }

    setEnvelopeDecay(decay) {
        this.envelopeDecay = Math.max(0.01, Math.min(5, decay));
    }

    // Play a key - sends pitch CV to all oscillators
    playKey(keyIndex, scale, rootSemitones = 0, glideTime = 0.05) {
        const ratio = this.getKeyPitchRatio(keyIndex, scale, rootSemitones);
        this.setPitchCV(ratio, glideTime);

        if (this.envelopeEnabled && this.envelopeVCA) {
            // AD envelope mode - shape the master VCA
            const attack = this.envelopeAttack || 0.01;
            const decay = this.envelopeDecay || 0.5;
            const now = this.ctx.currentTime;
            const vca = this.envelopeVCA.gain;

            // Cancel any scheduled changes
            vca.cancelScheduledValues(now);

            // Start from silence
            vca.setValueAtTime(0, now);

            // Attack: ramp up to full
            vca.linearRampToValueAtTime(1.0, now + attack);

            // Decay: ramp down to silence
            vca.linearRampToValueAtTime(0, now + attack + decay);
        } else {
            // Drone mode - ensure VCA is open, slight articulation via master
            if (this.envelopeVCA) {
                this.envelopeVCA.gain.cancelScheduledValues(this.ctx.currentTime);
                this.envelopeVCA.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.01);
            }
            // Slight articulation boost on master
            const currentGain = this.masterGain.gain.value;
            this.masterGain.gain.setTargetAtTime(currentGain * 1.1, this.ctx.currentTime, 0.01);
            this.masterGain.gain.setTargetAtTime(currentGain, this.ctx.currentTime + 0.05, 0.1);
        }
    }

    // Release key - optionally return to base pitch or hold
    releaseKey(holdPitch = true) {
        if (!holdPitch && this.baseFrequencies) {
            // Return all oscillators to their base frequencies
            this.setPitchCV(1, 0.2);
        }

        // When exiting play mode, restore VCA to unity
        if (!holdPitch && this.envelopeVCA) {
            this.envelopeVCA.gain.cancelScheduledValues(this.ctx.currentTime);
            this.envelopeVCA.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.3);
        }
    }

    // Quantize all oscillators to current scale/root (for when scale changes)
    quantizeOscillators(scale, rootSemitones = 0) {
        if (!this.baseFrequencies) {
            this.storeBaseFrequencies();
        }

        const rootFreq = 55 * Math.pow(2, rootSemitones / 12); // A1 as base

        this.cells.forEach((cell, index) => {
            if (!cell || cell.category !== 'osc' || !cell.params || !cell.params.freq) return;

            const currentFreq = cell.params.freq.value;

            // Find nearest scale degree
            let nearestRatio = 1;
            let minDistance = Infinity;

            // Check multiple octaves
            for (let octave = -2; octave <= 4; octave++) {
                const octaveMultiplier = Math.pow(2, octave);
                for (const scaleRatio of scale) {
                    const targetFreq = rootFreq * scaleRatio * octaveMultiplier;
                    const distance = Math.abs(Math.log2(currentFreq / targetFreq));
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestRatio = scaleRatio * octaveMultiplier;
                    }
                }
            }

            // Snap to nearest scale degree
            const quantizedFreq = rootFreq * nearestRatio;
            cell.params.freq.setTargetAtTime(quantizedFreq, this.ctx.currentTime, 0.3);

            // Update base frequency for V/Oct tracking
            this.baseFrequencies.set(index, quantizedFreq);
        });
    }

    // Set root note and optionally quantize
    setRoot(rootSemitones, scale = null, quantize = true) {
        this.currentRoot = rootSemitones;
        this.rootNote = 55 * Math.pow(2, rootSemitones / 12);

        if (quantize && scale) {
            this.quantizeOscillators(scale, rootSemitones);
        }
    }

    // Set scale and optionally quantize oscillators
    setScale(scaleName, rootSemitones = null, quantize = true) {
        if (this.scales[scaleName]) {
            this.currentScale = scaleName;
            const scale = this.scales[scaleName];
            const root = rootSemitones !== null ? rootSemitones : (this.currentRoot || 0);

            // Update pitch quantizer worklet
            this.updateQuantizerScale();

            if (quantize) {
                this.quantizeOscillators(scale, root);
            }
        }
    }

    // ============== MACRO SYSTEM ==============

    getMacroAssignments() {
        const assignments = [];

        // Always include global controls
        assignments.push({
            label: 'VOL',
            type: 'global',
            param: 'masterGain',
            value: this.masterGain.gain.value / 1.0,
            min: 0,
            max: 1
        });

        assignments.push({
            label: 'REV',
            type: 'global',
            param: 'reverbMix',
            value: 0.25,
            min: 0,
            max: 1
        });

        assignments.push({
            label: 'DRFT',
            type: 'global',
            param: 'driftAmount',
            value: this.driftAmount / 0.001,
            min: 0,
            max: 1
        });

        assignments.push({
            label: 'KREL',
            type: 'global',
            param: 'krellDensity',
            value: this.krellDensity,
            min: 0,
            max: 1
        });

        // Analyze active cells and add relevant controls
        let oscCount = 0;
        let modCount = 0;
        let fxCount = 0;

        this.cells.forEach((cell, index) => {
            if (!cell || !cell.params) return;
            if (assignments.length >= 16) return;

            if (cell.category === 'osc' && oscCount < 4) {
                oscCount++;
                const suffix = oscCount > 1 ? oscCount : '';

                if (cell.params.freq) {
                    assignments.push({
                        label: `FRQ${suffix}`,
                        type: 'cell',
                        cellIndex: index,
                        param: 'freq',
                        value: Math.log2(cell.params.freq.value / 27.5) / 6,
                        min: 27.5,
                        max: 1760
                    });
                }

                if (cell.params.gain && assignments.length < 16) {
                    assignments.push({
                        label: `GN${suffix}`,
                        type: 'cell',
                        cellIndex: index,
                        param: 'gain',
                        value: cell.params.gain.value / 0.3,
                        min: 0,
                        max: 0.3
                    });
                }
            }

            if ((cell.category === 'mod' || cell.isModulator) && modCount < 3 && assignments.length < 16) {
                modCount++;
                const suffix = modCount > 1 ? modCount : '';

                if (cell.params.freq || cell.params.rate) {
                    const paramName = cell.params.freq ? 'freq' : 'rate';
                    const paramValue = (cell.params.freq || cell.params.rate).value;
                    assignments.push({
                        label: `RT${suffix}`,
                        type: 'cell',
                        cellIndex: index,
                        param: paramName,
                        value: Math.min(paramValue / 10, 1),
                        min: 0.01,
                        max: 10
                    });
                }

                if (cell.params.depth && assignments.length < 16) {
                    assignments.push({
                        label: `DPT${suffix}`,
                        type: 'cell',
                        cellIndex: index,
                        param: 'depth',
                        value: Math.min(cell.params.depth.value / 100, 1),
                        min: 0,
                        max: 100
                    });
                }
            }

            if (cell.category === 'fx' && fxCount < 2 && assignments.length < 16) {
                fxCount++;
                const suffix = fxCount > 1 ? fxCount : '';

                if (cell.params.mix) {
                    assignments.push({
                        label: `MIX${suffix}`,
                        type: 'cell',
                        cellIndex: index,
                        param: 'mix',
                        value: cell.params.mix.value,
                        min: 0,
                        max: 1
                    });
                }

                if (cell.params.time && assignments.length < 16) {
                    assignments.push({
                        label: `TIM${suffix}`,
                        type: 'cell',
                        cellIndex: index,
                        param: 'time',
                        value: cell.params.time.value / 2,
                        min: 0,
                        max: 2
                    });
                }
            }

            // Handle filters
            if (cell.filter && assignments.length < 16) {
                assignments.push({
                    label: 'CUT',
                    type: 'filter',
                    cellIndex: index,
                    param: 'frequency',
                    value: Math.log2(cell.filter.frequency.value / 100) / 7,
                    min: 100,
                    max: 12000
                });
            }
        });

        // Fill remaining slots with timbral variety controls
        const timbreControls = [
            {
                label: 'WAVE',
                type: 'global',
                param: 'waveformBias',
                value: this.currentWaveformBias,
                min: 0,
                max: 1
            },
            {
                label: 'FILT',
                type: 'global',
                param: 'filterCutoff',
                value: this.globalFilterCutoff,
                min: 0,
                max: 1
            },
            {
                label: 'RESO',
                type: 'global',
                param: 'filterResonance',
                value: this.globalFilterResonance,
                min: 0,
                max: 1
            },
            {
                label: 'FM',
                type: 'global',
                param: 'fmDepth',
                value: this.globalFMDepth,
                min: 0,
                max: 1
            },
            {
                label: 'DIST',
                type: 'global',
                param: 'distortion',
                value: this.globalDistortion,
                min: 0,
                max: 1
            },
            {
                label: 'RATE',
                type: 'global',
                param: 'krellEventRate',
                value: 1 - (this.krellEventRate - 1000) / 20000,
                min: 1000,
                max: 20000
            },
            {
                label: 'DCAY',
                type: 'global',
                param: 'decayRate',
                value: (this.decayRate - 0.999) / 0.001,
                min: 0.999,
                max: 1.0
            }
        ];

        let timbreIdx = 0;
        while (assignments.length < 16 && timbreIdx < timbreControls.length) {
            assignments.push(timbreControls[timbreIdx]);
            timbreIdx++;
        }

        return assignments.slice(0, 16);
    }

    setMacroValue(_index, value, assignment) {
        if (!assignment) return;

        const normalizedValue = Math.max(0, Math.min(1, value));

        if (assignment.type === 'global') {
            switch (assignment.param) {
                case 'masterGain':
                    this.masterGain.gain.setTargetAtTime(normalizedValue, this.ctx.currentTime, 0.05);
                    break;
                case 'reverbMix':
                    // Would need reverb send gain node reference
                    break;
                case 'driftAmount':
                    this.driftAmount = normalizedValue * 0.001;
                    break;
                case 'krellDensity':
                    this.krellDensity = normalizedValue;
                    break;
                case 'krellEventRate':
                    this.krellEventRate = 1000 + (1 - normalizedValue) * 20000;
                    break;
                case 'decayRate':
                    this.decayRate = 0.999 + normalizedValue * 0.001;
                    break;
                // Timbral variety controls
                case 'waveformBias':
                    this.currentWaveformBias = normalizedValue;
                    break;
                case 'filterCutoff':
                    this.globalFilterCutoff = normalizedValue;
                    // Apply to all active voice filters
                    this.applyGlobalFilter();
                    break;
                case 'filterResonance':
                    this.globalFilterResonance = normalizedValue;
                    this.applyGlobalFilter();
                    break;
                case 'fmDepth':
                    this.globalFMDepth = normalizedValue;
                    this.applyGlobalFM();
                    break;
                case 'distortion':
                    this.globalDistortion = normalizedValue;
                    this.applyGlobalDistortion();
                    break;
            }
        } else if (assignment.type === 'cell') {
            const cell = this.cells[assignment.cellIndex];
            if (!cell || !cell.params || !cell.params[assignment.param]) return;

            const param = cell.params[assignment.param];
            const range = assignment.max - assignment.min;
            let newValue;

            // Handle logarithmic frequency scaling
            if (assignment.param === 'freq' && assignment.min > 20) {
                newValue = assignment.min * Math.pow(assignment.max / assignment.min, normalizedValue);
            } else {
                newValue = assignment.min + normalizedValue * range;
            }

            param.setTargetAtTime(newValue, this.ctx.currentTime, 0.05);
        } else if (assignment.type === 'filter') {
            const cell = this.cells[assignment.cellIndex];
            if (!cell || !cell.filter) return;

            const newFreq = 100 * Math.pow(120, normalizedValue); // Log scale 100-12000 Hz
            cell.filter.frequency.setTargetAtTime(newFreq, this.ctx.currentTime, 0.05);
        }
    }

    // Apply global filter settings to all voices with filters
    applyGlobalFilter() {
        const cutoffHz = 100 + this.globalFilterCutoff * 8000; // 100-8100 Hz
        const q = 0.5 + this.globalFilterResonance * 15; // 0.5-15.5 Q

        this.cells.forEach(cell => {
            if (!cell || !cell.filter) return;

            cell.filter.frequency.setTargetAtTime(cutoffHz, this.ctx.currentTime, 0.1);
            cell.filter.Q.setTargetAtTime(q, this.ctx.currentTime, 0.1);
        });
    }

    // Apply global FM depth to all FM voices
    applyGlobalFM() {
        const depthHz = this.globalFMDepth * 500; // 0-500 Hz deviation

        this.cells.forEach(cell => {
            if (!cell || !cell.modulator) return;

            // Find the modGain node (FM depth control)
            if (cell.params && cell.params.fmDepth) {
                // For voices with modGain accessible
                const modGainNode = cell.modGain ||
                    (cell.modulator && cell.modulator._modGain);
                if (modGainNode && modGainNode.gain) {
                    modGainNode.gain.setTargetAtTime(depthHz, this.ctx.currentTime, 0.1);
                }
            }
        });
    }

    // Apply global distortion to all voices with distortion
    applyGlobalDistortion() {
        this.cells.forEach(cell => {
            if (!cell || !cell.distortion) return;

            // Update the waveshaper curve
            this.updateVoiceDistortion(cell.distortion, this.globalDistortion);
        });
    }

    // ============== PHRASE GENERATOR SYSTEM ==============

    // Initialize voice pools for smooth phrase playback
    initializeVoicePools() {
        // Create 4 melody voices
        for (let i = 0; i < 4; i++) {
            this.melodyVoicePool.push(this.createPhraseVoice('melody'));
        }
        // Create 4 T-voices for tintinnabuli
        for (let i = 0; i < 4; i++) {
            this.tVoicePool.push(this.createPhraseVoice('tvoice'));
        }
        // Create 6 chord voices
        for (let i = 0; i < 6; i++) {
            this.chordVoicePool.push(this.createPhraseVoice('chord'));
        }
    }

    // Create a single voice for phrase playback
    createPhraseVoice(type) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        // Different timbres for different voice types
        if (type === 'melody') {
            osc.type = ['sine', 'triangle', 'sawtooth'][Math.floor(Math.random() * 3)];
            filter.type = 'lowpass';
            filter.frequency.value = 2000 + Math.random() * 3000;
            filter.Q.value = 0.5 + Math.random() * 2;
        } else if (type === 'tvoice') {
            // T-voices are purer, simpler
            osc.type = Math.random() < 0.7 ? 'sine' : 'triangle';
            filter.type = 'lowpass';
            filter.frequency.value = 3000 + Math.random() * 2000;
            filter.Q.value = 0.5;
        } else {
            // Chord voices - warmer
            osc.type = ['sine', 'triangle'][Math.floor(Math.random() * 2)];
            filter.type = 'lowpass';
            filter.frequency.value = 1500 + Math.random() * 2000;
            filter.Q.value = 0.5 + Math.random();
        }

        gain.gain.value = 0; // Start silent

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start();

        return {
            osc,
            gain,
            filter,
            busy: false,
            releaseTime: 0
        };
    }

    // Get an available voice from a pool
    getAvailableVoice(pool) {
        const now = this.ctx.currentTime;
        // First look for a free voice
        for (const voice of pool) {
            if (!voice.busy && now > voice.releaseTime) {
                return voice;
            }
        }
        // If none free, steal the oldest
        let oldest = pool[0];
        for (const voice of pool) {
            if (voice.releaseTime < oldest.releaseTime) {
                oldest = voice;
            }
        }
        return oldest;
    }

    // Start phrase playback loop
    startPhrasePlayback() {
        if (!this.phraseActive) return;

        // Generate first phrase
        this.generatePhrase();

        const playStep = () => {
            if (!this.phraseActive || !this.isRunning) return;

            const currentBeat = this.phrasePosition;

            // Play notes at this beat
            this.playNotesAtBeat(currentBeat);

            // Advance position (16th note resolution)
            this.phrasePosition += 0.25;

            // Check for phrase end
            if (this.phrasePosition >= this.currentPhrase.length) {
                this.phrasePosition = 0;
                this.generatePhrase(); // Generate new phrase
            }

            // Schedule next step
            const msPerBeat = 60000 / this.phraseTempo;
            this.phraseTimer = setTimeout(playStep, msPerBeat / 4);
        };

        // Small delay to let everything initialize
        setTimeout(playStep, 500);
    }

    // Generate a new phrase
    generatePhrase() {
        // 25% chance of song mode (more tonal, melodious)
        this.songMode = Math.random() < 0.25;

        // 50% chance of drone on each new phrase (less in song mode)
        const newDroneState = this.songMode ? (Math.random() < 0.3) : (Math.random() < 0.5);
        if (newDroneState !== this.droneEnabled) {
            this.droneEnabled = newDroneState;
            this.updateDroneState();
        }

        // Randomly select phrase length (1, 2, 4, or 8 bars)
        const lengths = [1, 2, 4, 8];
        // Song mode prefers 4 or 8 bar phrases, minimalist prefers shorter
        let lengthWeights;
        if (this.songMode) {
            lengthWeights = [0.05, 0.15, 0.4, 0.4]; // Prefer 4 and 8 bars
        } else if (this.minimalismLevel > 0.6) {
            lengthWeights = [0.3, 0.4, 0.2, 0.1];
        } else {
            lengthWeights = [0.15, 0.25, 0.35, 0.25];
        }

        let r = Math.random();
        let lengthIdx = 0;
        for (let i = 0; i < lengthWeights.length; i++) {
            r -= lengthWeights[i];
            if (r <= 0) { lengthIdx = i; break; }
        }
        this.phraseLengthBars = lengths[lengthIdx];

        const totalBeats = this.phraseLengthBars * this.beatsPerBar;

        this.currentPhrase = {
            length: totalBeats,
            notes: [],
            chords: [],
            tintinnabuli: [],
            type: this.selectPhraseType()
        };

        // Generate based on phrase type
        switch (this.currentPhrase.type) {
            case 'minimalist':
                this.generateMinimalistPhrase();
                break;
            case 'chordal':
                this.generateChordalPhrase();
                break;
            case 'ambient':
                this.generateAmbientPhrase();
                break;
            case 'song':
                this.generateSongPhrase();
                break;
            default:
                this.generateMelodicPhrase();
        }

        // Generate tintinnabuli counterpoint if enabled
        if (this.tintinnabuliEnabled && this.currentPhrase.notes.length > 0) {
            this.generateTintinnabuliVoice();
        }

        if (this.songMode) {
            console.log('SONG MODE: ' + this.currentPhrase.type + ', ' + this.phraseLengthBars + ' bars');
        }
    }

    // Select phrase type based on levels
    selectPhraseType() {
        const r = Math.random();

        // Song mode always uses song phrase type
        if (this.songMode) {
            return 'song';
        }

        // High minimalism = more minimalist/ambient phrases
        if (this.minimalismLevel > 0.7) {
            return r < 0.5 ? 'minimalist' : (r < 0.8 ? 'ambient' : 'melodic');
        }

        // High harmony = more chordal phrases
        if (this.harmonyLevel > 0.7) {
            return r < 0.4 ? 'chordal' : (r < 0.7 ? 'melodic' : 'ambient');
        }

        // Balanced - varied selection
        if (r < 0.35) return 'melodic';
        if (r < 0.55) return 'chordal';
        if (r < 0.75) return 'minimalist';
        return 'ambient';
    }

    // Generate melodic phrase - REAL sequencer-style motifs
    generateMelodicPhrase() {
        const scale = this.scales[this.currentScale] || this.scales.major;
        const notes = [];

        // Create a SHORT MOTIF (2-4 notes) that defines the phrase
        const motifLength = 2 + Math.floor(Math.random() * 3);
        const motif = [];

        // Start on a chord tone (root, 3rd, or 5th)
        const chordTones = [0, 2, 4];
        let startDegree = chordTones[Math.floor(Math.random() * 3)] + scale.length; // Middle octave

        // Build the motif with musical intervals
        let currentDegree = startDegree;
        for (let i = 0; i < motifLength; i++) {
            motif.push(currentDegree);
            // Musical movement: steps and small skips
            const intervals = [-2, -1, -1, 0, 1, 1, 2, 3]; // Favor steps, allow small skips
            currentDegree += intervals[Math.floor(Math.random() * intervals.length)];
            currentDegree = Math.max(scale.length - 2, Math.min(scale.length * 2 + 2, currentDegree));
        }

        // SEQUENCER-STYLE: 16th note grid with the motif repeating
        const stepDuration = 0.25; // 16th notes
        const stepsPerBar = 16;
        const totalSteps = this.currentPhrase.length * 4; // 4 steps per beat

        // Choose a rhythmic pattern (which steps are active)
        const rhythmPatterns = [
            [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0], // Every other 16th
            [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0], // Syncopated
            [1,1,0,1, 1,0,1,0, 1,1,0,1, 1,0,1,0], // Dense
            [1,0,1,0, 1,0,0,0, 1,0,1,0, 1,0,0,0], // Simple pulse
            [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], // Quarter notes
            [1,1,1,0, 1,1,1,0, 1,1,1,0, 1,1,1,0], // Triplet feel
            [1,0,1,1, 0,1,0,1, 1,0,1,1, 0,1,0,1], // Funk
        ];
        const pattern = rhythmPatterns[Math.floor(Math.random() * rhythmPatterns.length)];

        // Play the motif on the rhythmic grid
        let motifIndex = 0;
        for (let step = 0; step < totalSteps; step++) {
            const patternStep = step % stepsPerBar;

            if (pattern[patternStep]) {
                // Get the current motif note
                const degree = motif[motifIndex % motif.length];

                // Occasional octave shift for variation
                let finalDegree = degree;
                if (step > stepsPerBar && Math.random() < 0.15) {
                    finalDegree += (Math.random() < 0.5 ? scale.length : -scale.length);
                }
                finalDegree = Math.max(0, Math.min(scale.length * 3 - 1, finalDegree));

                notes.push({
                    beat: step * stepDuration,
                    degree: finalDegree,
                    duration: stepDuration * 0.8, // Slightly shorter for separation
                    velocity: 0.7 + Math.random() * 0.2
                });

                motifIndex++;
            }
        }

        this.currentPhrase.notes = notes;
    }

    // Generate chordal phrase - arpeggiated chord progressions
    generateChordalPhrase() {
        const scale = this.scales[this.currentScale] || this.scales.major;
        const notes = [];
        const chords = [];

        // Common chord progressions (scale degrees)
        const progressions = [
            [0, 3, 4, 0],      // I - IV - V - I
            [0, 5, 3, 4],      // I - vi - IV - V
            [0, 4, 5, 3],      // I - V - vi - IV
            [0, 2, 4, 0],      // I - iii - V - I
            [0, 3, 0, 4],      // I - IV - I - V
            [5, 3, 0, 4],      // vi - IV - I - V
        ];
        const progression = progressions[Math.floor(Math.random() * progressions.length)];

        // Arpeggio patterns (which chord tones to play in order)
        const arpeggioPatterns = [
            [0, 1, 2, 1],         // Up-down
            [0, 1, 2, 2, 1, 0],   // Up-down full
            [2, 1, 0, 1],         // Down-up
            [0, 2, 1, 2],         // Root-5th-3rd-5th
            [0, 1, 2, 0],         // Up-repeat root
        ];
        const arpPattern = arpeggioPatterns[Math.floor(Math.random() * arpeggioPatterns.length)];

        // 16th note grid
        const stepDuration = 0.25;
        const stepsPerChord = Math.floor(this.currentPhrase.length * 4 / progression.length);

        let step = 0;
        for (let chordIdx = 0; chordIdx < progression.length; chordIdx++) {
            const rootDegree = progression[chordIdx];

            // Build chord (root, 3rd, 5th)
            const chordDegrees = [rootDegree, rootDegree + 2, rootDegree + 4];

            // Add chord for visualization
            chords.push({
                beat: step * stepDuration,
                degrees: chordDegrees.map(d => d + scale.length),
                duration: stepsPerChord * stepDuration,
                velocity: 0.3
            });

            // Arpeggiate through the chord
            for (let s = 0; s < stepsPerChord; s++) {
                const arpIndex = s % arpPattern.length;
                const chordTone = arpPattern[arpIndex];
                const degree = chordDegrees[chordTone % 3] + scale.length; // Middle octave

                // Add some rhythmic variation
                if (s % 2 === 0 || Math.random() < 0.7) {
                    notes.push({
                        beat: step * stepDuration,
                        degree: degree,
                        duration: stepDuration * 0.7,
                        velocity: s % 4 === 0 ? 0.8 : 0.6 // Accent on downbeats
                    });
                }
                step++;
            }
        }

        this.currentPhrase.notes = notes;
        this.currentPhrase.chords = chords;
    }

    // Generate sparse melody - occasional accents over texture
    generateSparseMelody() {
        const scale = this.scales[this.currentScale] || this.scales.major;

        // Add melodic accents on strong beats
        const accents = [0, 4, 8, 12]; // Every bar
        for (const beat of accents) {
            if (beat < this.currentPhrase.length) {
                const degree = [0, 2, 4][Math.floor(Math.random() * 3)] + scale.length * 2; // High octave
                this.currentPhrase.notes.push({
                    beat,
                    degree,
                    duration: 1,
                    velocity: 0.75
                });
            }
        }
    }

    // Generate minimalist phrase - Reich/Glass style strict repetition with phasing
    generateMinimalistPhrase() {
        const scale = this.scales[this.currentScale] || this.scales.major;
        const notes = [];

        // Reich-style: Create a FIXED pattern that repeats EXACTLY
        // Classic minimalist cells - short, repetitive, hypnotic
        const cellPatterns = [
            [0, 2, 4, 2],           // Simple triad arpeggio
            [0, 0, 2, 4],           // Root emphasis
            [4, 2, 0, 2, 4, 2],     // Down-up
            [0, 2, 0, 4, 0, 2],     // Root anchor
            [0, 4, 2, 4],           // Skip pattern
            [0, 1, 2, 1, 0, -1],    // Stepwise
        ];
        const cellPattern = cellPatterns[Math.floor(Math.random() * cellPatterns.length)];

        // Fixed rhythm - 8th notes (classic minimalism)
        const stepDuration = 0.5;

        // Calculate how many times the cell repeats
        const totalSteps = this.currentPhrase.length * 2; // 2 steps per beat (8th notes)
        const baseDegree = scale.length; // Middle octave root

        // Create the repeating pattern - NO VARIATION, pure repetition
        for (let step = 0; step < totalSteps; step++) {
            const cellIndex = step % cellPattern.length;
            const intervalFromRoot = cellPattern[cellIndex];
            const degree = baseDegree + intervalFromRoot;

            // Ensure degree is in valid range
            const finalDegree = Math.max(0, Math.min(scale.length * 3 - 1, degree));

            // Consistent velocity with subtle accent on cell start
            const velocity = cellIndex === 0 ? 0.75 : 0.6;

            notes.push({
                beat: step * stepDuration,
                degree: finalDegree,
                duration: stepDuration * 0.85, // Slightly legato
                velocity
            });
        }

        this.currentPhrase.notes = notes;
    }

    // Generate ambient phrase - slow evolving melodic line over drone
    generateAmbientPhrase() {
        const scale = this.scales[this.currentScale] || this.scales.major;
        const notes = [];

        // Slow melodic line - one note every 2 beats
        const stepDuration = 2;
        const numSteps = Math.floor(this.currentPhrase.length / stepDuration);

        // Start on root, move slowly
        let currentDegree = scale.length; // Middle octave root
        const melodicPath = [0, 2, 4, 2, 0, -1, 0, 4]; // Gentle melodic contour

        for (let i = 0; i < numSteps; i++) {
            const pathIndex = i % melodicPath.length;
            currentDegree = scale.length + melodicPath[pathIndex];

            notes.push({
                beat: i * stepDuration,
                degree: currentDegree,
                duration: stepDuration * 1.2, // Overlapping for legato
                velocity: 0.5
            });
        }

        this.currentPhrase.notes = notes;

        // Sustained drone chord
        this.currentPhrase.chords = [{
            beat: 0,
            degrees: [0, 4, scale.length], // Root, 5th, octave
            duration: this.currentPhrase.length,
            velocity: 0.25
        }];
    }

    // Generate song phrase - TONAL, MELODIOUS, SONG-READY
    // This creates proper musical phrases with clear melodic contour,
    // singable melodies, and strong harmonic support
    generateSongPhrase() {
        const scale = this.scales[this.currentScale] || this.scales.major;
        const notes = [];
        const chords = [];

        // Use consonant scales for song mode
        const consonantScales = ['major', 'minor', 'pentatonic', 'dorian'];
        if (!consonantScales.includes(this.currentScale)) {
            // Temporarily use major for more tonal results
            this.setScale('major');
        }

        // Set a comfortable, musical tempo
        this.phraseTempo = 80 + Math.random() * 40; // 80-120 BPM

        // Create a SINGABLE MELODY with clear contour
        // Use common melodic patterns: arch, descent, question-answer
        const melodyPatterns = [
            // Ascending arch (up then down)
            [0, 1, 2, 3, 4, 3, 2, 1],
            // Descending with resolution
            [4, 3, 2, 1, 2, 1, 0, 0],
            // Question-answer (up, pause, down to resolve)
            [0, 2, 4, 4, 2, 1, 0, 0],
            // Stepwise with leap
            [0, 1, 2, 1, 0, 2, 4, 2],
            // Pentatonic-friendly
            [0, 2, 4, 2, 0, 2, 4, 5],
            // Pop melody contour
            [2, 2, 4, 4, 3, 2, 1, 0],
            // Ballad style
            [0, 0, 2, 4, 4, 2, 0, 0],
        ];

        const melodyPattern = melodyPatterns[Math.floor(Math.random() * melodyPatterns.length)];

        // Strong chord progressions (in scale degrees)
        const progressions = [
            [0, 3, 4, 0],      // I - IV - V - I (classic)
            [0, 5, 3, 4],      // I - vi - IV - V (pop)
            [0, 4, 5, 3],      // I - V - vi - IV (axis)
            [0, 3, 0, 4],      // I - IV - I - V
            [0, 2, 3, 4],      // I - iii - IV - V
        ];
        const chordProgression = progressions[Math.floor(Math.random() * progressions.length)];

        // Calculate beats per chord
        const beatsPerChord = Math.floor(this.currentPhrase.length / chordProgression.length);

        // Generate chords with arpeggiation for richness
        chordProgression.forEach((root, chordIdx) => {
            const chordBeat = chordIdx * beatsPerChord;

            // Full chord on downbeat
            chords.push({
                beat: chordBeat,
                degrees: [root, root + 2, root + 4], // Triad
                duration: beatsPerChord,
                velocity: 0.7
            });
        });

        // Generate melody notes aligned with chord changes
        // 8th note rhythm for singability
        const notesPerBar = 8; // 8th notes
        const totalNotes = this.currentPhrase.length * 2; // 2 eighth notes per beat

        for (let i = 0; i < totalNotes; i++) {
            const beat = i * 0.5; // 8th notes

            // Determine which chord we're over
            const chordIdx = Math.floor(beat / beatsPerChord) % chordProgression.length;
            const chordRoot = chordProgression[chordIdx];

            // Get melody note from pattern (loop through pattern)
            const patternIdx = i % melodyPattern.length;
            let degree = melodyPattern[patternIdx];

            // Transpose melody to fit current chord (voice leading)
            // Keep melody in comfortable range
            degree = degree + scale.length; // Middle octave

            // Add some rhythmic variation - not every 8th note
            const rhythmPatterns = [
                [1, 0, 1, 1, 1, 0, 1, 0], // Syncopated
                [1, 1, 1, 0, 1, 1, 1, 0], // Strong beats
                [1, 0, 1, 0, 1, 0, 1, 1], // Off-beat emphasis
                [1, 1, 0, 1, 1, 0, 1, 0], // Swing feel
            ];
            const rhythmPattern = rhythmPatterns[Math.floor(Math.random() * rhythmPatterns.length)];

            if (rhythmPattern[i % rhythmPattern.length] === 1) {
                notes.push({
                    beat: beat,
                    degree: degree,
                    duration: 0.5, // 8th note
                    velocity: (i % 4 === 0) ? 0.9 : 0.7 // Accent downbeats
                });
            }
        }

        // Add melodic ornaments - passing tones, neighbor tones
        if (Math.random() < 0.5) {
            const ornamentedNotes = [];
            notes.forEach((note, idx) => {
                ornamentedNotes.push(note);

                // Sometimes add a quick grace note before
                if (idx < notes.length - 1 && Math.random() < 0.2) {
                    const nextNote = notes[idx + 1];
                    const gap = nextNote.beat - note.beat;
                    if (gap >= 0.5) {
                        // Add passing tone
                        const passingDegree = Math.round((note.degree + nextNote.degree) / 2);
                        ornamentedNotes.push({
                            beat: note.beat + gap * 0.75,
                            degree: passingDegree,
                            duration: 0.25,
                            velocity: 0.5
                        });
                    }
                }
            });
            this.currentPhrase.notes = ornamentedNotes;
        } else {
            this.currentPhrase.notes = notes;
        }

        this.currentPhrase.chords = chords;
    }

    // Generate tintinnabuli T-voice (Arvo Pärt style)
    generateTintinnabuliVoice() {
        if (!this.currentPhrase.notes.length) return;

        const scale = this.scales[this.currentScale] || this.scales.major;

        // Triad degrees (1, 3, 5 in scale indices)
        // For most scales: root (0), third (2), fifth (4)
        const triadDegrees = [0, 2, 4].filter(d => d < scale.length);

        this.currentPhrase.tintinnabuli = this.currentPhrase.notes.map((note, idx) => {
            const melodyDegree = note.degree % scale.length;
            let tDegree;

            const mode = this.tintinnabuliMode === 'alternating' ?
                (idx % 2 === 0 ? 'above' : 'below') : this.tintinnabuliMode;

            tDegree = this.findNearestTriadTone(melodyDegree, triadDegrees, mode, scale.length);

            // Place in same octave region as melody
            const melodyOctave = Math.floor(note.degree / scale.length);

            return {
                beat: note.beat,
                degree: melodyOctave * scale.length + tDegree,
                duration: note.duration * 1.2, // T-voice sustains slightly longer
                velocity: note.velocity * 0.95 // T-voice nearly as loud as melody for pronounced effect
            };
        });
    }

    // Find nearest triad tone in given direction
    findNearestTriadTone(melodyDegree, triadDegrees, direction, scaleLength) {
        const sorted = [...triadDegrees].sort((a, b) => a - b);

        if (direction === 'above') {
            for (const t of sorted) {
                if (t > melodyDegree) return t;
            }
            // Wrap to next octave
            return sorted[0] + scaleLength;
        } else {
            for (let i = sorted.length - 1; i >= 0; i--) {
                if (sorted[i] < melodyDegree) return sorted[i];
            }
            // Wrap to previous octave
            return sorted[sorted.length - 1] - scaleLength;
        }
    }

    // Play notes at current beat position
    playNotesAtBeat(beat) {
        if (!this.currentPhrase) return;

        const tolerance = 0.125; // 32nd note tolerance

        // Play melody notes
        const melodyNotes = this.currentPhrase.notes
            .filter(n => Math.abs(n.beat - beat) < tolerance);
        melodyNotes.forEach(note => this.triggerMelodyNote(note));

        // Play chord notes
        const chordNotes = this.currentPhrase.chords
            .filter(c => Math.abs(c.beat - beat) < tolerance);
        chordNotes.forEach(chord => this.triggerChord(chord));

        // Play tintinnabuli
        if (this.tintinnabuliEnabled) {
            const tNotes = this.currentPhrase.tintinnabuli
                .filter(t => Math.abs(t.beat - beat) < tolerance);
            tNotes.forEach(tNote => this.triggerTVoiceNote(tNote));
        }

        // Debug: log when notes are played
        if (melodyNotes.length > 0 || chordNotes.length > 0) {
            // Uncomment for debugging: console.log('Beat ' + beat.toFixed(2) + ': melody=' + melodyNotes.length + ', chords=' + chordNotes.length);
        }
    }

    // Trigger a melody note - LOUD and clearly articulated
    triggerMelodyNote(note) {
        const scale = this.scales[this.currentScale] || this.scales.major;
        const freq = this.degreeToFrequency(note.degree, scale);
        const voice = this.getAvailableVoice(this.melodyVoicePool);

        voice.osc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.002);

        // Punchy articulation envelope
        const now = this.ctx.currentTime;
        const attackTime = 0.003; // Very fast attack for clarity
        const sustainTime = note.duration * (60 / this.phraseTempo) * 0.7;
        const releaseTime = 0.08;

        // VERY LOUD - 0.7 for punchy, prominent sequence sound
        const peakGain = note.velocity * 0.7;

        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(0, now);
        voice.gain.gain.linearRampToValueAtTime(peakGain, now + attackTime);
        voice.gain.gain.setValueAtTime(peakGain * 0.85, now + attackTime + sustainTime);
        voice.gain.gain.linearRampToValueAtTime(0, now + attackTime + sustainTime + releaseTime);

        voice.busy = true;
        voice.releaseTime = now + attackTime + sustainTime + releaseTime;
    }

    // Trigger a chord - LOUD with clear attack
    triggerChord(chord) {
        const scale = this.scales[this.currentScale] || this.scales.major;

        chord.degrees.forEach((degree, i) => {
            const freq = this.degreeToFrequency(degree, scale);
            const voice = this.getAvailableVoice(this.chordVoicePool);

            voice.osc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.005);

            const now = this.ctx.currentTime;
            const attackTime = 0.01 + i * 0.005; // Fast attack, slight stagger
            const sustainTime = chord.duration * (60 / this.phraseTempo) * 0.8;
            const releaseTime = 0.2;

            // LOUD - 0.45 for punchy chord sound
            const peakGain = chord.velocity * 0.45;

            voice.gain.gain.cancelScheduledValues(now);
            voice.gain.gain.setValueAtTime(0, now);
            voice.gain.gain.linearRampToValueAtTime(peakGain, now + attackTime);
            voice.gain.gain.setValueAtTime(peakGain * 0.75, now + attackTime + sustainTime);
            voice.gain.gain.linearRampToValueAtTime(0, now + attackTime + sustainTime + releaseTime);

            voice.busy = true;
            voice.releaseTime = now + attackTime + sustainTime + releaseTime;
        });
    }

    // Trigger a tintinnabuli T-voice note - PRONOUNCED bell-like tone
    triggerTVoiceNote(note) {
        const scale = this.scales[this.currentScale] || this.scales.major;
        const freq = this.degreeToFrequency(note.degree, scale);
        const voice = this.getAvailableVoice(this.tVoicePool);

        // T-voice often sounds better an octave higher for bell-like clarity
        const tFreq = freq * (Math.random() < 0.5 ? 2 : 1);
        voice.osc.frequency.setTargetAtTime(tFreq, this.ctx.currentTime, 0.002);

        // Use triangle or sine for pure, bell-like T-voice tone
        voice.osc.type = Math.random() < 0.7 ? 'triangle' : 'sine';

        const now = this.ctx.currentTime;
        const attackTime = 0.003; // Faster attack for bell-like clarity
        const sustainTime = note.duration * (60 / this.phraseTempo) * 0.8; // Longer sustain
        const releaseTime = 0.25; // Longer release for bell decay

        // LOUD T-voice for pronounced tintinnabuli effect - 0.6
        const peakGain = note.velocity * 0.6;

        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(0, now);
        voice.gain.gain.linearRampToValueAtTime(peakGain, now + attackTime);
        voice.gain.gain.setValueAtTime(peakGain * 0.75, now + attackTime + sustainTime);
        voice.gain.gain.linearRampToValueAtTime(0, now + attackTime + sustainTime + releaseTime);

        voice.busy = true;
        voice.releaseTime = now + attackTime + sustainTime + releaseTime;
    }

    // Convert scale degree to frequency
    degreeToFrequency(degree, scale) {
        const octave = Math.floor(degree / scale.length);
        const scaleDegree = ((degree % scale.length) + scale.length) % scale.length;
        const ratio = scale[scaleDegree];
        return this.rootNote * ratio * Math.pow(2, octave);
    }

    // ============== NEW CORNER BEHAVIORS ==============

    // Play an IMMEDIATE chord burst for instant feedback
    playImmediateChord(degrees, velocity = 0.8) {
        const scale = this.scales[this.currentScale] || this.scales.major;
        const now = this.ctx.currentTime;

        degrees.forEach((degree, i) => {
            const freq = this.degreeToFrequency(degree + scale.length, scale);
            const voice = this.getAvailableVoice(this.chordVoicePool);

            voice.osc.frequency.setValueAtTime(freq, now);

            // VERY LOUD, punchy attack for dramatic effect
            voice.gain.gain.cancelScheduledValues(now);
            voice.gain.gain.setValueAtTime(0, now);
            voice.gain.gain.linearRampToValueAtTime(velocity * 0.8, now + 0.01);
            voice.gain.gain.setValueAtTime(velocity * 0.6, now + 0.15);
            voice.gain.gain.linearRampToValueAtTime(0, now + 0.8);

            voice.busy = true;
            voice.releaseTime = now + 0.8;
        });
    }

    // Upper left (cell 0): More Harmony - INSTANT chord burst + arpeggio
    nudgeHarmony() {
        console.log('=== HARMONY BUTTON PRESSED ===');

        // INSTANT AUDIO FEEDBACK - play a big chord NOW
        this.playImmediateChord([0, 2, 4, 7], 0.9); // Major 7 chord

        // Mute the cell-based drone sounds
        this.fadeDownCellVoices();

        // Set up for harmonic content
        this.harmonyLevel = Math.min(1, this.harmonyLevel + 0.4);
        this.minimalismLevel = Math.max(0, this.minimalismLevel - 0.2);

        // Harmonic scales
        const harmonicScales = ['major', 'harmonic', 'dreamHouse', 'dorian'];
        this.setScale(harmonicScales[Math.floor(Math.random() * harmonicScales.length)]);

        // Generate arpeggio phrase
        this.phrasePosition = 0;
        this.currentPhrase = {
            length: 16,
            notes: [],
            chords: [],
            tintinnabuli: [],
            type: 'chordal'
        };
        this.generateChordalPhrase();

        if (this.tintinnabuliEnabled && this.currentPhrase.notes.length > 0) {
            this.generateTintinnabuliVoice();
        }

        // Medium tempo for arpeggios
        this.phraseTempo = 100 + Math.random() * 20;

        console.log('HARMONY: ' + this.currentPhrase.notes.length + ' notes, tempo=' + this.phraseTempo.toFixed(0));
    }

    // Upper right (cell 7): More Minimalist - INSTANT repeating pattern
    nudgeMinimalist() {
        console.log('=== MINIMALIST BUTTON PRESSED ===');

        // INSTANT AUDIO FEEDBACK - rapid fire notes
        const scale = this.scales[this.currentScale] || this.scales.major;
        const now = this.ctx.currentTime;

        // Play first 4 notes of pattern immediately
        [0, 2, 4, 2].forEach((degree, i) => {
            setTimeout(() => {
                const voice = this.getAvailableVoice(this.melodyVoicePool);
                const freq = this.degreeToFrequency(degree + scale.length, scale);
                voice.osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                voice.gain.gain.cancelScheduledValues(this.ctx.currentTime);
                voice.gain.gain.setValueAtTime(0, this.ctx.currentTime);
                voice.gain.gain.linearRampToValueAtTime(0.85, this.ctx.currentTime + 0.005);
                voice.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.15);
                voice.busy = true;
                voice.releaseTime = this.ctx.currentTime + 0.15;
            }, i * 100); // 100ms apart - fast!
        });

        // Mute cell sounds
        this.fadeDownCellVoices();

        this.minimalismLevel = Math.min(1, this.minimalismLevel + 0.4);
        this.harmonyLevel = Math.max(0, this.harmonyLevel - 0.2);

        // Reich-style phasing
        this.melodyVoicePool.forEach((voice, i) => {
            const detune = (i - 2) * 2;
            voice.osc.detune.setValueAtTime(detune, now);
        });

        // Generate minimalist phrase
        this.phrasePosition = 0;
        this.currentPhrase = {
            length: 8,
            notes: [],
            chords: [],
            tintinnabuli: [],
            type: 'minimalist'
        };
        this.generateMinimalistPhrase();

        if (this.tintinnabuliEnabled && this.currentPhrase.notes.length > 0) {
            this.generateTintinnabuliVoice();
        }

        // Fast, driving tempo
        this.phraseTempo = 120 + Math.random() * 40;

        console.log('MINIMALIST: ' + this.currentPhrase.notes.length + ' notes, tempo=' + this.phraseTempo.toFixed(0));
    }

    // Lower left (cell 56): Timbral Randomization - DRAMATIC instant change
    randomizeTimbre() {
        console.log('=== TIMBRE BUTTON PRESSED ===');

        const waveforms = ['sine', 'triangle', 'sawtooth', 'square'];
        const now = this.ctx.currentTime;

        // INSTANT: change all voice timbres immediately
        this.melodyVoicePool.forEach(voice => {
            voice.osc.type = waveforms[Math.floor(Math.random() * waveforms.length)];
            voice.filter.frequency.setValueAtTime(500 + Math.random() * 5000, now);
            voice.filter.Q.setValueAtTime(0.5 + Math.random() * 10, now);
        });

        this.chordVoicePool.forEach(voice => {
            voice.osc.type = waveforms[Math.floor(Math.random() * waveforms.length)];
            voice.filter.frequency.setValueAtTime(300 + Math.random() * 3000, now);
            voice.filter.Q.setValueAtTime(0.5 + Math.random() * 6, now);
        });

        this.tVoicePool.forEach(voice => {
            voice.osc.type = waveforms[Math.floor(Math.random() * 2)];
            voice.filter.frequency.setValueAtTime(1000 + Math.random() * 4000, now);
        });

        // INSTANT AUDIO FEEDBACK - play the current phrase note with new timbre
        const scale = this.scales[this.currentScale] || this.scales.major;
        const testDegrees = [0, 4, 7]; // Root, 5th, octave - demonstrates timbre
        testDegrees.forEach((degree, i) => {
            setTimeout(() => {
                const voice = this.getAvailableVoice(this.melodyVoicePool);
                const freq = this.degreeToFrequency(degree + scale.length, scale);
                voice.osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                voice.gain.gain.cancelScheduledValues(this.ctx.currentTime);
                voice.gain.gain.setValueAtTime(0, this.ctx.currentTime);
                voice.gain.gain.linearRampToValueAtTime(0.8, this.ctx.currentTime + 0.01);
                voice.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
                voice.busy = true;
                voice.releaseTime = this.ctx.currentTime + 0.3;
            }, i * 80);
        });

        // Randomize global parameters
        this.currentWaveformBias = Math.random();
        this.globalFilterCutoff = 0.1 + Math.random() * 0.8;
        this.globalFilterResonance = Math.random() * 0.7;
        this.globalFMDepth = Math.random() * 0.6;
        this.globalDistortion = Math.random() * 0.4;

        // Apply to cell voices
        this.applyGlobalFilter();
        this.applyGlobalFM();
        this.applyGlobalDistortion();

        // Dramatic reverb change
        if (this.reverbSend) {
            this.reverbSend.gain.setValueAtTime(0.05 + Math.random() * 0.5, now);
        }

        // Random tempo shift
        this.phraseTempo = 60 + Math.random() * 100;

        // Immediately play a note burst to demonstrate new timbre
        this.playNotesAtBeat(this.phrasePosition);

        console.log('TIMBRE: waveformBias=' + this.currentWaveformBias.toFixed(2) +
                    ', filter=' + this.globalFilterCutoff.toFixed(2) +
                    ', tempo=' + this.phraseTempo.toFixed(0));
    }

    // Fade down cell-based voices to make phrase voices more prominent
    fadeDownCellVoices() {
        const now = this.ctx.currentTime;

        // Fade down all active cell voices
        this.cells.forEach((cell, i) => {
            if (cell && cell.node && cell.gain) {
                cell.gain.gain.setTargetAtTime(
                    cell.gain.gain.value * 0.3, // Reduce to 30%
                    now, 0.2
                );
            }
        });

        // Reduce overall cell activity
        this.krellDensity = Math.max(0.05, this.krellDensity * 0.5);

        console.log('Cell voices faded down, krellDensity=' + this.krellDensity.toFixed(3));
    }

    // Update all cell voices based on droneEnabled state
    updateDroneState() {
        const now = this.ctx.currentTime;
        const targetGain = this.droneEnabled ? 0.1 : 0;
        const fadeTime = 0.5; // Smooth transition

        this.cells.forEach((cell, i) => {
            if (cell && cell.params && cell.params.gain) {
                cell.params.gain.setTargetAtTime(targetGain, now, fadeTime);
            }
            // Also handle partial gains for drone voices
            if (cell && cell.partialGains) {
                cell.partialGains.forEach(g => {
                    try {
                        g.gain.setTargetAtTime(this.droneEnabled ? 0.05 : 0, now, fadeTime);
                    } catch (e) {}
                });
            }
        });

        console.log('Drone state: ' + (this.droneEnabled ? 'ON' : 'OFF'));
    }

    // Kill all drone voices immediately
    killDrone() {
        const now = this.ctx.currentTime;

        // Disable drone mode
        this.droneEnabled = false;

        // Immediately silence all cell voices
        this.cells.forEach((cell, i) => {
            if (cell && cell.params && cell.params.gain) {
                cell.params.gain.cancelScheduledValues(now);
                cell.params.gain.setTargetAtTime(0, now, 0.05); // Fast fade
            }
            if (cell && cell.partialGains) {
                cell.partialGains.forEach(g => {
                    try {
                        g.gain.cancelScheduledValues(now);
                        g.gain.setTargetAtTime(0, now, 0.05);
                    } catch (e) {}
                });
            }
        });

        // Also reduce Krell activity
        this.krellDensity = Math.max(0.01, this.krellDensity * 0.3);

        console.log('ANTI-DRONE: All drone voices killed');
    }

    // Set root note from semitones (0-11, where 0 = C)
    setRootSemitones(semitones) {
        // C4 = 261.63 Hz, we use lower octave
        // A = 55 Hz (A1), C is 3 semitones up from A
        const cFreq = 55 * Math.pow(2, 3/12); // C2 ~65.4 Hz
        this.rootNote = cFreq * Math.pow(2, semitones / 12);
        this.currentRoot = semitones;

        // Update quantizer with new root
        this.updateQuantizerScale();
    }

    // Toggle a cell and return new state
    toggleCell(index) {
        if (this.cells[index]) {
            this.deactivateCell(index);
            return false;
        } else {
            this.activateCell(index);
            return true;
        }
    }

    // ============== PITCH QUANTIZER SYSTEM ==============

    // Update the pitch quantizer worklet with current scale ratios
    updateQuantizerScale() {
        if (this.pitchQuantizer && this.scales[this.currentScale]) {
            const ratios = this.scales[this.currentScale];
            this.pitchQuantizer.port.postMessage({
                type: 'setScale',
                ratios: ratios
            });
            // Also update root note
            this.pitchQuantizer.parameters.get('root').value = this.rootNote;
        }
    }

    // Quantize any frequency to the nearest scale degree
    // This is a CPU-side quantization for direct frequency assignments
    quantizeFrequency(inputFreq) {
        const scale = this.scales[this.currentScale] || this.scales.major;
        const rootFreq = this.rootNote;

        if (inputFreq <= 0 || !isFinite(inputFreq)) return rootFreq;

        // Find how many octaves above the root
        const ratio = inputFreq / rootFreq;
        if (ratio <= 0) return rootFreq;

        // Get octave and position within octave
        const octave = Math.floor(Math.log2(ratio));
        const octaveMultiplier = Math.pow(2, octave);
        const positionInOctave = ratio / octaveMultiplier; // 1.0 to 2.0

        // Find nearest scale degree
        let closestRatio = 1;
        let minDistance = Infinity;

        // Check current octave's degrees
        for (const scaleRatio of scale) {
            const distance = Math.abs(Math.log2(positionInOctave) - Math.log2(scaleRatio));
            if (distance < minDistance) {
                minDistance = distance;
                closestRatio = scaleRatio;
            }
        }

        // Also check the octave above (first degree = 2.0)
        const octaveUpDistance = Math.abs(Math.log2(positionInOctave) - Math.log2(2));
        if (octaveUpDistance < minDistance) {
            closestRatio = 2;
        }

        // Also check octave below (last degree of previous octave)
        if (scale.length > 0) {
            const lastRatio = scale[scale.length - 1];
            const octaveDownDistance = Math.abs(Math.log2(positionInOctave) - Math.log2(lastRatio / 2));
            if (octaveDownDistance < minDistance && positionInOctave < 1.1) {
                closestRatio = lastRatio / 2;
            }
        }

        return rootFreq * octaveMultiplier * closestRatio;
    }

    // Quantize frequency and set it on an oscillator or AudioParam
    setQuantizedFrequency(param, freq, timeConstant = 0.003) {
        const quantizedFreq = this.quantizeFrequency(freq);
        if (param.setTargetAtTime) {
            param.setTargetAtTime(quantizedFreq, this.ctx.currentTime, timeConstant);
        } else {
            param.value = quantizedFreq;
        }
        return quantizedFreq;
    }
}

window.PatchUnknown = PatchUnknown;
