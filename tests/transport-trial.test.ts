import test from 'node:test';
import assert from 'node:assert/strict';
import { TransportTrial } from './transport-trial.ts';
for(const ratio of [50,80] as const)test(`transport comparison ${ratio}%: queued and manual orders retain identical per-leg costs`,()=>{
  const manual=new TransportTrial(ratio),queued=new TransportTrial(ratio,true);
  assert.equal(manual.order(0,1),true);assert.equal(queued.order(0,1),true);
  for(let i=0;i<4;i++){manual.step();queued.step();}
  assert.equal(manual.order(1,2),true);for(let i=0;i<4;i++){manual.step();queued.step();}
  assert.deepEqual(manual.counts,queued.counts);assert.equal(manual.commands,2);assert.equal(queued.commands,1);
  assert.deepEqual(queued.counts,ratio===50?[20,10,10]:[8,7,25]);
});
test('queued conversion includes existing garrison, clips overflow and stops if intermediate camp is lost',()=>{
  const b=new TransportTrial(50,true,45);b.order(0,1);for(let i=0;i<8;i++)b.step();
  assert.deepEqual(b.counts,[20,25,25]);assert.equal(b.overflow,15);
  const lost=new TransportTrial(80,true);lost.order(0,1);lost.middleOwned=false;for(let i=0;i<8;i++)lost.step();
  assert.equal(lost.counts[2],0);assert.equal(lost.pending,null);assert.match(lost.log.join(''),/不模拟交战/);
  assert.equal(lost.order(0,2),false);
});
