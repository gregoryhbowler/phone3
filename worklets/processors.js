// High-quality AudioWorklet processors for experimental synthesis
// Inspired by: Buchla, Serge, Rungler, Ciani, Radigue, Basinski, Autechre

// ==========================================
// COMPLEX OSCILLATOR (Buchla 259-inspired)
// ==========================================
class ComplexOscillatorProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'frequency', defaultValue: 220, minValue: 0.1, maxValue: 20000, automationRate: 'a-rate' },
            { name: 'timbre', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'a-rate' },
            { name: 'symmetry', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'a-rate' },
            { name: 'foldAmount', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'a-rate' }
        ];
    }

    constructor() {
        super();
        this.phase = 0;
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const freq = parameters.frequency;
        const timbre = parameters.timbre;
        const symmetry = parameters.symmetry;
        const fold = parameters.foldAmount;

        for (let channel = 0; channel < output.length; channel++) {
            const out = output[channel];

            for (let i = 0; i < out.length; i++) {
                const f = freq.length > 1 ? freq[i] : freq[0];
                const t = timbre.length > 1 ? timbre[i] : timbre[0];
                const s = symmetry.length > 1 ? symmetry[i] : symmetry[0];
                const fld = fold.length > 1 ? fold[i] : fold[0];

                // Variable symmetry waveshaping
                const phaseInc = f / sampleRate;
                this.phase += phaseInc;
                if (this.phase >= 1) this.phase -= 1;

                // Generate complex waveform
                let sample = 0;
                const sym = 0.1 + s * 0.8;

                if (this.phase < sym) {
                    const localPhase = this.phase / sym;
                    sample = -1 + 2 * localPhase;
                } else {
                    const localPhase = (this.phase - sym) / (1 - sym);
                    sample = 1 - 2 * localPhase;
                }

                // Add harmonic content based on timbre
                const harmonic = Math.sin(this.phase * Math.PI * 2 * (1 + Math.floor(t * 7)));
                sample = sample * (1 - t * 0.5) + harmonic * t * 0.5;

                // Wavefolding (Buchla-style)
                if (fld > 0) {
                    sample = sample * (1 + fld * 3);
                    for (let j = 0; j < 3; j++) {
                        if (sample > 1) sample = 2 - sample;
                        if (sample < -1) sample = -2 - sample;
                    }
                }

                out[i] = sample * 0.7;
            }
        }

        return true;
    }
}

// ==========================================
// RUNGLER (Rob Hordijk-inspired chaos)
// ==========================================
class RunglerProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'freq1', defaultValue: 37, minValue: 0.1, maxValue: 1000, automationRate: 'a-rate' },
            { name: 'freq2', defaultValue: 41, minValue: 0.1, maxValue: 1000, automationRate: 'a-rate' },
            { name: 'chaos', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' }
        ];
    }

    constructor() {
        super();
        this.phase1 = 0;
        this.phase2 = 0;
        this.shiftRegister = new Array(8).fill(0).map(() => Math.random() > 0.5 ? 1 : 0);
        this.dacValue = 0;
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const freq1 = parameters.freq1;
        const freq2 = parameters.freq2;
        const chaos = parameters.chaos[0];

        for (let channel = 0; channel < output.length; channel++) {
            const out = output[channel];

            for (let i = 0; i < out.length; i++) {
                const f1 = freq1.length > 1 ? freq1[i] : freq1[0];
                const f2 = freq2.length > 1 ? freq2[i] : freq2[0];

                this.phase1 += f1 / sampleRate;
                this.phase2 += f2 / sampleRate;

                if (this.phase1 >= 1) {
                    this.phase1 -= 1;
                    const newBit = (this.shiftRegister[0] ^ this.shiftRegister[5]) ^ (this.phase2 > 0.5 ? 1 : 0);
                    this.shiftRegister.pop();
                    this.shiftRegister.unshift(newBit);

                    this.dacValue = 0;
                    for (let j = 0; j < 8; j++) {
                        this.dacValue += this.shiftRegister[j] * Math.pow(2, j);
                    }
                    this.dacValue = (this.dacValue / 255) * 2 - 1;
                }

                if (this.phase2 >= 1) this.phase2 -= 1;

                const tri1 = this.phase1 < 0.5 ? this.phase1 * 4 - 1 : 3 - this.phase1 * 4;
                const tri2 = this.phase2 < 0.5 ? this.phase2 * 4 - 1 : 3 - this.phase2 * 4;

                const modAmount = chaos * 500;
                this.phase1 += (tri2 * modAmount) / sampleRate;
                this.phase2 += (tri1 * modAmount * 0.7) / sampleRate;

                const mix = tri1 * 0.3 + tri2 * 0.3 + this.dacValue * 0.4 * chaos;

                out[i] = mix * 0.8;
            }
        }

        return true;
    }
}

