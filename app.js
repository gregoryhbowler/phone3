// PATCH UNKNOWN - The arcane interface
// Each cell is a mystery. Meanings are hidden. Sound is the only truth.

let synth = null;
let grid = null;
let cellElements = [];

// Mode state
let currentMode = 'patch'; // 'patch' or 'play'
let isRecording = false;

// Play mode state
let selectedRoot = 0; // 0 = C, 1 = C#, etc.
let selectedScale = 'harmonic';
let macroAssignments = [];
let activeNotes = new Map(); // frequency -> oscillator for polyphonic playing
let envelopeEnabled = false; // AD envelope toggle

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
            target.classList.contains('env-slider')) {
            return; // Allow native scroll/drag
        }
        e.preventDefault();
    }, { passive: false });
}

// Setup header buttons
function setupHeader() {
    const modeToggle = document.getElementById('mode-toggle');
    const recordBtn = document.getElementById('record-btn');

    modeToggle.addEventListener('click', toggleMode);
    modeToggle.addEventListener('touchstart', (e) => {
        e.preventDefault();
        toggleMode();
    });

    recordBtn.addEventListener('click', toggleRecording);
    recordBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        toggleRecording();
    });
}

// Toggle between patch and play modes
function toggleMode() {
    const modeToggle = document.getElementById('mode-toggle');
    const patchMode = document.getElementById('patch-mode');
    const playMode = document.getElementById('play-mode');

    if (currentMode === 'patch') {
        currentMode = 'play';
        modeToggle.textContent = '♩';
        modeToggle.classList.add('play-mode');
        patchMode.classList.add('hidden');
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
        // Release pitch CV (return to base)
        synth.releaseKey(false);
        activeNotes.clear();
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

    // Envelope sliders
    const envAttack = document.getElementById('env-attack');
    const envDecay = document.getElementById('env-decay');
    const envRow = document.getElementById('env-row');

    if (envAttack) {
        envAttack.addEventListener('input', (e) => {
            // Map 0-100 to 0.001-0.5 seconds (attack should be quick)
            const attack = 0.001 + (e.target.value / 100) * 0.499;
            synth.setEnvelopeAttack(attack);
        });
    }

    if (envDecay) {
        envDecay.addEventListener('input', (e) => {
            // Map 0-100 to 0.05-3 seconds
            const decay = 0.05 + (e.target.value / 100) * 2.95;
            synth.setEnvelopeDecay(decay);
        });
    }
}

// Toggle AD envelope mode
function toggleEnvelope() {
    envelopeEnabled = !envelopeEnabled;
    synth.setEnvelopeEnabled(envelopeEnabled);

    const envToggle = document.getElementById('env-toggle');
    const envRow = document.getElementById('env-row');

    if (envToggle) {
        envToggle.classList.toggle('active', envelopeEnabled);
        // ◇ = drone/hold mode, ◆ = envelope mode
        envToggle.textContent = envelopeEnabled ? '◆' : '◇';
    }

    if (envRow) {
        envRow.classList.toggle('active', envelopeEnabled);
    }
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
