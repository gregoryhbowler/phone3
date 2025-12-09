// PATCH UNKNOWN - The arcane interface
// Each cell is a mystery. Meanings are hidden. Sound is the only truth.

let synth = null;
let grid = null;
let cellElements = [];

// Mode state
let currentMode = 'patch'; // 'patch', 'play', or 'seq'
let isRecording = false;

// Play mode state
let selectedRoot = 0; // 0 = C, 1 = C#, etc.
let selectedScale = 'harmonic';
let macroAssignments = [];
let activeNotes = new Map(); // frequency -> oscillator for polyphonic playing
let envelopeEnabled = false; // AD envelope toggle

// Sequencer state
let seqLength = 8; // 2-16 steps
let seqSteps = new Array(16).fill(false); // step on/off
let seqNotes = new Array(16).fill(16); // note index (0-31 for 4 octaves of scale degrees)
let seqTempo = 120; // BPM
let seqTranspose = 0; // scale degrees (-12 to +12)
let seqPlaying = false;
let seqCurrentStep = 0;
let seqIntervalId = null;

// Transpose sequencer state
let transposeSeqEnabled = false; // master toggle
let transposeSeqRandom = false; // random mode
let transposeSeqCells = new Array(8).fill(null).map(() => ({
    enabled: false,
    transpose: 0, // -12 to +12 scale degrees
    cycle: 1 // how many step seq loops before advancing
}));
let transposeSeqCurrentCell = 0; // current cell index (within enabled cells)
let transposeSeqLoopCount = 0; // counts loops for cycle advancement

// LFO state
const LFO_SHAPES = ['sine', 'tri', 'saw', 'sqr', 'rnd', 's&h'];
let lfos = new Array(6).fill(null).map((_, i) => ({
    enabled: false,
    shape: 0, // index into LFO_SHAPES
    rate: 0.5, // 0-1 normalized (maps to 0.01-20 Hz)
    depth: 0.5, // 0-1
    destination: 0 // 0-15 = macros, 16-21 = LFO 1-6 rate
}));
let lfoPhases = new Array(6).fill(0);
let lfoValues = new Array(6).fill(0);
let lfoAnimationId = null;
let lastLfoTime = 0;

// Cryptic cell assignments - these indices determine behavior
// but the user should never understand the mapping
const MELODIC_CELL = 0;   // Upper left - yearning arpeggios (Barbieri, Glass, Reich, Pärt)
const EVOLVE_CELL = 7;    // Upper right - consonance
const RHYTHMIC_CELL = 56; // Lower left - pulse and rhythm
const RANDOM_CELL = 63;   // Lower right - chaos

// Initialize the application
async function init() {
    grid = document.getElementById('grid');
    const overlay = document.getElementById('start-overlay');

    // Wait for user interaction (required for audio)
    overlay.addEventListener('click', async () => {
        overlay.classList.add('hidden');

        synth = new PatchUnknown();
        await synth.init();

        setupHeader();
        createGrid();
        createPlayMode();
        startAnimationLoop();
    });

    // Prevent default touch behaviors only on grid/keyboard (not controls)
    document.addEventListener('touchmove', e => {
        // Allow touch on scale selector, sliders, and control rows
        const target = e.target;
        if (target.closest('#scale-selector') ||
            target.closest('#scale-row') ||
            target.closest('.env-slider') ||
            target.classList.contains('env-slider') ||
            target.closest('#seq-controls') ||
            target.closest('.seq-slider') ||
            target.closest('#seq-grid')) {
            return; // Allow native scroll/drag
        }
        e.preventDefault();
    }, { passive: false });
}

// Setup header buttons
function setupHeader() {
    const modeToggle = document.getElementById('mode-toggle');
    const recordBtn = document.getElementById('record-btn');
    const seqToggle = document.getElementById('seq-toggle');

    modeToggle.addEventListener('click', toggleMode);
    modeToggle.addEventListener('touchstart', (e) => {
        e.preventDefault();
        toggleMode();
    }, { passive: false });

    recordBtn.addEventListener('click', toggleRecording);
    recordBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        toggleRecording();
    }, { passive: false });

    seqToggle.addEventListener('click', toggleSeqMode);
    seqToggle.addEventListener('touchstart', (e) => {
        e.preventDefault();
        toggleSeqMode();
    }, { passive: false });
}

// Toggle between patch and play modes
function toggleMode() {
    const modeToggle = document.getElementById('mode-toggle');
    const seqToggle = document.getElementById('seq-toggle');
    const patchMode = document.getElementById('patch-mode');
    const playMode = document.getElementById('play-mode');
    const seqMode = document.getElementById('seq-mode');

    // Stop sequencer if running
    stopSequencer();

    if (currentMode === 'patch' || currentMode === 'seq') {
        currentMode = 'play';
        modeToggle.textContent = '♩';
        modeToggle.classList.add('play-mode');
        seqToggle.classList.remove('active');
        patchMode.classList.add('hidden');
        seqMode.classList.add('hidden');
        playMode.classList.remove('hidden');

        // Store base frequencies for V/Oct control
        synth.storeBaseFrequencies();

        // Quantize oscillators to current scale/root
        const scale = synth.scales[selectedScale];
        if (scale) {
            synth.quantizeOscillators(scale, selectedRoot);
        }

        updateMacros();
    } else {
        currentMode = 'patch';
        modeToggle.textContent = '▦';
        modeToggle.classList.remove('play-mode');
        patchMode.classList.remove('hidden');
        playMode.classList.add('hidden');
        seqMode.classList.add('hidden');
        // Release pitch CV (return to base)
        synth.releaseKey(false);
        activeNotes.clear();
    }
}

// Toggle sequencer mode
function toggleSeqMode() {
    const modeToggle = document.getElementById('mode-toggle');
    const seqToggle = document.getElementById('seq-toggle');
    const patchMode = document.getElementById('patch-mode');
    const playMode = document.getElementById('play-mode');
    const seqMode = document.getElementById('seq-mode');

    if (currentMode === 'seq') {
        // Return to patch mode
        stopSequencer();
        currentMode = 'patch';
        modeToggle.textContent = '▦';
        modeToggle.classList.remove('play-mode');
        seqToggle.classList.remove('active');
        patchMode.classList.remove('hidden');
        playMode.classList.add('hidden');
        seqMode.classList.add('hidden');
        synth.releaseKey(false);
    } else {
        // Enter sequencer mode
        currentMode = 'seq';
        modeToggle.textContent = '▦';
        modeToggle.classList.remove('play-mode');
        seqToggle.classList.add('active');
        patchMode.classList.add('hidden');
        playMode.classList.add('hidden');
        seqMode.classList.remove('hidden');

        // Store base frequencies for V/Oct control
        synth.storeBaseFrequencies();

        // Initialize sequencer UI
        createSequencerUI();
    }
}

// Toggle recording
function toggleRecording() {
    const recordBtn = document.getElementById('record-btn');

    if (!isRecording) {
        synth.startRecording();
        isRecording = true;
        recordBtn.textContent = '●';
        recordBtn.classList.add('recording');
    } else {
        synth.stopRecording();
        isRecording = false;
        recordBtn.textContent = '○';
        recordBtn.classList.remove('recording');
    }
}

