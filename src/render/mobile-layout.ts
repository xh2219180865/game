type Point={x:number;y:number};
type Rect={x:number;y:number;w:number;h:number};

const SOURCE_CLEARANCE=42;
const LIMIT=Number.MAX_SAFE_INTEGER/4;
const coordinate=(n:number,fallback=0):number=>Number.isFinite(n)?Math.max(-LIMIT,Math.min(LIMIT,n)):fallback;
const dimension=(n:number):number=>Math.max(0,coordinate(n));
const clamp=(n:number,min:number,max:number):number=>Math.max(min,Math.min(max,n));
const overlap=(a:Rect,b:Rect):number=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));

/**
 * Uses the anchor's 34 px hit area plus an 8 px gap before considering other
 * camps. Prefer a local card before seeking an unobstructed distant pocket.
 * Returns the least overlapping local rectangle; the caller must hide it if its hit area
 * would cover the source. No obstacle or input rectangle is modified.
 */
export function placeCampPopover(anchor:Point,bounds:Rect,obstacles:readonly Rect[],size:{w:number;h:number}):Rect{
  const area={x:coordinate(bounds.x),y:coordinate(bounds.y),w:dimension(bounds.w),h:dimension(bounds.h)};
  const w=Math.min(dimension(size.w),area.w),h=Math.min(dimension(size.h),area.h);
  const point={x:coordinate(anchor.x,area.x+area.w/2),y:coordinate(anchor.y,area.y+area.h/2)};
  const source={x:point.x-SOURCE_CLEARANCE,y:point.y-SOURCE_CLEARANCE,w:SOURCE_CLEARANCE*2,h:SOURCE_CLEARANCE*2};
  const others=obstacles.filter(r=>[r.x,r.y,r.w,r.h].every(Number.isFinite)&&r.w>0&&r.h>0).map(r=>({x:coordinate(r.x),y:coordinate(r.y),w:dimension(r.w),h:dimension(r.h)}));
  const candidates:Rect[]=[];
  const seen=new Set<string>();
  const add=(x:number,y:number):void=>{
    const candidate={x:clamp(x,area.x,area.x+area.w-w),y:clamp(y,area.y,area.y+area.h-h),w,h};
    const key=`${candidate.x},${candidate.y}`;
    if(!seen.has(key)){seen.add(key);candidates.push(candidate);}
  };
  // Stable tie order: above, below, left, right.
  add(point.x-w/2,source.y-h);
  add(point.x-w/2,source.y+source.h);
  add(source.x-w,point.y-h/2);
  add(source.x+source.w,point.y-h/2);
  const xs=[area.x,area.x+area.w-w,point.x-w/2,point.x-52-w,point.x+52];
  const ys=[area.y,area.y+area.h-h,point.y-h/2,point.y-52-h,point.y+52];
  for(const r of [source,...others]){
    xs.push(r.x-w,r.x,r.x+r.w-w,r.x+r.w);
    ys.push(r.y-h,r.y,r.y+r.h-h,r.y+r.h);
  }
  // Edge combinations also find clear corner pockets when the four direct
  // placements are obstructed. Overlap area changes only at these edges.
  for(const x of xs)for(const y of ys)add(x,y);
  let best=candidates[0]!;
  let score=[Infinity,Infinity,Infinity,Infinity];
  for(const candidate of candidates){
    const gap=Math.hypot(Math.max(candidate.x-point.x,0,point.x-candidate.x-w),Math.max(candidate.y-point.y,0,point.y-candidate.y-h));
    const next=[overlap(candidate,source),Math.max(0,gap-52),others.reduce((sum,r)=>sum+overlap(candidate,r),0),(candidate.x+w/2-point.x)**2+(candidate.y+h/2-point.y)**2];
    const firstDifference=next.findIndex((value,i)=>value!==score[i]);
    if(firstDifference>=0&&next[firstDifference]!<score[firstDifference]!){
      best=candidate;score=next;
    }
  }
  return best;
}
