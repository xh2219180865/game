import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceBattle, applyBattleAction, createBattle } from '../src/core/battle.ts';
import { advanceSimulation } from '../src/core/ai.ts';
import { validateBattle } from '../src/app/validation.ts';

test('P04 P06: 256 real army records remain intact through save and arrival',()=>{
  const b=createBattle('L03',{id:'stress',firstDragCompleted:true}),source=b.camps.find(c=>c.id==='L03-P2')!;
  for(let i=1;i<=256;i++){source.garrison=2;assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:i,sourceId:source.id,targetId:'L03-N2'}).ok,true);}
  validateBattle(b);const json=JSON.stringify(b);assert.ok(Buffer.byteLength(json)<256*1024);const restored=JSON.parse(json);assert.equal(restored.armies.length,256);
  const ev=advanceBattle(restored,b.armies[0]!.arrivalAtMs);assert.equal(restored.armies.length,0);assert.equal(ev.filter(e=>e.type==='arrival').length,256);assert.ok(ev.some(e=>e.type==='overflow'));
});
test('R18 N65 P05: identical scheduled inputs produce identical states at 30 and 60 fps',()=>{
  function run(fps:number){
    const b=createBattle('A01',{id:'frame-test'});let actionIndex=0;
    const actions=[{at:1000,targetId:'A01-N4'},{at:4000,targetId:'A01-N2'},{at:10000,targetId:'A01-N4'}];
    for(let f=1;f<=fps*240&&b.status==='running';f++){
      const to=Math.round(f*1000/fps);
      while(actions[actionIndex]&&actions[actionIndex]!.at<=to){const a=actions[actionIndex]!;advanceSimulation(b,a.at);applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:++actionIndex,sourceId:'A01-P1',targetId:a.targetId});}
      advanceSimulation(b,to);
    }
    assert.equal(b.status,'finished');assert.ok(b.result);return b;
  }
  assert.deepEqual(run(30),run(60));
});