// ==========================================
// DUAL SLOPE GENERATOR (Serge DSG-style)
// ==========================================
class DualSlopeProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'rise', defaultValue: 0.1, minValue: 0.001, maxValue: 10, automationRate: 'k-rate' },
            { name: 'fall', defaultValue: 0.2, minValue: 0.001, maxValue: 10, automationRate: 'k-rate' },
            { name: 'shape', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
            { name: 'cycle', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' }
        ];
    }

    constructor() {
        super();
        this.value = 0;
        this.rising = true;
        this.gate = false;
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const input = inputs[0];
        const rise = parameters.rise[0];
        const fall = parameters.fall[0];
        const shape = parameters.shape[0];
        const cycle = parameters.cycle[0] > 0.5;

        for (let channel = 0; channel < output.length; channel++) {
            const out = output[channel];
            const inp = input.length > 0 ? input[channel] : null;

            for (let i = 0; i < out.length; i++) {
                if (inp && inp[i] > 0.5 && !this.gate) {
                    this.gate = true;
                    this.rising = true;
                } else if (inp && inp[i] < 0.5) {
                    this.gate = false;
                }

                if (this.rising) {
                    const riseRate = 1 / (rise * sampleRate);
                    if (shape < 0.5) {
                        this.value += (1 - this.value) * riseRate * (1 + (0.5 - shape) * 10);
                    } else {
                        this.value += riseRate;
                    }

                    if (this.value >= 1) {
                        this.value = 1;
                        this.rising = false;
                    }
                } else {
                    const fallRate = 1 / (fall * sampleRate);
                    if (shape > 0.5) {
                        this.value -= this.value * fallRate * (1 + (shape - 0.5) * 10);
                    } else {
                        this.value -= fallRate;
                    }

                    if (this.value <= 0) {
                        this.value = 0;
                        if (cycle) {
                            this.rising = true;
                        }
                    }
                }

                out[i] = this.value * 2 - 1;
            }
        }

        return true;
    }
}

// ==========================================
// SMOOTH & STEPPED RANDOM (Buchla 266-style)
// ==========================================
class RandomSourceProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'rate', defaultValue: 2, minValue: 0.01, maxValue: 100, automationRate: 'a-rate' },
            { name: 'smooth', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' }
        ];
    }

    constructor() {
        super();
        this.phase = 0;
        this.currentValue = Math.random() * 2 - 1;
        this.targetValue = Math.random() * 2 - 1;
        this.smoothedValue = 0;
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const rate = parameters.rate;
        const smooth = parameters.smooth[0];

        for (let channel = 0; channel < output.length; channel++) {
            const out = output[channel];

            for (let i = 0; i < out.length; i++) {
                const r = rate.length > 1 ? rate[i] : rate[0];

                this.phase += r / sampleRate;
                if (this.phase >= 1) {
                    this.phase -= 1;
                    this.currentValue = this.targetValue;
                    this.targetValue = Math.random() * 2 - 1;
                }

                const stepped = this.currentValue;
                const linear = this.currentValue + (this.targetValue - this.currentValue) * this.phase;

                const target = stepped * (1 - smooth) + linear * smooth;
                const slewRate = 0.001 + (1 - smooth) * 0.1;
                this.smoothedValue += (target - this.smoothedValue) * slewRate;

                out[i] = smooth > 0.9 ? this.smoothedValue : stepped * (1 - smooth) + this.smoothedValue * smooth;
            }
        }

        return true;
    }
}

