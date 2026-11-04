import type {Tier} from '../core/types.ts';
export type SampleSpriteId=`sample-barracks-${Tier}`|`sample-infantry-${0|1|2|3|4|5}`;
/** New infantry artwork; equal source windows keep the actual foot baseline stable. */
export const SAMPLE_SPRITE_CROPS:Record<SampleSpriteId,readonly[number,number,number,number]>={
  "sample-barracks-1": [
    0.030598958333333332,
    0.00390625,
    0.2766927083333333,
    0.2939453125
  ],
  "sample-barracks-2": [
    0.3515625,
    0,
    0.2962239583333333,
    0.2978515625
  ],
  "sample-barracks-3": [
    0.68359375,
    0.0009765625,
    0.3014322916666667,
    0.296875
  ],
  "sample-infantry-0": [
    0.0986328125,
    0.306640625,
    0.14908854166666666,
    0.3359375
  ],
  "sample-infantry-1": [
    0.4169921875,
    0.306640625,
    0.14908854166666666,
    0.3359375
  ],
  "sample-infantry-2": [
    0.7535807291666666,
    0.306640625,
    0.14908854166666666,
    0.3359375
  ],
  "sample-infantry-3": [
    0.10091145833333333,
    0.650390625,
    0.14908854166666666,
    0.3359375
  ],
  "sample-infantry-4": [
    0.4215494791666667,
    0.650390625,
    0.14908854166666666,
    0.3359375
  ],
  "sample-infantry-5": [
    0.7552083333333334,
    0.650390625,
    0.14908854166666666,
    0.3359375
  ]
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
