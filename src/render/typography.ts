/** Local display subset; body copy and battlefield counts keep their readable fonts. */
export const FONT_SOURCE='assets/fonts/shanhe-wenkai.ttf';
export const FONT_FILES=[FONT_SOURCE,'assets/fonts/OFL.txt'] as const;
let family:string|null=null;
let revision=0;
export function displayFont():string{return `${family?`"${family}", `:''}"Kaiti SC", "STKaiti", "KaiTi", "Songti SC", "STSong", "SimSun", serif`;}
export function getFontRevision():number{return revision;}
export function installDisplayFont(value:string):void{
  if(!value||/["\\\r\n]/.test(value)||value===family)return;
  family=value;revision++;
}