// ==========================================
// WAVEFOLDER (Serge Wave Multiplier-style)
// ==========================================
class WavefolderProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'folds', defaultValue: 2, minValue: 1, maxValue: 8, automationRate: 'a-rate' },
            { name: 'symmetry', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'a-rate' },
            { name: 'gain', defaultValue: 1, minValue: 0.1, maxValue: 5, automationRate: 'a-rate' }
        ];
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];

        if (input.length === 0) return true;

        const folds = parameters.folds;
        const symmetry = parameters.symmetry;
        const gain = parameters.gain;

        for (let channel = 0; channel < output.length; channel++) {
            const inp = input[channel];
            const out = output[channel];

            for (let i = 0; i < out.length; i++) {
                const f = folds.length > 1 ? folds[i] : folds[0];
                const s = symmetry.length > 1 ? symmetry[i] : symmetry[0];
                const g = gain.length > 1 ? gain[i] : gain[0];

                let sample = inp[i] * g;
                sample += (s - 0.5) * 0.5;

                const numFolds = Math.floor(f);
                for (let j = 0; j < numFolds; j++) {
                    if (sample > 1) {
                        sample = 2 - sample;
                    } else if (sample < -1) {
                        sample = -2 - sample;
                    }
                }

                sample = Math.tanh(sample);

                out[i] = sample;
            }
        }

        return true;
    }
}

// ==========================================
// VOLTAGE-CONTROLLED SLOPE (Serge VCS)
// ==========================================
class VCSlopeProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'rate', defaultValue: 1, minValue: 0.001, maxValue: 100, automationRate: 'a-rate' },
            { name: 'response', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' }
        ];
    }

    constructor() {
        super();
        this.value = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        const rate = parameters.rate;
        const response = parameters.response[0];

        for (let channel = 0; channel < output.length; channel++) {
            const inp = input.length > 0 ? input[channel] : null;
            const out = output[channel];

            for (let i = 0; i < out.length; i++) {
                const r = rate.length > 1 ? rate[i] : rate[0];
                const target = inp ? inp[i] : 0;

                const slewTime = 0.0001 + response * r * 0.1;
                const coeff = 1 - Math.exp(-1 / (slewTime * sampleRate));

                this.value += (target - this.value) * coeff;

                out[i] = this.value;
            }
        }

        return true;
    }
}

// ==========================================
// RESONANT EQ (State Variable Filter)
// ==========================================
class ResonantEQProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'frequency', defaultValue: 1000, minValue: 20, maxValue: 20000, automationRate: 'a-rate' },
            { name: 'resonance', defaultValue: 0.5, minValue: 0, maxValue: 0.99, automationRate: 'a-rate' },
            { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 3, automationRate: 'k-rate' }
        ];
    }

    constructor() {
        super();
        this.lp = 0;
        this.bp = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];

        if (input.length === 0) return true;

        const freq = parameters.frequency;
        const res = parameters.resonance;
        const mode = Math.floor(parameters.mode[0]);

        for (let channel = 0; channel < output.length; channel++) {
            const inp = input[channel];
            const out = output[channel];

            for (let i = 0; i < out.length; i++) {
                const f = freq.length > 1 ? freq[i] : freq[0];
                const q = res.length > 1 ? res[i] : res[0];

                const fc = 2 * Math.sin(Math.PI * f / sampleRate);
                const feedback = q + q / (1 - fc);

                const hp = inp[i] - this.lp - feedback * this.bp;
                this.bp += fc * hp;
                this.lp += fc * this.bp;

                switch (mode) {
                    case 0: out[i] = this.lp; break;
                    case 1: out[i] = this.bp; break;
                    case 2: out[i] = hp; break;
                    case 3: out[i] = this.lp - hp; break;
                }
            }
        }

        return true;
    }
}

// ==========================================
// CHAOS GENERATOR (Lorenz attractor)
// ==========================================
class ChaosProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'rate', defaultValue: 100, minValue: 1, maxValue: 1000, automationRate: 'a-rate' },
            { name: 'sigma', defaultValue: 10, minValue: 1, maxValue: 30, automationRate: 'k-rate' },
            { name: 'rho', defaultValue: 28, minValue: 1, maxValue: 50, automationRate: 'k-rate' },
            { name: 'beta', defaultValue: 2.667, minValue: 0.5, maxValue: 10, automationRate: 'k-rate' }
        ];
    }

    constructor() {
        super();
        this.x = 0.1;
        this.y = 0;
        this.z = 0;
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const rate = parameters.rate;
        const sigma = parameters.sigma[0];
        const rho = parameters.rho[0];
        const beta = parameters.beta[0];

        for (let channel = 0; channel < output.length; channel++) {
            const out = output[channel];

            for (let i = 0; i < out.length; i++) {
                const r = rate.length > 1 ? rate[i] : rate[0];
                const dt = r / sampleRate;

                const dx = sigma * (this.y - this.x) * dt;
                const dy = (this.x * (rho - this.z) - this.y) * dt;
                const dz = (this.x * this.y - beta * this.z) * dt;

                this.x += dx;
                this.y += dy;
                this.z += dz;

                out[i] = this.x / 20;
            }
        }

        return true;
    }
}

