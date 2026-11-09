import { BATTLE_SPRITE_CROPS, type BattleSpriteId } from './battle-sprite-regions.ts';
import { SAMPLE_SPRITE_CROPS, type SampleSpriteId } from './sample-sprite-regions.ts';
import { TROOP_MOTION_CROPS, type MotionSpriteId } from './troop-motion-regions.ts';

/** Local, shared artwork. Platform entries supply images; rules never wait for art. */
export const ART_SOURCES = {
  home:'assets/art/warfront-home.jpg',
  'field-tent':'assets/art/field-tent.jpg',
  'terrain-plains':'assets/art/warfront-ground.jpg',
  'terrain-snow':'assets/art/a-terrain-snow.jpg',
  'terrain-desert':'assets/art/a-terrain-desert.jpg',
  cards:'assets/art/a-cards.jpg',
  battlefield:'assets/art/warfront-camps.png',
  sample:'assets/art/warfront-infantry.png',
  motion:'assets/art/warfront-foot.png',
  cavalry:'assets/art/warfront-cavalry.png',
  landforms:'assets/art/warfront-landforms.png',
} as const;
export const LANDFORM_SPRITE_CROPS={
  "landform-plains-0": [
    0.001953125,
    0.1474609375,
    0.3313802083333333,
    0.2998046875
  ],
  "landform-snow-0": [
    0.3352864583333333,
    0.1484375,
    0.326171875,
    0.2880859375
  ],
  "landform-desert-0": [
    0.6666666666666666,
    0.1689453125,
    0.3333333333333333,
    0.279296875
  ],
  "landform-plains-1": [
    0.0078125,
    0.6181640625,
    0.3209635416666667,
    0.2646484375
  ],
  "landform-snow-1": [
    0.3352864583333333,
    0.6318359375,
    0.3229166666666667,
    0.24609375
  ],
  "landform-desert-1": [
    0.6666666666666666,
    0.640625,
    0.330078125,
    0.2431640625
  ]
} as const;
export type LandformSpriteId=keyof typeof LANDFORM_SPRITE_CROPS;
type SourceId=keyof typeof ART_SOURCES;
type CardKind='mobilize'|'march'|'supply'|'feint'|'farming'|'logistics'|'fortification';
export type ArtId=SourceId|`card-${CardKind}`|BattleSpriteId|SampleSpriteId|MotionSpriteId|LandformSpriteId;
export type ArtImage=Pick<HTMLImageElement,'src'|'width'|'height'|'onload'|'onerror'>;
export type ArtImageFactory=()=>ArtImage;
type SourceState={image:ArtImage|null;loading:Promise<void>|null;failed:boolean};
const states=new Map<SourceId,SourceState>(Object.keys(ART_SOURCES).map(id=>[id as SourceId,{image:null,loading:null,failed:false}]));
const cardKinds:CardKind[]=['mobilize','march','supply','feint','farming','logistics','fortification'];
let imageFactory:ArtImageFactory|undefined;
let artRevision=0;
/** Changes only when available artwork changes, so held input cannot cross layouts. */
export function getArtRevision():number{return artRevision;}

export function getArtStatus():{ready:number;loading:number;failed:number;total:number}{
  const values=[...states.values()];
  return {ready:values.filter(s=>s.image!==null).length,loading:values.filter(s=>s.loading!==null).length,failed:values.filter(s=>s.failed).length,total:values.length};
}

export function loadArt(createImage:ArtImageFactory):Promise<void>{
  imageFactory=createImage;
  const pending=[...states].map(([id,state])=>{
    if(state.image)return Promise.resolve();
    if(state.loading)return state.loading;
    state.failed=false;
    state.loading=Promise.resolve().then(()=>new Promise<void>(resolve=>{
      let image:ArtImage|undefined,timer:ReturnType<typeof setTimeout>|undefined,settled=false;
      const finish=(success:boolean)=>{
        if(settled)return;settled=true;
        if(timer!==undefined)clearTimeout(timer);
        if(image){image.onload=null;image.onerror=null;}
        const next=success&&image?image:null;if(next!==state.image)artRevision++;
        state.image=next;state.failed=!success;resolve();
      };
      try{
        image=createImage();
        image.onload=()=>finish(Number.isFinite(image!.width)&&Number.isFinite(image!.height)&&image!.width>0&&image!.height>0);
        image.onerror=()=>finish(false);
        timer=setTimeout(()=>finish(false),15000);
        image.src=ART_SOURCES[id];
      }catch{finish(false);}
    })).finally(()=>{state.loading=null;});
    return state.loading;
  });
  return Promise.all(pending).then(()=>{});
}

