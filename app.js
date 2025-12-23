// MOTIF UNKNOWN - Generative melodic phrase engine
// Continuous melodic output with tintinnabuli mode

let synth = null;
let grid = null;
let cellElements = [];
let isRecording = false;

// Header control state
const ROOT_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
let currentRootIndex = 0;

const SCALE_ORDER = ['major', 'minor', 'dorian', 'harmonic', 'dreamHouse', 'pentatonic', 'lydian', 'mixolydian', 'phrygian'];
const SCALE_DISPLAY = {
    'major': 'MAJ', 'minor': 'MIN', 'dorian': 'DOR', 'harmonic': 'HAR',
    'dreamHouse': 'DRM', 'pentatonic': 'PEN', 'lydian': 'LYD',
    'mixolydian': 'MIX', 'phrygian': 'PHR'
};
let currentScaleIndex = 0;

const TINT_MODES = ['off', 'above', 'below', 'alt'];
const TINT_DISPLAY = { 'off': 'T', 'above': 'T↑', 'below': 'T↓', 'alt': 'T~' };
let currentTintIndex = 0;

// Corner cell indices
const HARMONY_CELL = 0;      // Upper left - more harmony
const MINIMALIST_CELL = 7;   // Upper right - more minimalist
const TIMBRE_CELL = 56;      // Lower left - timbral randomization
const RANDOM_CELL = 63;      // Lower right - randomize patch

// Initialize the application
async function init() {
    grid = document.getElementById('grid');
    const overlay = document.getElementById('start-overlay');

    overlay.addEventListener('click', async () => {
        overlay.classList.add('hidden');

        synth = new PatchUnknown();
        await synth.init();

        setupHeader();
        createGrid();
        startAnimationLoop();
    });

    // Prevent default touch behaviors on grid
    document.addEventListener('touchmove', e => {
        if (e.target.closest('#grid')) {
            e.preventDefault();
        }
    }, { passive: false });
}

// Setup header button handlers
function setupHeader() {
    const rootBtn = document.getElementById('root-btn');
    const scaleBtn = document.getElementById('scale-btn');
    const tintBtn = document.getElementById('tint-btn');
    const recordBtn = document.getElementById('record-btn');

    // Root note cycling
    rootBtn.addEventListener('click', cycleRoot);
    rootBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        cycleRoot();
    }, { passive: false });

    // Scale cycling
    scaleBtn.addEventListener('click', cycleScale);
    scaleBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        cycleScale();
    }, { passive: false });

    // Tintinnabuli mode cycling
    tintBtn.addEventListener('click', cycleTintinnabuli);
    tintBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        cycleTintinnabuli();
    }, { passive: false });

    // Recording toggle
    recordBtn.addEventListener('click', toggleRecording);
    recordBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        toggleRecording();
    }, { passive: false });
}

// Cycle through root notes
function cycleRoot() {
    currentRootIndex = (currentRootIndex + 1) % ROOT_NOTES.length;
    const rootBtn = document.getElementById('root-btn');
    rootBtn.textContent = ROOT_NOTES[currentRootIndex];

    // Update synth root (convert to semitones from C)
    synth.setRootSemitones(currentRootIndex);

    // Visual feedback
    rootBtn.classList.add('active');
    setTimeout(() => rootBtn.classList.remove('active'), 200);
}

// Cycle through scales
function cycleScale() {
    currentScaleIndex = (currentScaleIndex + 1) % SCALE_ORDER.length;
    const scaleName = SCALE_ORDER[currentScaleIndex];
    const scaleBtn = document.getElementById('scale-btn');
    scaleBtn.textContent = SCALE_DISPLAY[scaleName];

    // Update synth scale
    synth.currentScale = scaleName;

    // Visual feedback
    scaleBtn.classList.add('active');
    setTimeout(() => scaleBtn.classList.remove('active'), 200);
}

