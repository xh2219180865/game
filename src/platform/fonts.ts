import {FONT_SOURCE,installDisplayFont} from '../render/typography.ts';

/** Optional local decoration. A failed/missing font must never block the game. */
export async function loadBrowserFont(onFailure?:(message:string)=>void):Promise<void>{
  if(typeof FontFace==='undefined'||typeof document==='undefined'||!document.fonts)return;
  try{
    const face=await new FontFace('Shanhe WenKai',`url("${FONT_SOURCE}")`).load();
    // CSSOM may serialize a spaced family with quotes. We own this declared
    // family; use it directly rather than accepting a serialized CSS value.
    document.fonts.add(face);installDisplayFont('Shanhe WenKai');
  }catch(error){onFailure?.(String(error));/* Keep system Kai/Song fallback. */}
}
export function loadWechatFont(port:{loadFont?:(path:string)=>string|null}):void{
  try{const family=port.loadFont?.(FONT_SOURCE);if(family)installDisplayFont(family);}catch{/* Same fallback on older base libraries. */}
}
