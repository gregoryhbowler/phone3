// Obscure ASCII/Unicode glyphs for each module type
// These are deliberately cryptic and non-descriptive

const GLYPHS = {
    // Oscillator glyphs
    osc: [
        `◊∿◊\n∿ ∿\n◊∿◊`,
        `╭─╮\n│○│\n╰─╯`,
        `▲△▲\n△▲△\n▲△▲`,
        `┌┬┐\n├┼┤\n└┴┘`,
        `⊚─⊚\n│×│\n⊚─⊚`,
        `∴∵∴\n∵∴∵\n∴∵∴`,
        `◈◇◈\n◇◆◇\n◈◇◈`,
        `≋≋≋\n≋◎≋\n≋≋≋`,
        `⌇⌇⌇\n⌇◉⌇\n⌇⌇⌇`,
        `╔═╗\n║∞║\n╚═╝`,
        `┏━┓\n┃◯┃\n┗━┛`,
        `▓░▓\n░▒░\n▓░▓`,
        `⫷⫸\n⫷⫸\n⫷⫸`,
        `⟁⟁⟁\n⟁◎⟁\n⟁⟁⟁`,
        `⧫⧫⧫\n⧫ ⧫\n⧫⧫⧫`,
        `⬡⬢⬡\n⬢⬡⬢\n⬡⬢⬡`,
        `⎔⎔⎔\n⎔◈⎔\n⎔⎔⎔`,
        `⌬⌬⌬\n⌬⌬⌬\n⌬⌬⌬`,
        `◬◬◬\n◬◭◬\n◬◬◬`,
        `⧈⧈⧈\n⧈⧉⧈\n⧈⧈⧈`
    ],

    // Modulator glyphs
    mod: [
        `↻↺↻\n↺◎↺\n↻↺↻`,
        `⟳⟲⟳\n⟲⊛⟲\n⟳⟲⟳`,
        `∿∿∿\n∿◦∿\n∿∿∿`,
        `⤢⤡⤢\n⤡◇⤡\n⤢⤡⤢`,
        `⇶⇶⇶\n⇶⊙⇶\n⇶⇶⇶`,
        `↯↯↯\n↯◉↯\n↯↯↯`,
        `⥀⥁⥀\n⥁⊚⥁\n⥀⥁⥀`,
        `↝↝↝\n↝◎↝\n↝↝↝`,
        `⇝⇜⇝\n⇜⊕⇜\n⇝⇜⇝`,
        `⤳⤳⤳\n⤳⊗⤳\n⤳⤳⤳`,
        `⥉⥊⥉\n⥊⊛⥊\n⥉⥊⥉`,
        `⟿⟿⟿\n⟿◈⟿\n⟿⟿⟿`,
        `⤻⤺⤻\n⤺⊜⤺\n⤻⤺⤻`,
        `⇢⇠⇢\n⇠◉⇠\n⇢⇠⇢`,
        `⤼⤽⤼\n⤽⊝⤽\n⤼⤽⤼`,
        `↭↭↭\n↭⊙↭\n↭↭↭`,
        `⥂⥃⥂\n⥃◎⥃\n⥂⥃⥂`,
        `⇿⇿⇿\n⇿⊚⇿\n⇿⇿⇿`,
        `⥄⥅⥄\n⥅⊛⥅\n⥄⥅⥄`,
        `⤿⤾⤿\n⤾◇⤾\n⤿⤾⤿`
    ],

    // Effects glyphs
    fx: [
        `▒▓▒\n▓█▓\n▒▓▒`,
        `░▒░\n▒▓▒\n░▒░`,
        `┼┼┼\n┼◎┼\n┼┼┼`,
        `╳╳╳\n╳⊛╳\n╳╳╳`,
        `⋰⋱⋰\n⋱◈⋱\n⋰⋱⋰`,
        `⋮⋯⋮\n⋯⊗⋯\n⋮⋯⋮`,
        `⁚⁛⁚\n⁛◉⁛\n⁚⁛⁚`,
        `⁘⁙⁘\n⁙⊕⁙\n⁘⁙⁘`,
        `∷∶∷\n∶◎∶\n∷∶∷`,
        `⁞⁝⁞\n⁝⊚⁝\n⁞⁝⁞`,
        `⋄⋄⋄\n⋄◆⋄\n⋄⋄⋄`,
        `⋆⋆⋆\n⋆★⋆\n⋆⋆⋆`,
        `∘∙∘\n∙◉∙\n∘∙∘`,
        `⊹⊹⊹\n⊹⊛⊹\n⊹⊹⊹`,
        `⊶⊷⊶\n⊷◎⊷\n⊶⊷⊶`,
        `⊰⊱⊰\n⊱⊚⊱\n⊰⊱⊰`,
        `⋈⋈⋈\n⋈⊗⋈\n⋈⋈⋈`,
        `⋐⋑⋐\n⋑◈⋑\n⋐⋑⋐`,
        `⋒⋓⋒\n⋓⊕⋓\n⋒⋓⋒`,
        `⋔⋔⋔\n⋔◉⋔\n⋔⋔⋔`
    ],

    // Sequencer glyphs
    seq: [
        `▸▹▸\n▹◎▹\n▸▹▸`,
        `►►►\n►⊛►\n►►►`,
        `⏵⏴⏵\n⏴◈⏴\n⏵⏴⏵`,
        `⧐⧏⧐\n⧏⊗⧏\n⧐⧏⧐`,
        `⊳⊲⊳\n⊲◉⊲\n⊳⊲⊳`,
        `◁▷◁\n▷⊕▷\n◁▷◁`,
        `⫸⫷⫸\n⫷◎⫷\n⫸⫷⫸`,
        `⟐⟐⟐\n⟐⊚⟐\n⟐⟐⟐`,
        `⤙⤚⤙\n⤚⊛⤚\n⤙⤚⤙`,
        `⤛⤜⤛\n⤜◇⤜\n⤛⤜⤛`,
        `⇥⇤⇥\n⇤◈⇤\n⇥⇤⇥`,
        `⥤⥢⥤\n⥢⊗⥢\n⥤⥢⥤`,
        `⊏⊐⊏\n⊐◉⊐\n⊏⊐⊏`,
        `⊑⊒⊑\n⊒⊕⊒\n⊑⊒⊑`,
        `⋉⋊⋉\n⋊◎⋊\n⋉⋊⋉`,
        `⋋⋌⋋\n⋌⊚⋌\n⋋⋌⋋`,
        `⊸⫞⊸\n⫞⊛⫞\n⊸⫞⊸`,
        `⊺⊻⊺\n⊻◇⊻\n⊺⊻⊺`,
        `⧎⧏⧎\n⧏◈⧏\n⧎⧏⧎`,
        `⧑⧒⧑\n⧒⊗⧒\n⧑⧒⧑`
    ],

    // Logic glyphs
    logic: [
        `⊼⊽⊼\n⊽◉⊽\n⊼⊽⊼`,
        `∧∨∧\n∨⊕∨\n∧∨∧`,
        `⊻⊼⊻\n⊼◎⊼\n⊻⊼⊻`,
        `¬¬¬\n¬⊚¬\n¬¬¬`,
        `⋀⋁⋀\n⋁⊛⋁\n⋀⋁⋀`,
        `⟑⟒⟑\n⟒◇⟒\n⟑⟒⟑`,
        `⊓⊔⊓\n⊔◈⊔\n⊓⊔⊓`,
        `⊞⊟⊞\n⊟⊗⊟\n⊞⊟⊞`,
        `⊠⊡⊠\n⊡◉⊡\n⊠⊡⊠`,
        `⧄⧅⧄\n⧅⊕⧅\n⧄⧅⧄`,
        `⧆⧇⧆\n⧇◎⧇\n⧆⧇⧆`,
        `⧠⧡⧠\n⧡⊚⧡\n⧠⧡⧠`,
        `⬒⬓⬒\n⬓⊛⬓\n⬒⬓⬒`,
        `⬔⬕⬔\n⬕◇⬕\n⬔⬕⬔`,
        `⬖⬗⬖\n⬗◈⬗\n⬖⬗⬖`,
        `⬘⬙⬘\n⬙⊗⬙\n⬘⬙⬘`,
        `⬚⬛⬚\n⬛◉⬛\n⬚⬛⬚`,
        `⬜⬝⬜\n⬝⊕⬝\n⬜⬝⬜`,
        `⯀⯁⯀\n⯁◎⯁\n⯀⯁⯀`,
        `⯂⯃⯂\n⯃⊚⯃\n⯂⯃⯂`
    ],

    // Utility glyphs
    util: [
        `═══\n║◎║\n═══`,
        `───\n│⊛│\n───`,
        `╌╌╌\n╎◈╎\n╌╌╌`,
        `┄┄┄\n┆⊗┆\n┄┄┄`,
        `┈┈┈\n┊◉┊\n┈┈┈`,
        `╍╍╍\n╏⊕╏\n╍╍╍`,
        `⎯⎯⎯\n⎸◎⎹\n⎯⎯⎯`,
        `⌈⌉⌈\n⌊⊚⌋\n⌈⌉⌈`,
        `⎡⎤⎡\n⎣⊛⎦\n⎡⎤⎡`,
        `⎢⎥⎢\n⎢◇⎥\n⎢⎥⎢`,
        `⌜⌝⌜\n⌞◈⌟\n⌜⌝⌜`,
        `⎾⏋⎾\n⎿⊗⏌\n⎾⏋⎾`,
        `⏐⏐⏐\n⏐◉⏐\n⏐⏐⏐`,
        `⎮⎮⎮\n⎮⊕⎮\n⎮⎮⎮`,
        `┃┃┃\n┃◎┃\n┃┃┃`,
        `│││\n│⊚│\n│││`,
        `┊┊┊\n┊⊛┊\n┊┊┊`,
        `┋┋┋\n┋◇┋\n┋┋┋`,
        `╽╽╽\n╽◈╽\n╽╽╽`,
        `╿╿╿\n╿⊗╿\n╿╿╿`
    ],

    // Special glyphs for corner cells
    special: {
        melodic: `♪♫♪\n♫◈♫\n♪♫♪`,    // Upper left - yearning arpeggios
        evolve: `⟰⟰⟰\n⟰✧⟰\n⟰⟰⟰`,     // Upper right - consonance
        rhythmic: `⏱⏱⏱\n⏱◉⏱\n⏱⏱⏱`,  // Lower left - pulse
        randomize: `⁂⁂⁂\n⁂※⁂\n⁂⁂⁂`  // Lower right - chaos
    }
};

// Generate a random glyph for a given category
function getGlyph(category) {
    const glyphs = GLYPHS[category];
    if (!glyphs) return GLYPHS.util[0];
    return glyphs[Math.floor(Math.random() * glyphs.length)];
}

// Get specific special glyph
function getSpecialGlyph(type) {
    return GLYPHS.special[type] || GLYPHS.util[0];
}

// Export for use
window.GLYPHS = GLYPHS;
window.getGlyph = getGlyph;
window.getSpecialGlyph = getSpecialGlyph;
