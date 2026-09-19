import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const read=(file:string)=>readFileSync(resolve(root,file),'utf8');
const index=JSON.parse(read('tests/acceptance-map.json'));
const requirements=[...read('docs/11-需求核对清单.md').matchAll(/^### 核对项：(.+)\n([\s\S]*?)(?=^### 核对项：|$(?![\s\S]))/gm)].map(match=>({
  title:match[1],scenarios:[...match[2]!.matchAll(/^#### 场景：(.+)$/gm)].map(s=>s[1]),
}));

test('acceptance index preserves all current case IDs and every requirement scenario in document order',()=>{
  const ids=[...read('docs/08-验收用例.md').matchAll(/^\| ([A-Y]\d{2}) \|/gm)].map(match=>match[1]);
  assert.equal(ids.length,290);assert.equal(new Set(ids).size,290);
  assert.deepEqual(index.cases.map((c:{id:string})=>c.id),ids);
  assert.equal(requirements.length,46);assert.equal(requirements.flatMap(r=>r.scenarios).length,98);
  assert.deepEqual(index.requirements.map((r:{title:string;scenarios:{title:string}[]})=>({title:r.title,scenarios:r.scenarios?.map(s=>s.title)})),requirements);
});

test('requirement evidence names its scope, valid case references and remaining conditions without depending on temporary artifacts',()=>{
  const statuses=new Set(['verified-local','partial-local','deferred-platform','conditional-future']);
  const ids=new Set(index.cases.map((c:{id:string})=>c.id));
  for(const requirement of index.requirements){
    assert.ok(statuses.has(requirement.acceptance),requirement.title);
    assert.ok(typeof requirement.reviewEvidence==='string'&&requirement.reviewEvidence.trim(),requirement.title);
    for(const scenario of requirement.scenarios){
      const label=`${requirement.title} / ${scenario.title}`;
      assert.ok(statuses.has(scenario.acceptance),label);
      assert.ok(Array.isArray(scenario.caseIds)&&new Set(scenario.caseIds).size===scenario.caseIds.length,label);
      for(const id of scenario.caseIds)assert.ok(ids.has(id),`${label}: ${id}`);
      assert.ok(Array.isArray(scenario.remaining),label);
      if(scenario.acceptance==='verified-local')assert.deepEqual(scenario.remaining,[],label);
      else assert.ok(scenario.remaining.length>0&&scenario.remaining.every((s:unknown)=>typeof s==='string'&&s.trim()),label);
      assert.ok(Array.isArray(scenario.evidence)&&scenario.evidence.length>0,label);
      for(const evidence of scenario.evidence){
        assert.ok(typeof evidence.file==='string'&&!evidence.file.startsWith('/')&&!evidence.file.split('/').includes('..'),label);
        assert.ok(typeof evidence.detail==='string'&&evidence.detail.trim(),label);
        // Screenshots and run logs are optional audit artifacts; a clean checkout must still test and build.
        if(!evidence.file.startsWith('.tmp/'))assert.ok(existsSync(resolve(root,evidence.file)),`${label}: ${evidence.file}`);
      }
    }
  }
});
