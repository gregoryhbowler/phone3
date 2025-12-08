// MODULE DEFINITIONS
// Hundreds of module types for the modular synth
// Each module has: name, category, create(ctx, params), connect(source), disconnect(), process(input)
// Inspired by: Buchla, Serge, Ciani, Barbieri, Reich, Radigue, Basinski, Autechre

const MODULE_TYPES = {
    // ==========================================
    // OSCILLATORS (Sound Sources)
    // ==========================================

    // Basic oscillators - pure waveforms
    sineOsc: {
        category: 'osc',
        create: (ctx) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = 110 + Math.random() * 330;
            const gain = ctx.createGain();
            gain.gain.value = 0.3;
            osc.connect(gain);
            osc.start();
            return { node: gain, osc, params: { freq: osc.frequency, gain: gain.gain } };
        }
    },

    sawOsc: {
        category: 'osc',
        create: (ctx) => {
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = 55 + Math.random() * 220;
            const gain = ctx.createGain();
            gain.gain.value = 0.2;
            osc.connect(gain);
            osc.start();
            return { node: gain, osc, params: { freq: osc.frequency, gain: gain.gain } };
        }
    },

    squareOsc: {
        category: 'osc',
        create: (ctx) => {
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = 82.5 + Math.random() * 165;
            const gain = ctx.createGain();
            gain.gain.value = 0.15;
            osc.connect(gain);
            osc.start();
            return { node: gain, osc, params: { freq: osc.frequency, gain: gain.gain } };
        }
    },

    triangleOsc: {
        category: 'osc',
        create: (ctx) => {
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = 220 + Math.random() * 440;
            const gain = ctx.createGain();
            gain.gain.value = 0.35;
            osc.connect(gain);
            osc.start();
            return { node: gain, osc, params: { freq: osc.frequency, gain: gain.gain } };
        }
    },

    // SPECTRAL OSCILLATORS (Caterina Barbieri, Kali Malone inspired)
    // Harmonic series oscillator - pure partials
    harmonicOsc: {
        category: 'osc',
        create: (ctx) => {
            const out = ctx.createGain();
            out.gain.value = 0.15;
            const oscs = [];
            const baseFreq = 55 + Math.random() * 55; // Low fundamental

            // First 8 harmonics with decreasing amplitude
            for (let h = 1; h <= 8; h++) {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = baseFreq * h;
                const g = ctx.createGain();
                // 1/h amplitude weighting (Fourier-like)
                g.gain.value = 0.4 / h;
                osc.connect(g);
                g.connect(out);
                osc.start();
                oscs.push({ osc, gain: g });
            }

            return { node: out, oscs, params: { gain: out.gain } };
        }
    },

    // Odd harmonics only (hollow, clarinet-like)
    oddHarmonicOsc: {
        category: 'osc',
        create: (ctx) => {
            const out = ctx.createGain();
            out.gain.value = 0.18;
            const oscs = [];
            const baseFreq = 82.5 + Math.random() * 82.5;

            // Odd harmonics: 1, 3, 5, 7, 9, 11
            [1, 3, 5, 7, 9, 11].forEach((h, i) => {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = baseFreq * h;
                const g = ctx.createGain();
                g.gain.value = 0.3 / h;
                osc.connect(g);
                g.connect(out);
                osc.start();
                oscs.push({ osc, gain: g });
            });

            return { node: out, oscs, params: { gain: out.gain } };
        }
    },

    // Perfect intervals oscillator (fifths, fourths - Riley/Young)
    perfectOsc: {
        category: 'osc',
        create: (ctx) => {
            const out = ctx.createGain();
            out.gain.value = 0.2;
            const oscs = [];
            const baseFreq = 55 + Math.random() * 55;

            // Stack of perfect fifths (3/2 ratio)
            const ratios = [1, 3/2, 9/4, 27/8].map(r => r > 2 ? r / 2 : r);
            ratios.forEach((ratio, i) => {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = baseFreq * ratio * (i < 2 ? 1 : 2);
                const g = ctx.createGain();
                g.gain.value = 0.2;
                osc.connect(g);
                g.connect(out);
                osc.start();
                oscs.push({ osc, gain: g });
            });

            return { node: out, oscs, params: { gain: out.gain } };
        }
    },

    // Reich-style phasing pair
    phasingPair: {
        category: 'osc',
        create: (ctx) => {
            const out = ctx.createGain();
            out.gain.value = 0.25;
            const baseFreq = 220 + Math.random() * 220;

            // Two oscillators, very slightly detuned
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            osc1.type = osc2.type = 'sine';
            osc1.frequency.value = baseFreq;
            // Tiny detune creates slow beating (Reich technique)
            osc2.frequency.value = baseFreq * 1.001; // ~2 cents sharp

            const g1 = ctx.createGain();
            const g2 = ctx.createGain();
            g1.gain.value = g2.gain.value = 0.5;

            // Pan slightly for stereo effect
            const pan1 = ctx.createStereoPanner();
            const pan2 = ctx.createStereoPanner();
            pan1.pan.value = -0.3;
            pan2.pan.value = 0.3;

            osc1.connect(g1);
            osc2.connect(g2);
            g1.connect(pan1);
            g2.connect(pan2);
            pan1.connect(out);
            pan2.connect(out);

            osc1.start();
            osc2.start();

            return { node: out, osc: osc1, osc2, params: { freq: osc1.frequency, gain: out.gain } };
        }
    },

    // Drone oscillator (Radigue-style - very slow movement)
    droneOsc: {
        category: 'osc',
        create: (ctx) => {
            const out = ctx.createGain();
            out.gain.value = 0.3;
            const baseFreq = 55; // Fixed low drone

            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = baseFreq;

            // Add very slow vibrato (barely perceptible)
            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.05; // One cycle per 20 seconds
            const lfoGain = ctx.createGain();
            lfoGain.gain.value = 0.5; // +/- 0.5 Hz

            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);

            osc.connect(out);
            osc.start();
            lfo.start();

            return { node: out, osc, lfo, params: { freq: osc.frequency, gain: out.gain } };
        }
    },

    // Bell/inharmonic (Risset-style)
    bellOsc: {
        category: 'osc',
        create: (ctx) => {
            const out = ctx.createGain();
            out.gain.value = 0.12;
            const oscs = [];
            const baseFreq = 200 + Math.random() * 200;
            // Inharmonic ratios for bell-like tones
            const ratios = [1, 2.0, 3.0, 4.2, 5.4, 6.8, 8.1];

            ratios.forEach((ratio, i) => {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = baseFreq * ratio;
                const g = ctx.createGain();
                g.gain.value = 0.2 / (i + 1);
                osc.connect(g);
                g.connect(out);
                osc.start();
                oscs.push(osc);
            });

            return { node: out, oscs, params: { gain: out.gain } };
        }
    },

    // Complex oscillators
    pulseOsc: {
        category: 'osc',
        create: (ctx) => {
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            osc1.type = 'sawtooth';
            osc2.type = 'sawtooth';
            const freq = 110 + Math.random() * 220;
            osc1.frequency.value = freq;
            osc2.frequency.value = freq;
            const inv = ctx.createGain();
            inv.gain.value = -1;
            const out = ctx.createGain();
            out.gain.value = 0.2;
            osc1.connect(out);
            osc2.connect(inv);
            inv.connect(out);
            osc1.start();
            osc2.start();
            return { node: out, osc: osc1, osc2, params: { freq: osc1.frequency, freq2: osc2.frequency } };
        }
    },

    superSaw: {
        category: 'osc',
        create: (ctx) => {
            const out = ctx.createGain();
            out.gain.value = 0.1;
            const oscs = [];
            const baseFreq = 110 + Math.random() * 110;
            for (let i = 0; i < 5; i++) {
                const osc = ctx.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.value = baseFreq * (1 + (i - 2) * 0.01 * Math.random());
                osc.connect(out);
                osc.start();
                oscs.push(osc);
            }
            return { node: out, oscs, params: { gain: out.gain } };
        }
    },

    noiseWhite: {
        category: 'osc',
        create: (ctx) => {
            const bufferSize = ctx.sampleRate * 2;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            noise.loop = true;
            const gain = ctx.createGain();
            gain.gain.value = 0.1; // Reduced for subtlety
            noise.connect(gain);
            noise.start();
            return { node: gain, source: noise, params: { gain: gain.gain } };
        }
    },

    noisePink: {
        category: 'osc',
        create: (ctx) => {
            const bufferSize = ctx.sampleRate * 2;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
                b6 = white * 0.115926;
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            noise.loop = true;
            const gain = ctx.createGain();
            gain.gain.value = 0.12;
            noise.connect(gain);
            noise.start();
            return { node: gain, source: noise, params: { gain: gain.gain } };
        }
    },

    noiseBrown: {
        category: 'osc',
        create: (ctx) => {
            const bufferSize = ctx.sampleRate * 2;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            let lastOut = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                data[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = data[i];
                data[i] *= 3.5;
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            noise.loop = true;
            const gain = ctx.createGain();
            gain.gain.value = 0.15;
            noise.connect(gain);
            noise.start();
            return { node: gain, source: noise, params: { gain: gain.gain } };
        }
    },

    // Rungler-inspired chaos oscillator
    chaosOsc: {
        category: 'osc',
        create: (ctx) => {
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            osc1.type = 'sawtooth';
            osc2.type = 'square';
            osc1.frequency.value = 37 + Math.random() * 100;
            osc2.frequency.value = 41 + Math.random() * 100;

            const gain1 = ctx.createGain();
            const gain2 = ctx.createGain();
            gain1.gain.value = 150; // Reduced cross-mod
            gain2.gain.value = 100;

            osc1.connect(gain1);
            osc2.connect(gain2);
            gain1.connect(osc2.frequency);
            gain2.connect(osc1.frequency);

            const out = ctx.createGain();
            out.gain.value = 0.12;
            osc1.connect(out);
            osc2.connect(out);

            osc1.start();
            osc2.start();

            return { node: out, osc: osc1, osc2, params: { freq: osc1.frequency, freq2: osc2.frequency } };
        }
    },

    // FM oscillator pair
    fmOsc: {
        category: 'osc',
        create: (ctx) => {
            const carrier = ctx.createOscillator();
            const modulator = ctx.createOscillator();
            const modGain = ctx.createGain();

            carrier.type = 'sine';
            modulator.type = 'sine';

            const ratio = [1, 2, 3, 4, 5, 7][Math.floor(Math.random() * 6)];
            const baseFreq = 110 + Math.random() * 220;

            carrier.frequency.value = baseFreq;
            modulator.frequency.value = baseFreq * ratio;
            modGain.gain.value = baseFreq * (0.5 + Math.random() * 2);

            modulator.connect(modGain);
            modGain.connect(carrier.frequency);

            const out = ctx.createGain();
            out.gain.value = 0.2;
            carrier.connect(out);

            carrier.start();
            modulator.start();

            return { node: out, osc: carrier, modulator, params: { freq: carrier.frequency, modFreq: modulator.frequency, modDepth: modGain.gain } };
        }
    },

    // Additive harmonics
    additiveOsc: {
        category: 'osc',
        create: (ctx) => {
            const out = ctx.createGain();
            out.gain.value = 0.15;
            const oscs = [];
            const baseFreq = 55 + Math.random() * 110;

            for (let i = 1; i <= 8; i++) {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = baseFreq * i;
                const g = ctx.createGain();
                g.gain.value = (Math.random() * 0.5) / i;
                osc.connect(g);
                g.connect(out);
                osc.start();
                oscs.push({ osc, gain: g });
            }

            return { node: out, oscs, params: { gain: out.gain } };
        }
    },

    // Sub oscillator
    subOsc: {
        category: 'osc',
        create: (ctx) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = 27.5 + Math.random() * 55;
            const gain = ctx.createGain();
            gain.gain.value = 0.35;
            osc.connect(gain);
            osc.start();
            return { node: gain, osc, params: { freq: osc.frequency, gain: gain.gain } };
        }
    },

    // Metallic oscillator (inharmonic)
    metallicOsc: {
        category: 'osc',
        create: (ctx) => {
            const out = ctx.createGain();
            out.gain.value = 0.1;
            const oscs = [];
            const baseFreq = 100 + Math.random() * 200;
            const ratios = [1, 1.4, 2.8, 3.5, 5.9, 6.7];

            ratios.forEach(ratio => {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = baseFreq * ratio;
                const g = ctx.createGain();
                g.gain.value = 0.15 / ratio;
                osc.connect(g);
                g.connect(out);
                osc.start();
                oscs.push(osc);
            });

            return { node: out, oscs, params: { gain: out.gain } };
        }
    },

    // Formant oscillator (vowel-like) - Butterworth Q for stability
    formantOsc: {
        category: 'osc',
        create: (ctx) => {
            const source = ctx.createOscillator();
            source.type = 'sawtooth';
            source.frequency.value = 110 + Math.random() * 110;

            const f1a = ctx.createBiquadFilter();
            const f1b = ctx.createBiquadFilter();
            const f2a = ctx.createBiquadFilter();
            const f2b = ctx.createBiquadFilter();
            f1a.type = f1b.type = f2a.type = f2b.type = 'bandpass';

            const freq1 = 500 + Math.random() * 300;
            const freq2 = 1400 + Math.random() * 600;
            f1a.frequency.value = f1b.frequency.value = freq1;
            f2a.frequency.value = f2b.frequency.value = freq2;
            f1a.Q.value = f1b.Q.value = f2a.Q.value = f2b.Q.value = 0.707;

            const out = ctx.createGain();
            out.gain.value = 0.35;

            source.connect(f1a);
            source.connect(f2a);
            f1a.connect(f1b);
            f2a.connect(f2b);
            f1b.connect(out);
            f2b.connect(out);
            source.start();

            return { node: out, osc: source, filters: [f1a, f2a], params: { freq: source.frequency, gain: out.gain } };
        }
    },

    // ==========================================
    // MODULATORS (LFOs, Envelopes, etc.)
    // ==========================================

    // Glacial LFO (Radigue-style - extremely slow)
    lfoGlacial: {
        category: 'mod',
        create: (ctx) => {
            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.01 + Math.random() * 0.05; // 20-100 second cycle
            const gain = ctx.createGain();
            gain.gain.value = 20;
            lfo.connect(gain);
            lfo.start();
            return { node: gain, osc: lfo, params: { freq: lfo.frequency, depth: gain.gain }, isModulator: true };
        }
    },

    lfoSine: {
        category: 'mod',
        create: (ctx) => {
            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.1 + Math.random() * 3;
            const gain = ctx.createGain();
            gain.gain.value = 30;
            lfo.connect(gain);
            lfo.start();
            return { node: gain, osc: lfo, params: { freq: lfo.frequency, depth: gain.gain }, isModulator: true };
        }
    },

    lfoSquare: {
        category: 'mod',
        create: (ctx) => {
            const lfo = ctx.createOscillator();
            lfo.type = 'square';
            lfo.frequency.value = 0.5 + Math.random() * 3;
            const gain = ctx.createGain();
            gain.gain.value = 20;
            lfo.connect(gain);
            lfo.start();
            return { node: gain, osc: lfo, params: { freq: lfo.frequency, depth: gain.gain }, isModulator: true };
        }
    },

    lfoSaw: {
        category: 'mod',
        create: (ctx) => {
            const lfo = ctx.createOscillator();
            lfo.type = 'sawtooth';
            lfo.frequency.value = 0.2 + Math.random() * 1.5;
            const gain = ctx.createGain();
            gain.gain.value = 25;
            lfo.connect(gain);
            lfo.start();
            return { node: gain, osc: lfo, params: { freq: lfo.frequency, depth: gain.gain }, isModulator: true };
        }
    },

    lfoRandom: {
        category: 'mod',
        create: (ctx) => {
            const bufferSize = 256;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.playbackRate.value = 0.5 + Math.random() * 1.5;
            const gain = ctx.createGain();
            gain.gain.value = 30;
            source.connect(gain);
            source.start();
            return { node: gain, source, params: { rate: source.playbackRate, depth: gain.gain }, isModulator: true };
        }
    },

    lfoSmooth: {
        category: 'mod',
        create: (ctx) => {
            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.05 + Math.random() * 0.3;
            const gain = ctx.createGain();
            gain.gain.value = 50;
            lfo.connect(gain);
            lfo.start();
            return { node: gain, osc: lfo, params: { freq: lfo.frequency, depth: gain.gain }, isModulator: true };
        }
    },

    lfoFast: {
        category: 'mod',
        create: (ctx) => {
            const lfo = ctx.createOscillator();
            lfo.type = 'triangle';
            lfo.frequency.value = 6 + Math.random() * 12;
            const gain = ctx.createGain();
            gain.gain.value = 15;
            lfo.connect(gain);
            lfo.start();
            return { node: gain, osc: lfo, params: { freq: lfo.frequency, depth: gain.gain }, isModulator: true };
        }
    },

    // Chaotic LFO (Lorenz-inspired)
    lfosChaotic: {
        category: 'mod',
        create: (ctx) => {
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            osc1.type = 'sine';
            osc2.type = 'sine';
            osc1.frequency.value = 0.2;
            osc2.frequency.value = 0.27;

            const mod1 = ctx.createGain();
            const mod2 = ctx.createGain();
            mod1.gain.value = 0.3;
            mod2.gain.value = 0.4;

            osc1.connect(mod1);
            osc2.connect(mod2);
            mod1.connect(osc2.frequency);
            mod2.connect(osc1.frequency);

            const out = ctx.createGain();
            out.gain.value = 30;
            osc1.connect(out);

            osc1.start();
            osc2.start();

            return { node: out, osc: osc1, osc2, params: { depth: out.gain }, isModulator: true };
        }
    },

    // Stepped random (S&H)
    sampleHold: {
        category: 'mod',
        create: (ctx) => {
            const steps = 16;
            const buffer = ctx.createBuffer(1, steps, ctx.sampleRate / 1000);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < steps; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.playbackRate.value = 2 + Math.random() * 5;
            const gain = ctx.createGain();
            gain.gain.value = 40;
            source.connect(gain);
            source.start();
            return { node: gain, source, params: { rate: source.playbackRate, depth: gain.gain }, isModulator: true };
        }
    },

    // Envelope follower simulation - Butterworth smoothing
    envelopeFollower: {
        category: 'mod',
        create: (ctx) => {
            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 1 + Math.random() * 2;

            const abs = ctx.createWaveShaper();
            const curve = new Float32Array(256);
            for (let i = 0; i < 256; i++) {
                curve[i] = Math.abs((i - 128) / 128);
            }
            abs.curve = curve;

            const smooth = ctx.createBiquadFilter();
            smooth.type = 'lowpass';
            smooth.frequency.value = 10;
            smooth.Q.value = 0.707;

            const gain = ctx.createGain();
            gain.gain.value = 30;

            lfo.connect(abs);
            abs.connect(smooth);
            smooth.connect(gain);
            lfo.start();

            return { node: gain, osc: lfo, params: { freq: lfo.frequency, depth: gain.gain }, isModulator: true };
        }
    },

    // ==========================================
    // EFFECTS (Filters, Delays, etc.)
    // ==========================================

    // TAPE DEGRADATION (Basinski-style)
    tapeWobble: {
        category: 'fx',
        create: (ctx) => {
            // Subtle pitch wobble (wow and flutter)
            const delay = ctx.createDelay(0.1);
            delay.delayTime.value = 0.02;

            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.3 + Math.random() * 0.5; // Wow

            const lfo2 = ctx.createOscillator();
            lfo2.type = 'sine';
            lfo2.frequency.value = 6 + Math.random() * 4; // Flutter

            const lfoGain = ctx.createGain();
            lfoGain.gain.value = 0.001; // Very subtle

            const lfo2Gain = ctx.createGain();
            lfo2Gain.gain.value = 0.0002; // Even more subtle flutter

            lfo.connect(lfoGain);
            lfo2.connect(lfo2Gain);
            lfoGain.connect(delay.delayTime);
            lfo2Gain.connect(delay.delayTime);

            lfo.start();
            lfo2.start();

            return { node: delay, lfo, lfo2, params: { time: delay.delayTime } };
        }
    },

    // High-frequency loss (tape aging)
    tapeLoss: {
        category: 'fx',
        create: (ctx) => {
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 4000 + Math.random() * 4000; // Variable degradation
            filter.Q.value = 0.5;

            // Slight high shelf cut
            const shelf = ctx.createBiquadFilter();
            shelf.type = 'highshelf';
            shelf.frequency.value = 3000;
            shelf.gain.value = -3 - Math.random() * 6; // -3 to -9dB

            filter.connect(shelf);

            return { node: filter, output: shelf, params: {} };
        }
    },

    filterLP: {
        category: 'fx',
        create: (ctx) => {
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            const baseFreq = 800 + Math.random() * 1500;
            filter.frequency.value = baseFreq;
            filter.Q.value = 0.707;

            const modScale = ctx.createGain();
            modScale.gain.value = 200;
            modScale.connect(filter.frequency);

            return { node: filter, modInput: modScale, params: { modDepth: modScale.gain } };
        }
    },

    filterHP: {
        category: 'fx',
        create: (ctx) => {
            const filter = ctx.createBiquadFilter();
            filter.type = 'highpass';
            const baseFreq = 150 + Math.random() * 350;
            filter.frequency.value = baseFreq;
            filter.Q.value = 0.707;

            const modScale = ctx.createGain();
            modScale.gain.value = 100;
            modScale.connect(filter.frequency);

            return { node: filter, modInput: modScale, params: { modDepth: modScale.gain } };
        }
    },

    filterBP: {
        category: 'fx',
        create: (ctx) => {
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            const baseFreq = 500 + Math.random() * 1200;
            filter.frequency.value = baseFreq;
            filter.Q.value = 1;

            const modScale = ctx.createGain();
            modScale.gain.value = 300;
            modScale.connect(filter.frequency);

            return { node: filter, modInput: modScale, params: { modDepth: modScale.gain } };
        }
    },

    filterNotch: {
        category: 'fx',
        create: (ctx) => {
            const filter = ctx.createBiquadFilter();
            filter.type = 'notch';
            const baseFreq = 700 + Math.random() * 1000;
            filter.frequency.value = baseFreq;
            filter.Q.value = 1;

            const modScale = ctx.createGain();
            modScale.gain.value = 200;
            modScale.connect(filter.frequency);

            return { node: filter, modInput: modScale, params: { modDepth: modScale.gain } };
        }
    },

    filterPeak: {
        category: 'fx',
        create: (ctx) => {
            const filter = ctx.createBiquadFilter();
            filter.type = 'peaking';
            const baseFreq = 900 + Math.random() * 1200;
            filter.frequency.value = baseFreq;
            filter.Q.value = 0.707;
            filter.gain.value = 3 + Math.random() * 4;

            const modScale = ctx.createGain();
            modScale.gain.value = 250;
            modScale.connect(filter.frequency);

            return { node: filter, modInput: modScale, params: { modDepth: modScale.gain } };
        }
    },

    filterResonant: {
        category: 'fx',
        create: (ctx) => {
            const filter1 = ctx.createBiquadFilter();
            const filter2 = ctx.createBiquadFilter();
            filter1.type = 'lowpass';
            filter2.type = 'lowpass';
            const baseFreq = 600 + Math.random() * 1000;
            filter1.frequency.value = baseFreq;
            filter2.frequency.value = baseFreq;
            filter1.Q.value = 0.707;
            filter2.Q.value = 0.707;

            filter1.connect(filter2);

            const modScale = ctx.createGain();
            modScale.gain.value = 400;
            modScale.connect(filter1.frequency);
            modScale.connect(filter2.frequency);

            return { node: filter1, output: filter2, modInput: modScale, params: { modDepth: modScale.gain } };
        }
    },

    filterSVF: {
        category: 'fx',
        create: (ctx) => {
            const lp = ctx.createBiquadFilter();
            const hp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            hp.type = 'highpass';
            const baseFreq = 700 + Math.random() * 1100;
            lp.frequency.value = baseFreq;
            hp.frequency.value = baseFreq * 0.7;
            lp.Q.value = 0.707;
            hp.Q.value = 0.707;

            const mix = ctx.createGain();
            mix.gain.value = 1;

            hp.connect(lp);
            lp.connect(mix);

            const modScale = ctx.createGain();
            modScale.gain.value = 300;
            modScale.connect(lp.frequency);
            modScale.connect(hp.frequency);

            return { node: hp, output: mix, modInput: modScale, params: { modDepth: modScale.gain } };
        }
    },

    combFilter: {
        category: 'fx',
        create: (ctx) => {
            const delay = ctx.createDelay(0.1);
            delay.delayTime.value = 0.001 + Math.random() * 0.01;
            const feedback = ctx.createGain();
            feedback.gain.value = 0.7 + Math.random() * 0.25;
            const mix = ctx.createGain();
            mix.gain.value = 1;

            delay.connect(feedback);
            feedback.connect(delay);
            delay.connect(mix);

            return { node: delay, output: mix, params: { time: delay.delayTime, feedback: feedback.gain } };
        }
    },

    allpassFilter: {
        category: 'fx',
        create: (ctx) => {
            const filter = ctx.createBiquadFilter();
            filter.type = 'allpass';
            const baseFreq = 700 + Math.random() * 1400;
            filter.frequency.value = baseFreq;
            filter.Q.value = 0.707;

            const modScale = ctx.createGain();
            modScale.gain.value = 250;
            modScale.connect(filter.frequency);

            return { node: filter, modInput: modScale, params: { modDepth: modScale.gain } };
        }
    },

    // Delay (longer for ambient work)
    delayShort: {
        category: 'fx',
        create: (ctx) => {
            const delay = ctx.createDelay(1);
            delay.delayTime.value = 0.1 + Math.random() * 0.3;
            const feedback = ctx.createGain();
            feedback.gain.value = 0.35 + Math.random() * 0.35;
            const mix = ctx.createGain();
            mix.gain.value = 0.6;

            delay.connect(feedback);
            feedback.connect(delay);
            delay.connect(mix);

            return { node: delay, output: mix, params: { time: delay.delayTime, feedback: feedback.gain } };
        }
    },

    delayLong: {
        category: 'fx',
        create: (ctx) => {
            const delay = ctx.createDelay(4); // Longer max
            delay.delayTime.value = 0.5 + Math.random() * 1.5;
            const feedback = ctx.createGain();
            feedback.gain.value = 0.5 + Math.random() * 0.3;

            // Filter in feedback for tape-like degradation
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 3000;
            filter.Q.value = 0.5;

            const mix = ctx.createGain();
            mix.gain.value = 0.4;

            delay.connect(filter);
            filter.connect(feedback);
            feedback.connect(delay);
            delay.connect(mix);

            return { node: delay, output: mix, params: { time: delay.delayTime, feedback: feedback.gain } };
        }
    },

    delayPingPong: {
        category: 'fx',
        create: (ctx) => {
            const delay1 = ctx.createDelay(1);
            const delay2 = ctx.createDelay(1);
            delay1.delayTime.value = 0.15 + Math.random() * 0.2;
            delay2.delayTime.value = 0.2 + Math.random() * 0.3;

            const fb = ctx.createGain();
            fb.gain.value = 0.4;

            const mix = ctx.createGain();
            mix.gain.value = 0.5;

            delay1.connect(delay2);
            delay2.connect(fb);
            fb.connect(delay1);
            delay1.connect(mix);
            delay2.connect(mix);

            return { node: delay1, output: mix, params: { time: delay1.delayTime, feedback: fb.gain } };
        }
    },

    distortion: {
        category: 'fx',
        create: (ctx) => {
            const shaper = ctx.createWaveShaper();
            const amount = 10 + Math.random() * 40; // Reduced
            const curve = new Float32Array(256);
            for (let i = 0; i < 256; i++) {
                const x = (i - 128) / 128;
                curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
            }
            shaper.curve = curve;
            shaper.oversample = '2x';
            return { node: shaper, params: {} };
        }
    },

    softClip: {
        category: 'fx',
        create: (ctx) => {
            const shaper = ctx.createWaveShaper();
            const curve = new Float32Array(256);
            for (let i = 0; i < 256; i++) {
                const x = (i - 128) / 128;
                curve[i] = x / (1 + Math.abs(x));
            }
            shaper.curve = curve;
            return { node: shaper, params: {} };
        }
    },

    foldback: {
        category: 'fx',
        create: (ctx) => {
            const shaper = ctx.createWaveShaper();
            const curve = new Float32Array(256);
            const threshold = 0.3 + Math.random() * 0.4;
            for (let i = 0; i < 256; i++) {
                let x = (i - 128) / 128;
                while (Math.abs(x) > threshold) {
                    x = Math.abs(Math.abs(x) - threshold * 2) - threshold;
                }
                curve[i] = x / threshold;
            }
            shaper.curve = curve;
            return { node: shaper, params: {} };
        }
    },

    bitcrusher: {
        category: 'fx',
        create: (ctx) => {
            const shaper = ctx.createWaveShaper();
            const bits = 4 + Math.floor(Math.random() * 4); // Less extreme
            const levels = Math.pow(2, bits);
            const curve = new Float32Array(256);
            for (let i = 0; i < 256; i++) {
                const x = (i - 128) / 128;
                curve[i] = Math.round(x * levels) / levels;
            }
            shaper.curve = curve;
            return { node: shaper, params: {} };
        }
    },

    ringMod: {
        category: 'fx',
        create: (ctx) => {
            const carrier = ctx.createOscillator();
            carrier.type = 'sine';
            carrier.frequency.value = 100 + Math.random() * 500;

            const modGain = ctx.createGain();
            modGain.gain.value = 0;

            carrier.connect(modGain.gain);
            carrier.start();

            return { node: modGain, osc: carrier, params: { freq: carrier.frequency } };
        }
    },

    compressor: {
        category: 'fx',
        create: (ctx) => {
            const comp = ctx.createDynamicsCompressor();
            comp.threshold.value = -30 + Math.random() * 20;
            comp.knee.value = 10 + Math.random() * 20;
            comp.ratio.value = 4 + Math.random() * 12;
            comp.attack.value = 0.003 + Math.random() * 0.05;
            comp.release.value = 0.1 + Math.random() * 0.4;
            return { node: comp, params: { threshold: comp.threshold, ratio: comp.ratio } };
        }
    },

    convolver: {
        category: 'fx',
        create: (ctx) => {
            const conv = ctx.createConvolver();
            const length = ctx.sampleRate * (0.1 + Math.random() * 0.5); // Longer impulses
            const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
            for (let c = 0; c < 2; c++) {
                const data = buffer.getChannelData(c);
                for (let i = 0; i < length; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * 0.3));
                }
            }
            conv.buffer = buffer;

            const mix = ctx.createGain();
            mix.gain.value = 0.4;
            conv.connect(mix);

            return { node: conv, output: mix, params: {} };
        }
    },

    // ==========================================
    // SEQUENCERS & CLOCKS
    // ==========================================

    clockSlow: {
        category: 'seq',
        create: (ctx) => {
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = 0.25 + Math.random() * 0.5; // Very slow
            const gain = ctx.createGain();
            gain.gain.value = 25;
            osc.connect(gain);
            osc.start();
            return { node: gain, osc, params: { freq: osc.frequency, depth: gain.gain }, isModulator: true, isClock: true };
        }
    },

    clockFast: {
        category: 'seq',
        create: (ctx) => {
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = 2 + Math.random() * 6;
            const gain = ctx.createGain();
            gain.gain.value = 20;
            osc.connect(gain);
            osc.start();
            return { node: gain, osc, params: { freq: osc.frequency, depth: gain.gain }, isModulator: true, isClock: true };
        }
    },

    stepSeq: {
        category: 'seq',
        create: (ctx) => {
            const steps = 8;
            const buffer = ctx.createBuffer(1, steps, ctx.sampleRate / 1000);
            const data = buffer.getChannelData(0);
            // Use Just Intonation intervals
            const scale = [1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8, 2];
            for (let i = 0; i < steps; i++) {
                data[i] = (Math.log2(scale[Math.floor(Math.random() * scale.length)]));
            }
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.playbackRate.value = 1 + Math.random() * 3;
            const gain = ctx.createGain();
            gain.gain.value = 50;
            source.connect(gain);
            source.start();
            return { node: gain, source, params: { rate: source.playbackRate, depth: gain.gain }, isModulator: true };
        }
    },

    euclideanSeq: {
        category: 'seq',
        create: (ctx) => {
            const steps = 16;
            const hits = 3 + Math.floor(Math.random() * 5);
            const buffer = ctx.createBuffer(1, steps, ctx.sampleRate / 1000);
            const data = buffer.getChannelData(0);

            const pattern = [];
            let bucket = 0;
            for (let i = 0; i < steps; i++) {
                bucket += hits;
                if (bucket >= steps) {
                    bucket -= steps;
                    pattern.push(1);
                } else {
                    pattern.push(0);
                }
            }
            for (let i = 0; i < steps; i++) {
                data[i] = pattern[i];
            }

            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.playbackRate.value = 2 + Math.random() * 4;
            const gain = ctx.createGain();
            gain.gain.value = 30;
            source.connect(gain);
            source.start();
            return { node: gain, source, params: { rate: source.playbackRate, depth: gain.gain }, isModulator: true };
        }
    },

    // ==========================================
    // LOGIC & ROUTING
    // ==========================================

    mixer: {
        category: 'logic',
        create: (ctx) => {
            const gain = ctx.createGain();
            gain.gain.value = 0.5 + Math.random() * 0.5;
            return { node: gain, params: { gain: gain.gain } };
        }
    },

    attenuator: {
        category: 'logic',
        create: (ctx) => {
            const gain = ctx.createGain();
            gain.gain.value = 0.1 + Math.random() * 0.4;
            return { node: gain, params: { gain: gain.gain } };
        }
    },

    amplifier: {
        category: 'logic',
        create: (ctx) => {
            const gain = ctx.createGain();
            gain.gain.value = 1.5 + Math.random() * 2;
            return { node: gain, params: { gain: gain.gain } };
        }
    },

    inverter: {
        category: 'logic',
        create: (ctx) => {
            const gain = ctx.createGain();
            gain.gain.value = -1;
            return { node: gain, params: { gain: gain.gain } };
        }
    },

    rectifier: {
        category: 'logic',
        create: (ctx) => {
            const shaper = ctx.createWaveShaper();
            const curve = new Float32Array(256);
            for (let i = 0; i < 256; i++) {
                curve[i] = Math.abs((i - 128) / 128);
            }
            shaper.curve = curve;
            return { node: shaper, params: {} };
        }
    },

    slewLimiter: {
        category: 'logic',
        create: (ctx) => {
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 15 + Math.random() * 30;
            filter.Q.value = 0.707;
            return { node: filter, params: {} };
        }
    },

    dcOffset: {
        category: 'logic',
        create: (ctx) => {
            const offset = ctx.createConstantSource ? ctx.createConstantSource() : ctx.createOscillator();
            if (offset.offset) {
                offset.offset.value = Math.random() * 0.5;
            }
            const gain = ctx.createGain();
            gain.gain.value = 1;
            offset.connect(gain);
            offset.start();
            return { node: gain, source: offset, params: { gain: gain.gain } };
        }
    },

    // ==========================================
    // UTILITIES
    // ==========================================

    vca: {
        category: 'util',
        create: (ctx) => {
            const gain = ctx.createGain();
            gain.gain.value = 0.3 + Math.random() * 0.4;
            return { node: gain, params: { gain: gain.gain } };
        }
    },

    panner: {
        category: 'util',
        create: (ctx) => {
            const panner = ctx.createStereoPanner();
            panner.pan.value = (Math.random() * 2 - 1) * 0.8;
            return { node: panner, params: { pan: panner.pan } };
        }
    },

    autoPanner: {
        category: 'util',
        create: (ctx) => {
            const panner = ctx.createStereoPanner();
            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.1 + Math.random() * 1; // Slower
            const depth = ctx.createGain();
            depth.gain.value = 0.6;
            lfo.connect(depth);
            depth.connect(panner.pan);
            lfo.start();
            return { node: panner, lfo, params: { freq: lfo.frequency, depth: depth.gain } };
        }
    },

    ducker: {
        category: 'util',
        create: (ctx) => {
            const gain = ctx.createGain();
            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.5 + Math.random() * 2;
            const depth = ctx.createGain();
            depth.gain.value = -0.4;
            const offset = ctx.createConstantSource ? ctx.createConstantSource() : null;

            if (offset) {
                offset.offset.value = 1;
                offset.connect(gain.gain);
                offset.start();
            } else {
                gain.gain.value = 0.5;
            }

            lfo.connect(depth);
            depth.connect(gain.gain);
            lfo.start();

            return { node: gain, lfo, params: { freq: lfo.frequency } };
        }
    },

    crossfader: {
        category: 'util',
        create: (ctx) => {
            const gain = ctx.createGain();
            gain.gain.value = 0.5;
            return { node: gain, params: { gain: gain.gain } };
        }
    },

    feedbackLoop: {
        category: 'util',
        create: (ctx) => {
            const delay = ctx.createDelay(0.5);
            delay.delayTime.value = 0.02 + Math.random() * 0.08;
            const feedback = ctx.createGain();
            feedback.gain.value = 0.2 + Math.random() * 0.25;
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 2500 + Math.random() * 2000;
            filter.Q.value = 0.707;

            delay.connect(filter);
            filter.connect(feedback);
            feedback.connect(delay);

            return { node: delay, output: feedback, params: { time: delay.delayTime, feedback: feedback.gain } };
        }
    },

    limiter: {
        category: 'util',
        create: (ctx) => {
            const comp = ctx.createDynamicsCompressor();
            comp.threshold.value = -3;
            comp.knee.value = 0;
            comp.ratio.value = 20;
            comp.attack.value = 0.001;
            comp.release.value = 0.1;
            return { node: comp, params: {} };
        }
    },

    stereoWidener: {
        category: 'util',
        create: (ctx) => {
            const splitter = ctx.createChannelSplitter(2);
            const merger = ctx.createChannelMerger(2);
            const delay = ctx.createDelay(0.1);
            delay.delayTime.value = 0.01 + Math.random() * 0.02;

            splitter.connect(merger, 0, 0);
            splitter.connect(delay);
            delay.connect(merger, 0, 1);

            return { node: splitter, output: merger, params: { time: delay.delayTime } };
        }
    }
};

// Get all module type names
const MODULE_NAMES = Object.keys(MODULE_TYPES);

// Get random module type
function getRandomModuleType() {
    return MODULE_NAMES[Math.floor(Math.random() * MODULE_NAMES.length)];
}

// Get module types by category
function getModulesByCategory(category) {
    return Object.entries(MODULE_TYPES)
        .filter(([_, m]) => m.category === category)
        .map(([name]) => name);
}

// Export
window.MODULE_TYPES = MODULE_TYPES;
window.MODULE_NAMES = MODULE_NAMES;
window.getRandomModuleType = getRandomModuleType;
window.getModulesByCategory = getModulesByCategory;