// Create the 64-cell grid
function createGrid() {
    grid.innerHTML = '';
    cellElements = [];

    for (let i = 0; i < 64; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.index = i;

        // Special cells
        if (i === MELODIC_CELL) {
            cell.dataset.type = 'melodic';
        } else if (i === EVOLVE_CELL) {
            cell.dataset.type = 'evolve';
        } else if (i === RHYTHMIC_CELL) {
            cell.dataset.type = 'rhythmic';
        } else if (i === RANDOM_CELL) {
            cell.dataset.type = 'randomize';
        }

        // Create content with cryptic glyph
        const content = document.createElement('div');
        content.className = 'cell-content';
        content.textContent = generateCrypticGlyph(i);
        cell.appendChild(content);

        // Touch/click handlers
        cell.addEventListener('touchstart', handleCellTouch, { passive: false });
        cell.addEventListener('mousedown', handleCellTouch);

        grid.appendChild(cell);
        cellElements.push(cell);
    }

    // Update visual state for initially active cells
    updateAllCells();
}

// Generate cryptic glyph for a cell
function generateCrypticGlyph(index) {
    // Use position-based deterministic randomness mixed with true randomness
    const seed = index * 17 + 31;
    const categories = ['osc', 'mod', 'fx', 'seq', 'logic', 'util'];

    // Special cells get special glyphs
    if (index === MELODIC_CELL) {
        return getSpecialGlyph('melodic');
    }
    if (index === EVOLVE_CELL) {
        return getSpecialGlyph('evolve');
    }
    if (index === RHYTHMIC_CELL) {
        return getSpecialGlyph('rhythmic');
    }
    if (index === RANDOM_CELL) {
        return getSpecialGlyph('randomize');
    }

    // Others get category-based glyphs
    const category = categories[seed % categories.length];
    return getGlyph(category);
}

// Handle cell touch/click
function handleCellTouch(e) {
    e.preventDefault();
    const cell = e.currentTarget;
    const index = parseInt(cell.dataset.index);

    // Visual feedback
    cell.classList.add('signal');
    setTimeout(() => cell.classList.remove('signal'), 200);

    // Handle special cells
    if (index === MELODIC_CELL) {
        synth.nudgeMelodic();
        pulseGrid('melodic');
        return;
    }

    if (index === EVOLVE_CELL) {
        synth.evolve();
        pulseGrid('evolve');
        return;
    }

    if (index === RHYTHMIC_CELL) {
        synth.nudgeRhythmic();
        pulseGrid('rhythmic');
        return;
    }

    if (index === RANDOM_CELL) {
        synth.randomize();
        updateAllCells();
        pulseGrid('randomize');
        return;
    }

    // Regular cell toggle
    const isActive = synth.toggleCell(index);
    updateCell(index, isActive);

    // If cell is active and touched again, modulate parameters
    if (isActive) {
        synth.touchCell(index, 1);
    }
}

// Update a single cell's visual state
function updateCell(index, isActive) {
    const cell = cellElements[index];
    if (!cell) return;

    if (isActive) {
        cell.classList.add('active');
        const category = synth.getCellCategory(index);
        if (category) {
            cell.dataset.category = category;
        }
    } else {
        cell.classList.remove('active');
        delete cell.dataset.category;
    }
}

// Update all cells' visual state
function updateAllCells() {
    for (let i = 0; i < 64; i++) {
        const isActive = synth.isCellActive(i);
        updateCell(i, isActive);

        // Regenerate glyph for inactive cells occasionally
        if (!isActive && Math.random() < 0.3) {
            const content = cellElements[i].querySelector('.cell-content');
            if (content && i !== MELODIC_CELL && i !== EVOLVE_CELL && i !== RHYTHMIC_CELL && i !== RANDOM_CELL) {
                content.textContent = generateCrypticGlyph(i);
            }
        }
    }
}

// Visual pulse effect across grid
function pulseGrid(type) {
    const delay = type === 'evolve' ? 20 : 10;
    const order = type === 'evolve' ?
        // Spiral outward from center
        getSpiralOrder() :
        // Random cascade
        Array.from({ length: 64 }, (_, i) => i).sort(() => Math.random() - 0.5);

    order.forEach((index, i) => {
        setTimeout(() => {
            cellElements[index].classList.add('signal');
            setTimeout(() => cellElements[index].classList.remove('signal'), 200);
        }, i * delay);
    });
}

// Get spiral order from center
function getSpiralOrder() {
    const order = [];
    const center = { x: 3.5, y: 3.5 };

    const indexed = Array.from({ length: 64 }, (_, i) => ({
        index: i,
        x: i % 8,
        y: Math.floor(i / 8),
        dist: Math.sqrt(Math.pow((i % 8) - center.x, 2) + Math.pow(Math.floor(i / 8) - center.y, 2))
    }));

    indexed.sort((a, b) => a.dist - b.dist);
    return indexed.map(i => i.index);
}

// Animation loop for subtle visual feedback
let animationFrame = null;
function startAnimationLoop() {
    function animate() {
        // Occasionally flash connected cells
        if (Math.random() < 0.02) {
            const connections = synth.getActiveConnections();
            if (connections.length > 0) {
                const conn = connections[Math.floor(Math.random() * connections.length)];
                const indices = conn.split(/->|~>/).map(s => parseInt(s.split('.')[0]));
                indices.forEach(idx => {
                    if (!isNaN(idx) && cellElements[idx]) {
                        cellElements[idx].classList.add('connected');
                        setTimeout(() => cellElements[idx].classList.remove('connected'), 300);
                    }
                });
            }
        }

        // Subtle glyph mutations for active cells
        if (Math.random() < 0.01) {
            const activeIndices = cellElements
                .map((_, i) => i)
                .filter(i => synth.isCellActive(i) && i !== EVOLVE_CELL && i !== RANDOM_CELL);

            if (activeIndices.length > 0) {
                const idx = activeIndices[Math.floor(Math.random() * activeIndices.length)];
                if (idx !== MELODIC_CELL && idx !== EVOLVE_CELL && idx !== RHYTHMIC_CELL && idx !== RANDOM_CELL) {
                    const content = cellElements[idx].querySelector('.cell-content');
                    if (content) {
                        const category = synth.getCellCategory(idx);
                        if (category) {
                            content.textContent = getGlyph(category);
                        }
                    }
                }
            }
        }

        animationFrame = requestAnimationFrame(animate);
    }

    animate();
}

// Handle visibility change
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (synth) synth.suspend();
        if (animationFrame) cancelAnimationFrame(animationFrame);
    } else {
        if (synth) synth.resume();
        startAnimationLoop();
    }
});

// ============== PLAY MODE ==============

// Create the play mode interface
function createPlayMode() {
    createMacroGrid();
    createScaleSelector();
    createKeyboard();
}

