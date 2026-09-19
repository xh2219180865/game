import type { TroopType } from '../core/types.ts';

export type MotionTroop=Exclude<TroopType,'infantry'>;
export type MotionFrame=0|1|2|3|4|5;
export type MotionSpriteId=`motion-${MotionTroop}-${MotionFrame}`;
/** Equal cell windows keep each unit's size and foot baseline stable across a stride. */
export const TROOP_MOTION_CROPS=Object.fromEntries(
  (['archer','cavalry','guard'] as const).flatMap((type,row)=>
    Array.from({length:6},(_,frame)=>[`motion-${type}-${frame}`,type==='cavalry'
      ?[((frame%3)*512+32)/1536,(Math.floor(frame/3)*502+8)/1024,448/1536,472/1024] as const
      :[(frame*256+24)/1536,(row===0?12:674)/1024,232/1536,(row===0?316:332)/1024] as const])),
) as Record<MotionSpriteId,readonly[number,number,number,number]>;