/** Explicit retry and foreground recovery reuse the platform's last image factory. */
export function retryArt():Promise<void>{return imageFactory?loadArt(imageFactory):Promise.resolve();}

function region(id:ArtId):{source:SourceId;column:number;row:number;columns:number;rows:number}|null{
  if(Object.prototype.hasOwnProperty.call(ART_SOURCES,id))return {source:id as SourceId,column:0,row:0,columns:1,rows:1};
  if(id.startsWith('card-')){
    const index=cardKinds.indexOf(id.slice(5) as CardKind);
    if(index>=0)return {source:'cards',column:index%4,row:Math.floor(index/4),columns:4,rows:2};
  }
  return null;
}

export function drawArt(ctx:CanvasRenderingContext2D,id:ArtId,x:number,y:number,width:number,height:number,fit:'cover'|'contain'|'bottom'|'stretch'='contain'):boolean{
  if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)return false;
  const sample=Object.prototype.hasOwnProperty.call(SAMPLE_SPRITE_CROPS,id)?SAMPLE_SPRITE_CROPS[id as SampleSpriteId]:undefined;
  const motion=Object.prototype.hasOwnProperty.call(TROOP_MOTION_CROPS,id)?TROOP_MOTION_CROPS[id as MotionSpriteId]:undefined;
  const landform=Object.prototype.hasOwnProperty.call(LANDFORM_SPRITE_CROPS,id)?LANDFORM_SPRITE_CROPS[id as LandformSpriteId]:undefined;
  const sprite=landform??sample??motion??(Object.prototype.hasOwnProperty.call(BATTLE_SPRITE_CROPS,id)?BATTLE_SPRITE_CROPS[id as BattleSpriteId]:undefined);
  const crop=sprite?{source:landform?'landforms' as const:sample?'sample' as const:motion?(id.startsWith('motion-cavalry-')?'cavalry' as const:'motion' as const):'battlefield' as const,column:0,row:0,columns:1,rows:1}:region(id);if(!crop)return false;
  const state=states.get(crop.source),image=state?.image;if(!image)return false;
  let sw=image.width/crop.columns,sh=image.height/crop.rows,sx=crop.column*sw,sy=crop.row*sh;
  if(sprite){[sx,sy,sw,sh]=[sprite[0]*image.width,sprite[1]*image.height,sprite[2]*image.width,sprite[3]*image.height];}
  if(fit==='cover'){
    const ratio=width/height;
    if(sw/sh>ratio){const next=sh*ratio;sx+=(sw-next)/2;sw=next;}
    else {const next=sw/ratio;sy+=(sh-next)/2;sh=next;}
  }else if(fit!=='stretch'){
    const scale=Math.min(width/sw,height/sh),w=sw*scale,h=sh*scale;
    x+=(width-w)/2;y+=fit==='bottom'?height-h:(height-h)/2;width=w;height=h;
  }
  // drawImage itself does not change transforms, alpha, clipping, or paint styles.
  // The first transparent master has the infantry spear tip in the empty lower-left
  // corner of the neighbouring level-three barracks rectangle. Exclude only that gutter.
  const clipGutter=id==='camp-barracks-3';
  if(clipGutter){ctx.save();ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+width,y);ctx.lineTo(x+width,y+height);ctx.lineTo(x+width*.45,y+height);ctx.lineTo(x+width*.45,y+height*.90);ctx.lineTo(x,y+height*.90);ctx.closePath();ctx.clip();}
  try{ctx.drawImage(image as CanvasImageSource,sx,sy,sw,sh,x,y,width,height);return true;}
  catch{state!.image=null;state!.failed=true;artRevision++;return false;}
  finally{if(clipGutter)ctx.restore();}
}