// Create 16 macro knobs
function createMacroGrid() {
    const macroGrid = document.getElementById('macro-grid');
    macroGrid.innerHTML = '';

    for (let i = 0; i < 16; i++) {
        const knob = document.createElement('div');
        knob.className = 'macro-knob';
        knob.dataset.index = i;

        const visual = document.createElement('div');
        visual.className = 'knob-visual';

        const indicator = document.createElement('div');
        indicator.className = 'knob-indicator';
        visual.appendChild(indicator);

        const label = document.createElement('div');
        label.className = 'knob-label';
        label.textContent = '---';

        knob.appendChild(visual);
        knob.appendChild(label);

        // Touch/drag handling for knob
        let startY = 0;
        let startValue = 0;

        const handleStart = (e) => {
            e.preventDefault();
            const touch = e.touches ? e.touches[0] : e;
            startY = touch.clientY;
            startValue = macroAssignments[i]?.value || 0.5;
            knob.classList.add('active');
        };

        const handleMove = (e) => {
            if (!knob.classList.contains('active')) return;
            e.preventDefault();
            const touch = e.touches ? e.touches[0] : e;
            const deltaY = startY - touch.clientY;
            const newValue = Math.max(0, Math.min(1, startValue + deltaY / 100));

            if (macroAssignments[i]) {
                macroAssignments[i].value = newValue;
                synth.setMacroValue(i, newValue, macroAssignments[i]);
                updateKnobVisual(knob, newValue);
                // Also update seq mode knob if exists
                syncMacroKnob(i, newValue);
            }
        };

        const handleEnd = () => {
            knob.classList.remove('active');
        };

        knob.addEventListener('touchstart', handleStart, { passive: false });
        knob.addEventListener('touchmove', handleMove, { passive: false });
        knob.addEventListener('touchend', handleEnd);
        knob.addEventListener('mousedown', handleStart);
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleEnd);

        macroGrid.appendChild(knob);
    }
}

// Update knob visual rotation
function updateKnobVisual(knob, value) {
    const indicator = knob.querySelector('.knob-indicator');
    // Map 0-1 to -135 to +135 degrees
    const rotation = -135 + value * 270;
    indicator.style.transform = `translateX(-50%) rotate(${rotation}deg)`;
}

// Update all macros based on current patch
function updateMacros() {
    macroAssignments = synth.getMacroAssignments();
    const knobs = document.querySelectorAll('.macro-knob');

    knobs.forEach((knob, i) => {
        const label = knob.querySelector('.knob-label');
        const assignment = macroAssignments[i];

        if (assignment) {
            label.textContent = assignment.label;
            updateKnobVisual(knob, assignment.value);
        } else {
            label.textContent = '---';
            updateKnobVisual(knob, 0.5);
        }
    });
}

// Create root and scale selectors
function createScaleSelector() {
    const rootSelector = document.getElementById('root-selector');
    const scaleSelector = document.getElementById('scale-selector');

    // Root notes
    const roots = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    rootSelector.innerHTML = '';

    roots.forEach((note, i) => {
        const btn = document.createElement('button');
        btn.className = 'root-btn' + (i === selectedRoot ? ' active' : '');
        btn.textContent = note;
        btn.addEventListener('click', () => selectRoot(i));
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            selectRoot(i);
        });
        rootSelector.appendChild(btn);
    });

    // Scales from synth
    const scales = Object.keys(synth.scales);
    scaleSelector.innerHTML = '';

    scales.forEach(scale => {
        const btn = document.createElement('button');
        btn.className = 'scale-btn' + (scale === selectedScale ? ' active' : '');
        btn.textContent = scale;
        // Use click only - touchstart with preventDefault blocks scrolling
        btn.addEventListener('click', () => selectScale(scale));
        scaleSelector.appendChild(btn);
    });

    // Envelope toggle button
    const envToggle = document.getElementById('env-toggle');
    if (envToggle) {
        envToggle.addEventListener('click', toggleEnvelope);
        envToggle.addEventListener('touchstart', (e) => {
            e.preventDefault();
            toggleEnvelope();
        });
    }

    // Envelope sliders (sync to sequencer view)
    const envAttack = document.getElementById('env-attack');
    const envDecay = document.getElementById('env-decay');
    const envRow = document.getElementById('env-row');

    if (envAttack) {
        envAttack.addEventListener('input', (e) => {
            // Map 0-100 to 0.001-0.5 seconds (attack should be quick)
            const attack = 0.001 + (e.target.value / 100) * 0.499;
            synth.setEnvelopeAttack(attack);
            // Sync to seq mode slider
            const seqEnvAttack = document.getElementById('seq-env-attack');
            if (seqEnvAttack) seqEnvAttack.value = e.target.value;
        });
    }

    if (envDecay) {
        envDecay.addEventListener('input', (e) => {
            // Map 0-100 to 0.05-3 seconds
            const decay = 0.05 + (e.target.value / 100) * 2.95;
            synth.setEnvelopeDecay(decay);
            // Sync to seq mode slider
            const seqEnvDecay = document.getElementById('seq-env-decay');
            if (seqEnvDecay) seqEnvDecay.value = e.target.value;
        });
    }
}

// Toggle AD envelope mode (also syncs sequencer view)
function toggleEnvelope() {
    toggleEnvelopeBoth();
}

function selectRoot(index) {
    selectedRoot = index;
    const buttons = document.querySelectorAll('.root-btn');
    buttons.forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
    });
    updateKeyboard();

    // V/Oct: quantize all oscillators to new root
    const scale = synth.scales[selectedScale];
    if (scale) {
        synth.setRoot(selectedRoot, scale, true);
    }
}

function selectScale(scaleName) {
    selectedScale = scaleName;
    synth.currentScale = scaleName;
    const buttons = document.querySelectorAll('.scale-btn');
    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.textContent === scaleName);
    });
    updateKeyboard();

    // V/Oct: quantize all oscillators to new scale
    synth.setScale(scaleName, selectedRoot, true);
}

// Create 32-note keyboard (4 rows x 8 columns)
function createKeyboard() {
    const keyboard = document.getElementById('keyboard');
    keyboard.innerHTML = '';

    for (let i = 0; i < 32; i++) {
        const key = document.createElement('div');
        key.className = 'key';
        key.dataset.index = i;

        const noteSpan = document.createElement('span');
        noteSpan.className = 'key-note';

        const octaveSpan = document.createElement('span');
        octaveSpan.className = 'key-octave';

        key.appendChild(noteSpan);
        key.appendChild(octaveSpan);

        // Touch handlers
        key.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleKeyPress(i, key);
        }, { passive: false });

        key.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleKeyRelease(i, key);
        });

        key.addEventListener('mousedown', () => handleKeyPress(i, key));
        key.addEventListener('mouseup', () => handleKeyRelease(i, key));
        key.addEventListener('mouseleave', () => handleKeyRelease(i, key));

        keyboard.appendChild(key);
    }

    updateKeyboard();
}

// Update keyboard note labels
function updateKeyboard() {
    const keys = document.querySelectorAll('.key');
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const scale = synth.scales[selectedScale] || synth.scales.harmonic;

    keys.forEach((key, i) => {
        const noteSpan = key.querySelector('.key-note');
        const octaveSpan = key.querySelector('.key-octave');

        // Map key index to scale degree and octave
        const scaleIndex = i % scale.length;
        const octaveOffset = Math.floor(i / scale.length);

        // Get ratio from scale
        const ratio = scale[scaleIndex];

        // Calculate note name based on ratio (approximate to chromatic)
        const cents = 1200 * Math.log2(ratio);
        const semitones = Math.round(cents / 100);
        const noteIndex = (selectedRoot + semitones) % 12;

        noteSpan.textContent = noteNames[noteIndex];
        octaveSpan.textContent = 1 + octaveOffset;
    });
}

// Handle key press - V/Oct pitch control of patch oscillators
function handleKeyPress(index, keyElement) {
    keyElement.classList.add('pressed');

    const scale = synth.scales[selectedScale] || synth.scales.harmonic;

    // V/Oct: tune all oscillators to this key's pitch
    synth.playKey(index, scale, selectedRoot, 0.03);

    // Track which key is pressed (for visual state)
    activeNotes.set(index, true);
}

