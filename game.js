// ===== Geometry Dash — Infinite Neon Runner v2 =====
// All phases: procedural gen, abilities, shop tabs, skins, trails,
// achievements, stats, settings, music, screen shake, zone transitions,
// new obstacles (laser/saw/bouncy/falling/gravity), power-up rings

'use strict';

// ============================================================
// SETTINGS  (persisted to localStorage)
// ============================================================
const Settings = {
    _data: JSON.parse(localStorage.getItem('gdSettings') || '{}'),
    get(k, def) { return this._data[k] !== undefined ? this._data[k] : def; },
    set(k, v)   { this._data[k] = v; localStorage.setItem('gdSettings', JSON.stringify(this._data)); },
};

// ============================================================
// AUDIO ENGINE  (all synthesized — zero external files)
// ============================================================
class AudioEngine {
    constructor() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.musicGain  = this.ctx.createGain();
            this.sfxGain    = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);
            this.musicGain.connect(this.masterGain);
            this.sfxGain.connect(this.masterGain);
            this.masterGain.gain.value = 1;
            this.setMusicVol(Settings.get('musicVol', 50));
            this.setSfxVol(Settings.get('sfxVol', 80));
            this.enabled = true;
            this._musicNode = null;
            this._curZone   = -1;
        } catch(e) { this.enabled = false; }
    }

    setMusicVol(pct) {
        if (!this.enabled) return;
        this.musicGain.gain.value = pct / 100 * 0.22;
        Settings.set('musicVol', pct);
        if (pct === 0) {
            this.stopMusic();
        } else if (this._musicStopped && this._curZone !== -1) {
            const z = this._curZone;
            this._curZone = -1; // force restart
            this.startMusic(z);
        }
    }

    setSfxVol(pct)   { if (!this.enabled) return; this.sfxGain.gain.value  = pct / 100 * 0.55; Settings.set('sfxVol',   pct); }

    _resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

    _tone(type, f1, f2, vol, dur, delay=0) {
        if (!this.enabled) return;
        this._resume();
        const now  = this.ctx.currentTime + delay;
        const osc  = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain); gain.connect(this.sfxGain);
        osc.type = type;
        osc.frequency.setValueAtTime(Math.max(1,f1), now);
        if (f2 !== f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1,f2), now+dur);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now+dur);
        osc.start(now); osc.stop(now+dur+0.01);
    }

    playJump()           { this._tone('square',   440, 880, 0.4, 0.15); }
    playCoin()           { this._tone('sine',      900, 1400, 0.22, 0.09); }
    playRing()           { [600,900,1200].forEach((f,i)=>this._tone('sine',f,f*1.3,0.28,0.18,i*0.07)); }
    playDie()            { this._tone('sawtooth', 300, 60,  0.5, 0.35); this._tone('sine',1200,200,0.25,0.1); }
    playShieldBreak()    { this._tone('square',   600, 140, 0.5, 0.28); this._tone('sawtooth',350,80,0.22,0.2); }
    playGhostActivate()  { [500,700,900,1100].forEach((f,i)=>this._tone('sine',f,f*1.1,0.22,0.14,i*0.08)); }
    playMilestone()      { [523,659,784,1047,1319].forEach((f,i)=>this._tone('triangle',f,f,0.28,0.28,i*0.1)); }
    playAchievement()    { [440,554,659,880].forEach((f,i)=>this._tone('sine',f,f,0.32,0.3,i*0.12)); }
    playBounce()         { this._tone('sine',300,600,0.35,0.18); }
    playLaser()          { this._tone('sawtooth',800,200,0.3,0.25); }

    // Synthesized zone music — each zone has its own bass/melody pattern
    startMusic(zoneIdx) {
        if (!this.enabled) return;
        if (this._curZone === zoneIdx && !this._musicStopped) return;
        this.stopMusic();
        this._curZone = zoneIdx;
        if (Settings.get('musicVol', 50) === 0) return;
        this._resume();

        const PATTERNS = [
            { tempo:1.2, bass:[65,65,73,69], mel:[523,659,784,659] },
            { tempo:1.5, bass:[55,55,62,58], mel:[440,554,659,880] },
            { tempo:1.4, bass:[73,73,80,77], mel:[622,740,932,740] },
            { tempo:1.8, bass:[60,60,67,65], mel:[494,587,784,698] },
        ];
        const p = PATTERNS[zoneIdx % PATTERNS.length];
        let step = 0;
        const tick = () => {
            if (this._musicStopped) return;
            const now = this.ctx.currentTime;
            // bass
            const bo = this.ctx.createOscillator();
            const bg = this.ctx.createGain();
            bo.connect(bg); bg.connect(this.musicGain);
            bo.type = 'triangle'; bo.frequency.value = p.bass[step%p.bass.length];
            bg.gain.setValueAtTime(0.9, now); bg.gain.exponentialRampToValueAtTime(0.001, now+0.32);
            bo.start(now); bo.stop(now+0.33);
            // melody
            if (step % 2 === 0) {
                const mo = this.ctx.createOscillator();
                const mg = this.ctx.createGain();
                mo.connect(mg); mg.connect(this.musicGain);
                mo.type = 'square'; mo.frequency.value = p.mel[(step/2)%p.mel.length];
                mg.gain.setValueAtTime(0.18, now); mg.gain.exponentialRampToValueAtTime(0.001, now+0.28);
                mo.start(now); mo.stop(now+0.29);
            }
            step++;
            this._musicTimer = setTimeout(tick, (1/p.tempo)*400);
        };
        this._musicStopped = false;
        this._musicTimer   = setTimeout(tick, 0);
    }

    stopMusic() {
        this._musicStopped = true;
        clearTimeout(this._musicTimer);
    }

    clear() {
        this.stopMusic();
        this._curZone = -1;
    }
}

// ============================================================
// CONSTANTS
// ============================================================
const ZONE_LENGTH = 3500;

const ZONES = [
    { name:'NEON CITY',  bgHue:195, primaryColor:'#00f0ff', groundColor:'#00aaff', obstacleColor:'#ff3366', badgeClass:'zone-cyan'   },
    { name:'LAVA PIT',   bgHue:28,  primaryColor:'#ffee00', groundColor:'#ff7700', obstacleColor:'#ff5500', badgeClass:'zone-orange' },
    { name:'SKY GRID',   bgHue:280, primaryColor:'#cc00ff', groundColor:'#bb00ff', obstacleColor:'#ff00aa', badgeClass:'zone-purple' },
    { name:'DEMON CORE', bgHue:0,   primaryColor:'#ff4466', groundColor:'#ff3300', obstacleColor:'#ff8800', badgeClass:'zone-red'    },
];

const ABILITIES = {
    double_jump:  { id:'double_jump',  name:'DOUBLE JUMP',  icon:'⬆⬆', desc:'Jump once more while airborne',         cost:300, color:'#00f0ff', rarity:'common'   },
    shield:       { id:'shield',       name:'SHIELD',        icon:'🛡',  desc:'Absorbs 1 hit per run',                 cost:150, color:'#00ff88', rarity:'common'   },
    magnet:       { id:'magnet',       name:'COIN MAGNET',   icon:'🧲',  desc:'Auto-collect coins within 130px',       cost:400, color:'#cc00ff', rarity:'uncommon' },
    ghost:        { id:'ghost',        name:'SECOND CHANCE', icon:'👻',  desc:'Respawn with 3s invincibility once/run',cost:500, color:'#aaaaff', rarity:'rare'     },
    slowmo:       { id:'slowmo',       name:'SLOW MOTION',   icon:'⏳',  desc:'Hold S to slow time (5s per run)',      cost:350, color:'#ffaa00', rarity:'uncommon' },
    coin_2x:      { id:'coin_2x',      name:'2× COINS',      icon:'×2',  desc:'All coins and bonuses count double',    cost:600, color:'#ffee00', rarity:'rare'     },
    head_start:   { id:'head_start',   name:'HEAD START',    icon:'🚀',  desc:'Begin each run at 1000m mark',          cost:250, color:'#ff5500', rarity:'common'   },
    lucky_shield: { id:'lucky_shield', name:'LUCKY SHIELD',  icon:'🍀',  desc:'25% chance of free shield each run',    cost:200, color:'#00ff88', rarity:'common'   },
};

const UPGRADES = {
    shield_lv2:   { id:'shield_lv2',   name:'SHIELD LV2',   icon:'🛡🛡', desc:'Absorbs 2 hits per run',              cost:400, requires:'shield',    color:'#00ff88', rarity:'uncommon' },
    slowmo_lv2:   { id:'slowmo_lv2',   name:'SLOWMO LV2',   icon:'⏳⏳', desc:'10s slow motion per run',             cost:300, requires:'slowmo',    color:'#ffaa00', rarity:'uncommon' },
    djump_lv2:    { id:'djump_lv2',    name:'TRIPLE JUMP',  icon:'⬆³',  desc:'2 extra air jumps',                   cost:450, requires:'double_jump',color:'#00f0ff', rarity:'uncommon' },
    magnet_lv2:   { id:'magnet_lv2',   name:'MEGNET LV2',   icon:'🧲🧲', desc:'200px radius, ultra-speed pull',      cost:350, requires:'magnet',    color:'#cc00ff', rarity:'uncommon' },
    ghost_lv2:    { id:'ghost_lv2',    name:'SECOND×2',     icon:'👻👻', desc:'Second Chance works twice per run',   cost:600, requires:'ghost',     color:'#aaaaff', rarity:'rare'     },
};

// Player Skins
const SKINS = {
    cube:     { id:'cube',     name:'CUBE',     icon:'⬛', desc:'The classic. Never goes out of style.', cost:0,   color:'#00f0ff' },
    triangle: { id:'triangle', name:'TRIANGLE', icon:'△',  desc:'Sharp and deadly-looking.',              cost:200, color:'#ff5544' },
    circle:   { id:'circle',   name:'ORB',      icon:'⬤',  desc:'Round and smooth.',                      cost:250, color:'#44ffaa' },
    diamond:  { id:'diamond',  name:'DIAMOND',  icon:'◆',  desc:'A rotating gemstone.',                   cost:300, color:'#ffee00' },
    ship:     { id:'ship',     name:'SHIP',     icon:'🚀', desc:'A sleek rocket silhouette.',             cost:500, color:'#ff88cc' },
};

// Trail Styles
const TRAILS = {
    neon:    { id:'neon',    name:'NEON',    icon:'✦', desc:'Classic fading block trail.', cost:0,   color:'#00f0ff' },
    fire:    { id:'fire',    name:'FIRE',    icon:'🔥', desc:'Orange ember particles.',     cost:150, color:'#ff6600' },
    ice:     { id:'ice',     name:'ICE',     icon:'❄', desc:'Crystalline blue fragments.', cost:150, color:'#88ddff' },
    rainbow: { id:'rainbow', name:'RAINBOW', icon:'🌈', desc:'Shifting HSL color trail.',   cost:300, color:'#ffffff' },
    ghost:   { id:'ghost',   name:'GHOST',   icon:'👻', desc:'Transparent wisp trail.',    cost:200, color:'#aaaaff' },
};