// ==========================================
// VACTROL SIMULATION (LED/LDR response)
// ==========================================
class VactrolProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'attack', defaultValue: 0.01, minValue: 0.001, maxValue: 1, automationRate: 'k-rate' },
            { name: 'release', defaultValue: 0.1, minValue: 0.001, maxValue: 2, automationRate: 'k-rate' }
        ];
    }

    constructor() {
        super();
        this.value = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];

        if (input.length === 0) return true;

        const attack = parameters.attack[0];
        const release = parameters.release[0];

        for (let channel = 0; channel < output.length; channel++) {
            const inp = input[channel];
            const out = output[channel];

            for (let i = 0; i < out.length; i++) {
                const target = Math.abs(inp[i]);

                if (target > this.value) {
                    const attackCoeff = 1 - Math.exp(-1 / (attack * sampleRate));
                    this.value += (target - this.value) * attackCoeff;
                } else {
                    const releaseCoeff = 1 - Math.exp(-1 / (release * sampleRate));
                    this.value += (target - this.value) * releaseCoeff * (1 + this.value);
                }

                out[i] = this.value;
            }
        }

        return true;
    }
}

// ==========================================
// WAVE TERRAIN SYNTHESIS
// ==========================================
class WaveTerrainProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'xFreq', defaultValue: 110, minValue: 0.1, maxValue: 2000, automationRate: 'a-rate' },
            { name: 'yFreq', defaultValue: 111, minValue: 0.1, maxValue: 2000, automationRate: 'a-rate' },
            { name: 'terrain', defaultValue: 0, minValue: 0, maxValue: 4, automationRate: 'k-rate' }
        ];
    }

    constructor() {
        super();
        this.xPhase = 0;
        this.yPhase = 0;
    }

    terrain(x, y, type) {
        switch (Math.floor(type)) {
            case 0:
                return Math.sin(x * Math.PI * 2) * Math.sin(y * Math.PI * 2);
            case 1:
                const dist = Math.sqrt(x * x + y * y);
                return Math.sin(dist * Math.PI * 4);
            case 2:
                return x * x - y * y;
            case 3:
                const angle = Math.atan2(y, x);
                const r = Math.sqrt(x * x + y * y);
                return Math.sin(angle * 3 + r * 5);
            case 4:
                return Math.sin(x * 7) * Math.cos(y * 11) + Math.sin(x * 13) * Math.cos(y * 17) * 0.5;
            default:
                return Math.sin(x * Math.PI * 2) * Math.sin(y * Math.PI * 2);
        }
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const xFreq = parameters.xFreq;
        const yFreq = parameters.yFreq;
        const terrainType = parameters.terrain[0];

        for (let channel = 0; channel < output.length; channel++) {
            const out = output[channel];

            for (let i = 0; i < out.length; i++) {
                const fx = xFreq.length > 1 ? xFreq[i] : xFreq[0];
                const fy = yFreq.length > 1 ? yFreq[i] : yFreq[0];

                this.xPhase += fx / sampleRate;
                this.yPhase += fy / sampleRate;

                if (this.xPhase >= 1) this.xPhase -= 1;
                if (this.yPhase >= 1) this.yPhase -= 1;

                const x = this.xPhase * 2 - 1;
                const y = this.yPhase * 2 - 1;

                out[i] = this.terrain(x, y, terrainType) * 0.7;
            }
        }

        return true;
    }
}