// Cycle through tintinnabuli modes
function cycleTintinnabuli() {
    currentTintIndex = (currentTintIndex + 1) % TINT_MODES.length;
    const mode = TINT_MODES[currentTintIndex];
    const tintBtn = document.getElementById('tint-btn');
    tintBtn.textContent = TINT_DISPLAY[mode];

    if (mode === 'off') {
        synth.tintinnabuliEnabled = false;
        tintBtn.classList.remove('active');
    } else {
        synth.tintinnabuliEnabled = true;
        synth.tintinnabuliMode = mode === 'alt' ? 'alternating' : mode;
        tintBtn.classList.add('active');
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

        // Special corner cells
        if (i === HARMONY_CELL) {
            cell.dataset.type = 'harmony';
        } else if (i === MINIMALIST_CELL) {
            cell.dataset.type = 'minimalist';
        } else if (i === TIMBRE_CELL) {
            cell.dataset.type = 'timbre';
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
    const seed = index * 17 + 31;
    const categories = ['osc', 'mod', 'fx', 'seq', 'logic', 'util'];

    // Special cells get special glyphs
    if (index === HARMONY_CELL) {
        return getSpecialGlyph('harmony');
    }
    if (index === MINIMALIST_CELL) {
        return getSpecialGlyph('minimalist');
    }
    if (index === TIMBRE_CELL) {
        return getSpecialGlyph('timbre');
    }
    if (index === RANDOM_CELL) {
        return getSpecialGlyph('randomize');
    }

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

    // Handle corner cells with new behaviors
    if (index === HARMONY_CELL) {
        synth.nudgeHarmony();
        pulseGrid('harmony');
        return;
    }

    if (index === MINIMALIST_CELL) {
        synth.nudgeMinimalist();
        pulseGrid('minimalist');
        return;
    }

    if (index === TIMBRE_CELL) {
        synth.randomizeTimbre();
        pulseGrid('timbre');
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
            if (content && i !== HARMONY_CELL && i !== MINIMALIST_CELL &&
                i !== TIMBRE_CELL && i !== RANDOM_CELL) {
                content.textContent = generateCrypticGlyph(i);
            }
        }
    }
}

// Visual pulse effect across grid
function pulseGrid(type) {
    const delay = type === 'minimalist' ? 30 : 15;
    let order;

    if (type === 'harmony') {
        // Radiate from upper left
        order = Array.from({ length: 64 }, (_, i) => i);
    } else if (type === 'minimalist') {
        // Slow wave from upper right
        order = getSpiralOrder();
    } else if (type === 'timbre') {
        // Random scatter
        order = Array.from({ length: 64 }, (_, i) => i).sort(() => Math.random() - 0.5);
    } else {
        // Random cascade for randomize
        order = Array.from({ length: 64 }, (_, i) => i).sort(() => Math.random() - 0.5);
    }

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

// Animation loop for visual feedback
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
                .filter(i => synth.isCellActive(i) &&
                    i !== HARMONY_CELL && i !== MINIMALIST_CELL &&
                    i !== TIMBRE_CELL && i !== RANDOM_CELL);

            if (activeIndices.length > 0) {
                const idx = activeIndices[Math.floor(Math.random() * activeIndices.length)];
                const content = cellElements[idx].querySelector('.cell-content');
                if (content) {
                    const category = synth.getCellCategory(idx);
                    if (category) {
                        content.textContent = getGlyph(category);
                    }
                }
            }
        }

        // Visual feedback for phrase notes (pulse random cells on beat)
        if (synth.phraseActive && Math.random() < 0.15) {
            const activeIndices = cellElements
                .map((_, i) => i)
                .filter(i => synth.isCellActive(i));

            if (activeIndices.length > 0) {
                const idx = activeIndices[Math.floor(Math.random() * activeIndices.length)];
                cellElements[idx].classList.add('note-active');
                setTimeout(() => cellElements[idx].classList.remove('note-active'), 150);
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