// Handle key release - pitch holds until next key
function handleKeyRelease(index, keyElement) {
    keyElement.classList.remove('pressed');

    if (activeNotes.has(index)) {
        // V/Oct style: pitch holds, no release
        // (like a sample-and-hold on pitch CV)
        synth.releaseKey(true); // true = hold pitch
        activeNotes.delete(index);
    }
}

// Release all held notes - return to base pitch
function releaseAllNotes() {
    activeNotes.forEach((_, index) => {
        const key = document.querySelector(`.key[data-index="${index}"]`);
        if (key) key.classList.remove('pressed');
    });
    activeNotes.clear();
    // Return oscillators to base pitch
    synth.releaseKey(false);
}

// ============== STEP SEQUENCER ==============

// Create the sequencer UI
function createSequencerUI() {
    createSeqMacroGrid();
    createSeqLengthSelector();
    createSeqGrid();
    setupSeqControls();
    setupSeqEnvelopeControls();
    createTransposeSeqUI();
    createLfoUI();
    startLfoEngine();
}

// Create 16 macro knobs for sequencer (2 rows of 8)
function createSeqMacroGrid() {
    const macroGrid = document.getElementById('seq-macro-grid');
    macroGrid.innerHTML = '';

    // Get current assignments
    macroAssignments = synth.getMacroAssignments();

    for (let i = 0; i < 16; i++) {
        const knob = document.createElement('div');
        knob.className = 'macro-knob';
        knob.dataset.index = i;
        knob.dataset.seqKnob = 'true';

        const visual = document.createElement('div');
        visual.className = 'knob-visual';

        const indicator = document.createElement('div');
        indicator.className = 'knob-indicator';
        visual.appendChild(indicator);

        const label = document.createElement('div');
        label.className = 'knob-label';

        // Append elements first before updating visuals
        knob.appendChild(visual);
        knob.appendChild(label);

        const assignment = macroAssignments[i];
        if (assignment) {
            label.textContent = assignment.label;
            updateKnobVisual(knob, assignment.value);
        } else {
            label.textContent = '---';
            updateKnobVisual(knob, 0.5);
        }

        // Touch/drag handling for knob
        let startY = 0;
        let startValue = 0;

        const handleStart = (e) => {
            e.preventDefault();
            const touch = e.touches ? e.touches[0] : e;
            startY = touch.clientY;
            startValue = macroAssignments[i]?.value || 0.5;
            knob.classList.add('active');
        };

        const handleMove = (e) => {
            if (!knob.classList.contains('active')) return;
            e.preventDefault();
            const touch = e.touches ? e.touches[0] : e;
            const deltaY = startY - touch.clientY;
            const newValue = Math.max(0, Math.min(1, startValue + deltaY / 100));

            if (macroAssignments[i]) {
                macroAssignments[i].value = newValue;
                synth.setMacroValue(i, newValue, macroAssignments[i]);
                updateKnobVisual(knob, newValue);
                // Also update play mode knob if exists
                syncMacroKnob(i, newValue);
            }
        };

        const handleEnd = () => {
            knob.classList.remove('active');
        };

        knob.addEventListener('touchstart', handleStart, { passive: false });
        knob.addEventListener('touchmove', handleMove, { passive: false });
        knob.addEventListener('touchend', handleEnd);
        knob.addEventListener('mousedown', handleStart);
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleEnd);

        macroGrid.appendChild(knob);
    }
}

// Sync macro knob value between play mode and seq mode
function syncMacroKnob(index, value) {
    // Update all knobs with this index (both views)
    const allKnobs = document.querySelectorAll(`.macro-knob[data-index="${index}"]`);
    allKnobs.forEach(knob => {
        updateKnobVisual(knob, value);
    });
}

// Setup sequencer envelope controls with sync to play mode
function setupSeqEnvelopeControls() {
    const seqEnvToggle = document.getElementById('seq-env-toggle');
    const seqEnvAttack = document.getElementById('seq-env-attack');
    const seqEnvDecay = document.getElementById('seq-env-decay');
    const seqEnvRow = document.getElementById('seq-env-row');

    // Sync current envelope state to seq controls
    if (seqEnvToggle) {
        seqEnvToggle.classList.toggle('active', envelopeEnabled);
        seqEnvToggle.textContent = envelopeEnabled ? '◆' : '◇';

        seqEnvToggle.addEventListener('click', () => toggleEnvelopeBoth());
        seqEnvToggle.addEventListener('touchstart', (e) => {
            e.preventDefault();
            toggleEnvelopeBoth();
        });
    }

    if (seqEnvRow) {
        seqEnvRow.classList.toggle('active', envelopeEnabled);
    }

    // Sync attack/decay slider values from play mode
    const playEnvAttack = document.getElementById('env-attack');
    const playEnvDecay = document.getElementById('env-decay');

    if (seqEnvAttack && playEnvAttack) {
        seqEnvAttack.value = playEnvAttack.value;
        seqEnvAttack.addEventListener('input', (e) => {
            const attack = 0.001 + (e.target.value / 100) * 0.499;
            synth.setEnvelopeAttack(attack);
            // Sync to play mode slider
            playEnvAttack.value = e.target.value;
        });
    }

    if (seqEnvDecay && playEnvDecay) {
        seqEnvDecay.value = playEnvDecay.value;
        seqEnvDecay.addEventListener('input', (e) => {
            const decay = 0.05 + (e.target.value / 100) * 2.95;
            synth.setEnvelopeDecay(decay);
            // Sync to play mode slider
            playEnvDecay.value = e.target.value;
        });
    }
}

// Toggle envelope and sync both views
function toggleEnvelopeBoth() {
    envelopeEnabled = !envelopeEnabled;
    synth.setEnvelopeEnabled(envelopeEnabled);

    // Update play mode controls
    const envToggle = document.getElementById('env-toggle');
    const envRow = document.getElementById('env-row');
    if (envToggle) {
        envToggle.classList.toggle('active', envelopeEnabled);
        envToggle.textContent = envelopeEnabled ? '◆' : '◇';
    }
    if (envRow) {
        envRow.classList.toggle('active', envelopeEnabled);
    }

    // Update seq mode controls
    const seqEnvToggle = document.getElementById('seq-env-toggle');
    const seqEnvRow = document.getElementById('seq-env-row');
    if (seqEnvToggle) {
        seqEnvToggle.classList.toggle('active', envelopeEnabled);
        seqEnvToggle.textContent = envelopeEnabled ? '◆' : '◇';
    }
    if (seqEnvRow) {
        seqEnvRow.classList.toggle('active', envelopeEnabled);
    }
}

// Create length selector (2-16 steps)
function createSeqLengthSelector() {
    const selector = document.getElementById('seq-length-selector');
    selector.innerHTML = '';

    for (let len = 2; len <= 16; len++) {
        const btn = document.createElement('button');
        btn.className = 'seq-len-btn' + (len === seqLength ? ' active' : '');
        btn.textContent = len;
        btn.addEventListener('click', () => setSeqLength(len));
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            setSeqLength(len);
        }, { passive: false });
        selector.appendChild(btn);
    }
}

// Set sequence length
function setSeqLength(len) {
    seqLength = len;
    const buttons = document.querySelectorAll('.seq-len-btn');
    buttons.forEach((btn, i) => {
        btn.classList.toggle('active', i + 2 === len);
    });
    updateSeqGridVisibility();
}