// ==========================================
// TAPE LOOP (Basinski-style degradation)
// ==========================================
class TapeLoopProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'loopTime', defaultValue: 2, minValue: 0.1, maxValue: 10, automationRate: 'k-rate' },
            { name: 'feedback', defaultValue: 0.95, minValue: 0, maxValue: 0.999, automationRate: 'k-rate' },
            { name: 'wobble', defaultValue: 0.3, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
            { name: 'hiss', defaultValue: 0.02, minValue: 0, maxValue: 0.1, automationRate: 'k-rate' }
        ];
    }

    constructor() {
        super();
        this.maxBufferSize = sampleRate * 10;
        this.buffer = new Float32Array(this.maxBufferSize);
        this.writeHead = 0;
        this.readPhase = 0;
        this.lfoPhase = 0;
        this.lfo2Phase = 0;
        this.filterState = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        const loopTime = parameters.loopTime[0];
        const feedback = parameters.feedback[0];
        const wobble = parameters.wobble[0];
        const hiss = parameters.hiss[0];

        const loopSamples = Math.floor(loopTime * sampleRate);

        for (let channel = 0; channel < output.length; channel++) {
            const inp = input.length > 0 ? input[channel] : null;
            const out = output[channel];

            for (let i = 0; i < out.length; i++) {
                // Wow (slow pitch variation)
                this.lfoPhase += 0.3 / sampleRate;
                if (this.lfoPhase >= 1) this.lfoPhase -= 1;
                const wow = Math.sin(this.lfoPhase * Math.PI * 2) * wobble * 0.002;

                // Flutter (fast pitch variation)
                this.lfo2Phase += 7 / sampleRate;
                if (this.lfo2Phase >= 1) this.lfo2Phase -= 1;
                const flutter = Math.sin(this.lfo2Phase * Math.PI * 2) * wobble * 0.0005;

                // Read from buffer with interpolation
                const readSpeed = 1 + wow + flutter;
                this.readPhase += readSpeed;
                if (this.readPhase >= loopSamples) this.readPhase -= loopSamples;

                const readPos = this.readPhase;
                const readIndex = Math.floor(readPos);
                const frac = readPos - readIndex;
                const idx0 = readIndex % loopSamples;
                const idx1 = (readIndex + 1) % loopSamples;

                // Linear interpolation
                const sample = this.buffer[idx0] * (1 - frac) + this.buffer[idx1] * frac;

                // High-frequency loss (tape aging simulation)
                this.filterState = this.filterState * 0.95 + sample * 0.05;
                const filteredSample = sample * 0.7 + this.filterState * 0.3;

                // Add subtle hiss
                const noise = (Math.random() * 2 - 1) * hiss;

                // Output
                out[i] = filteredSample + noise;

                // Write new input mixed with feedback
                const inputSample = inp ? inp[i] : 0;
                this.buffer[this.writeHead] = inputSample * 0.5 + filteredSample * feedback;

                this.writeHead++;
                if (this.writeHead >= loopSamples) this.writeHead = 0;
            }
        }

        return true;
    }
}

// ==========================================
// SPECTRAL DRONE (Radigue-style)
// ==========================================
class SpectralDroneProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'fundamental', defaultValue: 55, minValue: 20, maxValue: 200, automationRate: 'a-rate' },
            { name: 'brightness', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
            { name: 'beating', defaultValue: 0.3, minValue: 0, maxValue: 1, automationRate: 'k-rate' }
        ];
    }

    constructor() {
        super();
        // 16 oscillator phases for harmonics
        this.phases = new Float32Array(16).fill(0);
        // Slight detuning for each harmonic (creates beating)
        this.detune = new Float32Array(16);
        for (let i = 0; i < 16; i++) {
            this.detune[i] = 1 + (Math.random() - 0.5) * 0.002;
        }
        // Slow drift for each harmonic
        this.driftPhases = new Float32Array(16);
        for (let i = 0; i < 16; i++) {
            this.driftPhases[i] = Math.random();
        }
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const fundamental = parameters.fundamental;
        const brightness = parameters.brightness[0];
        const beating = parameters.beating[0];

        for (let channel = 0; channel < output.length; channel++) {
            const out = output[channel];

            for (let i = 0; i < out.length; i++) {
                const fund = fundamental.length > 1 ? fundamental[i] : fundamental[0];
                let sample = 0;

                // Sum harmonics
                for (let h = 0; h < 16; h++) {
                    const harmonic = h + 1;

                    // Amplitude envelope per harmonic (higher = quieter)
                    const baseAmp = 1 / harmonic;
                    // Brightness control (reduce higher harmonics when dark)
                    const brightAmp = Math.pow(brightness, harmonic * 0.3);
                    const amplitude = baseAmp * brightAmp * 0.15;

                    // Slow drift modulation per harmonic
                    this.driftPhases[h] += 0.01 / sampleRate;
                    if (this.driftPhases[h] >= 1) this.driftPhases[h] -= 1;
                    const drift = Math.sin(this.driftPhases[h] * Math.PI * 2) * beating * 0.001;

                    // Frequency with detune and drift
                    const freq = fund * harmonic * (this.detune[h] + drift);

                    // Update phase
                    this.phases[h] += freq / sampleRate;
                    if (this.phases[h] >= 1) this.phases[h] -= 1;

                    // Pure sine
                    sample += Math.sin(this.phases[h] * Math.PI * 2) * amplitude;
                }

                out[i] = sample;
            }
        }

        return true;
    }
}

