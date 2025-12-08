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
            pentatonic: [1/1, 9/8, 5/4, 3/2, 5/3]
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

        // Spectral analyzer for self-listening
        this.analyser = null;
        this.spectralData = null;
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

        this.masterGain.connect(this.saturation);
        this.saturation.connect(this.analyser);
        this.analyser.connect(this.limiter);
        this.limiter.connect(this.ctx.destination);

        const reverbSend = this.ctx.createGain();
        reverbSend.gain.value = 0.25;
        this.masterGain.connect(reverbSend);
        reverbSend.connect(this.reverb);
        this.reverb.connect(this.limiter);

        // Load AudioWorklets
        try {
            await this.ctx.audioWorklet.addModule('worklets/processors.js');
            this.workletReady = true;
        } catch (e) {
            console.log('Worklets not available, using fallback');
            this.workletReady = false;
        }

        // Initialize with random patch
        this.randomize();
        this.isRunning = true;

        // Start Krell autonomous behavior
        this.startKrell();

        // Start glacial drift
        this.startDrift();

        // Start spectral listening
        this.startListening();

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
            () => this.krellModulate(),      // Modulate existing cells
            () => this.krellToggle(),        // Toggle a cell
            () => this.krellDrift(),         // Drift frequencies
            () => this.krellPhase(),         // Adjust phase relationships
            () => this.krellDecay(),         // Apply decay to a cell
            () => this.krellHarmonicShift(), // Shift to related harmonic
        ];

        // Weight toward modulation and drift (subtle changes)
        const weights = [0.3, 0.15, 0.25, 0.1, 0.1, 0.1];
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
        const osc = this.ctx.createOscillator();
        // Favor pure waveforms (sine, triangle) for spectral clarity
        osc.type = ['sine', 'triangle', 'sine', 'sine'][Math.floor(Math.random() * 4)];
        osc.frequency.value = this.getMusicalFrequency();
        const gain = this.ctx.createGain();
        gain.gain.value = 0.1;
        osc.connect(gain);
        osc.start();
        return { node: gain, osc, category: 'osc', params: { freq: osc.frequency, gain: gain.gain } };
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

        // Remember for Basinski-style memory
        this.loopMemory.set(index, {
            activated: this.ctx.currentTime,
            initialGain: module.params?.gain?.value || 0.1
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
            this.currentScale = melodicScales[Math.floor(Math.random() * melodicScales.length)];
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
        this.currentScale = consonantScales[Math.floor(Math.random() * consonantScales.length)];

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
    randomize() {
        // Clear everything gracefully
        this.cells.forEach((_, i) => {
            if (this.cells[i]) {
                this.deactivateCell(i);
            }
        });

        // Pick new scale
        const scaleNames = Object.keys(this.scales);
        this.currentScale = scaleNames[Math.floor(Math.random() * scaleNames.length)];

        // Random root in low register (27.5 to 110 Hz)
        this.rootNote = 27.5 * Math.pow(2, Math.random() * 2);

        // Reset Krell parameters
        this.krellEventRate = 4000 + Math.random() * 8000;
        this.krellDensity = 0.2 + Math.random() * 0.3;
        this.driftAmount = 0.0001 + Math.random() * 0.0004;

        // Activate random cells (sparse to start - let Krell build up)
        const numCells = 3 + Math.floor(Math.random() * 5);
        const cellIndices = Array.from({ length: 64 }, (_, i) => i)
            .filter(i => i !== 7 && i !== 63) // Skip special cells
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
                const emptyIndex = this.cells.findIndex(c => c === null);
                if (emptyIndex !== -1 && emptyIndex !== 7 && emptyIndex !== 63) {
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
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
            this.startKrell();
        }
    }
}

window.PatchUnknown = PatchUnknown;