// Create the step knobs and buttons
function createSeqGrid() {
    const knobsContainer = document.getElementById('seq-knobs');
    const stepsContainer = document.getElementById('seq-steps');
    knobsContainer.innerHTML = '';
    stepsContainer.innerHTML = '';

    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const scale = synth.scales[selectedScale] || synth.scales.harmonic;

    for (let i = 0; i < 16; i++) {
        // Create knob column
        const knob = document.createElement('div');
        knob.className = 'seq-knob' + (seqSteps[i] ? ' active' : '');
        knob.dataset.step = i;
        if (i >= seqLength) knob.style.display = 'none';

        const knobVisual = document.createElement('div');
        knobVisual.className = 'seq-knob-visual';

        const indicator = document.createElement('div');
        indicator.className = 'seq-knob-indicator';
        knobVisual.appendChild(indicator);

        const noteLabel = document.createElement('div');
        noteLabel.className = 'seq-knob-note';
        noteLabel.textContent = getSeqNoteName(seqNotes[i], scale, noteNames);

        knob.appendChild(knobVisual);
        knob.appendChild(noteLabel);

        // Touch/drag handling for note knob
        let startY = 0;
        let startValue = 0;

        const handleKnobStart = (e) => {
            e.preventDefault();
            const touch = e.touches ? e.touches[0] : e;
            startY = touch.clientY;
            startValue = seqNotes[i];
            knob.classList.add('dragging');
        };

        const handleKnobMove = (e) => {
            if (!knob.classList.contains('dragging')) return;
            e.preventDefault();
            const touch = e.touches ? e.touches[0] : e;
            const deltaY = startY - touch.clientY;
            // 4 octaves * scale length = total notes
            const maxNote = scale.length * 4 - 1;
            const newValue = Math.max(0, Math.min(maxNote, Math.round(startValue + deltaY / 8)));
            seqNotes[i] = newValue;
            updateSeqKnobVisual(knob, newValue, scale, noteNames);
        };

        const handleKnobEnd = () => {
            knob.classList.remove('dragging');
        };

        knob.addEventListener('touchstart', handleKnobStart, { passive: false });
        knob.addEventListener('touchmove', handleKnobMove, { passive: false });
        knob.addEventListener('touchend', handleKnobEnd);
        knob.addEventListener('mousedown', handleKnobStart);
        document.addEventListener('mousemove', handleKnobMove);
        document.addEventListener('mouseup', handleKnobEnd);

        knobsContainer.appendChild(knob);

        // Create step button
        const stepBtn = document.createElement('button');
        stepBtn.className = 'seq-step-btn' + (seqSteps[i] ? ' active' : '');
        stepBtn.dataset.step = i;
        stepBtn.textContent = i + 1;
        if (i >= seqLength) stepBtn.style.display = 'none';

        stepBtn.addEventListener('click', () => toggleSeqStep(i));
        stepBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            toggleSeqStep(i);
        }, { passive: false });

        stepsContainer.appendChild(stepBtn);

        // Update knob visual
        updateSeqKnobVisual(knob, seqNotes[i], scale, noteNames);
    }
}

// Get note name for sequencer display
function getSeqNoteName(noteIndex, scale, noteNames) {
    const scaleLen = scale.length;
    const scaleIdx = noteIndex % scaleLen;
    const octave = Math.floor(noteIndex / scaleLen) + 1;

    const ratio = scale[scaleIdx];
    const cents = 1200 * Math.log2(ratio);
    const semitones = Math.round(cents / 100);
    const noteIdx = (selectedRoot + semitones) % 12;

    return noteNames[noteIdx] + octave;
}

// Update knob visual rotation and label
function updateSeqKnobVisual(knob, value, scale, noteNames) {
    const indicator = knob.querySelector('.seq-knob-indicator');
    const noteLabel = knob.querySelector('.seq-knob-note');
    const maxNote = scale.length * 4 - 1;

    // Map note to rotation (-135 to +135 degrees)
    const rotation = -135 + (value / maxNote) * 270;
    indicator.style.transform = `translateX(-50%) rotate(${rotation}deg)`;

    noteLabel.textContent = getSeqNoteName(value, scale, noteNames);
}

// Toggle step on/off
function toggleSeqStep(index) {
    seqSteps[index] = !seqSteps[index];
    const stepBtn = document.querySelector(`.seq-step-btn[data-step="${index}"]`);
    const knob = document.querySelector(`.seq-knob[data-step="${index}"]`);

    if (stepBtn) stepBtn.classList.toggle('active', seqSteps[index]);
    if (knob) knob.classList.toggle('active', seqSteps[index]);
}

// Update grid visibility based on length
function updateSeqGridVisibility() {
    const knobs = document.querySelectorAll('.seq-knob');
    const steps = document.querySelectorAll('.seq-step-btn');

    knobs.forEach((knob, i) => {
        knob.style.display = i < seqLength ? '' : 'none';
    });

    steps.forEach((step, i) => {
        step.style.display = i < seqLength ? '' : 'none';
    });
}

// Setup transport and parameter controls
function setupSeqControls() {
    const playBtn = document.getElementById('seq-play');
    const stopBtn = document.getElementById('seq-stop');
    const tempoSlider = document.getElementById('seq-tempo');
    const tempoValue = document.getElementById('seq-tempo-value');
    const transposeSlider = document.getElementById('seq-transpose');
    const transposeValue = document.getElementById('seq-transpose-value');

    playBtn.addEventListener('click', startSequencer);
    playBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startSequencer();
    }, { passive: false });

    stopBtn.addEventListener('click', stopSequencer);
    stopBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        stopSequencer();
    }, { passive: false });

    tempoSlider.value = seqTempo;
    tempoValue.textContent = seqTempo;
    tempoSlider.addEventListener('input', (e) => {
        seqTempo = parseInt(e.target.value);
        tempoValue.textContent = seqTempo;
        if (seqPlaying) {
            // Restart with new tempo (preserves current step)
            clearInterval(seqIntervalId);
            const msPerBeat = 60000 / seqTempo;
            const msPerStep = msPerBeat / 4;
            seqIntervalId = setInterval(() => {
                const prevStep = seqCurrentStep;
                seqCurrentStep = (seqCurrentStep + 1) % seqLength;

                // Check if we've completed a loop
                if (seqCurrentStep === 0 && prevStep === seqLength - 1) {
                    advanceTransposeSeq();
                }

                playSeqStep();
            }, msPerStep);
        }
    });

    transposeSlider.value = seqTranspose;
    transposeValue.textContent = seqTranspose > 0 ? '+' + seqTranspose : seqTranspose;
    transposeSlider.addEventListener('input', (e) => {
        seqTranspose = parseInt(e.target.value);
        transposeValue.textContent = seqTranspose > 0 ? '+' + seqTranspose : seqTranspose;
    });
}

// Start the sequencer
function startSequencer() {
    if (seqPlaying) return;
    seqPlaying = true;
    seqCurrentStep = 0;

    // Reset transpose sequencer state when starting
    transposeSeqLoopCount = 0;
    transposeSeqCurrentCell = 0;
    updateTransposeSeqCurrentCell();

    const playBtn = document.getElementById('seq-play');
    playBtn.classList.add('playing');

    // Calculate interval from BPM for 16th notes (4 steps per beat)
    const msPerBeat = 60000 / seqTempo;
    const msPerStep = msPerBeat / 4; // 16th notes = quarter of a beat

    // Play first step immediately
    playSeqStep();

    // Schedule subsequent steps
    seqIntervalId = setInterval(() => {
        const prevStep = seqCurrentStep;
        seqCurrentStep = (seqCurrentStep + 1) % seqLength;

        // Check if we've completed a loop (wrapped back to start)
        if (seqCurrentStep === 0 && prevStep === seqLength - 1) {
            advanceTransposeSeq();
        }

        playSeqStep();
    }, msPerStep);
}