// ==========================================
// PHASING OSCILLATOR (Reich-style)
// ==========================================
class PhasingOscillatorProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'frequency', defaultValue: 220, minValue: 20, maxValue: 2000, automationRate: 'a-rate' },
            { name: 'detune', defaultValue: 0.001, minValue: 0, maxValue: 0.01, automationRate: 'k-rate' },
            { name: 'voices', defaultValue: 2, minValue: 2, maxValue: 8, automationRate: 'k-rate' }
        ];
    }

    constructor() {
        super();
        this.phases = new Float32Array(8).fill(0);
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const freq = parameters.frequency;
        const detune = parameters.detune[0];
        const numVoices = Math.floor(parameters.voices[0]);

        for (let channel = 0; channel < output.length; channel++) {
            const out = output[channel];

            for (let i = 0; i < out.length; i++) {
                const f = freq.length > 1 ? freq[i] : freq[0];
                let sample = 0;

                for (let v = 0; v < numVoices; v++) {
                    // Each voice slightly detuned from the previous
                    const voiceFreq = f * (1 + v * detune);
                    this.phases[v] += voiceFreq / sampleRate;
                    if (this.phases[v] >= 1) this.phases[v] -= 1;

                    sample += Math.sin(this.phases[v] * Math.PI * 2) / numVoices;
                }

                out[i] = sample * 0.8;
            }
        }

        return true;
    }
}

// ==========================================
// PITCH QUANTIZER (Scale-aware V/Oct quantization)
// ==========================================
// Takes any frequency input and quantizes it to the nearest
// scale degree based on root note and current scale ratios.
// The scale is communicated via message port as an array of ratios.
class PitchQuantizerProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'root', defaultValue: 55, minValue: 20, maxValue: 880, automationRate: 'k-rate' },
            { name: 'glide', defaultValue: 0.005, minValue: 0, maxValue: 0.1, automationRate: 'k-rate' },
            { name: 'bypass', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' }
        ];
    }

    constructor() {
        super();
        // Default to major scale ratios
        this.scaleRatios = [1, 1.122462, 1.259921, 1.334840, 1.498307, 1.681793, 1.887749];
        this.currentFreq = 55;
        this.targetFreq = 55;

        // Listen for scale updates from main thread
        this.port.onmessage = (event) => {
            if (event.data.type === 'setScale' && Array.isArray(event.data.ratios)) {
                this.scaleRatios = event.data.ratios;
            }
        };
    }

    // Find the nearest scale degree frequency to the input frequency
    quantizeFrequency(inputFreq, rootFreq) {
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
        for (const scaleRatio of this.scaleRatios) {
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
        if (this.scaleRatios.length > 0) {
            const lastRatio = this.scaleRatios[this.scaleRatios.length - 1];
            const octaveDownDistance = Math.abs(Math.log2(positionInOctave) - Math.log2(lastRatio / 2));
            if (octaveDownDistance < minDistance && positionInOctave < 1.1) {
                closestRatio = lastRatio / 2;
            }
        }

        return rootFreq * octaveMultiplier * closestRatio;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        const rootFreq = parameters.root[0];
        const glide = parameters.glide[0];
        const bypass = parameters.bypass[0] > 0.5;

        // Calculate glide coefficient
        const glideCoeff = glide > 0 ? 1 - Math.exp(-1 / (glide * sampleRate)) : 1;

        for (let channel = 0; channel < output.length; channel++) {
            const inp = input.length > 0 && input[channel] ? input[channel] : null;
            const out = output[channel];

            for (let i = 0; i < out.length; i++) {
                // Get input frequency (could be from CV or direct value)
                const inputFreq = inp ? inp[i] : rootFreq;

                if (bypass) {
                    // Pass through unchanged
                    out[i] = inputFreq;
                } else {
                    // Quantize to nearest scale degree
                    this.targetFreq = this.quantizeFrequency(inputFreq, rootFreq);

                    // Apply glide/portamento
                    if (glide > 0) {
                        this.currentFreq += (this.targetFreq - this.currentFreq) * glideCoeff;
                    } else {
                        this.currentFreq = this.targetFreq;
                    }

                    out[i] = this.currentFreq;
                }
            }
        }

        return true;
    }
}

