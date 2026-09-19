import type {Tier} from '../core/types.ts';

export type SampleSpriteId=`sample-barracks-${Tier}`|`sample-infantry-${0|1|2|3|4|5}`;
const uv=(x:number,y:number,w:number,h:number):readonly[number,number,number,number]=>[x/1536,y/1024,w/1536,h/1024];
/** Shared soldier crop dimensions preserve helmet and ground alignment across frames. */
export const SAMPLE_SPRITE_CROPS:Record<SampleSpriteId,readonly[number,number,number,number]>={
  'sample-barracks-1':uv(32,117,438,237),
  'sample-barracks-2':uv(517,75,493,273),
  'sample-barracks-3':uv(1027,4,502,348),
  'sample-infantry-0':uv(153,350,210,314),
  'sample-infantry-1':uv(665,350,210,314),
  'sample-infantry-2':uv(1177,350,210,314),
  'sample-infantry-3':uv(153,667,210,314),
  'sample-infantry-4':uv(665,667,210,314),
  'sample-infantry-5':uv(1177,667,210,314),
};

/** Six visible foot poses per 720 ms cycle; negative/invalid clocks remain still. */
export function infantryWalkFrame(clockMs:number,slot=0,moving=true):0|1|2|3|4|5{
  if(!moving||!Number.isFinite(clockMs)||clockMs<0)return 0;
  const offset=Number.isSafeInteger(slot)&&slot>=0?(slot%3)*2:0;
  return ((Math.floor(clockMs/120)+offset)%6) as 0|1|2|3|4|5;
}

/** A full stride covers 17.28 map units (720 ms at base infantry speed). Phase is in cycles. */
export function infantryDistanceFrame(distance:number,slot=0,moving=true,phase=0):0|1|2|3|4|5{
  if(!moving||!Number.isFinite(distance)||distance<0)return 0;
  const offset=Number.isSafeInteger(slot)&&slot>=0?(slot%3)*2:0;
  const cycle=Number.isFinite(phase)?((phase%1)+1)%1:0;
  return ((Math.floor(distance/2.88+cycle*6+1e-9)+offset)%6) as 0|1|2|3|4|5;
}
