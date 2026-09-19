import test from 'node:test';
import assert from 'node:assert/strict';
import { drawGameControl, drawHomeEntryIcon, type HomeEntryKind } from '../src/render/game-controls.ts';
import type { MobileIcon } from '../src/render/mobile-icons.ts';

const icons:MobileIcon[]=['settings','lessons','cards','leaderboard','rank','close','back','info','upgrade','home','replay','play','pause','chevron'];
type Point={x:number;y:number};
type Paint={points:Point[];style:unknown;kind:string};
function drawing(x:number,y:number,size:number,icon:MobileIcon|HomeEntryKind,pressed=false,home=false){
  const initial={fillStyle:'#abcdef',strokeStyle:'#ff00aa',lineWidth:7,lineJoin:'miter',lineCap:'butt',globalAlpha:.7,shadowBlur:5,shadowOffsetX:-3,shadowOffsetY:4};
  let state:Record<string,unknown>={...initial},position={x:0,y:0,scale:1},dash=[4,2];
  const stack:{state:Record<string,unknown>;position:typeof position;dash:number[]}[]=[],paints:Paint[]=[];
  let path:Point[]=[],calls=0;
  const point=(px:number,py:number):Point=>({x:position.x+px*position.scale,y:position.y+py*position.scale});
  const ctx=new Proxy({}, {
    get(_target,key){if(key in state)return state[String(key)];return (...args:unknown[])=>{
      calls++;const n=args as number[];
      switch(key){
        case 'save':stack.push({state:{...state},position:{...position},dash:[...dash]});break;
        case 'restore':assert.ok(stack.length);({state,position,dash}=stack.pop()!);break;
        case 'translate':position.x+=n[0]!*position.scale;position.y+=n[1]!*position.scale;break;
        case 'scale':assert.equal(n[0],n[1]);position.scale*=n[0]!;break;
        case 'setLineDash':dash=[...(args[0] as number[])];break;
        case 'beginPath':path=[];break;
        case 'moveTo':case 'lineTo':path.push(point(n[0]!,n[1]!));break;
        case 'quadraticCurveTo':path.push(point(n[0]!,n[1]!),point(n[2]!,n[3]!));break;
        case 'arc':{
          const [cx,cy,r,start,end]=n as [number,number,number,number,number];
          assert.ok(r>=0);
          for(let i=0;i<=64;i++){const a=start+(end-start)*i/64;path.push(point(cx+Math.cos(a)*r,cy+Math.sin(a)*r));}
          break;
        }
        case 'closePath':break;
        case 'createLinearGradient':{
          assert.ok(n.every(Number.isFinite));
          const stops:[number,string][]=[];
          return {stops,addColorStop(at:number,color:string){assert.ok(at>=0&&at<=1);stops.push([at,color]);}};
        }
        case 'fill':case 'stroke':{
          assert.deepEqual(dash,[]);assert.equal(state.shadowBlur,0);assert.equal(state.shadowOffsetX,0);assert.equal(state.shadowOffsetY,0);
          const radius=key==='stroke'?Number(state.lineWidth)*position.scale/2:0;
          const points=path.flatMap(p=>[-radius,radius].flatMap(dx=>[-radius,radius].map(dy=>({x:p.x+dx,y:p.y+dy}))));
          paints.push({points,style:state[key==='fill'?'fillStyle':'strokeStyle'],kind:String(key)});break;
        }
        default:assert.fail(`Unexpected canvas operation: ${String(key)}`);
      }
    };},
    set(_target,key,value){state[String(key)]=value;calls++;return true;},
  }) as CanvasRenderingContext2D;
  if(home)drawHomeEntryIcon(ctx,x,y,size,icon as HomeEntryKind,pressed);
  else drawGameControl(ctx,x,y,size,icon as MobileIcon,pressed);
  assert.equal(stack.length,0);assert.deepEqual(state,initial);assert.deepEqual(position,{x:0,y:0,scale:1});assert.deepEqual(dash,[4,2]);
  return {paints,calls};
}

test('all round controls stay within their touch square in both states at phone sizes',()=>{
  for(const icon of icons)for(const size of [44,48,52])for(const pressed of [false,true])for(const [x,y] of [[0,0],[21,63],[-80,-52]]){
    const {paints}=drawing(x!,y!,size,icon,pressed);
    assert.ok(paints.length>=7);
    for(const paint of paints)for(const p of paint.points){
      assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
      assert.ok(p.x>=x!-1e-8&&p.x<=x!+size+1e-8&&p.y>=y!-1e-8&&p.y<=y!+size+1e-8,`${icon} ${size} pressed=${pressed} exceeds its square`);
    }
  }
});

