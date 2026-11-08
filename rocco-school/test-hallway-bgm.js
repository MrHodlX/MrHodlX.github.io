'use strict';
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let passed = 0, failed = 0;
function check(name, cond, detail){
  if(cond){ passed++; console.log('PASS  ' + name); }
  else { failed++; console.log('FAIL  ' + name + (detail ? ' — ' + detail : '')); }
}

const scriptMatch = html.match(/<script>\s*\(function\(\)\{([\s\S]*?)\}\)\(\);\s*<\/script>/);
check('main IIFE present', !!scriptMatch);
try {
  new Function('(function(){' + scriptMatch[1] + '})();');
  check('full JS parse', true);
} catch(e){
  check('full JS parse', false, String(e));
}

const logicMatch = html.match(/\/\* ::EXPLORER_LOGIC_START:: \*\/([\s\S]*?)\/\* ::EXPLORER_LOGIC_END:: \*\//);
check('logic markers', !!logicMatch);
const api = new Function(logicMatch[1] + `; return {
  BGM_LEVEL, BGM_DUCK_LEVEL, BGM_MUTE_LEVEL, BGM_DRONE_FREQ, BGM_DETUNE_FREQS, BGM_AIR_FREQ,
  BGM_DRIFT_FREQS, BGM_BELL_FREQS, BGM_MAX_LIVE_OSC, BGM_ORNAMENT_SLOTS,
  isHallwayExploreMusicActive, bgmAmbientTarget, bgmEffectiveTarget, bgmSyncShouldDeferToDuck,
  nextBgmOrnamentDelay, describeHallwayBgmScore, planBgmRestart, roomNameAt,
  NPC_MOVE_SCALE, ROPE_INITIAL_GRACE, ROPE_COOL_MIN, ROPE_COOL_MAX, ROPE_JUMP_LO, ROPE_JUMP_HI,
  SCARE_PEAK, SCARE_FACE_IDS, MAP_W, MAP_H, MAP_ROWS, listNotebookDoors, MOVE_SPEED
};`)();

const hall = {state:'explore', quizOpen:false, paused:false, deathPending:false, hidden:false, muted:false, room:'Hallway'};
check('hallway explore active', api.isHallwayExploreMusicActive(hall) === true);
check('hallway target full', Math.abs(api.bgmAmbientTarget(hall) - api.BGM_LEVEL) < 1e-9);
check('classroom fades', api.bgmAmbientTarget(Object.assign({}, hall, {room:'Classroom'})) === api.BGM_MUTE_LEVEL);
check('library fades', api.bgmAmbientTarget(Object.assign({}, hall, {room:'Library'})) === api.BGM_MUTE_LEVEL);
check('office fades', api.bgmAmbientTarget(Object.assign({}, hall, {room:'Office'})) === api.BGM_MUTE_LEVEL);
check('quiz fades', api.bgmAmbientTarget(Object.assign({}, hall, {quizOpen:true, paused:true, state:'quiz'})) === api.BGM_MUTE_LEVEL);
check('pause fades', api.bgmAmbientTarget(Object.assign({}, hall, {paused:true})) === api.BGM_MUTE_LEVEL);
check('end fades', api.bgmAmbientTarget(Object.assign({}, hall, {state:'end'})) === api.BGM_MUTE_LEVEL);
check('title silent', api.bgmAmbientTarget(Object.assign({}, hall, {state:'title'})) === api.BGM_MUTE_LEVEL);
check('tabhide fades', api.bgmAmbientTarget(Object.assign({}, hall, {hidden:true})) === api.BGM_MUTE_LEVEL);
check('deathPending fades', api.bgmAmbientTarget(Object.assign({}, hall, {deathPending:true})) === api.BGM_MUTE_LEVEL);
check('scare state fades', api.bgmAmbientTarget(Object.assign({}, hall, {state:'scare', paused:true})) === api.BGM_MUTE_LEVEL);
check('mute immediate target', api.bgmAmbientTarget(Object.assign({}, hall, {muted:true})) === api.BGM_MUTE_LEVEL);
check('mute in room still silent', api.bgmAmbientTarget(Object.assign({}, hall, {muted:true, room:'Gym'})) === api.BGM_MUTE_LEVEL);

const ducked = Object.assign({}, hall, {ducking:true, duckLevel:api.BGM_DUCK_LEVEL});
check('duck lowers hallway', Math.abs(api.bgmEffectiveTarget(ducked) - api.BGM_DUCK_LEVEL) < 1e-9);
check('duck defers hallway raise', api.bgmSyncShouldDeferToDuck(ducked) === true);
check('mute beats duck', api.bgmSyncShouldDeferToDuck(Object.assign({}, ducked, {muted:true})) === false);
check('mute during duck is silent', api.bgmEffectiveTarget(Object.assign({}, ducked, {muted:true})) === api.BGM_MUTE_LEVEL);
check('room during duck can fade down', api.bgmSyncShouldDeferToDuck(Object.assign({}, ducked, {room:'Classroom'})) === false);
check('tabhide during duck can fade down', api.bgmSyncShouldDeferToDuck(Object.assign({}, ducked, {hidden:true})) === false);
check('quiz during duck can fade down', api.bgmSyncShouldDeferToDuck(Object.assign({}, ducked, {quizOpen:true, paused:true, state:'quiz'})) === false);

const score = api.describeHallwayBgmScore();
check('score marked musical', score.musical === true && score.loopingAlarm === false);
check('has low drone', score.layers.some(function(l){ return l.id === 'low-drone' && l.freq === 49; }));
check('has uneasy detune pair', score.layers.filter(function(l){ return l.id.indexOf('uneasy') === 0; }).length === 2);
check('detune not unison', Math.abs(api.BGM_DETUNE_FREQS[0] - api.BGM_DETUNE_FREQS[1]) > 0.5);
check('has drifting unresolved notes', score.layers.some(function(l){ return l.id === 'drift-unresolved' && l.freqs.length >= 5; }));
check('has sparse bells', score.ornaments.some(function(o){ return o.kind === 'bell' && o.freqs.length >= 4; }));
check('has distant creaks', score.ornaments.some(function(o){ return o.kind === 'creak'; }));
const resolved = {73.5:1, 98:1, 49:1};
check('drift avoids tonic/fifth/octave rest', api.BGM_DRIFT_FREQS.every(function(f){ return !resolved[f]; }));
check('graph osc bound', score.layers.length + 2 <= api.BGM_MAX_LIVE_OSC && api.BGM_MAX_LIVE_OSC <= 8);
check('three ornament slots', api.BGM_ORNAMENT_SLOTS.join(',') === 'bell,creak,drift');

const d0 = api.nextBgmOrnamentDelay('bell', function(){ return 0; });
const d1 = api.nextBgmOrnamentDelay('bell', function(){ return 1; });
const c0 = api.nextBgmOrnamentDelay('creak', function(){ return 0; });
const c1 = api.nextBgmOrnamentDelay('creak', function(){ return 1; });
check('bell delay range', d0 >= 4.2 && d1 <= 11.0001 && d1 > d0);
check('creak delay range', c0 >= 6.0 && c1 <= 14.5001 && c1 > c0);
check('bell/creak not identical period', Math.abs(d0 - c0) > 0.5);
check('not a fixed alarm tick', d1 - d0 > 3 && c1 - c0 > 3);

const planNew = api.planBgmRestart(null);
check('first start creates graph', planNew.createGraph === true && planNew.reuseGraph === false);
const planAgain = api.planBgmRestart({started:true, timers:[11,22,33]});
check('restart reuses graph', planAgain.reuseGraph === true && planAgain.createGraph === false);
check('restart clears timers', planAgain.clearTimers === true && planAgain.clearedCount === 3);
check('restart rearms three slots', planAgain.nextTimerCount === 3);

check('single startBgm function', (html.match(/function startBgm\(/g) || []).length === 1);
check('single BGM gain bus created in startBgm', /gain\.connect\(dest\);/.test(html) && !/function startBgm[\s\S]*gain\.connect\(dest\);[\s\S]*gain\.connect\(dest\);/.test(html.slice(html.indexOf('function startBgm'))));
check('no duplicate schedule if timers live', html.includes('if(bgmNodes.timers && bgmNodes.timers.length) return;'));
check('startGame clears schedules', /clearBgmSchedules\(\);[\s\S]*state = 'explore';[\s\S]*startBgm\(\);/.test(html));
check('startBgm after explore state', html.includes("state = 'explore';\n    startBgm();"));
check('visibility fades BGM', html.includes("syncBgm({fade: document.hidden ? 0.15 : 0.55})"));
check('tick gates BGM', html.includes('tickHallwayBgm();'));
check('end win fades BGM', /state = 'end';[\s\S]{0,80}syncBgm\(/.test(html));
check('mute sets BGM immediately', html.includes('g.setValueAtTime(BGM_MUTE_LEVEL, audioCtx.currentTime)'));
check('duck does not hard-restore 0.42', !/linearRampToValueAtTime\(0\.42/.test(html));
check('ornaments route through BGM bus', html.includes('const dest = bgmNodes.gain;') && html.includes('function playBgmBell') && html.includes('function playBgmCreak'));
check('no speechSynth as BGM', !/speechSynthesis[\s\S]{0,40}BGM/.test(html));

// simulated schedule tracker: arming twice without clear would duplicate
function simulateScheduleGuard(){
  const slots = api.BGM_ORNAMENT_SLOTS.slice();
  const store = {timers: []};
  function schedule(){
    if(store.timers && store.timers.length) return 'reuse';
    slots.forEach(function(kind, i){ store.timers.push(100 + i); });
    return 'armed';
  }
  const a = schedule();
  const b = schedule();
  const cleared = store.timers.splice(0, store.timers.length);
  const c = schedule();
  return {a:a, b:b, c:c, firstCount:3, afterClear:store.timers.length, cleared:cleared.length};
}
const sim = simulateScheduleGuard();
check('schedule first arms', sim.a === 'armed');
check('second start does not duplicate', sim.b === 'reuse');
check('restart after clear rearms once', sim.c === 'armed' && sim.afterClear === 3 && sim.cleared === 3);

check('SCARE_PEAK preserved', api.SCARE_PEAK === 0.98 && html.includes("outClipper.oversample = 'none'"));
check('faces preserved', api.SCARE_FACE_IDS.join(',') === 'grin,uneven,blank,stretch,askew');
check('NPC 0.7 preserved', api.NPC_MOVE_SCALE === 0.7);
check('rope grace/cool preserved', api.ROPE_INITIAL_GRACE === 45 && api.ROPE_COOL_MIN === 45 && api.ROPE_COOL_MAX === 75);
check('jump window preserved', api.ROPE_JUMP_LO === 0.42 && api.ROPE_JUMP_HI === 0.62);
check('player speed preserved', api.MOVE_SPEED === 2.85);
const walk = api.MAP_ROWS.join('').split('').filter(function(c){ return c==='.' || c==='+' || c===' '; }).length;
check('map 56x30/1191/6door', api.MAP_W === 56 && api.MAP_H === 30 && walk === 1191 && api.listNotebookDoors().length === 6);
check('spawn hallway', api.roomNameAt(16.5, 10.5) === 'Hallway');
check('classroom still classroom', api.roomNameAt(32.2, 3.4) === 'Classroom');
check('no PR6 extras', !html.includes('startRopeCountdown'));
check('preview still gated', html.includes("if(!/[?&]pwpreview=1(?:&|$)/.test(String(location.search || ''))) return;"));
check('build marker', html.includes('<!-- build 2026-11-08-hallway-ambient -->'));

console.log(passed + ' passed, ' + failed + ' failed');
if(failed) process.exit(1);
console.log('hallway bgm tests passed');
