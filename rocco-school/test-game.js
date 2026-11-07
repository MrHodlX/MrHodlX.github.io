'use strict';
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

function assert(cond, msg){
  if(!cond) throw new Error('FAIL: ' + msg);
}

const scriptMatch = html.match(/<script>\s*\(function\(\)\{([\s\S]*?)\}\)\(\);\s*<\/script>/);
assert(scriptMatch, 'main IIFE script present');
const script = '(function(){\n' + scriptMatch[1] + '\n})();';
try {
  new Function(script);
} catch (err) {
  throw new Error('FAIL: script syntax: ' + err.message);
}

const logicMatch = html.match(/\/\* ::ROCCO_LOGIC_START:: \*\/([\s\S]*?)\/\* ::ROCCO_LOGIC_END:: \*\//);
assert(logicMatch, 'logic export markers present');
const api = new Function(logicMatch[1] + '; return { TIME_PER_Q: typeof TIME_PER_Q==="undefined"?null:TIME_PER_Q, CATCH_DIST, PLAYER_RADIUS, NEED_BOOKS, MAP_ROWS, MAP_W, MAP_H, mapChar, isSolid, circleBlocked, tryMoveEntity, canCatch, roomNameAt, listNotebookDoors, doorInFront, movementPaused, rand, shuffle, choicesFor, QUESTION_TYPES, QUESTION_TYPE_IDS, pickLifeQuestions, SPAWN, INTERACT_DIST };')();

assert(api.QUESTION_TYPE_IDS.length === 12, '12 question types, got ' + api.QUESTION_TYPE_IDS.length);
assert(new Set(api.QUESTION_TYPE_IDS).size === 12, 'question type ids unique');

// TIME_PER_Q is outside the marker; read from file
assert(/const TIME_PER_Q = 30;/.test(html), '30-second quiz timer');
assert(api.NEED_BOOKS === 6, 'need 6 notebooks');

const rows = api.MAP_ROWS;
assert(rows.length === api.MAP_H, 'map height matches');
assert(rows.every(r => r.length === api.MAP_W), 'all map rows same width');
const doors = api.listNotebookDoors();
assert(doors.length === 6, 'exactly 6 notebook doors, got ' + doors.length);
assert(rows.join('').split('L').length - 1 >= 12, 'lockers present on map');
assert(api.roomNameAt(3.5, 3.5) === 'Locker Room', 'locker room region');
assert(api.roomNameAt(16.5, 10.5) === 'Hallway', 'hallway region');
assert(api.roomNameAt(32.2, 3.4) === 'Classroom', 'classroom region');
assert(api.roomNameAt(3.5, 8.5) === 'Cafeteria', 'cafeteria region');
assert(api.roomNameAt(32.2, 8.5) === 'Gym', 'gym region');
assert(api.roomNameAt(32.2, 14.4) === 'Rocket Bay', 'rocket bay region');

assert(!api.isSolid(Math.floor(api.SPAWN.x), Math.floor(api.SPAWN.y)), 'spawn tile walkable');
assert(!api.circleBlocked(api.SPAWN.x, api.SPAWN.y, api.PLAYER_RADIUS), 'spawn not colliding');

const reachQ = [[Math.floor(api.SPAWN.x), Math.floor(api.SPAWN.y)]];
const reachSeen = new Set([reachQ[0][0]+','+reachQ[0][1]]);
const reachDirs = [[1,0],[-1,0],[0,1],[0,-1]];
while(reachQ.length){
  const cur = reachQ.pop();
  for(let i=0;i<reachDirs.length;i++){
    const nx = cur[0]+reachDirs[i][0], ny = cur[1]+reachDirs[i][1], k=nx+','+ny;
    if(reachSeen.has(k) || nx<0 || ny<0 || nx>=api.MAP_W || ny>=api.MAP_H) continue;
    if(api.isSolid(nx,ny)) continue;
    reachSeen.add(k);
    reachQ.push([nx,ny]);
  }
}
doors.forEach(function(d){
  const adj = reachDirs.some(function(dir){ return reachSeen.has((d.tx+dir[0])+','+(d.ty+dir[1])); });
  assert(adj, 'notebook door reachable from spawn: '+d.tx+','+d.ty);
});
assert(api.isSolid(0, 0), 'outer wall solid');
assert(!api.isSolid(16, 10), 'hallway floor not solid');
assert(!api.isSolid(7, 3), 'doorway + is walkable');
assert(api.isSolid(3, 3), 'notebook door is solid');
assert(api.isSolid(1, 1), 'locker tile solid');

const ent = {x: api.SPAWN.x, y: api.SPAWN.y};
api.tryMoveEntity(ent, 0.2, api.SPAWN.y, api.PLAYER_RADIUS);
assert(ent.x > 1, 'cannot walk through west wall (x stayed safer than wall interior)');
assert(ent.x < api.SPAWN.x + 0.01, 'x did not pass into solid wall');

const wallEnt = {x: 16.5, y: 10.5};
api.tryMoveEntity(wallEnt, 16.5, 0.2, api.PLAYER_RADIUS);
assert(wallEnt.y > 1, 'cannot walk through north wall');

// door facing: stand east of locker-room notebook door (3,3) facing west
const lockerHit = api.doorInFront(4.3, 3.5, Math.PI, api.INTERACT_DIST);
assert(lockerHit && lockerHit.tx === 3 && lockerHit.ty === 3, 'facing locker notebook door detects it: ' + JSON.stringify(lockerHit));
const missHit = api.doorInFront(16.5, 10.5, -Math.PI/2, api.INTERACT_DIST);
assert(!missHit, 'center hallway facing north is not immediately a notebook door');

assert(api.canCatch(5, 5, 5.1, 5.1), 'close principal catches Rocco');
assert(!api.canCatch(5, 5, 8, 8), 'far principal does not catch');

assert(api.movementPaused({quizOpen:true, paused:true}) === true, 'quiz pauses movement');
assert(api.movementPaused({quizOpen:false, paused:false}) === false, 'explore does not pause movement');

function uniqueTypes(qs){ return new Set(qs.map(q => q.type)); }

let prev = [];
let last = api.pickLifeQuestions(prev);
assert(last.length === api.NEED_BOOKS, 'life picks 6 questions');
assert(uniqueTypes(last).size === api.NEED_BOOKS, 'types unique within a life');
last.forEach(q => {
  assert(typeof q.q === 'string' && q.q.length > 20, 'question text');
  assert(Number.isFinite(q.a), 'numeric answer');
  assert(q.c.includes(q.a), 'choices include answer');
  assert(q.c.length === 4, 'four choices');
  assert(api.QUESTION_TYPE_IDS.includes(q.type), 'known type');
});

for(let i=0;i<8;i++){
  const next = api.pickLifeQuestions(last.map(q => q.type));
  assert(next.length === api.NEED_BOOKS, 'respawn life '+i+' has 6 questions');
  assert(uniqueTypes(next).size === api.NEED_BOOKS, 'respawn life '+i+' unique types');
  const overlap = next.filter(q => last.some(p => p.type === q.type));
  assert(overlap.length === 0, 'respawn '+i+' repeats types: ' + overlap.map(q=>q.type).join(','));
  last = next;
}

// Generated answers match type formulas for a few sampled gens
for(let n=0;n<40;n++){
  const q = api.QUESTION_TYPES.equal_groups();
  const m = q.q.match(/counts (\d+) starships[\s\S]*has (\d+) windows/);
  assert(m && q.a === (+m[1])*(+m[2]), 'equal_groups answer');
  const q2 = api.QUESTION_TYPES.subtract_left();
  const m2 = q2.q.match(/cooked (\d+)[\s\S]*ate (\d+)/);
  assert(m2 && q2.a === (+m2[1])-(+m2[2]), 'subtract_left answer');
  const q3 = api.QUESTION_TYPES.each_took();
  const m3 = q3.q.match(/had (\d+) pencils\. (\d+) kids each took (\d+)/);
  assert(m3 && q3.a === (+m3[1]) - (+m3[2])*(+m3[3]), 'each_took answer');
}

assert(html.includes("Principal's Wrath"), 'title preserved');
assert(html.includes('He grades forever'), 'tagline preserved');
assert(html.includes('id="btnMute"'), 'mute control');
assert(html.includes('id="dpad"'), 'tablet dpad');
assert(html.includes('id="btnInteract"'), 'open/interact button');
assert(html.includes('SCARE_SVG') && html.includes('CALC_SVG'), 'original teacher art present');
assert(!html.includes('entropy'), 'no entropy lab references in rocco-school page');

console.log('All tests passed');
console.log(JSON.stringify({
  types: api.QUESTION_TYPE_IDS,
  doors: doors,
  map: {w: api.MAP_W, h: api.MAP_H},
  spawn: api.SPAWN,
  catchDist: api.CATCH_DIST
}, null, 2));