// Stop the sequencer
function stopSequencer() {
    if (!seqPlaying) return;
    seqPlaying = false;

    if (seqIntervalId) {
        clearInterval(seqIntervalId);
        seqIntervalId = null;
    }

    const playBtn = document.getElementById('seq-play');
    if (playBtn) playBtn.classList.remove('playing');

    // Clear current step highlight
    const steps = document.querySelectorAll('.seq-step-btn');
    steps.forEach(step => step.classList.remove('current'));

    // Restore VCA if envelope mode
    if (envelopeEnabled && synth.envelopeVCA) {
        synth.envelopeVCA.gain.cancelScheduledValues(synth.ctx.currentTime);
        synth.envelopeVCA.gain.setTargetAtTime(1.0, synth.ctx.currentTime, 0.1);
    }
}

// Play current sequencer step
function playSeqStep() {
    // Update visual
    const steps = document.querySelectorAll('.seq-step-btn');
    steps.forEach((step, i) => {
        step.classList.toggle('current', i === seqCurrentStep);
    });

    // Check if step is active
    if (!seqSteps[seqCurrentStep]) return;

    // Get note index with transpose (by scale degrees)
    const scale = synth.scales[selectedScale] || synth.scales.harmonic;

    // Add transpose sequencer offset to the manual transpose
    const transposeOffset = getCurrentTransposeOffset();
    let noteIndex = seqNotes[seqCurrentStep] + seqTranspose + transposeOffset;

    // Clamp to valid range (0 to 4 octaves of scale)
    const maxNote = scale.length * 4 - 1;
    noteIndex = Math.max(0, Math.min(maxNote, noteIndex));

    // Play the note using the V/Oct system
    synth.playKey(noteIndex, scale, selectedRoot, 0.01);
}

// ============== TRANSPOSE SEQUENCER ==============

// Create the transpose sequencer UI
function createTransposeSeqUI() {
    const toggleBtn = document.getElementById('transpose-seq-toggle');
    const randomBtn = document.getElementById('transpose-seq-random');
    const cellsContainer = document.getElementById('transpose-seq-cells');

    // Setup toggle button
    if (toggleBtn) {
        toggleBtn.classList.toggle('active', transposeSeqEnabled);
        toggleBtn.textContent = transposeSeqEnabled ? '◆' : '◇';
        toggleBtn.addEventListener('click', toggleTransposeSeq);
    }

    // Setup random button
    if (randomBtn) {
        randomBtn.classList.toggle('active', transposeSeqRandom);
        randomBtn.addEventListener('click', toggleTransposeSeqRandom);
    }

    // Create 8 transpose cells
    cellsContainer.innerHTML = '';

    for (let i = 0; i < 8; i++) {
        const cell = createTransposeCell(i);
        cellsContainer.appendChild(cell);
    }
}

// Create a single transpose cell
function createTransposeCell(index) {
    const cellData = transposeSeqCells[index];
    const cell = document.createElement('div');
    cell.className = 'transpose-cell' + (cellData.enabled ? ' active' : '');
    cell.dataset.index = index;

    // Enable button (top)
    const enableBtn = document.createElement('button');
    enableBtn.className = 'transpose-cell-enable' + (cellData.enabled ? ' active' : '');
    enableBtn.textContent = index + 1;
    enableBtn.addEventListener('click', () => toggleTransposeCell(index));

    // Transpose knob (middle)
    const knob = document.createElement('div');
    knob.className = 'transpose-cell-knob';

    const indicator = document.createElement('div');
    indicator.className = 'transpose-cell-indicator';
    knob.appendChild(indicator);

    // Touch/drag handling for transpose knob
    let startY = 0;
    let startValue = 0;

    const handleKnobStart = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const touch = e.touches ? e.touches[0] : e;
        startY = touch.clientY;
        startValue = cellData.transpose;
        knob.classList.add('dragging');
    };

    const handleKnobMove = (e) => {
        if (!knob.classList.contains('dragging')) return;
        e.preventDefault();
        const touch = e.touches ? e.touches[0] : e;
        const deltaY = startY - touch.clientY;
        const newValue = Math.max(-12, Math.min(12, Math.round(startValue + deltaY / 6)));
        cellData.transpose = newValue;
        updateTransposeCellVisual(cell, cellData);
    };

    const handleKnobEnd = () => {
        knob.classList.remove('dragging');
    };

    knob.addEventListener('touchstart', handleKnobStart, { passive: false });
    knob.addEventListener('touchmove', handleKnobMove, { passive: false });
    knob.addEventListener('touchend', handleKnobEnd);
    knob.addEventListener('mousedown', handleKnobStart);
    document.addEventListener('mousemove', handleKnobMove);
    document.addEventListener('mouseup', handleKnobEnd);

    // Transpose value display
    const valueLabel = document.createElement('div');
    valueLabel.className = 'transpose-cell-value';
    valueLabel.textContent = cellData.transpose > 0 ? '+' + cellData.transpose : cellData.transpose;

    // Cycle controls (bottom)
    const cycleContainer = document.createElement('div');
    cycleContainer.className = 'transpose-cell-cycle';

    const cycleDown = document.createElement('button');
    cycleDown.className = 'transpose-cycle-btn';
    cycleDown.textContent = '−';
    cycleDown.addEventListener('click', () => adjustTransposeCycle(index, -1));

    const cycleValue = document.createElement('span');
    cycleValue.className = 'transpose-cycle-value';
    cycleValue.textContent = cellData.cycle;

    const cycleUp = document.createElement('button');
    cycleUp.className = 'transpose-cycle-btn';
    cycleUp.textContent = '+';
    cycleUp.addEventListener('click', () => adjustTransposeCycle(index, 1));

    cycleContainer.appendChild(cycleDown);
    cycleContainer.appendChild(cycleValue);
    cycleContainer.appendChild(cycleUp);

    // Assemble cell
    cell.appendChild(enableBtn);
    cell.appendChild(knob);
    cell.appendChild(valueLabel);
    cell.appendChild(cycleContainer);

    // Update visual
    updateTransposeCellVisual(cell, cellData);

    return cell;
}

// Update transpose cell visual
function updateTransposeCellVisual(cell, cellData) {
    const indicator = cell.querySelector('.transpose-cell-indicator');
    const valueLabel = cell.querySelector('.transpose-cell-value');
    const cycleValue = cell.querySelector('.transpose-cycle-value');

    // Map -12 to +12 to rotation (-135 to +135 degrees)
    const rotation = (cellData.transpose / 12) * 135;
    indicator.style.transform = `translateX(-50%) rotate(${rotation}deg)`;

    valueLabel.textContent = cellData.transpose > 0 ? '+' + cellData.transpose : cellData.transpose;
    cycleValue.textContent = cellData.cycle;
}

// Toggle transpose sequencer on/off
function toggleTransposeSeq() {
    transposeSeqEnabled = !transposeSeqEnabled;
    const toggleBtn = document.getElementById('transpose-seq-toggle');

    if (toggleBtn) {
        toggleBtn.classList.toggle('active', transposeSeqEnabled);
        toggleBtn.textContent = transposeSeqEnabled ? '◆' : '◇';
    }

    // Reset state when enabling
    if (transposeSeqEnabled) {
        transposeSeqCurrentCell = 0;
        transposeSeqLoopCount = 0;
        updateTransposeSeqCurrentCell();
    } else {
        // Clear current highlight
        const cells = document.querySelectorAll('.transpose-cell');
        cells.forEach(cell => cell.classList.remove('current'));
    }
}