const ACHIEVEMENTS = [
    { id:'first_steps',    name:'FIRST STEPS',     icon:'👣', desc:'Reach 100m',                         reward:20,  check: g => g.getDistance()>=100 },
    { id:'century',        name:'CENTURY RUN',      icon:'💯', desc:'Reach 1,000m in one run',            reward:80,  check: g => g.getDistance()>=1000 },
    { id:'zone_hopper',    name:'ZONE HOPPER',      icon:'🌀', desc:'Enter all 4 zones in one run',       reward:100, check: g => g.zonesVisited.size>=4 },
    { id:'coin_hoarder',   name:'COIN HOARDER',     icon:'💰', desc:'Collect 50 coins in one run',        reward:60,  check: g => g.runCoins>=50 },
    { id:'unstoppable',    name:'UNSTOPPABLE',      icon:'🔥', desc:'Survive 5,000m',                     reward:200, check: g => g.getDistance()>=5000 },
    { id:'shopaholic',     name:'SHOPAHOLIC',       icon:'🛒', desc:'Own 5 or more abilities',            reward:100, check: g => Object.keys(g.abilitySystem.owned).length>=5 },
    { id:'ghost_rider',    name:'GHOST RIDER',      icon:'👻', desc:'Survive via Second Chance',          reward:50,  check: g => g.abilitySystem.ghostUsed },
    { id:'speed_freak',    name:'SPEED FREAK',      icon:'⚡', desc:'Enter Demon Core zone',              reward:150, check: g => g.zonesVisited.has(3) },
    { id:'neon_god',       name:'NEON GOD',         icon:'👑', desc:'Reach 20,000m',                      reward:500, check: g => g.getDistance()>=20000 },
    { id:'ring_collector', name:'RING COLLECTOR',   icon:'💫', desc:'Collect 5 power rings in one run',   reward:75,  check: g => g.ringsCollected>=5 },
];

const MILESTONES = [
    { dist:500,   icon:'🏃', label:'500M!',  bonus:25  },
    { dist:1000,  icon:'🏅', label:'1KM!',   bonus:50  },
    { dist:2000,  icon:'🥈', label:'2KM!',   bonus:100 },
    { dist:5000,  icon:'🥇', label:'5KM!',   bonus:200 },
    { dist:10000, icon:'🏆', label:'10KM!',  bonus:400 },
    { dist:20000, icon:'👑', label:'20KM!',  bonus:1000 },
    { dist:50000, icon:'💎', label:'50KM!',  bonus:3000 },
];

// ============================================================
// GENERATOR — Infinite procedural level
// ============================================================
class Generator {
    constructor(game) {
        this.game       = game;
        this.nextSpawnX = this.game.player.x + 500;
    }

    getDifficultyT(camX) { return Math.min(1, Math.max(0, camX) / 35000); }
    getCurrentSpeed(camX){ return 5.5 + this.getDifficultyT(camX) * 11.5; }
    getSpacing(camX)     { return Math.max(170, 520 - this.getDifficultyT(camX) * 350); }

    getObstaclePool(camX) {
        const t = this.getDifficultyT(camX);
        if (t < 0.06) return ['single_spike','gap_spikes','bouncy_pad'];
        if (t < 0.15) return ['single_spike','double_spike','gap_spikes','step_up','bouncy_pad'];
        if (t < 0.28) return ['double_spike','triple_spike','gap_spikes','step_up','tall_block','saw_blade'];
        if (t < 0.45) return ['triple_spike','gap_spikes','tall_block','ceiling_spike','laser_beam','saw_blade'];
        if (t < 0.62) return ['triple_spike','ceiling_spike','tall_block','floor_ceiling_combo','laser_beam','falling_spike'];
        return             ['triple_spike','ceiling_spike','floor_ceiling_combo','moving_spike','laser_beam','falling_spike','gravity_ring'];
    }

    _makeCoin(x,y) { return { x, y, size:22, collected:false, bobOffset:Math.random()*Math.PI*2 }; }
    _makeRing(x,y,type) { return { x, y, size:30, type, collected:false, bobOffset:Math.random()*Math.PI*2 }; }

    spawnCoins(startX, endX) {
        const gap = endX - startX; if (gap < 40) return;
        const GY  = this.game.groundY, r = Math.random();
        if (r < 0.22) {
            for (let i=0; i<5; i++) this.game.coins.push(this._makeCoin(startX+12+i*28, GY-68));
        } else if (r < 0.48) {
            const n=6;
            for (let i=0; i<n; i++) {
                const t = i/(n-1);
                this.game.coins.push(this._makeCoin(startX+t*Math.min(gap,280), GY-80-Math.sin(t*Math.PI)*90));
            }
        } else if (r < 0.65) {
            for (let i=0; i<8; i++)
                this.game.coins.push(this._makeCoin(startX+Math.random()*Math.min(gap,200), GY-65-Math.random()*110));
        } else if (r < 0.75) {
            for (let i=0; i<4; i++) this.game.coins.push(this._makeCoin(startX+14+i*30, GY-195));
        }
        // 25% chance of a power ring appearing in this gap
        if (Math.random() < 0.08) {
            const types = ['star','coinrush','mini','speed','coinburst'];
            const ry    = GY - 90 - Math.random() * 80;
            this.game.rings.push(this._makeRing(startX + gap*0.5, ry, types[Math.floor(Math.random()*types.length)]));
        }
    }

    update(camX) {
        const spawnUntil = camX + this.game.canvas.width + 500;
        while (this.nextSpawnX < spawnUntil) {
            const pool = this.getObstaclePool(camX);
            const type = pool[Math.floor(Math.random()*pool.length)];
            const endX = this.game.createSegment(this.nextSpawnX, type);
            const sp   = this.getSpacing(camX);
            if (Math.random() > 0.2) this.spawnCoins(endX+22, endX+Math.min(sp*0.65,260));
            this.nextSpawnX = endX + sp;
        }
        this.game.gameSpeed = this.getCurrentSpeed(camX);
        this._cull(camX);
    }

    _cull(camX) {
        const cx = camX - 900;
        let w=0;
        for (let i=0;i<this.game.obstacles.length;i++)
            if (this.game.obstacles[i].x+this.game.obstacles[i].width>cx) this.game.obstacles[w++]=this.game.obstacles[i];
        this.game.obstacles.length=w;
        w=0;
        for (let i=0;i<this.game.coins.length;i++)
            if (this.game.coins[i].x>cx) this.game.coins[w++]=this.game.coins[i];
        this.game.coins.length=w;
        w=0;
        for (let i=0;i<this.game.rings.length;i++)
            if (this.game.rings[i].x>cx) this.game.rings[w++]=this.game.rings[i];
        this.game.rings.length=w;
    }
}

// ============================================================
// ABILITY SYSTEM
// ============================================================
class AbilitySystem {
    constructor() {
        this.owned      = JSON.parse(localStorage.getItem('gdAbilities')  || '{}');
        this.owned['cube'] = true;
        this.owned['neon'] = true;
        this.totalCoins = parseInt(localStorage.getItem('gdTotalCoins')   || '0');
        this.equippedSkin  = localStorage.getItem('gdSkin')  || 'cube';
        this.equippedTrail = localStorage.getItem('gdTrail') || 'neon';
        this._initRun();
    }

    _initRun() {
        this.shieldHits      = 0;
        this.ghostUsed       = 0; // count (lv2 = 2 uses)
        this.ghostActive     = false;
        this.airJumpsLeft    = 0;
        this.maxAirJumps     = 0;
        this.slowMoTimeLeft  = 0;
        this.slowMoCooldown  = 0;
        this.luckyShieldProc = false;
    }

    isOwned(id) { return !!this.owned[id]; }

    purchase(id) {
        const item = ABILITIES[id] || UPGRADES[id] || SKINS[id] || TRAILS[id];
        if (!item || this.isOwned(id) || this.totalCoins < item.cost) return false;
        if (UPGRADES[id] && !this.isOwned(UPGRADES[id].requires)) return false;
        this.totalCoins -= item.cost;
        this.owned[id]   = true;
        localStorage.setItem('gdAbilities',  JSON.stringify(this.owned));
        localStorage.setItem('gdTotalCoins', this.totalCoins);
        return true;
    }

    equipSkin(id)  { this.equippedSkin  = id; localStorage.setItem('gdSkin',  id); }
    equipTrail(id) { this.equippedTrail = id; localStorage.setItem('gdTrail', id); }

    addCoins(n) {
        this.totalCoins += n;
        localStorage.setItem('gdTotalCoins', this.totalCoins);
    }

    resetRun() {
        this._initRun();
        const s2 = this.isOwned('shield_lv2');
        this.shieldHits   = this.isOwned('shield') ? (s2 ? 2 : 1) : 0;
        this.maxAirJumps  = this.isOwned('double_jump') ? (this.isOwned('djump_lv2') ? 2 : 1) : 0;
        this.airJumpsLeft = this.maxAirJumps;
        this.slowMoTimeLeft = this.isOwned('slowmo') ? (this.isOwned('slowmo_lv2') ? 10 : 5) : 0;
        const ghostMax    = this.isOwned('ghost') ? (this.isOwned('ghost_lv2') ? 2 : 1) : 0;
        this.ghostMax     = ghostMax;
        this.ghostUsed    = 0;
        if (this.shieldHits === 0 && this.isOwned('lucky_shield') && Math.random() < 0.25) {
            this.shieldHits      = 1;
            this.luckyShieldProc = true;
        }
    }

    get shieldActive() { return this.shieldHits > 0; }
}

// ============================================================
// SCREEN SHAKE
// ============================================================
class Shake {
    constructor() { this.x=0; this.y=0; this._mag=0; this._frames=0; }
    trigger(mag, frames) {
        if (!Settings.get('shake', true)) return;
        this._mag    = Math.max(this._mag, mag);
        this._frames = Math.max(this._frames, frames);
    }
    update() {
        if (this._frames <= 0) { this.x=0; this.y=0; return; }
        const f = this._frames/30;
        this.x = (Math.random()-0.5)*this._mag*f*2;
        this.y = (Math.random()-0.5)*this._mag*f*2;
        this._mag    *= 0.9;
        this._frames -= 1;
    }
}

