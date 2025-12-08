// PATCH UNKNOWN - The arcane interface
// Each cell is a mystery. Meanings are hidden. Sound is the only truth.

let synth = null;
let grid = null;
let cellElements = [];

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

        createGrid();
        startAnimationLoop();
    });

    // Prevent default touch behaviors
    document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