// ==========================================
// CV TO FREQUENCY CONVERTER (V/Oct standard)
// ==========================================
// Converts control voltage (-5V to +5V normalized as -1 to +1)
// to frequency based on V/Oct standard (1V = octave)
class CVToFreqProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'root', defaultValue: 55, minValue: 20, maxValue: 880, automationRate: 'k-rate' },
            { name: 'octaveRange', defaultValue: 5, minValue: 1, maxValue: 10, automationRate: 'k-rate' }
        ];
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        const rootFreq = parameters.root[0];
        const octaveRange = parameters.octaveRange[0];

        for (let channel = 0; channel < output.length; channel++) {
            const inp = input.length > 0 && input[channel] ? input[channel] : null;
            const out = output[channel];

            for (let i = 0; i < out.length; i++) {
                // CV is normalized -1 to +1
                const cv = inp ? inp[i] : 0;

                // Convert to frequency: 0V (cv=0) = root, +1V (cv=0.2 if 5 octave range) = octave up
                // CV of 1 = full range (e.g., 5 octaves if octaveRange=5)
                const octaves = cv * octaveRange;
                const freq = rootFreq * Math.pow(2, octaves);

                out[i] = freq;
            }
        }

        return true;
    }
}

// ==========================================
// FREQUENCY TO CV CONVERTER
// ==========================================
// Converts frequency back to normalized CV for modulation routing
class FreqToCVProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'root', defaultValue: 55, minValue: 20, maxValue: 880, automationRate: 'k-rate' },
            { name: 'octaveRange', defaultValue: 5, minValue: 1, maxValue: 10, automationRate: 'k-rate' }
        ];
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        const rootFreq = parameters.root[0];
        const octaveRange = parameters.octaveRange[0];

        for (let channel = 0; channel < output.length; channel++) {
            const inp = input.length > 0 && input[channel] ? input[channel] : null;
            const out = output[channel];

            for (let i = 0; i < out.length; i++) {
                const freq = inp ? inp[i] : rootFreq;

                // Convert frequency to CV
                const octaves = Math.log2(freq / rootFreq);
                const cv = octaves / octaveRange;

                out[i] = Math.max(-1, Math.min(1, cv)); // Clamp to -1 to +1
            }
        }

        return true;
    }
}

// Register all processors
registerProcessor('complex-oscillator', ComplexOscillatorProcessor);
registerProcessor('rungler', RunglerProcessor);
registerProcessor('dual-slope', DualSlopeProcessor);
registerProcessor('random-source', RandomSourceProcessor);
registerProcessor('wavefolder', WavefolderProcessor);
registerProcessor('vc-slope', VCSlopeProcessor);
registerProcessor('resonant-eq', ResonantEQProcessor);
registerProcessor('chaos', ChaosProcessor);
registerProcessor('vactrol', VactrolProcessor);
registerProcessor('wave-terrain', WaveTerrainProcessor);
registerProcessor('tape-loop', TapeLoopProcessor);
registerProcessor('spectral-drone', SpectralDroneProcessor);
registerProcessor('phasing-oscillator', PhasingOscillatorProcessor);
registerProcessor('pitch-quantizer', PitchQuantizerProcessor);
registerProcessor('cv-to-freq', CVToFreqProcessor);
registerProcessor('freq-to-cv', FreqToCVProcessor);