// Toggle random mode
function toggleTransposeSeqRandom() {
    transposeSeqRandom = !transposeSeqRandom;
    const randomBtn = document.getElementById('transpose-seq-random');

    if (randomBtn) {
        randomBtn.classList.toggle('active', transposeSeqRandom);
    }
}

// Toggle individual transpose cell
function toggleTransposeCell(index) {
    const cellData = transposeSeqCells[index];
    cellData.enabled = !cellData.enabled;

    const cell = document.querySelector(`.transpose-cell[data-index="${index}"]`);
    const enableBtn = cell?.querySelector('.transpose-cell-enable');

    if (cell) cell.classList.toggle('active', cellData.enabled);
    if (enableBtn) enableBtn.classList.toggle('active', cellData.enabled);
}

// Adjust cycle value for a cell
function adjustTransposeCycle(index, delta) {
    const cellData = transposeSeqCells[index];
    cellData.cycle = Math.max(1, Math.min(16, cellData.cycle + delta));

    const cell = document.querySelector(`.transpose-cell[data-index="${index}"]`);
    if (cell) {
        updateTransposeCellVisual(cell, cellData);
    }
}

// Get enabled transpose cells
function getEnabledTransposeCells() {
    return transposeSeqCells
        .map((cell, index) => ({ ...cell, index }))
        .filter(cell => cell.enabled);
}

// Update current cell highlight
function updateTransposeSeqCurrentCell() {
    const cells = document.querySelectorAll('.transpose-cell');
    const enabledCells = getEnabledTransposeCells();

    cells.forEach((cell, i) => {
        const isCurrentEnabled = enabledCells.length > 0 &&
            enabledCells[transposeSeqCurrentCell % enabledCells.length]?.index === i;
        cell.classList.toggle('current', transposeSeqEnabled && isCurrentEnabled);
    });
}

// Get current transpose value from transpose sequencer
function getCurrentTransposeOffset() {
    if (!transposeSeqEnabled) return 0;

    const enabledCells = getEnabledTransposeCells();
    if (enabledCells.length === 0) return 0;

    const currentCellIndex = transposeSeqCurrentCell % enabledCells.length;
    return enabledCells[currentCellIndex].transpose;
}

// Advance transpose sequencer (called when step seq completes a loop)
function advanceTransposeSeq() {
    if (!transposeSeqEnabled) return;

    const enabledCells = getEnabledTransposeCells();
    if (enabledCells.length === 0) return;

    const currentCellIndex = transposeSeqCurrentCell % enabledCells.length;
    const currentCell = enabledCells[currentCellIndex];

    transposeSeqLoopCount++;

    // Check if we've completed enough loops for this cell
    if (transposeSeqLoopCount >= currentCell.cycle) {
        transposeSeqLoopCount = 0;

        if (transposeSeqRandom) {
            // Random mode: pick any enabled cell (could be same)
            transposeSeqCurrentCell = Math.floor(Math.random() * enabledCells.length);
        } else {
            // Sequential mode: advance to next enabled cell
            transposeSeqCurrentCell = (currentCellIndex + 1) % enabledCells.length;
        }

        updateTransposeSeqCurrentCell();
    }
}

// ============== LFO SYSTEM ==============

// Get destination name for display
function getLfoDestName(destIndex, lfoIndex) {
    if (destIndex < 16) {
        // Macro destination
        const assignment = macroAssignments[destIndex];
        return assignment ? assignment.label : `M${destIndex + 1}`;
    } else {
        // LFO rate destination (16-21 = LFO 1-6)
        const targetLfo = destIndex - 16;
        if (targetLfo === lfoIndex) {
            return 'SELF'; // Can't modulate self, will skip
        }
        return `L${targetLfo + 1}RT`;
    }
}

// Get total number of destinations (16 macros + 6 LFO rates)
function getLfoDestCount() {
    return 22;
}

// Create the LFO UI
function createLfoUI() {
    const lfoGrid = document.getElementById('lfo-grid');
    if (!lfoGrid) return;

    lfoGrid.innerHTML = '';

    for (let i = 0; i < 6; i++) {
        const cell = createLfoCell(i);
        lfoGrid.appendChild(cell);
    }
}

// Create a single LFO cell
function createLfoCell(index) {
    const lfo = lfos[index];
    const cell = document.createElement('div');
    cell.className = 'lfo-cell' + (lfo.enabled ? ' active' : '');
    cell.dataset.index = index;

    // Header row: enable button + shape selector
    const headerRow = document.createElement('div');
    headerRow.className = 'lfo-header-row';

    const enableBtn = document.createElement('button');
    enableBtn.className = 'lfo-enable' + (lfo.enabled ? ' active' : '');
    enableBtn.textContent = index + 1;
    enableBtn.addEventListener('click', () => toggleLfo(index));

    const shapeBtn = document.createElement('button');
    shapeBtn.className = 'lfo-shape';
    shapeBtn.textContent = LFO_SHAPES[lfo.shape];
    shapeBtn.addEventListener('click', () => cycleLfoShape(index));

    headerRow.appendChild(enableBtn);
    headerRow.appendChild(shapeBtn);

    // Visual waveform display
    const visual = document.createElement('div');
    visual.className = 'lfo-visual';

    const wave = document.createElement('canvas');
    wave.className = 'lfo-wave';
    wave.width = 80;
    wave.height = 20;
    drawLfoWave(wave, lfo.shape);

    const indicator = document.createElement('div');
    indicator.className = 'lfo-indicator';

    visual.appendChild(wave);
    visual.appendChild(indicator);

    // Rate row
    const rateRow = document.createElement('div');
    rateRow.className = 'lfo-param-row';

    const rateLabel = document.createElement('span');
    rateLabel.className = 'lfo-param-label';
    rateLabel.textContent = 'RT';

    const rateSlider = document.createElement('input');
    rateSlider.type = 'range';
    rateSlider.className = 'lfo-slider';
    rateSlider.min = '0';
    rateSlider.max = '100';
    rateSlider.value = lfo.rate * 100;
    rateSlider.addEventListener('input', (e) => {
        lfo.rate = e.target.value / 100;
    });

    rateRow.appendChild(rateLabel);
    rateRow.appendChild(rateSlider);

    // Depth row
    const depthRow = document.createElement('div');
    depthRow.className = 'lfo-param-row';

    const depthLabel = document.createElement('span');
    depthLabel.className = 'lfo-param-label';
    depthLabel.textContent = 'DP';

    const depthSlider = document.createElement('input');
    depthSlider.type = 'range';
    depthSlider.className = 'lfo-slider';
    depthSlider.min = '0';
    depthSlider.max = '100';
    depthSlider.value = lfo.depth * 100;
    depthSlider.addEventListener('input', (e) => {
        lfo.depth = e.target.value / 100;
    });

    depthRow.appendChild(depthLabel);
    depthRow.appendChild(depthSlider);

    // Destination row
    const destRow = document.createElement('div');
    destRow.className = 'lfo-dest-row';

    const destPrev = document.createElement('button');
    destPrev.className = 'lfo-dest-prev';
    destPrev.textContent = '◂';
    destPrev.addEventListener('click', () => changeLfoDest(index, -1));

    const destDisplay = document.createElement('div');
    destDisplay.className = 'lfo-dest';
    destDisplay.textContent = getLfoDestName(lfo.destination, index);

    const destNext = document.createElement('button');
    destNext.className = 'lfo-dest-next';
    destNext.textContent = '▸';
    destNext.addEventListener('click', () => changeLfoDest(index, 1));

    destRow.appendChild(destPrev);
    destRow.appendChild(destDisplay);
    destRow.appendChild(destNext);

    // Assemble cell
    cell.appendChild(headerRow);
    cell.appendChild(visual);
    cell.appendChild(rateRow);
    cell.appendChild(depthRow);
    cell.appendChild(destRow);

    return cell;
}

