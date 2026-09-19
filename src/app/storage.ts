import { validateProfile } from './validation.ts';
import type { Profile } from '../core/progress.ts';

export interface StoragePort { read(key:string):Promise<string|null>; write(key:string,value:string):Promise<void>; remove(key:string):Promise<void> }
export interface Envelope {schemaVersion:1;rulesetId:'tc-v1';contentVersion:'0.1.0';revision:number;writtenAt:number;data:Profile;checksum:string}
export type LoadResult={kind:'empty'}|{kind:'ready';envelope:Envelope}|{kind:'recovery';reason:string;backup:Envelope|null};
export const SLOT_KEYS=['territory-conquest:slot:0','territory-conquest:slot:1'] as const;
export function checksum(value:string):string {
  let hash=2166136261;for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16).padStart(8,'0');
}
export function envelopeFor(data:Profile,revision:number,now:number):Envelope {
  validateProfile(data);const body={schemaVersion:1 as const,rulesetId:'tc-v1' as const,contentVersion:'0.1.0' as const,revision,writtenAt:now,data};
  return {...body,checksum:checksum(JSON.stringify(body))};
}
export function decodeEnvelope(raw:string):Envelope {
  let value:Envelope;
  try{value=JSON.parse(raw) as Envelope;}catch(cause){throw new Error('本地记录格式损坏，请重新读取或恢复可用副本。',{cause});}
  if(!value||value.schemaVersion!==1||value.rulesetId!=='tc-v1'||value.contentVersion!=='0.1.0')throw new Error('存档版本不兼容，请保留原记录');
  const {checksum:stored,...body}=value;
  if(stored!==checksum(JSON.stringify(body)))throw new Error('存档校验失败');
  if(!Number.isSafeInteger(value.revision)||value.revision<1||!Number.isSafeInteger(value.writtenAt)||value.writtenAt<0)throw new Error('存档版本号异常');
  validateProfile(value.data);return value;
}
export class SaveStore {
  private revision=0;
  private blocked=false;
  private queue:Promise<unknown>=Promise.resolve();
  constructor(privatePort:StoragePort){this.port=privatePort;}
  private port:StoragePort;
  async load():Promise<LoadResult>{
    const results=await Promise.allSettled(SLOT_KEYS.map(k=>this.port.read(k)));
    const valid:Envelope[]=[],errors:string[]=[];
    for(const r of results){
      if(r.status==='rejected'){errors.push('无法读取本地记录');continue;}
      if(r.value===null)continue;
      try{valid.push(decodeEnvelope(r.value));}catch(e){errors.push(e instanceof Error?e.message:'记录损坏');}
    }
    valid.sort((a,z)=>z.revision-a.revision);const latest=valid[0]??null;
    if(valid.length===2&&valid[0]!.data.generation!==valid[1]!.data.generation)errors.push('本地会话代次不一致');
    if(valid.length===2&&valid[0]!.revision===valid[1]!.revision&&valid[0]!.checksum!==valid[1]!.checksum)errors.push('存在冲突版本');
    this.blocked=errors.length>0;
    if(this.blocked)return {kind:'recovery',reason:[...new Set(errors)].join('；'),backup:latest};
    this.revision=latest?.revision??0;
    return latest?{kind:'ready',envelope:latest}:{kind:'empty'};
  }
  save(data:Profile,now:number):Promise<Envelope>{
    const captured=JSON.parse(JSON.stringify(data)) as Profile;
    const task=this.queue.then(async()=>{
      if(this.blocked)throw new Error('存档尚待恢复');
      const expected=this.revision, disk=await this.load();
      if(disk.kind==='recovery'||this.revision!==expected){this.blocked=true;throw new Error('本地记录已变化，请重新载入');}
      const candidate=envelopeFor(captured,expected+1,now),raw=JSON.stringify(candidate),key=SLOT_KEYS[candidate.revision%2]!;
      let writeError:unknown;
      try{await this.port.write(key,raw);}catch(e){writeError=e;}
      try{
        let actual:string|null;
        try{actual=await this.port.read(key);}catch(cause){throw new Error('本次保存结果暂无法确认，请重新读取后继续。',{cause});}
        if(actual===raw){this.revision=candidate.revision;return candidate;}
        if(writeError&&actual!==raw)throw new Error('保存未成功，原有记录仍保留');
        throw new Error('保存校验失败，请恢复记录');
      }catch(e){this.blocked=true;throw e;}
    });
    this.queue=task.catch(()=>{});return task;
  }
  async recoverBackup(backup:Envelope,now:number):Promise<Envelope>{
    await this.queue;
    validateProfile(backup.data);
    const candidate=envelopeFor(backup.data,backup.revision+1,now),raw=JSON.stringify(candidate),key=SLOT_KEYS[candidate.revision%2]!;
    try{
      await this.port.write(key,raw);
      if(await this.port.read(key)!==raw)throw new Error('恢复保存尚未确认');
    }catch(cause){throw new Error('副本恢复结果暂无法确认，请重新读取后再操作。',{cause});}
    this.revision=candidate.revision;this.blocked=false;return candidate;
  }
  async reset(data:Profile,now:number):Promise<Envelope>{
    await this.queue;this.blocked=true;
    for(const key of SLOT_KEYS)await this.port.remove(key);
    this.revision=0;this.blocked=false;return this.save(data,now);
  }
}
