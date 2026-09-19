import { SaveStore, SLOT_KEYS, envelopeFor } from '../src/app/storage.ts';
import { CARD_IDS, freshProfile } from '../src/core/progress.ts';
import { createMixedPressure } from './mixed-pressure-fixture.ts';

const button=document.querySelector<HTMLButtonElement>('#run')!,report=document.querySelector<HTMLPreElement>('#report')!;
button.onclick=()=>void run();
async function run(){
  button.disabled=true;
  const prefix=`quota-audit:${crypto.randomUUID()}:`,created=new Set<string>(),fillers:string[]=[],writes:{key:string;error:string}[]=[];
  const result:Record<string,unknown>={status:'running',origin:location.origin,prefix,scope:'Disposable real-browser localStorage; not phone or WeChat quota certification.'};
  const publish=()=>{report.textContent=JSON.stringify(result,null,2);};publish();
  const put=(key:string,value:string)=>{localStorage.setItem(key,value);created.add(key);};
  const port={async read(key:string){return localStorage.getItem(prefix+key);},async write(key:string,value:string){
    try{put(prefix+key,value);}catch(error){writes.push({key,error:error instanceof DOMException?error.name:String(error)});throw error;}
  },async remove(key:string){if(created.has(prefix+key)){localStorage.removeItem(prefix+key);created.delete(prefix+key);}}};
  const ensure=(value:unknown,message:string)=>{if(!value)throw new Error(message);};
  try{
    const now=Date.now(),base=freshProfile(now,'quota-test'),store=new SaveStore(port);
    await store.load();await store.save(base,now);await store.save(base,now);
    const original=SLOT_KEYS.map(key=>localStorage.getItem(prefix+key));
    const candidate=structuredClone(base);candidate.firstDragCompleted=true;candidate.tutorialFirstWins=['L01','L02','L03'];candidate.unlockedCardIds=[...CARD_IDS];
    const {battle}=createMixedPressure(`${candidate.generation}:${candidate.nextMatchSequence++}`);battle.status='paused';
    candidate.activeInventory={...battle.factions.find(f=>f.id==='P')!.inventory};
    candidate.activeMatch={battle,modeId:'arena-four',rankedCommitment:true,realStartedAt:now,startWeekId:candidate.weekId};
    const candidateBefore=JSON.stringify(candidate),expected=JSON.stringify(envelopeFor(candidate,3,now));
    result.envelopeUtf8Bytes=new TextEncoder().encode(expected).length;result.armiesBefore=battle.armies.length;
    ensure(battle.armies.length===256,'Pressure fixture must have 256 armies');
    ensure((result.envelopeUtf8Bytes as number)<256*1024,'Complete envelope exceeds 256 KiB target');
    let characters=0,quotaHits=0;
    for(const size of [65536,1024]){
      while(characters+size<=16*1024*1024){
        const key=prefix+`fill:${fillers.length}`;
        try{put(key,'x'.repeat(size));fillers.push(key);characters+=size;}
        catch(error){if(!(error instanceof DOMException)||error.name!=='QuotaExceededError')throw error;quotaHits++;break;}
      }
      result.fillerCharacters=characters;publish();
      await new Promise<void>(resolve=>setTimeout(resolve,0));
    }
    result.quotaHits=quotaHits;ensure(quotaHits>0,'16 MiB character safety bound reached without quota error; not verified');
    let failure='';try{await store.save(candidate,now);}catch(error){failure=error instanceof Error?error.message:String(error);}
    ensure(failure.length>0&&writes.some(w=>w.error==='QuotaExceededError'),'Formal save did not fail with native quota error');
    ensure(SLOT_KEYS.every((key,i)=>localStorage.getItem(prefix+key)===original[i]),'Failed write changed an old slot');
    ensure(JSON.stringify(candidate)===candidateBefore,'Saving truncated or changed candidate');
    const old=await new SaveStore(port).load();ensure(old.kind==='ready'&&JSON.stringify(old.envelope.data)===JSON.stringify(base),'Old committed profile did not survive');
    result.failedSave={message:failure,nativeErrors:writes,oldSlotsUnchanged:true,candidateUnchanged:true,oldProfileReadable:true};
    for(const key of fillers){localStorage.removeItem(key);created.delete(key);}
    const retry=new SaveStore(port);await retry.load();const saved=await retry.save(candidate,now),loaded=await new SaveStore(port).load();
    ensure(JSON.stringify(saved)===expected,'Retry envelope differs from complete candidate');
    ensure(loaded.kind==='ready'&&JSON.stringify(loaded.envelope)===expected,'Retry read differs from full envelope');
    result.retry={revision:saved.revision,armies:saved.data.activeMatch!.battle.armies.length,fullEnvelopeEqual:true};result.status='passed';
  }catch(error){result.status='failed';result.error=error instanceof Error?error.message:String(error);}
  finally{
    const keys=[...new Set([...fillers,...created])];for(const key of keys){localStorage.removeItem(key);created.delete(key);}
    result.cleanup={createdKeysRemoved:keys.length,remaining:keys.filter(key=>localStorage.getItem(key)!==null).length};
    publish();button.disabled=false;
  }
}