// Draw LFO waveform on canvas
function drawLfoWave(canvas, shapeIndex) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const mid = h / 2;

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#3a5a5a';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let x = 0; x < w; x++) {
        const phase = (x / w) * 2; // 2 cycles
        let y;

        switch (shapeIndex) {
            case 0: // sine
                y = Math.sin(phase * Math.PI * 2) * 0.8;
                break;
            case 1: // tri
                y = (Math.abs((phase % 1) * 4 - 2) - 1) * 0.8;
                break;
            case 2: // saw
                y = ((phase % 1) * 2 - 1) * 0.8;
                break;
            case 3: // sqr
                y = ((phase % 1) < 0.5 ? 1 : -1) * 0.6;
                break;
            case 4: // rnd (smooth random approximation)
                y = Math.sin(phase * Math.PI * 7.3) * Math.cos(phase * Math.PI * 3.1) * 0.8;
                break;
            case 5: // s&h (stepped)
                const step = Math.floor(phase * 4);
                const vals = [0.6, -0.4, 0.2, -0.8];
                y = vals[step % 4];
                break;
            default:
                y = 0;
        }

        const py = mid - y * (h / 2 - 2);
        if (x === 0) {
            ctx.moveTo(x, py);
        } else {
            ctx.lineTo(x, py);
        }
    }

    ctx.stroke();
}

// Toggle LFO on/off
function toggleLfo(index) {
    const lfo = lfos[index];
    lfo.enabled = !lfo.enabled;

    const cell = document.querySelector(`.lfo-cell[data-index="${index}"]`);
    const enableBtn = cell?.querySelector('.lfo-enable');

    if (cell) cell.classList.toggle('active', lfo.enabled);
    if (enableBtn) enableBtn.classList.toggle('active', lfo.enabled);

    // Reset phase when enabling
    if (lfo.enabled) {
        lfoPhases[index] = 0;
    }
}

// Cycle through LFO shapes
function cycleLfoShape(index) {
    const lfo = lfos[index];
    lfo.shape = (lfo.shape + 1) % LFO_SHAPES.length;

    const cell = document.querySelector(`.lfo-cell[data-index="${index}"]`);
    const shapeBtn = cell?.querySelector('.lfo-shape');
    const wave = cell?.querySelector('.lfo-wave');

    if (shapeBtn) shapeBtn.textContent = LFO_SHAPES[lfo.shape];
    if (wave) drawLfoWave(wave, lfo.shape);
}

// Change LFO destination
function changeLfoDest(index, delta) {
    const lfo = lfos[index];
    const destCount = getLfoDestCount();

    lfo.destination = (lfo.destination + delta + destCount) % destCount;

    // Skip self-modulation for LFO rate destinations
    if (lfo.destination >= 16 && lfo.destination - 16 === index) {
        lfo.destination = (lfo.destination + delta + destCount) % destCount;
    }

    const cell = document.querySelector(`.lfo-cell[data-index="${index}"]`);
    const destDisplay = cell?.querySelector('.lfo-dest');

    if (destDisplay) destDisplay.textContent = getLfoDestName(lfo.destination, index);
}

// Calculate LFO value based on shape and phase
function calculateLfoValue(shapeIndex, phase) {
    switch (shapeIndex) {
        case 0: // sine
            return Math.sin(phase * Math.PI * 2);
        case 1: // tri
            return Math.abs((phase % 1) * 4 - 2) - 1;
        case 2: // saw
            return (phase % 1) * 2 - 1;
        case 3: // sqr
            return (phase % 1) < 0.5 ? 1 : -1;
        case 4: // rnd (smooth noise using phase)
            return Math.sin(phase * 13.7) * Math.cos(phase * 7.3);
        case 5: // s&h (sample and hold - steps)
            // Update value only at integer phase boundaries
            return Math.sin(Math.floor(phase * 4) * 2.3) * Math.cos(Math.floor(phase * 4) * 1.7);
        default:
            return 0;
    }
}

// Start the LFO engine (runs continuously when in seq mode)
function startLfoEngine() {
    if (lfoAnimationId) return;

    lastLfoTime = performance.now();

    function updateLfos() {
        const now = performance.now();
        const deltaTime = (now - lastLfoTime) / 1000; // seconds
        lastLfoTime = now;

        // Only process if in seq mode
        if (currentMode !== 'seq') {
            lfoAnimationId = requestAnimationFrame(updateLfos);
            return;
        }

        // First pass: calculate all LFO values
        for (let i = 0; i < 6; i++) {
            const lfo = lfos[i];
            if (!lfo.enabled) {
                lfoValues[i] = 0;
                continue;
            }

            // Map rate 0-1 to Hz (0.01 to 20 Hz, exponential)
            let rateHz = 0.01 * Math.pow(2000, lfo.rate);

            // Check if another LFO is modulating this LFO's rate
            for (let j = 0; j < 6; j++) {
                if (i !== j && lfos[j].enabled && lfos[j].destination === 16 + i) {
                    // Modulate rate by +/- 50%
                    rateHz *= 1 + lfoValues[j] * lfos[j].depth * 0.5;
                }
            }

            // Update phase
            lfoPhases[i] += rateHz * deltaTime;
            if (lfoPhases[i] > 1000) lfoPhases[i] -= 1000; // Prevent overflow

            // Calculate value
            lfoValues[i] = calculateLfoValue(lfo.shape, lfoPhases[i]);
        }

        // Second pass: apply LFO modulation to macros
        for (let i = 0; i < 6; i++) {
            const lfo = lfos[i];
            if (!lfo.enabled || lfo.destination >= 16) continue;

            const macroIndex = lfo.destination;
            const assignment = macroAssignments[macroIndex];
            if (!assignment) continue;

            // Calculate modulated value
            const modAmount = lfoValues[i] * lfo.depth;
            const baseValue = assignment.value;
            const modValue = Math.max(0, Math.min(1, baseValue + modAmount * 0.5));

            // Apply to synth (but don't update stored value)
            synth.setMacroValue(macroIndex, modValue, assignment);
        }

        // Update visual indicators
        updateLfoVisuals();

        lfoAnimationId = requestAnimationFrame(updateLfos);
    }

    lfoAnimationId = requestAnimationFrame(updateLfos);
}

// Stop LFO engine
function stopLfoEngine() {
    if (lfoAnimationId) {
        cancelAnimationFrame(lfoAnimationId);
        lfoAnimationId = null;
    }
}

// Update LFO visual indicators
function updateLfoVisuals() {
    for (let i = 0; i < 6; i++) {
        const cell = document.querySelector(`.lfo-cell[data-index="${i}"]`);
        if (!cell) continue;

        const indicator = cell.querySelector('.lfo-indicator');
        if (indicator && lfos[i].enabled) {
            // Map LFO value (-1 to 1) to position (10% to 90%)
            const pos = 50 + lfoValues[i] * 40;
            indicator.style.left = `${pos}%`;
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
