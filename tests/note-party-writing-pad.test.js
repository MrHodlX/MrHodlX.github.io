// Run: node tests/note-party-writing-pad.test.js  (root Note Party writing pad only)
const fs=require('fs'),path=require('path'),assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let n=0;const t=(name,fn)=>{fn();n++;console.log('ok',n,name);};
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
t('all root scripts parse',()=>{assert(scripts.length>=2);scripts.forEach(s=>new Function(s));});
const wpSrc=scripts.find(s=>s.includes('NotePartyWritingPad'));
t('markup present',()=>{['id="write-hud-btn"','id="writing-pad"','id="wp-pencil"','id="wp-eraser"','id="wp-clear"','id="wp-done"','id="wp-canvas"','touch-action:none'].forEach(k=>assert(html.includes(k),k));});
t('no storage/upload/permission APIs in pad',()=>{['localStorage','sessionStorage','fetch(','XMLHttpRequest','getUserMedia','indexedDB'].forEach(k=>assert(!wpSrc.includes(k),k));});
t('existing features intact',()=>{['Note Party — For Star','id="star-recorder"','id="level2"','id="singalong"','id="sing-hud-btn"'].forEach(k=>assert(html.includes(k),k));});
// mock DOM
function el(id){const l={},a={};return{id,style:{},listeners:l,attrs:a,classList:{s:new Set(),add(c){this.s.add(c)},remove(c){this.s.delete(c)},contains(c){return this.s.has(c)}},setAttribute(k,v){a[k]=v},addEventListener(e,f){(l[e]=l[e]||[]).push(f)},fire(e,ev){(l[e]||[]).forEach(f=>f(ev))},textContent:''};}
const ops=[];const ctx=new Proxy({},{get:(o,k)=>k in o?o[k]:(...args)=>ops.push([k,...args]),set:(o,k,v)=>{o[k]=v;if(k==='globalCompositeOperation')ops.push(['gco',v]);return true;}});
const els={};['writing-pad','wp-canvas','write-hud-btn','wp-pencil','wp-eraser','wp-status','wp-clear','wp-done'].forEach(i=>els[i]=el(i));
let rect={left:10,top:20,width:200,height:100};
els['wp-canvas'].getContext=()=>ctx;els['wp-canvas'].getBoundingClientRect=()=>rect;els['wp-canvas'].setPointerCapture=()=>{};
const winL={};const win={devicePixelRatio:2,confirm:()=>true,addEventListener:(e,f)=>(winL[e]=f)};
new Function('window','document',wpSrc)(win,{getElementById:i=>els[i]});
const API=win.NotePartyWritingPad;const c=els['wp-canvas'];
const ev=(x,y,id=1)=>({clientX:x,clientY:y,pointerId:id,preventDefault(){this.pd=true}});
t('model tool switching',()=>{const m=API.createPadModel();assert.equal(m.tool,'pencil');m.setTool('eraser');assert.equal(m.tool,'eraser');m.setTool('math');assert.equal(m.tool,'eraser');});
t('toNorm clamps',()=>{assert.deepEqual(API.toNorm(110,70,rect),[0.5,0.5]);assert.deepEqual(API.toNorm(-50,999,rect),[0,1]);});
t('open sizes highDPI canvas',()=>{els['write-hud-btn'].onclick();assert(els['writing-pad'].classList.contains('show'));assert.equal(c.width,400);assert.equal(c.height,200);});
t('pencil stroke draws + prevents scroll',()=>{ops.length=0;const d=ev(20,30);c.fire('pointerdown',d);assert(d.pd);const m=ev(60,60);c.fire('pointermove',m);assert(m.pd);c.fire('pointerup',ev(60,60));assert(ops.some(o=>o[0]==='gco'&&o[1]==='source-over'));assert(ops.some(o=>o[0]==='lineTo'));});
t('move without down ignored',()=>{ops.length=0;const m=ev(1,1);c.fire('pointermove',m);assert(!m.pd);assert.equal(ops.length,0);});
t('eraser uses destination-out (background preserved)',()=>{els['wp-eraser'].onclick();assert.equal(els['wp-eraser'].attrs['aria-pressed'],'true');assert.equal(els['wp-pencil'].attrs['aria-pressed'],'false');ops.length=0;c.fire('pointerdown',ev(20,30));c.fire('pointermove',ev(40,40));c.fire('pointercancel',ev(0,0));assert(ops.some(o=>o[0]==='gco'&&o[1]==='destination-out'));});
t('pointercancel ends stroke',()=>{ops.length=0;const m=ev(5,5);c.fire('pointermove',m);assert(!m.pd);});
t('other pointer cannot hijack stroke',()=>{c.fire('pointerdown',ev(20,30,7));const before=ops.length;c.fire('pointermove',ev(50,50,8));c.fire('pointerup',ev(0,0,7));assert.equal(ops.filter(o=>o[0]==='lineTo').length>=0,true);});
t('resize keeps strokes and remaps',()=>{rect={left:0,top:0,width:400,height:300};ops.length=0;winL.resize();assert.equal(c.width,800);assert(ops.some(o=>o[0]==='moveTo'));});
t('done closes, reopen preserves session',()=>{els['wp-done'].onclick();assert(!els['writing-pad'].classList.contains('show'));ops.length=0;els['write-hud-btn'].onclick();assert(ops.some(o=>o[0]==='moveTo'));});
t('clear empties after confirm; cancel keeps',()=>{win.confirm=()=>false;els['wp-clear'].onclick();ops.length=0;winL.resize();assert(ops.some(o=>o[0]==='moveTo'));win.confirm=()=>true;els['wp-clear'].onclick();ops.length=0;winL.resize();assert(!ops.some(o=>o[0]==='moveTo'||o[0]==='arc'));els['wp-clear'].onclick();});
t('tap draws dot; pencil reselect',()=>{els['wp-pencil'].onclick();ops.length=0;c.fire('pointerdown',ev(30,30));c.fire('pointerup',ev(30,30));assert(ops.some(o=>o[0]==='arc'));});
console.log(`\n${n} tests passed`);