test('press sinks the warm glyph and changes lacquer lighting while the foot remains fixed',()=>{
  for(const icon of ['back','pause','close'] as const){
    const normal=drawing(0,0,44,icon).paints,pressed=drawing(0,0,44,icon,true).paints;
    assert.deepEqual(normal[0],pressed[0]);
    assert.notDeepEqual(normal[3]?.style,pressed[3]?.style);
    const normalGlyph=normal.filter(p=>p.style==='#FFF4D7'),pressedGlyph=pressed.filter(p=>p.style==='#E1DFC4');
    assert.ok(normalGlyph.length>0);assert.equal(normalGlyph.length,pressedGlyph.length);
    for(let i=0;i<normalGlyph.length;i++)for(let j=0;j<normalGlyph[i]!.points.length;j++){
      const p=normalGlyph[i]!.points[j]!,q=pressedGlyph[i]!.points[j]!;
      assert.ok(Math.abs(q.x-p.x)<1e-8);assert.ok(Math.abs(q.y-p.y-44*.025)<1e-8);
    }
  }
});

test('home equipment stays centered and distinct, with preserved state and inset press feedback',()=>{
  const kinds:HomeEntryKind[]=['lessons','cards','leaderboard','map','rank'];
  const silhouettes=new Set<string>();
  for(const kind of kinds){
    silhouettes.add(JSON.stringify(drawing(0,0,44,kind,false,true).paints));
    for(const size of [16,28,44,64,112])for(const pressed of [false,true])for(const [x,y] of [[0,0],[24,60],[-20,-30]]){
      const {paints}=drawing(x!,y!,size,kind,pressed,true);assert.ok(paints.length>0);
      for(const paint of paints)for(const p of paint.points){
        assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
        assert.ok(Math.abs(p.x-x!)<=size/2+1e-8&&Math.abs(p.y-y!)<=size/2+1e-8,`${kind} exceeds centered ${size} square`);
      }
    }
    assert.notDeepEqual(drawing(0,0,44,kind,false,true).paints,drawing(0,0,44,kind,true,true).paints);
  }
  assert.equal(silhouettes.size,kinds.length);
});

test('invalid home equipment geometry or unknown kinds never reach Canvas',()=>{
  for(const bad of [NaN,Infinity,-Infinity]){
    assert.equal(drawing(bad,0,44,'map',false,true).calls,0);
    assert.equal(drawing(0,bad,44,'map',false,true).calls,0);
    assert.equal(drawing(0,0,bad,'map',false,true).calls,0);
  }
  for(const size of [0,-1])assert.equal(drawing(0,0,size,'map',false,true).calls,0);
  assert.equal(drawing(Number.MAX_VALUE,0,Number.MAX_VALUE,'map',false,true).calls,0);
  assert.equal(drawing(0,0,44,'unknown' as HomeEntryKind,false,true).calls,0);
});

test('all fourteen controls preserve distinct, nonempty foreground glyphs and caller state',()=>{
  const shapes=icons.map(icon=>JSON.stringify(drawing(0,0,48,icon).paints.filter(p=>p.style==='#FFF4D7').map(p=>p.points)));
  assert.ok(shapes.every(s=>s!=='[]'));assert.equal(new Set(shapes).size,icons.length);
});

test('round control glyphs retain at least 4.5 to 1 contrast against both face-gradient ends',()=>{
  const luminance=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i]!,0);
  for(const pressed of [false,true]){
    const paints=drawing(0,0,44,'pause',pressed).paints;
    const face=paints.find(p=>typeof p.style==='object')!.style as {stops:[number,string][]};
    const foreground=paints.at(-1)!.style as string;
    for(const [,background] of face.stops){
      const a=luminance(background),b=luminance(foreground);
      assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${background}/${foreground} loses foreground contrast`);
    }
  }
});

test('invalid geometry does not touch the caller canvas',()=>{
  for(const bad of [NaN,Infinity,-Infinity]){
    assert.equal(drawing(bad,0,44,'back').calls,0);
    assert.equal(drawing(0,bad,44,'pause').calls,0);
    assert.equal(drawing(0,0,bad,'close').calls,0);
  }
  for(const size of [0,-1])assert.equal(drawing(0,0,size,'back').calls,0);
  assert.equal(drawing(Number.MAX_VALUE,0,Number.MAX_VALUE,'pause').calls,0);
});