// ============================================================
// MAIN GAME CLASS
// ============================================================
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx    = this.canvas.getContext('2d');
        this.audio  = new AudioEngine();
        this.abilitySystem = new AbilitySystem();
        this.shake  = new Shake();

        // State
        this.gameState = 'menu';
        this.attempts  = 1;
        this.gravity   = 1.1;
        this.jumpForce = -17;
        this.maxFallSpeed  = 18;
        this.targetFrameTime = 1000/60;

        // Player
        this.player = {
            x:100, y:0, width:48, height:48,
            velocityY:0, rotation:0, isGrounded:false,
            color:'#00f0ff', trail:[]
        };

        // Level
        this.cameraX   = 0;
        this.groundY   = 0;
        this.gameSpeed = 5.5;
        this.obstacles = [];
        this.coins     = [];
        this.rings     = [];
        this.particles = [];
        this.generator = null;

        // Gravity flip
        this.gravityFlipped   = false;
        this.gravityFlipTimer = 0; // frames remaining

        // Run stats
        this.runCoins       = 0;
        this.ringsCollected = 0;
        this.zonesVisited   = new Set();
        this.bestDistance   = parseInt(localStorage.getItem('gdBestDistance') || '0');
        this.milestonesHit  = new Set();
        this._prevZone      = -1;

        // Run stats persistence
        this.stats = JSON.parse(localStorage.getItem('gdStats') || '{"totalDist":0,"totalRuns":0,"totalCoins":0,"bestStreak":0,"curStreak":0,"history":[]}');
        this.achievements = JSON.parse(localStorage.getItem('gdAchievements') || '{}');

        // Active power-up ring effects (timers in seconds)
        this.starTimer     = 0;
        this.coinRushTimer = 0;
        this.miniTimer     = 0;
        this.speedTimer    = 0;

        // Input
        this.isJumping     = false;
        this.jumpQueued    = false;
        this.slowMoKeyHeld = false;
        this.invincibilityTimer = 0;

        // Auto-retry
        this._autoRetryTimeout = null;
        this._retryFill        = null;

        // Timers
        this.animationId       = null;
        this.lastTime          = 0;
        this._deathTimeout     = null;
        this._milestoneTimeout = null;
        this._zoneTimeout      = null;
        this._toastTimeout     = null;

        this.init();
    }

    // ----------------------------------------------------------
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.buildAllShopTabs();
        this.updateMenuDisplay();
        this.loadSettings();
        this.gameLoop(0);
    }

    setupCanvas() {
        const resize = () => {
            const oldGY = this.groundY;
            this.canvas.width  = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.groundY = this.canvas.height - 110;
            const diffGY = this.groundY - oldGY;

            if (oldGY > 0 && diffGY !== 0) {
                // Adjust obstacles
                this.obstacles.forEach(obs => {
                    if (obs.type === 'laser') {
                        obs.y = this.canvas.height * 0.45;
                        obs.height = this.canvas.height * 0.45;
                    } else if (obs.type === 'ceiling_spike') {
                        // Keep absolute top position
                    } else {
                        // Ground-based obstacles
                        obs.y += diffGY;
                    }
                });

                // Adjust coins
                this.coins.forEach(c => {
                    c.y += diffGY;
                });

                // Adjust rings
                this.rings.forEach(r => {
                    r.y += diffGY;
                });

                // Adjust player
                if (['playing','paused'].includes(this.gameState)) {
                    if (this.player.isGrounded) {
                        if (this.gravityFlipped) {
                            this.player.y = this.player.height;
                        } else {
                            this.player.y = this.groundY - this.player.height;
                        }
                    } else {
                        this.player.y += diffGY;
                    }
                }
            } else {
                if (['playing','paused'].includes(this.gameState)) {
                    this.player.y = Math.min(this.player.y, this.groundY - this.player.height);
                }
            }
        };
        resize();
        window.addEventListener('resize', resize);
    }

    setupEventListeners() {
        document.addEventListener('keydown', e => {
            if (e.code==='Escape')             { this.togglePause(); return; }
            if (e.code==='KeyS')               { this.slowMoKeyHeld=true; return; }
            if (e.code==='Space'||e.code==='ArrowUp') { e.preventDefault(); this.handleJump(); }
        });
        document.addEventListener('keyup', e => {
            if (e.code==='Space'||e.code==='ArrowUp') this.isJumping=false;
            if (e.code==='KeyS') this.slowMoKeyHeld=false;
        });
        this.canvas.addEventListener('mousedown',  () => this.handleJump());
        this.canvas.addEventListener('mouseup',    () => this.isJumping=false);
        this.canvas.addEventListener('touchstart', e => { e.preventDefault(); this.handleJump(); }, {passive:false});
        this.canvas.addEventListener('touchend',   () => this.isJumping=false);

        // ---- Menu Navigation ----
        document.getElementById('play-btn').addEventListener('click',         () => this.startGame());
        document.getElementById('shop-btn').addEventListener('click',         () => this.showShop());
        document.getElementById('stats-btn').addEventListener('click',        () => this.showStats());
        document.getElementById('achievements-btn').addEventListener('click', () => this.showAchievements());
        document.getElementById('settings-btn').addEventListener('click',     () => this.showSettings());
        document.getElementById('how-to-btn').addEventListener('click',       () => this.showScreen('how-to-screen'));
        document.getElementById('back-btn').addEventListener('click',         () => this.showScreen('main-menu'));
        document.getElementById('shop-back-btn').addEventListener('click',    () => { this.showScreen('main-menu'); this.updateMenuDisplay(); });
        document.getElementById('achieve-back-btn').addEventListener('click', () => this.showScreen('main-menu'));
        document.getElementById('stats-back-btn').addEventListener('click',   () => this.showScreen('main-menu'));
        document.getElementById('settings-back-btn').addEventListener('click',() => this.showScreen('main-menu'));

        // Shop tabs
        document.querySelectorAll('.shop-tab').forEach(tab => {
            tab.addEventListener('click', e => {
                document.querySelectorAll('.shop-tab').forEach(t=>t.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.buildShopTab(e.currentTarget.dataset.tab);
            });
        });

        // In-game overlays
        document.getElementById('retry-btn').addEventListener('click',     () => this.restart());
        document.getElementById('menu-btn').addEventListener('click',      () => this.showMenu());
        document.getElementById('resume-btn').addEventListener('click',    () => this.resume());
        document.getElementById('pause-menu-btn').addEventListener('click',() => this.showMenu());
        document.getElementById('pause-shop-btn').addEventListener('click',() => { this.pause(); this.showShop(); });

        // Settings controls
        const mv = document.getElementById('music-vol');
        mv.value = Settings.get('musicVol', 50);
        mv.addEventListener('input', e => {
            const v = +e.target.value;
            document.getElementById('music-vol-label').textContent = v+'%';
            this.audio.setMusicVol(v);
        });

        const sv = document.getElementById('sfx-vol');
        sv.value = Settings.get('sfxVol', 80);
        sv.addEventListener('input', e => {
            const v = +e.target.value;
            document.getElementById('sfx-vol-label').textContent = v+'%';
            this.audio.setSfxVol(v);
        });

        document.getElementById('auto-retry-toggle').checked = Settings.get('autoRetry', false);
        document.getElementById('auto-retry-toggle').addEventListener('change', e => Settings.set('autoRetry', e.target.checked));

        document.getElementById('shake-toggle').checked = Settings.get('shake', true);
        document.getElementById('shake-toggle').addEventListener('change', e => Settings.set('shake', e.target.checked));

        document.getElementById('hc-toggle').checked = Settings.get('highContrast', false);
        document.getElementById('hc-toggle').addEventListener('change', e => {
            Settings.set('highContrast', e.target.checked);
            document.body.classList.toggle('high-contrast', e.target.checked);
        });

        document.getElementById('reset-btn').addEventListener('click', () => {
            if (confirm('Reset ALL progress? This cannot be undone.')) {
                localStorage.clear();
                location.reload();
            }
        });
    }

    loadSettings() {
        document.getElementById('music-vol-label').textContent = Settings.get('musicVol',50) + '%';
        document.getElementById('sfx-vol-label').textContent   = Settings.get('sfxVol',80)   + '%';
        document.body.classList.toggle('high-contrast', Settings.get('highContrast', false));
    }

    // ----------------------------------------------------------
    handleJump() {
        if (this.gameState !== 'playing') return;
        if (this.player.isGrounded) {
            this.doJump();
        } else if (this.abilitySystem.airJumpsLeft > 0) {
            this.abilitySystem.airJumpsLeft--;
            this.doJump();
            this.updateAbilityPills();
        } else {
            this.jumpQueued = true;
            setTimeout(() => this.jumpQueued=false, 130);
        }
        this.isJumping = true;
    }

    doJump() {
        const dir = this.gravityFlipped ? -1 : 1;
        this.player.velocityY  = this.jumpForce * dir;
        this.player.isGrounded = false;
        this.spawnJumpParticles();
        this.audio.playJump();
    }

    togglePause() {
        if      (this.gameState==='playing') this.pause();
        else if (this.gameState==='paused')  this.resume();
    }

    pause() {
        if (this.gameState!=='playing') return;
        this.gameState = 'paused';
        this.audio.stopMusic();
        document.getElementById('pause-dist-label').textContent  = this.getDistance() + 'm';
        document.getElementById('pause-coins-label').textContent = '★ ' + this.runCoins;
        document.getElementById('pause-screen').classList.add('active');
    }

    resume() {
        if (this.gameState!=='paused') return;
        document.getElementById('pause-screen').classList.remove('active');
        this.gameState = 'playing';
        this.audio.startMusic(this.getCurrentZone());
    }

    // ----------------------------------------------------------
    getCurrentZone() { return Math.floor(Math.max(0,this.cameraX)/ZONE_LENGTH) % ZONES.length; }
    getDistance()    { return Math.max(0, Math.floor(this.cameraX/10)); }

    // ----------------------------------------------------------
    _initRunState() {
        this.runCoins       = 0;
        this.ringsCollected = 0;
        this.zonesVisited   = new Set([0]);
        this.milestonesHit  = new Set();
        this.invincibilityTimer = 0;
        this.obstacles = []; this.coins = []; this.rings = []; this.particles = [];
        this.starTimer=0; this.coinRushTimer=0; this.miniTimer=0; this.speedTimer=0;
        this.gravityFlipped=false; this.gravityFlipTimer=0;
        this._prevZone = 0;
        this.player.trail = [];
        this.jumpQueued=false; this.isJumping=false; this.slowMoKeyHeld=false;
    }

    startGame() {
        this.attempts = 1;
        this._initRunState();
        this.abilitySystem.resetRun();

        const hs  = this.abilitySystem.isOwned('head_start');
        this.cameraX  = hs ? 9500 : 0;
        this.player.x = this.cameraX + 100;

        this.generator = new Generator(this);
        this._resetPlayerPhysics();
        this.generator.update(this.cameraX);

        this.hideAllOverlays();
        this.showScreen('game-screen');
        this.gameState = 'playing';
        this._updateRunHUD();
        this.updateZoneBadge();
        this.updateAbilityPills();
        this.audio.startMusic(0);

        if (this.abilitySystem.luckyShieldProc) this._showLuckyBanner();
    }

    restart() {
        clearTimeout(this._autoRetryTimeout);
        document.getElementById('auto-retry-bar').classList.remove('active');
        this.attempts++;
        this._initRunState();
        this.abilitySystem.resetRun();

        const hs  = this.abilitySystem.isOwned('head_start');
        this.cameraX  = hs ? 9500 : 0;
        this.player.x = this.cameraX + 100;

        this.generator = new Generator(this);
        this._resetPlayerPhysics();
        this.generator.update(this.cameraX);

        this.hideAllOverlays();
        this.gameState = 'playing';
        this._updateRunHUD();
        this.updateZoneBadge();
        this.updateAbilityPills();
        this.audio.startMusic(0);

        if (this.abilitySystem.luckyShieldProc) this._showLuckyBanner();
    }

    _resetPlayerPhysics() {
        this.player.y          = this.groundY - this.player.height;
        this.player.velocityY  = 0;
        this.player.rotation   = 0;
        this.player.isGrounded = true;
        this.player.color      = ZONES[this.getCurrentZone()].primaryColor;
    }

    _updateRunHUD() {
        document.getElementById('attempt-number').textContent = this.attempts;
        document.getElementById('run-coin-count').textContent = this.runCoins;
        document.getElementById('distance-text').textContent  = this.getDistance().toLocaleString() + 'm';
    }

    _showLuckyBanner() {
        setTimeout(() => {
            const b = document.getElementById('lucky-banner');
            b.classList.add('active');
            setTimeout(()=>b.classList.remove('active'), 2200);
        }, 400);
    }

    showMenu() {
        clearTimeout(this._deathTimeout);
        clearTimeout(this._milestoneTimeout);
        clearTimeout(this._zoneTimeout);
        clearTimeout(this._autoRetryTimeout);
        this.audio.clear();
        this.gameState = 'menu';
        this.attempts  = 1;
        this.hideAllOverlays();
        this.showScreen('main-menu');
        this.updateMenuDisplay();
    }

    showShop() {
        this.buildAllShopTabs();
        document.getElementById('shop-total-coins').textContent = this.abilitySystem.totalCoins.toLocaleString();
        // Reset to first tab
        document.querySelectorAll('.shop-tab').forEach((t,i)=>t.classList.toggle('active',i===0));
        this.buildShopTab('abilities');
        this.showScreen('shop-screen');
    }

    showStats() {
        const s = this.stats, ab = this.abilitySystem;
        document.getElementById('st-best').textContent       = this.bestDistance.toLocaleString()+'m';
        document.getElementById('st-total-dist').textContent = s.totalDist.toLocaleString()+'m';
        document.getElementById('st-runs').textContent       = s.totalRuns.toLocaleString();
        document.getElementById('st-coins').textContent      = s.totalCoins.toLocaleString()+'★';
        document.getElementById('st-streak').textContent     = s.bestStreak;
        const done = ACHIEVEMENTS.filter(a=>this.achievements[a.id]).length;
        document.getElementById('st-achievements').textContent = `${done}/10`;

        // Chart
        const chart = document.getElementById('history-chart');
        chart.innerHTML = '';
        const hist  = s.history || [];
        const max   = Math.max(...hist, 1);
        hist.slice(-8).forEach(d => {
            const wrap = document.createElement('div'); wrap.className='history-bar-wrap';
            const bar  = document.createElement('div'); bar.className='history-bar';
            bar.style.height = Math.max(4, (d/max)*96) + 'px';
            const lbl  = document.createElement('div'); lbl.className='history-bar-label';
            lbl.textContent = d>=1000 ? (d/1000).toFixed(1)+'k' : d+'m';
            wrap.appendChild(bar); wrap.appendChild(lbl); chart.appendChild(wrap);
        });
        if (!hist.length) chart.innerHTML = '<div style="color:var(--text-secondary);font-size:.8rem;font-family:Orbitron">No runs yet</div>';
        this.showScreen('stats-screen');
    }

    showAchievements() {
        const grid = document.getElementById('achieve-grid');
        grid.innerHTML = '';
        let done = 0;
        ACHIEVEMENTS.forEach(a => {
            const earned = !!this.achievements[a.id];
            if (earned) done++;
            const row = document.createElement('div');
            row.className = `achieve-row${earned?' done':''}`;
            row.innerHTML = `
                <div class="a-icon">${a.icon}</div>
                <div class="a-info">
                    <div class="a-name">${a.name}</div>
                    <div class="a-desc">${a.desc}</div>
                </div>
                <div class="a-reward">${a.reward} ★</div>
            `;
            grid.appendChild(row);
        });
        document.getElementById('achieve-done').textContent = done;
        this.showScreen('achievements-screen');
    }

    showSettings() { this.showScreen('settings-screen'); }

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    }

    hideAllOverlays() {
        document.querySelectorAll('.overlay').forEach(o=>o.classList.remove('active'));
        ['milestone-banner','lucky-banner','zone-flash','zone-banner','achieve-toast','auto-retry-bar']
            .forEach(id=>document.getElementById(id).classList.remove('active'));
    }

    updateMenuDisplay() {
        document.getElementById('menu-best-dist').textContent   = this.bestDistance>0 ? this.bestDistance.toLocaleString()+'m' : '—';
        document.getElementById('menu-total-coins').textContent = this.abilitySystem.totalCoins.toLocaleString();
    }

    updateZoneBadge() {
        const zone = ZONES[this.getCurrentZone()];
        const badge = document.getElementById('zone-badge');
        badge.textContent = zone.name;
        badge.className   = `zone-badge ${zone.badgeClass}`;
    }

    // ----------------------------------------------------------
    // SHOP UI
    buildAllShopTabs() { this.buildShopTab('abilities'); }

    buildShopTab(tab) {
        const grid   = document.getElementById('shop-grid');
        grid.innerHTML = '';
        const coins  = this.abilitySystem.totalCoins;
        const as     = this.abilitySystem;

        const makeCard = (item, mode) => {
            // mode: 'buy'|'equip'|'skin'|'trail'
            const owned    = as.isOwned(item.id);
            const equipped = (mode==='skin'  && as.equippedSkin===item.id) ||
                             (mode==='trail' && as.equippedTrail===item.id);
            const canAfford= coins >= item.cost;
            let btnClass, btnTxt;
            if (mode==='skin'||mode==='trail') {
                if (!owned && item.cost > 0)         { btnClass='acard-btn--buy';      btnTxt='BUY';       }
                else if (equipped)                   { btnClass='acard-btn--equipped'; btnTxt='✓ EQUIPPED'; }
                else                                 { btnClass='acard-btn--equip';    btnTxt='EQUIP';      }
            } else {
                if (owned)                           { btnClass='acard-btn--owned';   btnTxt='✓ OWNED';    }
                else if (canAfford)                  { btnClass='acard-btn--buy';     btnTxt='BUY';         }
                else                                 { btnClass='acard-btn--locked';  btnTxt='🔒 LOCKED';   }
            }

            const card = document.createElement('div');
            card.className  = `ability-card rarity-${item.rarity||'common'}${owned?' owned':''}${equipped?' equipped':''}${mode==='upgrade'?' upgrade-card':''}`;
            card.id = `acard-${item.id}`;
            card.style.setProperty('--ability-color', item.color);
            card.innerHTML = `
                <div class="acard-icon">${item.icon}</div>
                <div class="acard-name">${item.name}</div>
                <div class="acard-desc">${item.desc}</div>
                ${item.cost>0 ? `<div class="acard-cost"><span class="coin-symbol">★</span><span>${item.cost.toLocaleString()}</span></div>` : '<div style="height:24px"></div>'}
                <button class="acard-btn ${btnClass}" data-id="${item.id}" data-mode="${mode}" ${(owned&&mode==='buy')||equipped?'disabled':''}>
                    ${btnTxt}
                </button>
            `;
            grid.appendChild(card);
        };

        if (tab==='abilities') {
            Object.values(ABILITIES).forEach(a => makeCard(a,'buy'));
        } else if (tab==='upgrades') {
            Object.values(UPGRADES).forEach(u => {
                const locked = !as.isOwned(u.requires);
                const maxed  = as.isOwned(u.id);
                const card = document.createElement('div');
                card.className = `ability-card upgrade-card rarity-${u.rarity||'uncommon'}${maxed?' owned maxed':''}`;
                card.id = `acard-${u.id}`;
                card.style.setProperty('--ability-color', u.color);
                const btnC = maxed ? 'acard-btn--owned' : (locked ? 'acard-btn--locked' : (coins>=u.cost ? 'acard-btn--buy' : 'acard-btn--locked'));
                const btnT = maxed ? '✓ MAXED' : (locked ? '🔒 NEED BASE' : 'UPGRADE');
                card.innerHTML = `
                    <div class="acard-icon">${u.icon}</div>
                    <div class="acard-name">${u.name}</div>
                    <div class="acard-desc">${u.desc}</div>
                    <div class="acard-cost"><span class="coin-symbol">★</span><span>${u.cost.toLocaleString()}</span></div>
                    <button class="acard-btn ${btnC}" data-id="${u.id}" data-mode="buy" ${maxed||locked?'disabled':''}>
                        ${btnT}
                    </button>
                `;
                grid.appendChild(card);
            });
        } else if (tab==='skins') {
            Object.values(SKINS).forEach(s => makeCard(s,'skin'));
        } else if (tab==='trails') {
            Object.values(TRAILS).forEach(t => makeCard(t,'trail'));
        }

        // Event delegation
        grid.querySelectorAll('.acard-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', e => {
                const id   = e.currentTarget.dataset.id;
                const mode = e.currentTarget.dataset.mode;
                if (mode === 'skin' || mode === 'trail') {
                    if (!as.isOwned(id)) {
                        if (as.purchase(id)) {
                            document.getElementById('shop-total-coins').textContent = as.totalCoins.toLocaleString();
                            if (mode === 'skin') as.equipSkin(id);
                            else as.equipTrail(id);
                            this.buildShopTab(mode === 'skin' ? 'skins' : 'trails');
                        }
                    } else {
                        if (mode === 'skin') as.equipSkin(id);
                        else as.equipTrail(id);
                        this.buildShopTab(mode === 'skin' ? 'skins' : 'trails');
                    }
                } else if (as.purchase(id)) {
                    document.getElementById('shop-total-coins').textContent = as.totalCoins.toLocaleString();
                    const curTab = document.querySelector('.shop-tab.active')?.dataset.tab||'abilities';
                    this.buildShopTab(curTab);
                }
            });
        });
    }

    // ----------------------------------------------------------
    // ABILITY PILLS
    updateAbilityPills() {
        const as = this.abilitySystem;
        const show = (id, cond) => document.getElementById(id).classList.toggle('pill-active', !!cond);

        show('shield-pill',     as.shieldActive);
        show('ghost-pill',      as.ghostMax>0 && as.ghostUsed<as.ghostMax);
        show('slowmo-pill',     as.isOwned('slowmo') && as.slowMoTimeLeft>0);
        show('doublejump-pill', as.isOwned('double_jump'));
        show('coin2x-pill',     as.isOwned('coin_2x'));
        show('star-pill',       this.starTimer>0);
        show('coinrush-pill',   this.coinRushTimer>0);
        show('mini-pill',       this.miniTimer>0);
        show('speed-pill',      this.speedTimer>0);
        show('gravity-pill',    this.gravityFlipped);

        if (as.isOwned('double_jump'))
            document.getElementById('dj-jumps').textContent = as.airJumpsLeft;
        if (as.isOwned('slowmo') && as.slowMoTimeLeft>0) {
            const fullTime = as.isOwned('slowmo_lv2') ? 10 : 5;
            document.getElementById('slowmo-bar').style.width = (as.slowMoTimeLeft/fullTime*100)+'%';
        }
    }

    // ----------------------------------------------------------
    // MILESTONES
    checkMilestones() {
        const dist = this.getDistance();
        for (const ms of MILESTONES) {
            if (dist>=ms.dist && !this.milestonesHit.has(ms.dist)) {
                this.milestonesHit.add(ms.dist);
                const mult  = this._coinMult();
                const bonus = ms.bonus * mult;
                this.runCoins += bonus;
                this.audio.playMilestone();
                if (ms.dist>=5000) this.spawnConfetti();
                document.getElementById('milestone-icon').textContent        = ms.icon;
                document.getElementById('milestone-label').textContent       = ms.label;
                document.getElementById('milestone-bonus-label').textContent = `+${bonus} ★`;
                document.getElementById('run-coin-count').textContent        = this.runCoins;
                const banner = document.getElementById('milestone-banner');
                banner.classList.add('active');
                clearTimeout(this._milestoneTimeout);
                this._milestoneTimeout = setTimeout(()=>banner.classList.remove('active'),2800);
                break;
            }
        }
    }

    _coinMult() {
        let m = 1;
        if (this.abilitySystem.isOwned('coin_2x')) m *= 2;
        if (this.coinRushTimer>0) m *= 5;
        return m;
    }

    // ----------------------------------------------------------
    // ACHIEVEMENTS
    checkAchievements() {
        ACHIEVEMENTS.forEach(a => {
            if (!this.achievements[a.id] && a.check(this)) {
                this.achievements[a.id] = true;
                localStorage.setItem('gdAchievements', JSON.stringify(this.achievements));
                this.abilitySystem.addCoins(a.reward);
                this.stats.totalCoins += a.reward;
                this._saveStats();
                this.audio.playAchievement();
                this.showAchievementToast(a);
            }
        });
    }

    showAchievementToast(a) {
        const el = document.getElementById('achieve-toast');
        el.innerHTML = `<div class="t-title">🏆 ACHIEVEMENT UNLOCKED</div><div class="t-name">${a.icon} ${a.name} — +${a.reward}★</div>`;
        el.classList.add('active');
        clearTimeout(this._toastTimeout);
        this._toastTimeout = setTimeout(()=>el.classList.remove('active'), 3200);
    }

    // ----------------------------------------------------------
    // ZONE TRANSITION
    checkZoneTransition() {
        const z = this.getCurrentZone();
        this.zonesVisited.add(z);
        if (z !== this._prevZone) {
            this._prevZone = z;
            this.triggerZoneTransition(z);
        }
    }

    triggerZoneTransition(zoneIdx) {
        const zone = ZONES[zoneIdx];
        const flash = document.getElementById('zone-flash');
        flash.style.background = zone.primaryColor;
        flash.classList.add('active');
        setTimeout(()=>flash.classList.remove('active'), 700);

        const banner = document.getElementById('zone-banner');
        banner.textContent = `ZONE ${zoneIdx+1} — ${zone.name}`;
        banner.style.color = zone.primaryColor;
        banner.style.textShadow = `0 0 30px ${zone.primaryColor}`;
        banner.classList.add('active');
        clearTimeout(this._zoneTimeout);
        this._zoneTimeout = setTimeout(()=>banner.classList.remove('active'), 2000);

        this.audio.startMusic(zoneIdx);
    }

    // ----------------------------------------------------------
    // OBSTACLE FACTORY
    createSegment(startX, type) {
        const S  = 50, GY = this.groundY;
        switch(type) {
            case 'single_spike':
                this.addSpike(startX, GY-S, S, S); return startX+S;
            case 'double_spike':
                this.addSpike(startX,    GY-S,S,S); this.addSpike(startX+S+4,GY-S,S,S); return startX+S*2+4;
            case 'triple_spike':
                for(let i=0;i<3;i++) this.addSpike(startX+i*(S+4),GY-S,S,S); return startX+S*3+8;
            case 'gap_spikes':
                this.addSpike(startX,GY-S,S,S); this.addSpike(startX+S+140,GY-S,S,S); return startX+S*2+140;
            case 'step_up':
                for(let i=0;i<3;i++){const bH=32+i*16; this.addBlock(startX+i*110,GY-bH,50,bH);} return startX+310;
            case 'tall_block':
                this.addBlock(startX,GY-80,50,80); return startX+50;
            case 'ceiling_spike':
                this.addCeilingSpike(startX+10,20,S,65); return startX+S;
            case 'floor_ceiling_combo':
                this.addSpike(startX,GY-S,S,S); this.addCeilingSpike(startX+S+30,15,S,72); return startX+S*2+30;
            case 'moving_spike':
                this.addMovingSpike(startX+25,GY-S,S,S); return startX+S+50;
            case 'bouncy_pad':
                this.obstacles.push({x:startX,y:GY-14,width:60,height:14,type:'bouncy_pad'}); return startX+60;
            case 'saw_blade':
                this.obstacles.push({x:startX+20,y:GY-40,width:40,height:40,type:'saw_blade',phase:Math.random()*Math.PI*2}); return startX+80;
            case 'laser_beam': {
                const period = 2.2 + Math.random()*1.5;
                this.obstacles.push({x:startX,y:this.canvas.height*0.45,width:12,height:this.canvas.height*0.45,type:'laser',period,phase:Math.random()*Math.PI*2}); return startX+12;
            }
            case 'falling_spike': {
                const fy = 20;
                this.obstacles.push({x:startX+20,y:fy,width:S,height:S,type:'ceiling_spike',falling:true,originY:fy,dropTriggered:false}); return startX+S+40;
            }
            case 'gravity_ring': {
                this.rings.push({x:startX+20, y:GY-120, size:36, type:'gravity', collected:false, bobOffset:Math.random()*Math.PI*2}); return startX+60;
            }
            default: return startX;
        }
    }

    addSpike(x,y,w,h)        { this.obstacles.push({x,y,width:w,height:h,type:'spike'}); }
    addCeilingSpike(x,y,w,h) { this.obstacles.push({x,y,width:w,height:h,type:'ceiling_spike'}); }
    addBlock(x,y,w,h)        { this.obstacles.push({x,y,width:w,height:h,type:'block'}); }
    addMovingSpike(x,y,w,h)  { this.obstacles.push({x,y,width:w,height:h,type:'spike',moving:true,originX:x,moveRange:70,moveSpeed:2.2,movePhase:Math.random()*Math.PI*2}); }

    // ----------------------------------------------------------
    // GAME LOOP
    gameLoop(currentTime) {
        let dt = currentTime - this.lastTime;
        this.lastTime = currentTime;
        if (dt>100||dt<=0) dt = this.targetFrameTime;

        this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
        if (this.gameState==='playing')  this.update(dt);
        if (['playing','paused','dead'].includes(this.gameState)) this.render();
        this.animationId = requestAnimationFrame(t=>this.gameLoop(t));
    }

    // ----------------------------------------------------------
    // UPDATE
    update(dt) {
        let ts = dt / this.targetFrameTime;

        // Slow motion
        const as = this.abilitySystem;
        if (as.isOwned('slowmo') && this.slowMoKeyHeld && as.slowMoTimeLeft>0 && as.slowMoCooldown<=0) {
            ts *= 0.4;
            as.slowMoTimeLeft -= dt/1000;
            if (as.slowMoTimeLeft<=0) { as.slowMoTimeLeft=0; as.slowMoCooldown=15; }
        }
        if (as.slowMoCooldown>0) as.slowMoCooldown -= dt/1000;

        // Power-up ring timers
        if (this.starTimer>0)     { this.starTimer     -= dt/1000; if(this.starTimer<=0) this.starTimer=0; }
        if (this.coinRushTimer>0) { this.coinRushTimer -= dt/1000; if(this.coinRushTimer<=0) this.coinRushTimer=0; }
        if (this.miniTimer>0)     { this.miniTimer     -= dt/1000; if(this.miniTimer<=0) this.miniTimer=0; }
        if (this.speedTimer>0)    { this.speedTimer    -= dt/1000; if(this.speedTimer<=0) this.speedTimer=0; }

        // Mini mode resizes player
        const miniScale = this.miniTimer>0 ? 0.5 : 1;
        const baseW=48, baseH=48;
        this.player.width  = baseW * miniScale;
        this.player.height = baseH * miniScale;

        // Ghost invincibility countdown
        if (this.invincibilityTimer>0) {
            this.invincibilityTimer -= ts;
            if (this.invincibilityTimer<=0) { this.invincibilityTimer=0; as.ghostActive=false; }
        }

        // Speed boost
        const speedMult = this.speedTimer>0 ? 1.5 : 1;
        this.player.x  += this.gameSpeed * ts * speedMult;
        this.cameraX    = this.player.x - 100;

        this.generator.update(this.cameraX);
        this.player.color = ZONES[this.getCurrentZone()].primaryColor;

        // Gravity flip
        if (this.gravityFlipTimer>0) {
            this.gravityFlipTimer -= ts;
            if (this.gravityFlipTimer<=0) { this.gravityFlipTimer=0; this.gravityFlipped=false; }
        }

        const gDir  = this.gravityFlipped ? -1 : 1;
        const gFloor= this.gravityFlipped ? 0    : this.groundY - this.player.height;
        const gCeil = this.gravityFlipped ? this.player.height : 0;

        this.player.velocityY += this.gravity * gDir * ts;
        this.player.velocityY = Math.max(-this.maxFallSpeed, Math.min(this.maxFallSpeed, this.player.velocityY));
        this.player.y         += this.player.velocityY * ts;

        if (!this.gravityFlipped) {
            if (this.player.y >= gFloor) {
                this.player.y=gFloor; this.player.velocityY=0; this.player.isGrounded=true;
                this.player.rotation = Math.round(this.player.rotation/90)*90;
                as.airJumpsLeft = as.maxAirJumps;
                if (this.jumpQueued) { this.doJump(); this.jumpQueued=false; }
            } else { this.player.isGrounded=false; }
            if (this.player.y < 0) { this.player.y=0; this.player.velocityY=Math.abs(this.player.velocityY)*0.3; }
        } else {
            const ceilLimit = this.player.height;
            if (this.player.y <= ceilLimit) {
                this.player.y=ceilLimit; this.player.velocityY=0; this.player.isGrounded=true;
                this.player.rotation = Math.round(this.player.rotation/90)*90;
                as.airJumpsLeft = as.maxAirJumps;
                if (this.jumpQueued) { this.doJump(); this.jumpQueued=false; }
            } else if (this.player.y >= this.groundY-this.player.height) {
                this.player.y=this.groundY-this.player.height; this.player.velocityY=0;
            } else { this.player.isGrounded=false; }
        }

        if (!this.player.isGrounded) this.player.rotation += 5 * ts;

        // Update moving/falling/laser obstacles
        const now = performance.now()/1000;
        for (const obs of this.obstacles) {
            if (obs.moving)
                obs.x = obs.originX + Math.sin(now*obs.moveSpeed+obs.movePhase)*obs.moveRange;
            if (obs.falling && !obs.dropTriggered) {
                const sx = obs.x - this.cameraX;
                if (sx < this.canvas.width*0.5) { obs.dropTriggered=true; }
            }
            if (obs.falling && obs.dropTriggered && obs.y<this.groundY-obs.height)
                obs.y = Math.min(obs.y+5*ts, this.groundY-obs.height);
        }

        // Trail
        const trailColor = this._trailColor(now);
        this.player.trail.unshift({x:this.player.x, y:this.player.y, alpha:0.75, color:trailColor, w:this.player.width, h:this.player.height});
        if (this.player.trail.length>14) this.player.trail.pop();
        this.player.trail.forEach(t=>{ t.alpha-=0.06*ts; });

        // Collision with obstacles
        this.checkCollisions();

        // Coins
        const magnetR = as.isOwned('magnet') ? (as.isOwned('magnet_lv2') ? 200 : 130) : 22;
        this.checkCoinCollection(magnetR);

        // Rings
        this.checkRingCollection();

        // Particles
        this.updateParticles(ts);

        // HUD
        document.getElementById('distance-text').textContent  = this.getDistance().toLocaleString()+'m';
        document.getElementById('run-coin-count').textContent = this.runCoins;
        this.updateZoneBadge();
        this.updateAbilityPills();
        this.shake.update();

        this.checkZoneTransition();
        this.checkMilestones();
        this.checkAchievements();
    }

    _trailColor(now) {
        const trail = this.abilitySystem.equippedTrail;
        if (trail==='fire')    return `hsl(${20+Math.random()*30},100%,60%)`;
        if (trail==='ice')     return `hsl(${190+Math.random()*20},80%,75%)`;
        if (trail==='rainbow') return `hsl(${(now*80)%360},100%,65%)`;
        if (trail==='ghost')   return 'rgba(180,180,255,0.4)';
        return this.player.color;
    }

    // ----------------------------------------------------------
    // COLLISIONS
    checkCollisions() {
        if (this.invincibilityTimer>0 || this.starTimer>0) return;
        const pH = {
            x: this.player.x+6, y: this.player.y+6,
            width: this.player.width-12, height: this.player.height-12
        };
        const now = performance.now()/1000;

        for (const obs of this.obstacles) {
            const sx = obs.x - this.cameraX;
            if (sx<-120 || sx>this.canvas.width+120) continue;

            let hit = false;
            if (obs.type==='laser') {
                const on = Math.sin(now*(Math.PI*2/obs.period)+obs.phase) > 0;
                if (on) hit = this.rectCollision(obs, pH);
            } else if (obs.type==='spike')         hit = this.spikeCollision(obs, pH);
            else if (obs.type==='ceiling_spike')   hit = this.ceilingSpikeCollision(obs, pH);
            else if (obs.type==='bouncy_pad')      { if(this.rectCollision(obs,pH)) { this._bounce(); } continue; }
            else if (obs.type==='saw_blade')       hit = this.sawCollision(obs, pH, now);
            else                                   hit = this.rectCollision(obs, pH);

            if (hit) { this.die(); return; }
        }
    }

    sawCollision(saw, rect, now) {
        // Circular hitbox (radius = 18px)
        const cx = saw.x + saw.width/2 - this.cameraX;
        const cy = saw.y + saw.height/2;
        const px = rect.x + rect.width/2 - this.cameraX;
        const py = rect.y + rect.height/2;
        const r  = 18;
        return Math.sqrt((px-cx)**2+(py-cy)**2) < r + Math.min(rect.width,rect.height)/2;
    }

    _bounce() {
        this.player.velocityY  = this.gravityFlipped ? -this.jumpForce * 1.5 : this.jumpForce * 1.5;
        this.player.isGrounded = false;
        this.audio.playBounce();
        this.spawnJumpParticles();
    }

    checkCoinCollection(radius) {
        const px = this.player.x + this.player.width/2;
        const py = this.player.y + this.player.height/2;
        let col=0;
        for (const c of this.coins) {
            if (c.collected) continue;
            const cx=c.x+c.size/2, cy=c.y+c.size/2;
            if (Math.sqrt((px-cx)**2+(py-cy)**2) < radius+c.size/2) { c.collected=true; col++; this.spawnCoinParticle(cx,cy); }
        }
        if (col>0) {
            const mult = this._coinMult();
            this.runCoins += col*mult;
            this.audio.playCoin();
            this.coins = this.coins.filter(c=>!c.collected);
            // Pulse HUD coin counter
            const hud = document.getElementById('coin-counter-hud');
            hud.classList.remove('pulse');
            void hud.offsetWidth;
            hud.classList.add('pulse');
        }
    }

    checkRingCollection() {
        const px=this.player.x+this.player.width/2, py=this.player.y+this.player.height/2;
        for (const r of this.rings) {
            if (r.collected) continue;
            const cx=r.x+r.size/2, cy=r.y+r.size/2;
            if (Math.sqrt((px-cx)**2+(py-cy)**2) < r.size/2+20) {
                r.collected = true;
                this.activateRing(r.type);
                this.ringsCollected++;
                this.audio.playRing();
                this.spawnRingParticles(cx,cy,r.type);
            }
        }
        this.rings = this.rings.filter(r=>!r.collected);
    }

    activateRing(type) {
        switch(type) {
            case 'star':      this.starTimer     = 5; this.shake.trigger(3,10); break;
            case 'coinrush':  this.coinRushTimer  = 8; break;
            case 'mini':      this.miniTimer      = 6; break;
            case 'speed':     this.speedTimer     = 4; this.shake.trigger(3,8); break;
            case 'coinburst': {
                const GY=this.groundY;
                for (let i=0;i<20;i++) this.coins.push({x:this.player.x+40+Math.random()*180,y:GY-60-Math.random()*120,size:22,collected:false,bobOffset:Math.random()*Math.PI*2});
                break;
            }
            case 'gravity':
                this.gravityFlipped   = !this.gravityFlipped;
                this.gravityFlipTimer = 180; // ~3s at 60fps
                this.player.velocityY = 0;
                this.shake.trigger(5,15);
                break;
        }
    }

    spikeCollision(spike, rect) {
        if (!this.rectCollision(spike, rect)) return false;
        const tx=spike.x+spike.width/2, ty=spike.y, bl=spike.x, br=spike.x+spike.width, by=spike.y+spike.height;
        return [{x:rect.x,y:rect.y},{x:rect.x+rect.width,y:rect.y},{x:rect.x,y:rect.y+rect.height},{x:rect.x+rect.width,y:rect.y+rect.height}]
            .some(c=>this.pointInTriangle(c.x,c.y,tx,ty,bl,by,br,by));
    }
    ceilingSpikeCollision(spike, rect) {
        if (!this.rectCollision(spike, rect)) return false;
        const tx=spike.x+spike.width/2, ty=spike.y+spike.height, bl=spike.x, br=spike.x+spike.width, by=spike.y;
        return [{x:rect.x,y:rect.y},{x:rect.x+rect.width,y:rect.y},{x:rect.x,y:rect.y+rect.height},{x:rect.x+rect.width,y:rect.y+rect.height}]
            .some(c=>this.pointInTriangle(c.x,c.y,tx,ty,bl,by,br,by));
    }
    pointInTriangle(px,py,ax,ay,bx,by,cx,cy) {
        const d1=(px-bx)*(ay-by)-(ax-bx)*(py-by), d2=(px-cx)*(by-cy)-(bx-cx)*(py-cy), d3=(px-ax)*(cy-ay)-(cx-ax)*(py-ay);
        return !((d1<0||d2<0||d3<0)&&(d1>0||d2>0||d3>0));
    }
    rectCollision(a,b) { return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y; }

    // ----------------------------------------------------------
    die() {
        if (this.gameState!=='playing') return;

        if (this.abilitySystem.shieldActive) {
            this.abilitySystem.shieldHits--;
            this.audio.playShieldBreak();
            this.spawnShieldBreakParticles();
            this.shake.trigger(4, 12);
            this.updateAbilityPills();
            return;
        }
        if (this.abilitySystem.ghostMax>0 && this.abilitySystem.ghostUsed<this.abilitySystem.ghostMax) {
            this.abilitySystem.ghostUsed++;
            this.abilitySystem.ghostActive = true;
            this.invincibilityTimer        = 180;
            this.audio.playGhostActivate();
            this.updateAbilityPills();
            return;
        }

        // Real death
        this.gameState = 'dead';
        this.audio.stopMusic();
        this.audio.playDie();
        this.spawnDeathParticles();
        this.shake.trigger(8, 30);

        const dist = this.getDistance();

        // Stats
        this.stats.totalRuns++;
        this.stats.totalDist += dist;
        this.stats.totalCoins += this.runCoins;
        if (dist>=100) { this.stats.curStreak++; if(this.stats.curStreak>this.stats.bestStreak) this.stats.bestStreak=this.stats.curStreak; }
        else             this.stats.curStreak=0;
        this.stats.history = [...(this.stats.history||[]), dist].slice(-8);
        this._saveStats();

        // Bank coins
        this.abilitySystem.addCoins(this.runCoins);

        const newBest = dist > this.bestDistance;
        if (newBest) { this.bestDistance=dist; localStorage.setItem('gdBestDistance', dist); }

        if (Settings.get('autoRetry', false)) {
            const bar = document.getElementById('auto-retry-bar');
            const fill = document.getElementById('auto-retry-fill');
            bar.classList.add('active');
            fill.style.transition = 'none';
            fill.style.width = '0%';
            void fill.offsetWidth; // Force reflow
            fill.style.transition = 'width 3s linear';
            fill.style.width = '100%';
            this._autoRetryTimeout = setTimeout(()=>this.restart(), 3100);
        }

        this._deathTimeout = setTimeout(()=>{
            document.getElementById('death-title').textContent       = newBest ? '🔥 NEW BEST!' : 'CRASHED!';
            document.getElementById('death-title').style.color       = newBest ? '#ffee00' : '';
            document.getElementById('new-best-badge').style.display  = newBest ? 'inline-block' : 'none';
            document.getElementById('death-distance').textContent    = dist.toLocaleString()+'m';
            document.getElementById('death-best-dist').textContent   = this.bestDistance.toLocaleString()+'m';
            document.getElementById('death-coins').textContent       = '+'+this.runCoins+' ★';
            document.getElementById('death-attempts').textContent    = this.attempts;
            document.getElementById('death-screen').classList.add('active');
        }, 520);
    }

    _saveStats() { localStorage.setItem('gdStats', JSON.stringify(this.stats)); }

    // ----------------------------------------------------------
    // PARTICLES
    spawnJumpParticles() {
        const zone = ZONES[this.getCurrentZone()];
        for (let i=0;i<10;i++) this.particles.push({x:this.player.x+this.player.width/2,y:this.player.y+this.player.height,vx:(Math.random()-.5)*6,vy:Math.random()*3+1.5,size:Math.random()*5+2,color:zone.primaryColor,alpha:0.9,decay:0.04});
    }
    spawnDeathParticles() {
        const zone=ZONES[this.getCurrentZone()];
        for (let i=0;i<55;i++) {
            const speed=Math.random()*16+4, angle=Math.random()*Math.PI*2;
            this.particles.push({x:this.player.x+this.player.width/2,y:this.player.y+this.player.height/2,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,size:Math.random()*15+4,color:Math.random()>.5?zone.primaryColor:zone.obstacleColor,alpha:1,decay:0.02,gravity:0.4});
        }
    }
    spawnShieldBreakParticles() {
        for (let i=0;i<24;i++) {
            const angle=i/24*Math.PI*2, speed=5+Math.random()*6;
            this.particles.push({x:this.player.x+this.player.width/2,y:this.player.y+this.player.height/2,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,size:Math.random()*8+3,color:'#00ff88',alpha:1,decay:0.026});
        }
    }
    spawnCoinParticle(cx,cy) {
        this.particles.push({x:cx,y:cy,vx:(Math.random()-.5)*3,vy:-3-Math.random()*2,size:5,color:'#ffcc00',alpha:1,decay:0.048});
    }
    spawnRingParticles(cx,cy,type) {
        const cols={star:'#ffffaa',coinrush:'#ffcc00',mini:'#88ddff',speed:'#ff6666',gravity:'#cc88ff',coinburst:'#ffcc00'};
        const c=cols[type]||'#ffffff';
        for(let i=0;i<30;i++){const a=i/30*Math.PI*2,s=4+Math.random()*8;this.particles.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,size:Math.random()*7+2,color:c,alpha:1,decay:0.025});}
    }
    spawnConfetti() {
        const cols=['#00f0ff','#ff00aa','#ffee00','#00ff88','#ff5500','#cc00ff'];
        for(let i=0;i<80;i++) this.particles.push({x:Math.random()*this.canvas.width,y:-20-Math.random()*80,vx:(Math.random()-.5)*5,vy:Math.random()*6+3,size:Math.random()*9+4,color:cols[Math.floor(Math.random()*cols.length)],alpha:1,decay:0.006,gravity:0.12,screen:true});
    }
    updateParticles(ts) {
        this.particles=this.particles.filter(p=>{
            p.x+=p.vx*ts; p.y+=p.vy*ts; p.alpha-=p.decay*ts;
            if(p.gravity) p.vy+=p.gravity*ts;
            return p.alpha>0;
        });
    }

    // ----------------------------------------------------------
    // RENDER
    render() {
        const zone=ZONES[this.getCurrentZone()], h=zone.bgHue;
        const sh=this.shake;
        this.ctx.save();
        this.ctx.translate(sh.x, sh.y);

        // Background gradient
        const grad=this.ctx.createLinearGradient(0,0,0,this.canvas.height);
        grad.addColorStop(0,`hsl(${h},55%,6%)`);
        grad.addColorStop(0.5,`hsl(${h},42%,11%)`);
        grad.addColorStop(1,`hsl(${h},32%,18%)`);
        this.ctx.fillStyle=grad;
        this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);

        // Star power tint
        if (this.starTimer>0) { this.ctx.fillStyle='rgba(255,255,150,0.06)'; this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height); }
        // Ghost tint
        if (this.invincibilityTimer>0) { this.ctx.fillStyle='rgba(120,120,255,0.07)'; this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height); }
        // Gravity flip tint
        if (this.gravityFlipped) { this.ctx.fillStyle='rgba(200,100,255,0.05)'; this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height); }

        this.renderParallax();
        this.renderGround();
        this.renderObstacles();
        this.renderRings();
        this.renderCoins();
        this.renderTrail();
        if (this.gameState!=='dead') this.renderPlayer();
        this.renderParticles();

        this.ctx.restore();
    }

    renderParallax() {
        const zone=ZONES[this.getCurrentZone()];
        const t=performance.now()/1000;
        // Layer 1: distant stars (slowest)
        const starSeed=12345;
        for (let i=0;i<80;i++) {
            const seed=(i*1973+starSeed)%10000;
            const sx=(seed%this.canvas.width + (this.cameraX*0.05)%(this.canvas.width)) % this.canvas.width;
            const sy=((seed*7)%this.canvas.height)*0.72;
            const size=0.8+(seed%4)*0.5;
            const twinkle=0.4+Math.sin(t*2+i)*0.4;
            this.ctx.fillStyle=`rgba(255,255,255,${twinkle*0.8})`;
            this.ctx.beginPath(); this.ctx.arc(sx,sy,size,0,Math.PI*2); this.ctx.fill();
        }
        // Layer 2: city skyline silhouette (mid parallax)
        const spacing=260;
        const startBi=Math.floor(this.cameraX*0.3/spacing)-1;
        const endBi=startBi+Math.ceil(this.canvas.width/spacing)+3;
        for (let bi=startBi;bi<=endBi;bi++) {
            const seed=Math.abs(bi*7919+bi*31+997)%10000;
            const w=28+(seed%48), hh=90+(seed%170), xoff=seed%90;
            const sx=(bi*spacing+xoff)-(this.cameraX*0.3);
            if (sx+w<0||sx>this.canvas.width) continue;
            const alpha=0.14+(seed%10)/100;
            this.ctx.fillStyle=`hsla(${zone.bgHue},65%,22%,${alpha})`;
            this.ctx.fillRect(sx,this.groundY-hh,w,hh);
            // Windows
            this.ctx.fillStyle=`hsla(${zone.bgHue},80%,65%,0.12)`;
            for (let wy=hh-20;wy>10;wy-=14) for(let wx=4;wx<w-6;wx+=10) this.ctx.fillRect(sx+wx,this.groundY-wy,5,7);
        }
    }

    renderGround() {
        const zone=ZONES[this.getCurrentZone()], GY=this.groundY;
        const gg=this.ctx.createLinearGradient(0,GY,0,this.canvas.height);
        gg.addColorStop(0,`hsl(${zone.bgHue},28%,18%)`);
        gg.addColorStop(1,`hsl(${zone.bgHue},20%,10%)`);
        this.ctx.fillStyle=gg;
        this.ctx.fillRect(0,GY,this.canvas.width,this.canvas.height-GY);

        this.ctx.save();
        this.ctx.shadowColor=zone.groundColor; this.ctx.shadowBlur=20;
        this.ctx.strokeStyle=zone.groundColor; this.ctx.lineWidth=2.5;
        this.ctx.beginPath(); this.ctx.moveTo(0,GY); this.ctx.lineTo(this.canvas.width,GY); this.ctx.stroke();
        // Gravity flip: also draw ceiling line
        if (this.gravityFlipped) {
            this.ctx.strokeStyle=zone.primaryColor; this.ctx.shadowColor=zone.primaryColor; this.ctx.lineWidth=2;
            this.ctx.beginPath(); this.ctx.moveTo(0,this.player.height); this.ctx.lineTo(this.canvas.width,this.player.height); this.ctx.stroke();
        }
        this.ctx.restore();

        // Grid
        this.ctx.strokeStyle=zone.groundColor+'28'; this.ctx.lineWidth=1;
        const gs=50, offset=this.cameraX%gs;
        for (let x=-offset;x<this.canvas.width;x+=gs) { this.ctx.beginPath(); this.ctx.moveTo(x,GY); this.ctx.lineTo(x,this.canvas.height); this.ctx.stroke(); }
        for (let y=GY+gs;y<this.canvas.height;y+=gs)  { this.ctx.beginPath(); this.ctx.moveTo(0,y); this.ctx.lineTo(this.canvas.width,y); this.ctx.stroke(); }
    }

    renderObstacles() {
        const zone=ZONES[this.getCurrentZone()];
        const now=performance.now()/1000;
        this.obstacles.forEach(obs=>{
            const sx=obs.x-this.cameraX;
            if (sx<-120||sx>this.canvas.width+120) return;
            this.ctx.save();
            this.ctx.shadowColor=zone.obstacleColor; this.ctx.shadowBlur=18;

            if (obs.type==='spike')          this._drawFloorSpike(sx,obs.y,obs.width,obs.height,zone.obstacleColor);
            else if (obs.type==='ceiling_spike') this._drawCeilingSpike(sx,obs.y,obs.width,obs.height,zone.obstacleColor);
            else if (obs.type==='bouncy_pad')    this._drawBouncyPad(sx,obs.y,obs.width,obs.height,zone);
            else if (obs.type==='saw_blade')     this._drawSaw(sx,obs.y,obs.width,obs.height,zone.obstacleColor,now+obs.phase);
            else if (obs.type==='laser')         this._drawLaser(sx,obs.y,obs.width,obs.height,zone.obstacleColor,obs,now);
            else                                 this._drawBlock(sx,obs.y,obs.width,obs.height,zone);

            this.ctx.restore();
        });
    }

    _drawFloorSpike(sx,y,w,h,color) {
        const g=this.ctx.createLinearGradient(sx,y+h,sx+w/2,y);
        g.addColorStop(0,color); g.addColorStop(1,'#ffffff');
        this.ctx.fillStyle=g;
        this.ctx.beginPath(); this.ctx.moveTo(sx+w/2,y); this.ctx.lineTo(sx,y+h); this.ctx.lineTo(sx+w,y+h); this.ctx.closePath(); this.ctx.fill();
        this.ctx.fillStyle='rgba(255,255,255,0.25)';
        this.ctx.beginPath(); this.ctx.moveTo(sx+w/2,y+8); this.ctx.lineTo(sx+9,y+h-6); this.ctx.lineTo(sx+w/2,y+h-12); this.ctx.closePath(); this.ctx.fill();
    }
    _drawCeilingSpike(sx,y,w,h,color) {
        const g=this.ctx.createLinearGradient(sx,y,sx+w/2,y+h);
        g.addColorStop(0,color); g.addColorStop(1,'#ffffff');
        this.ctx.fillStyle=g;
        this.ctx.beginPath(); this.ctx.moveTo(sx,y); this.ctx.lineTo(sx+w,y); this.ctx.lineTo(sx+w/2,y+h); this.ctx.closePath(); this.ctx.fill();
        this.ctx.fillStyle='rgba(255,255,255,0.22)';
        this.ctx.beginPath(); this.ctx.moveTo(sx+8,y+6); this.ctx.lineTo(sx+w/2,y+h-8); this.ctx.lineTo(sx+w/2+4,y+8); this.ctx.closePath(); this.ctx.fill();
    }
    _drawBlock(sx,y,w,h,zone) {
        const g=this.ctx.createLinearGradient(sx,y,sx+w,y+h);
        g.addColorStop(0,zone.primaryColor+'cc'); g.addColorStop(1,zone.primaryColor+'44');
        this.ctx.fillStyle=g; this.ctx.strokeStyle=zone.primaryColor; this.ctx.lineWidth=2;
        this.ctx.beginPath(); this.ctx.roundRect(sx,y,w,h,4); this.ctx.fill(); this.ctx.stroke();
        this.ctx.strokeStyle='rgba(255,255,255,0.1)'; this.ctx.lineWidth=1;
        this.ctx.beginPath(); this.ctx.moveTo(sx,y+h/2); this.ctx.lineTo(sx+w,y+h/2); this.ctx.moveTo(sx+w/2,y); this.ctx.lineTo(sx+w/2,y+h); this.ctx.stroke();
    }
    _drawBouncyPad(sx,y,w,h,zone) {
        const pct = 0.5+Math.abs(Math.sin(performance.now()*0.004))*0.5;
        this.ctx.fillStyle=`rgba(0,255,136,${0.8+pct*0.2})`;
        this.ctx.shadowColor='#00ff88'; this.ctx.shadowBlur=20;
        this.ctx.beginPath(); this.ctx.roundRect(sx,y,w,h,6); this.ctx.fill();
        this.ctx.fillStyle='rgba(255,255,255,0.4)';
        this.ctx.beginPath(); this.ctx.roundRect(sx+4,y+2,w-8,3,2); this.ctx.fill();
        // Arrow up
        this.ctx.strokeStyle='rgba(0,255,136,0.9)'; this.ctx.lineWidth=2;
        this.ctx.beginPath(); this.ctx.moveTo(sx+w/2,y-18); this.ctx.lineTo(sx+w/2-8,y-8); this.ctx.moveTo(sx+w/2,y-18); this.ctx.lineTo(sx+w/2+8,y-8); this.ctx.stroke();
    }
    _drawSaw(sx,y,w,h,color,now) {
        const cx=sx+w/2, cy=y+h/2, r=w/2;
        this.ctx.shadowColor=color; this.ctx.shadowBlur=20;
        this.ctx.save();
        this.ctx.translate(cx,cy); this.ctx.rotate(now*4);
        // Teeth
        const teeth=10;
        this.ctx.fillStyle=color;
        this.ctx.beginPath();
        for (let i=0;i<teeth;i++) {
            const a1=i/teeth*Math.PI*2, a2=(i+0.5)/teeth*Math.PI*2, a3=(i+1)/teeth*Math.PI*2;
            i===0?this.ctx.moveTo(Math.cos(a1)*r,Math.sin(a1)*r):this.ctx.lineTo(Math.cos(a1)*r,Math.sin(a1)*r);
            this.ctx.lineTo(Math.cos(a2)*(r+10),Math.sin(a2)*(r+10));
            this.ctx.lineTo(Math.cos(a3)*r,Math.sin(a3)*r);
        }
        this.ctx.closePath(); this.ctx.fill();
        // Center circle
        this.ctx.fillStyle='rgba(255,255,255,0.2)';
        this.ctx.beginPath(); this.ctx.arc(0,0,r*0.35,0,Math.PI*2); this.ctx.fill();
        this.ctx.restore();
    }
    _drawLaser(sx,y,w,h,color,obs,now) {
        const on = Math.sin(now*(Math.PI*2/obs.period)+obs.phase) > 0;
        const alpha = on ? 0.9 : 0.15;
        this.ctx.shadowBlur = on ? 30 : 5;
        this.ctx.fillStyle = on ? color : color+'40';
        this.ctx.fillRect(sx-4,y,w+8,h);
        // Warning stripes
        if (!on) {
            this.ctx.strokeStyle=color+'30'; this.ctx.lineWidth=1;
            for(let yw=y+8;yw<y+h;yw+=16){this.ctx.beginPath();this.ctx.moveTo(sx-4,yw);this.ctx.lineTo(sx+w+4,yw);this.ctx.stroke();}
        } else {
            // Core glow
            this.ctx.fillStyle='rgba(255,255,255,0.6)'; this.ctx.fillRect(sx-1,y,w+2,h);
        }
    }

    renderRings() {
        const t=performance.now()/1000;
        const RING_COLS={star:'#ffff88',coinrush:'#ffcc00',mini:'#88ddff',speed:'#ff6644',gravity:'#cc88ff',coinburst:'#ffee44'};
        const RING_ICONS={star:'⭐',coinrush:'★×5',mini:'🔵',speed:'🔴',gravity:'🔄',coinburst:'💫'};
        this.rings.forEach(ring=>{
            if (ring.collected) return;
            const sx=ring.x-this.cameraX;
            if (sx<-80||sx>this.canvas.width+80) return;
            const bob=Math.sin(t*2.2+ring.bobOffset)*6;
            const col=RING_COLS[ring.type]||'#ffffff';
            const cr=ring.size/2;
            const cx=sx+cr, cy=ring.y+cr+bob;

            this.ctx.save();
            this.ctx.shadowColor=col; this.ctx.shadowBlur=24;
            // Pulsing outer ring
            const pulse=0.6+Math.sin(t*4+ring.bobOffset)*0.4;
            this.ctx.strokeStyle=col; this.ctx.lineWidth=3;
            this.ctx.globalAlpha=pulse;
            this.ctx.beginPath(); this.ctx.arc(cx,cy,cr+6,0,Math.PI*2); this.ctx.stroke();
            this.ctx.globalAlpha=1;
            // Inner fill
            const rg=this.ctx.createRadialGradient(cx-cr*0.3,cy-cr*0.3,0,cx,cy,cr);
            rg.addColorStop(0,'rgba(255,255,255,0.7)'); rg.addColorStop(0.5,col+'bb'); rg.addColorStop(1,col+'55');
            this.ctx.fillStyle=rg;
            this.ctx.beginPath(); this.ctx.arc(cx,cy,cr,0,Math.PI*2); this.ctx.fill();
            // Rotating spokes
            this.ctx.save(); this.ctx.translate(cx,cy); this.ctx.rotate(t*2);
            this.ctx.strokeStyle='rgba(255,255,255,0.5)'; this.ctx.lineWidth=1.5;
            for(let i=0;i<4;i++){const a=i*Math.PI/2;this.ctx.beginPath();this.ctx.moveTo(0,0);this.ctx.lineTo(Math.cos(a)*cr,Math.sin(a)*cr);this.ctx.stroke();}
            this.ctx.restore();
            this.ctx.restore();
        });
    }

    renderCoins() {
        const t=performance.now()/1000;
        this.coins.forEach(coin=>{
            const sx=coin.x-this.cameraX;
            if (sx<-50||sx>this.canvas.width+50) return;
            const bob=Math.sin(t*2.5+coin.bobOffset)*5;
            const r=coin.size/2, cx=sx+r, cy=coin.y+r+bob;
            this.ctx.save();
            this.ctx.shadowColor='#ffcc00'; this.ctx.shadowBlur=16;
            const cg=this.ctx.createRadialGradient(cx-r*0.3,cy-r*0.3,0,cx,cy,r);
            cg.addColorStop(0,'#ffffbb'); cg.addColorStop(0.5,'#ffcc00'); cg.addColorStop(1,'#cc6600');
            this.ctx.fillStyle=cg;
            this.ctx.beginPath(); this.ctx.arc(cx,cy,r,0,Math.PI*2); this.ctx.fill();
            this.ctx.fillStyle='rgba(255,255,255,0.36)';
            this.ctx.beginPath(); this.ctx.arc(cx-r*0.28,cy-r*0.28,r*0.45,0,Math.PI*2); this.ctx.fill();
            this.ctx.shadowBlur=0; this.ctx.fillStyle='rgba(255,240,100,0.95)';
            this._drawStar2(cx,cy,5,r*0.46,r*0.18);
            this.ctx.strokeStyle='rgba(255,230,100,0.5)'; this.ctx.lineWidth=1.5;
            this.ctx.beginPath(); this.ctx.arc(cx,cy,r+2,0,Math.PI*2); this.ctx.stroke();
            this.ctx.restore();
        });
    }
    _drawStar2(cx,cy,pts,outer,inner) {
        this.ctx.beginPath();
        for(let i=0;i<pts*2;i++){const a=i*Math.PI/pts-Math.PI/2,r=i%2===0?outer:inner;const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;i===0?this.ctx.moveTo(x,y):this.ctx.lineTo(x,y);}
        this.ctx.closePath(); this.ctx.fill();
    }

    renderTrail() {
        const trailStyle = this.abilitySystem.equippedTrail;
        this.player.trail.forEach((t,i)=>{
            if (t.alpha<=0) return;
            const sx=t.x-this.cameraX;
            this.ctx.save();
            this.ctx.globalAlpha=Math.max(0,t.alpha*0.5);
            if (trailStyle==='fire') {
                const fg=this.ctx.createRadialGradient(sx+t.w/2,t.y+t.h/2,0,sx+t.w/2,t.y+t.h/2,t.w*0.6);
                fg.addColorStop(0,'#ffffff'); fg.addColorStop(0.3,'#ffcc00'); fg.addColorStop(1,'#ff440000');
                this.ctx.fillStyle=fg;
                this.ctx.beginPath(); this.ctx.arc(sx+t.w/2,t.y+t.h/2,t.w*(0.6-i*0.04),0,Math.PI*2); this.ctx.fill();
            } else if (trailStyle==='ice') {
                this.ctx.fillStyle=t.color||'#88ddff';
                const size=t.w*(0.5-i*0.03);
                this.ctx.save(); this.ctx.translate(sx+t.w/2,t.y+t.h/2); this.ctx.rotate(i*0.3);
                this.ctx.fillRect(-size/2,-size/2,size,size); this.ctx.restore();
            } else if (trailStyle==='ghost') {
                this.ctx.fillStyle='rgba(180,180,255,0.15)';
                const size=t.w*(0.9-i*0.05);
                this.ctx.beginPath(); this.ctx.arc(sx+t.w/2,t.y+t.h/2,size/2,0,Math.PI*2); this.ctx.fill();
            } else {
                // Neon or rainbow
                this.ctx.fillStyle=t.color||this.player.color;
                const size=t.w*(1-i*0.07);
                this.ctx.fillRect(sx+(t.w-size)/2,t.y+(t.h-size)/2,size,size);
            }
            this.ctx.restore();
        });
    }

    renderPlayer() {
        const sx = this.player.x - this.cameraX;
        const skin = this.abilitySystem.equippedSkin;
        this.ctx.save();
        this.ctx.translate(sx+this.player.width/2, this.player.y+this.player.height/2);
        this.ctx.rotate(this.player.rotation * Math.PI/180);
        if (this.invincibilityTimer>0) this.ctx.globalAlpha=0.45+Math.sin(performance.now()*0.025)*0.45;
        if (this.starTimer>0) { this.ctx.shadowColor='#ffffaa'; this.ctx.shadowBlur=30; }

        const col=this.player.color, hw=this.player.width/2, hh=this.player.height/2;
        this.ctx.shadowColor=col; this.ctx.shadowBlur=24;

        if (skin==='triangle') {
            const g=this.ctx.createLinearGradient(-hw,-hh,hw,hh);
            g.addColorStop(0,col); g.addColorStop(1,'#ffffff');
            this.ctx.fillStyle=g; this.ctx.strokeStyle='#ffffff'; this.ctx.lineWidth=2.5;
            this.ctx.beginPath(); this.ctx.moveTo(0,-hh); this.ctx.lineTo(-hw,hh); this.ctx.lineTo(hw,hh); this.ctx.closePath(); this.ctx.fill(); this.ctx.stroke();
        } else if (skin==='circle') {
            const g=this.ctx.createRadialGradient(-hw*0.3,-hh*0.3,0,0,0,hw);
            g.addColorStop(0,'#ffffff'); g.addColorStop(0.5,col); g.addColorStop(1,col+'88');
            this.ctx.fillStyle=g;
            this.ctx.beginPath(); this.ctx.arc(0,0,hw,0,Math.PI*2); this.ctx.fill();
            this.ctx.strokeStyle='#ffffff'; this.ctx.lineWidth=2;
            this.ctx.beginPath(); this.ctx.arc(0,0,hw,0,Math.PI*2); this.ctx.stroke();
            this.ctx.shadowBlur=0; this.ctx.fillStyle='rgba(255,255,255,0.9)';
            this._drawStar2(0,0,5,hw*0.45,hw*0.2);
        } else if (skin==='diamond') {
            const g=this.ctx.createLinearGradient(-hw,-hh,hw,hh);
            g.addColorStop(0,'#ffffff'); g.addColorStop(0.5,col); g.addColorStop(1,col+'88');
            this.ctx.fillStyle=g; this.ctx.strokeStyle='#ffffff'; this.ctx.lineWidth=2;
            this.ctx.beginPath(); this.ctx.moveTo(0,-hh); this.ctx.lineTo(hw,0); this.ctx.lineTo(0,hh); this.ctx.lineTo(-hw,0); this.ctx.closePath(); this.ctx.fill(); this.ctx.stroke();
        } else if (skin==='ship') {
            this.ctx.fillStyle=col; this.ctx.strokeStyle='#ffffff'; this.ctx.lineWidth=2;
            this.ctx.beginPath(); this.ctx.moveTo(hw,0); this.ctx.lineTo(-hw,-hh*0.6); this.ctx.lineTo(-hw+8,0); this.ctx.lineTo(-hw,hh*0.6); this.ctx.closePath(); this.ctx.fill(); this.ctx.stroke();
            // Exhaust
            this.ctx.fillStyle='rgba(255,200,0,0.7)';
            this.ctx.beginPath(); this.ctx.arc(-hw+4,0,5,0,Math.PI*2); this.ctx.fill();
        } else {
            // Cube (default)
            const pg=this.ctx.createLinearGradient(-hw,-hh,hw,hh);
            pg.addColorStop(0,col); pg.addColorStop(0.5,'#ffffff'); pg.addColorStop(1,col);
            this.ctx.fillStyle=pg;
            this.ctx.beginPath(); this.ctx.roundRect(-hw,-hh,this.player.width,this.player.height,5); this.ctx.fill();
            this.ctx.strokeStyle='#ffffff'; this.ctx.lineWidth=2.5; this.ctx.shadowBlur=0;
            this.ctx.beginPath(); this.ctx.roundRect(-hw,-hh,this.player.width,this.player.height,5); this.ctx.stroke();
            this.ctx.fillStyle='rgba(255,255,255,0.88)'; this.ctx.shadowColor='#ffffff'; this.ctx.shadowBlur=8;
            this.ctx.beginPath(); this.ctx.moveTo(0,-10); this.ctx.lineTo(10,0); this.ctx.lineTo(0,10); this.ctx.lineTo(-10,0); this.ctx.closePath(); this.ctx.fill();
            this.ctx.shadowBlur=0; this.ctx.fillStyle='rgba(255,255,255,0.5)';
            [[-hw+6,-hh+6],[hw-10,-hh+6],[-hw+6,hh-10],[hw-10,hh-10]].forEach(([cx,cy])=>{this.ctx.beginPath();this.ctx.arc(cx,cy,2.5,0,Math.PI*2);this.ctx.fill();});
        }
        this.ctx.restore();
    }

    renderParticles() {
        this.particles.forEach(p=>{
            this.ctx.save();
            this.ctx.globalAlpha=Math.max(0,p.alpha);
            this.ctx.fillStyle=p.color; this.ctx.shadowColor=p.color; this.ctx.shadowBlur=8;
            const dx = p.screen ? p.x : (p.x-this.cameraX);
            this.ctx.beginPath(); this.ctx.arc(dx,p.y,p.size,0,Math.PI*2); this.ctx.fill();
            this.ctx.restore();
        });
    }
}

// ============================================================
// Bootstrap
// ============================================================
document.addEventListener('DOMContentLoaded', () => new Game());
