'use strict';
(() => {
const cards = [
{id:'mobilize',name:'鸣鼓征兵',short:'征兵',kind:'主动',status:'现行策略 · 保留',effect:'己营额外增加一倍自然产速，持续 6 秒；每张额外生产额度最多 8。',input:'点卡，再点未满仓且未停产的己营。',motion:'双槌落下 → 鼓皮短回弹 → 600ms 收稳；持续标记显示剩余期限。',limits:'不是即时 +8。停产与满仓不积累兵；续卡只续时并追加预算，不叠倍率。',scene:'一级步营 20 兵、零生产余量，无被动。t=0 施策；本示例按自然 0.9＋额外 0.9 兵／秒展示。'},
{id:'march',name:'倍道兼行',short:'兼行',kind:'主动',status:'现行策略 · 保留',effect:'下一次有效派兵速度 ×1.4；只影响这一队。',input:'点卡准备，再沿合法相邻道路拖兵。真实整数 ETA 缩短才消费。',motion:'真正出发时显示双箭；150–450ms 两根短尾线；队伍始终按实际 ETA 移动。',limits:'不加攻击，不途中转骑兵。已存在求援时取较高主动倍率，不相乘。',scene:'两己营各 20／10 兵；t=0 源派 10 留 10。示例普通旅时 4200ms，兼行为 3000ms；路线非地图比例。'},
{id:'supply',name:'征召乡勇',short:'乡勇',kind:'主动',status:'现行策略 · 保留',effect:'立即补充最多 6 名本营兵种，受有效容量限制。',input:'点卡后点未满仓己营。取消／无效不消费。',motion:'t=0 已补兵；集合剪影从近处收拢，木签确认；600ms 内收尾。',limits:'48／50 只补 2；满仓无效不扣。图标三人仅为集合意象，不是补兵数。',scene:'己营初始 48／50，t=0 乡勇提交后立即变为 50，只显示实际 +2；隔离自然生产。'},
{id:'feint',name:'火袭粮营',short:'火袭',kind:'主动',status:'现行策略 · 保留',effect:'敌营停产 4 秒；若为塔营，同时停射 4 秒。',input:'点卡，再点存活敌方营地。中立／己方无效。',motion:'粮袋短火星 → 小烟 → 600ms 收为停产横杠；续时只用 280ms 确认。',limits:'不烧掉驻军，不伤在途军；塔内守备兵仍可派出，已出发弓兵仍可齐射。',scene:'敌塔营 20 兵，t=0 火袭；驻军不减，t=4000ms 停产／停射到期。为看清状态，不推进本例自然生产与塔射。'},
{id:'beacon',name:'烽火求援',short:'求援',kind:'主动',status:'新增设计 · 未启用',effect:'标记己营 6 秒；相邻友营新发往该城的援军速度 ×1.25。',input:'点卡，再点有直连可派友营的己城；不自动派兵。',motion:'小烽火点亮，合法邻路短显汇入箭；220ms 后仅留期限。',limits:'旧在途队不加速；目标易主清标，已出发速度快照保留。对方可以转攻别城。',scene:'中营 16 兵，两侧友营各 20。t=0 求援；t=1000ms 示范玩家分别派 10 兵，普通 5000ms→4000ms，两队在 t=5000ms 到达；隔离自然生产。'},
{id:'converge',name:'并力齐攻',short:'齐攻',kind:'主动',status:'新增设计 · 未启用',effect:'两座己营各派半数，同步抵达一座共同直连的敌营。',input:'选源 A → 源 B → 共同邻敌城 → 看派留／ETA → 确认。',motion:'t=0 两队立即前进；双木令短显 220ms，到达复用普通交战。',limits:'通常旅时 2500／4000ms 时共同用 4000ms；两队不合并、无额外攻击。两源会同时减兵。',scene:'两源各 20，敌营 16。t=0 各派 10，通常 2500／4000ms 对齐为 4000ms；均为步兵，隔离产兵与塔射；t=4000ms 占领剩 4。'},
{id:'barricade',name:'拒马固守',short:'拒马',kind:'主动',status:'新增设计 · 未启用',effect:'己城设置 4 点拒马，存在 8 秒；只抵消到达城门的敌军。',input:'点卡后点己营。已有拒马再次使用只续时、不补点。',motion:'木梁就位，220ms 绳结收紧；实际抵消时 160ms 短木屑与缺口。',limits:'弓兵齐射和塔射仍削真实驻军；拒马不计兵力、不拦路。易主／到期清除。',scene:'己城守 6、拒马 4；一支 8 人敌军在 t=2500ms 抵达，先耗工事 4，再以 4 对 6，守军剩 2；本例隔离产兵。',duration:8000},
{id:'farming',name:'屯田积谷',short:'屯田',kind:'被动',status:'现行策略 · 保留',effect:'获卡累加层数，全部己营自然产速按 B(0.20,n) 提高。',input:'领奖时确认领取；后续对局自动读取层数，无战场施放按钮。',motion:'领取提交后谷穗轻倾，240ms 内回稳；战场不循环撒谷。',limits:'每周到期；n 层为 0.20n／(n+4)，不设三层上限。升级和兵种仍影响基础产速。',scene:'领取示意：屯田 1→2 层，增益 4%→6.67%；一级步营有效产速 0.936→0.960 兵／秒。展示领取后结果，不模拟在途生产。'},
{id:'logistics',name:'兵贵神速',short:'神速',kind:'被动',status:'现行策略 · 保留',effect:'全部新出征部队速度按 B(0.15,n) 提高，仍受速度封顶。',input:'领取后在后续局自动生效；已出发队伍不重新加速。',motion:'两枚足迹依次加深，220ms 内收稳；无常驻速度光环。',limits:'和兼行的单队主动区分：神速是全局小幅被动；不加伤害、射程或齐射次数。',scene:'领取示意：神速 1→2 层，增益 3%→5%；无其他加成步兵速度 24.72→25.20。此页不模拟真实地图旅时。'},
{id:'appeasement',name:'新城招抚',short:'招抚',kind:'被动',status:'替换候选 · 未启用',effect:'本局首次获得某城后，补 floor(6n／(n+4)) 名本营兵种。',input:'无施放按钮；须先真实占领，交战／归属／淘汰之后检查一次。',motion:'并入已有夺城序列，180ms 后安民粮囊轻收，450ms 内收尾；不再换一次旗。',limits:'满仓也记已触发，同城夺回不重发；零城淘汰不复活。与扩营做替换对照，旧层数不转换。',scene:'招抚 2 层。10 步兵于 t=3000ms 攻下 6 兵中立弓营，先剩 4 转弓兵，再招抚 +2 成 6；隔离生产与射击。'}
];
const $=id=>document.getElementById(id),ctx=$('battle').getContext('2d');
const icons=new Map();
let selected=cards[4],time=0,playing=false,last=null,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
$('reduced').checked=reduced;
for(const item of cards){const img=new Image();img.src=`icons/${item.id}.svg`;img.onload=()=>draw();icons.set(item.id,img);
 const button=document.createElement('button');button.className='order';button.dataset.id=item.id;button.innerHTML=`<span class="painted-icon" style="--ix:${cards.indexOf(item)%5};--iy:${Math.floor(cards.indexOf(item)/5)}"><img src="icons/${item.id}.svg" alt=""></span><span>${item.short}<small>${item.kind}</small></span>`;button.onclick=()=>select(item.id);$('cards').append(button);}
const battlefieldArt={};
for(const [name,src] of Object.entries({ground:'reference/warfront-ground.jpg',camps:'reference/warfront-camps.png',orders:'icon-art-direction.png'})){const image=new Image();image.onload=()=>draw();image.onerror=()=>{if(name==='orders')document.body.classList.add('orders-fallback');draw();};image.src=src;battlefieldArt[name]=image;}
const spriteCrops={"camp-barracks-1": [0.009569377990430622, 0.02631578947368421, 0.22886762360446572, 0.2025518341307815], "camp-archery-1": [0.2567783094098884, 0.024720893141945772, 0.23125996810207336, 0.20414673046251994], "camp-fort-1": [0.7671451355661882, 0.006379585326953748, 0.21610845295055822, 0.22248803827751196], "unit-infantry": [0.04864433811802233, 0.7496012759170654, 0.145933014354067, 0.24401913875598086], "unit-archer": [0.2942583732057416, 0.7631578947368421, 0.15869218500797447, 0.23046251993620415]};
function sprite(id,x,y,w,h){const image=battlefieldArt.camps,uv=spriteCrops[id];if(!image||!image.complete||!image.naturalWidth||!uv)return false;const sw=uv[2]*image.naturalWidth,sh=uv[3]*image.naturalHeight,scale=Math.min(w/sw,h/sh),dw=sw*scale,dh=sh*scale;ctx.drawImage(image,uv[0]*image.naturalWidth,uv[1]*image.naturalHeight,sw,sh,x-dw/2,y-dh,dw,dh);return true;}
function ground(){const image=battlefieldArt.ground;ctx.fillStyle='#c2ac80';ctx.fillRect(0,0,620,410);if(image&&image.complete&&image.naturalWidth){const scale=Math.max(620/image.naturalWidth,410/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;ctx.drawImage(image,(620-w)/2,(410-h)/2,w,h);ctx.fillStyle='#e6d4ab1c';ctx.fillRect(0,0,620,410);}}
function road(a,b){ctx.save();ctx.translate(a.x,a.y);const length=Math.hypot(b.x-a.x,b.y-a.y);ctx.rotate(Math.atan2(b.y-a.y,b.x-a.x));ctx.fillStyle='#87755266';ctx.beginPath();for(let i=0;i<=length;i+=12){const y=-12+Math.sin(i*.31)*2;if(i===0)ctx.moveTo(i,y);else ctx.lineTo(i,y);}for(let i=length;i>=0;i-=12)ctx.lineTo(i,12+Math.sin(i*.27)*2);ctx.closePath();ctx.fill();line(0,0,length,0,'#b99f72',17);for(const y of [-4,4])line(0,y,length,y,'#89745288',1.3);ctx.restore();}

const maxTime=()=>selected.duration||6000;
function select(id){selected=cards.find(c=>c.id===id)||cards[0];time=0;playing=false;last=null;
 for(const button of $('cards').children)button.setAttribute('aria-pressed',String(button.dataset.id===selected.id));
 for(const key of ['kind','title','status','effect','input','motion','limits','scene'])$(key).textContent=key==='title'?selected.name:selected[key];
 $('detail-title').textContent=selected.name;
 for(const id of ['detail-icon','icon32','icon44','icon72'])$(id).src=`icons/${selected.id}.svg`;const detail=$('detail-icon').parentElement;detail.style.setProperty('--ix',cards.indexOf(selected)%5);detail.style.setProperty('--iy',Math.floor(cards.indexOf(selected)/5));
 $('time').max=String(maxTime());$('icon-state').querySelector('[value=empty]').disabled=selected.kind==='被动';$('icon-state').value='normal';document.querySelector('.size-check').dataset.state='normal';draw();}
function state(){const id=selected.id,t=time;let center=20,left=20,right=20,owner='P',phase='施策已提交',status='',readout='',armies=[],emphasis=0;
 const run=(side,count,start,duration,color='P',troop='步')=>{if(t>=start&&t<start+duration)armies.push({side,count,p:(t-start)/duration,color,troop});};
 if(id==='mobilize'){center=20+Math.floor(1.8*t/1000+1e-8);const natural=Math.floor(.9*t/1000+1e-8);status=t<6000?`鼓令 ${((6000-t)/1000).toFixed(1)}s`:'鼓令到期';readout=`驻军 ${center}（从20起） · 普通生产对照 ${20+natural} · 额外额度剩 ${(8-.9*t/1000).toFixed(2)}；预算不等于即时补兵。`;emphasis=t<600?1:0;}
 if(id==='march'){left=10;center=t<3000?10:20;run('left',10,0,3000);status='兼行 ×1.4';phase=t<3000?'源留10，军团按实际ETA前进':'友援到达，按目标营整编';readout=`派10／留10 · 兼行ETA ${Math.max(0,3000-t)}ms · 普通旅时4200ms；到达后目标10→20。`;}
 if(id==='supply'){center=50;status='乡勇 +2';readout='提交即48→50。实际补2、扣1张；集合剪影只解释已补入的人数，不创建在途队。';emphasis=t<600?1:0;}
 if(id==='feint'){owner='E';center=20;status=t<4000?`停产／停射 ${((4000-t)/1000).toFixed(1)}s`:'停产／停射已到期';readout='目标驻军始终20（隔离示意）。火袭不造成伤害；4秒到期后允许正常生产／按原节拍射击。';emphasis=t<600?1:0;}
 if(id==='beacon'){center=t<5000?16:36;left=right=t<1000?20:10;run('left',10,1000,4000);run('right',10,1000,4000);status=t<6000?`求援 ${((6000-t)/1000).toFixed(1)}s`:'求援到期';phase=t<1000?'仅标记；此时没有自动派兵':t<5000?'示例玩家派出两队，各取新速度快照':'两队实际到达，16→36';readout=t<1000?'标记不会自动调兵。第1秒模拟玩家分别手动派10。':`两源各留10 · 两队目标同属己方 · 新队×1.25，ETA ${Math.max(0,5000-t)}ms；旧在途不会加速。`;emphasis=t<220?1:0;}
 if(id==='converge'){left=right=10;owner=t<4000?'E':'P';center=t<4000?16:4;run('left',10,0,4000);run('right',10,0,4000);status=t<4000?'双队同步抵达':'占领，剩4';phase=t<4000?'两条直连道路，共同ETA':'20对16，真实剩余4';readout=`各派10／留10 · 常规2500／4000ms → 对齐4000ms · ${t<4000?'快队放慢，不加攻击':'两队正常交战，不产生合击加成'}。`;emphasis=t<220?1:0;}
 if(id==='barricade'){center=t<2500?6:2;left=8;run('left',8,0,2500,'E');status=t<2500?`拒马4 · ${((8000-t)/1000).toFixed(1)}s`:'拒马已耗尽';phase=t<2500?'工事已生效，等待真实抵达':'工事抵消4，守军6→2';readout=t<2500?'拒马4点，不计作驻军；敌8人正在接近。':'敌8−工事4＝4；4与守6按1:1交战，守2。工事不是可派出的士兵。';emphasis=t<220?1:0;}
 if(id==='farming'){center=20;phase='领取后2层';status='屯田 +6.67%';readout='本示例领取1→2层：产速增益4%→6.67%，一级步营0.936→0.960兵/秒；t=0层数已更新。';emphasis=t<240?1:0;}
 if(id==='logistics'){center=20;phase='领取后2层';status='神速 +5%';readout='本示例领取1→2层：速度增益3%→5%，新步兵出征速度24.72→25.20；旧在途不重算。';emphasis=t<220?1:0;}
 if(id==='appeasement'){left=10;center=t<3000?6:6;owner=t<3000?'N':'P';run('left',10,0,3000);status=t<3000?'等待真实占领':'招抚 +2 · 已转弓兵';phase=t<3000?'招抚不能帮助赢下本次交战':'先占领剩4，再补2成6';readout=t<3000?'2层招抚：floor(12/6)=2。先由真实10兵攻下6守军，不预支奖励兵。':'10对6先剩4，转换为弓兵后招抚+2＝6；seenCampIds已记录，丢失后夺回不重发。';emphasis=t>=3180&&t<3450?1:0;}
 return {center,left,right,owner,phase,status,readout,armies,emphasis};}
const pos={left:{x:112,y:295},right:{x:508,y:295},center:{x:310,y:139}};
function effectiveSize(size){const scale=620/Math.max(240,$('battle').clientWidth);return Math.max(size,(size>=18?14:11)*scale);}
function text(value,x,y,size=15,color='#4d4033',align='center'){ctx.fillStyle=color;ctx.font=`${effectiveSize(size)}px "PingFang SC",sans-serif`;ctx.textAlign=align;ctx.fillText(value,x,y);}
function line(x,y,z,w,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(z,w);ctx.stroke();}
function label(value,x,y,color='#456e65'){ctx.font=`${effectiveSize(14)}px "PingFang SC",sans-serif`;const width=ctx.measureText(value).width+20;ctx.fillStyle='#f8f1e1';ctx.fillRect(x-width/2,y-17,width,25);ctx.strokeStyle='#c8b897';ctx.lineWidth=1;ctx.strokeRect(x-width/2,y-17,width,25);text(value,x,y,14,color);}
function camp(x,y,name,count,owner,selectedTarget=false,showName=true){const c=owner==='E'?'#9b5c47':owner==='N'?'#878577':'#52786d';ctx.save();ctx.translate(x,y);const spriteId=name==='敌塔营'?'camp-fort-1':name==='弓营'?'camp-archery-1':'camp-barracks-1';if(!sprite(spriteId,0,29,108,94)){ctx.fillStyle='#8b7653';ctx.fillRect(-32,-16,64,45);ctx.fillStyle='#4c514b';ctx.beginPath();ctx.moveTo(-37,-16);ctx.lineTo(-22,-30);ctx.lineTo(22,-30);ctx.lineTo(37,-16);ctx.closePath();ctx.fill();ctx.fillStyle='#493e2e';ctx.fillRect(-9,1,18,28);}const countFont=effectiveSize(18),badgeHeight=Math.max(25,countFont+6),badgeWidth=Math.max(50,countFont*String(count).length*.65+12);ctx.fillStyle='#58442f';ctx.fillRect(-badgeWidth/2-2,33,badgeWidth+4,badgeHeight+4);ctx.fillStyle=c;ctx.fillRect(-badgeWidth/2,35,badgeWidth,badgeHeight);ctx.strokeStyle='#b69964';ctx.lineWidth=1;ctx.strokeRect(-badgeWidth/2,35,badgeWidth,badgeHeight);for(const peg of [-1,1]){ctx.fillStyle='#c7af7b';ctx.beginPath();ctx.arc(peg*(badgeWidth/2-4),39,1.4,0,Math.PI*2);ctx.fill();}text(String(count),0,38+countFont*.8,18,'#fff4dc');if(showName)label(name,0,35+badgeHeight+effectiveSize(13)+4,'#57452f');
 if(owner==='P'){ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(38,-26);ctx.lineTo(45,-20);ctx.lineTo(38,-14);ctx.lineTo(31,-20);ctx.closePath();ctx.fill();}else if(owner==='E'){ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(32,-26);ctx.lineTo(45,-20);ctx.lineTo(32,-14);ctx.closePath();ctx.fill();}else{ctx.strokeStyle=c;ctx.lineWidth=2;ctx.strokeRect(32,-26,10,10);}
 if(selectedTarget){ctx.strokeStyle='#a18452';ctx.lineWidth=1;ctx.setLineDash([4,5]);ctx.strokeRect(-45,-40,90,106);ctx.setLineDash([]);}ctx.restore();}
function icon(id,x,y,size,opacity=1,rotation=0){const board=battlefieldArt.orders,index=cards.findIndex(c=>c.id===id),img=icons.get(id);ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.globalAlpha=opacity;if(board&&board.complete&&board.naturalWidth&&index>=0){const sw=board.naturalWidth/5,sh=board.naturalHeight/2;ctx.fillStyle='#58422e';ctx.fillRect(-size/2-1,-size/2-1,size+2,size+2);ctx.drawImage(board,(index%5)*sw,Math.floor(index/5)*sh,sw,sh,-size/2,-size/2,size,size);}else if(img&&img.complete&&img.naturalWidth)ctx.drawImage(img,-size/2,-size/2,size,size);ctx.restore();}
function draw(){if(!ctx)return;const s=state(),id=selected.id;ctx.clearRect(0,0,620,410);ground();
 text('相邻道路示意 · 非地图比例',22,28,12,'#56472e','left');text(`${time} ms`,598,28,12,'#56472e','right');
 for(const p of [pos.left,pos.right])road(p,pos.center);
 if(id==='converge'&&time<4000){for(const p of [pos.left,pos.right])line(p.x,p.y-5,pos.center.x,pos.center.y+25,'#a78550',2);}
 const centerName=id==='appeasement'?'弓营':id==='feint'?'敌塔营':'目标营地';
 camp(pos.left.x,pos.left.y,'左邻营地',s.left,id==='barricade'?'E':'P');camp(pos.right.x,pos.right.y,'右邻营地',s.right,'P');camp(pos.center.x,pos.center.y,centerName,s.center,s.owner,s.emphasis>0,false);
 for(const a of s.armies){const from=pos[a.side],to=pos.center,x=from.x+(to.x-from.x)*a.p,y=from.y+(to.y-from.y)*a.p;ctx.save();ctx.translate(x,y);if(!sprite('unit-infantry',0,6,27,39)){ctx.fillStyle='#677266';ctx.fillRect(-7,-12,14,18);}ctx.fillStyle=a.color==='E'?'#96543f':'#456e65';ctx.beginPath();ctx.moveTo(9,-22);ctx.lineTo(19,-18);ctx.lineTo(9,-14);ctx.closePath();ctx.fill();line(9,-23,9,0,'#665034',1.4);if(id==='march'&&!reduced&&time<450){line(-13,2,-28,12,'#a18452',2);line(-13,-4,-25,2,'#a18452',2);}label(`${a.troop} ${a.count}`,0,31,a.color==='E'?'#96543f':'#456e65');ctx.restore();}
 if(id==='barricade'&&time<2500){const age=time/220;icon('barricade',310,184,reduced?43:40+3*Math.min(1,age));}
 if(id==='feint'&&time<4000){icon('feint',365,102,42);if(!reduced&&time<600){for(let j=0;j<3;j++){ctx.fillStyle='#b76d3f';ctx.beginPath();ctx.arc(365+(j-1)*8,96-(time*(j+1)/70)%22,2,0,Math.PI*2);ctx.fill();}}}
 if(id==='beacon'&&time<6000)icon('beacon',366,104,42);
 if(['mobilize','supply','farming','logistics'].includes(id)){const limit=id==='mobilize'||id==='supply'?600:id==='farming'?240:220;const age=Math.min(1,time/limit);const wobble=reduced||age===1?0:Math.sin(age*Math.PI*2)*.045;icon(id,362,102,44,1,wobble);}
 if(id==='appeasement'&&time>=3000){const age=time-3000;icon('appeasement',364,100,44);if(age<800)label('夺城4 · 招抚+2',310,65);}
 if(s.status)label(s.status,310,235,s.owner==='E'?'#96543f':'#456e65');
 if((id==='farming'||id==='logistics')){ctx.fillStyle='#f8f1e1';ctx.fillRect(166,55,288,34);text(id==='farming'?'1→2层 · 产速 +6.67%':'1→2层 · 出征速度 +5%',310,78,17,'#456e65');}
 $('phase').textContent=s.phase;$('readout').textContent=s.readout;$('timeValue').value=`${time} ms`;$('time').value=String(time);$('play').textContent=playing?'暂停':'播放';
 $('battle').setAttribute('aria-label',`${selected.name}，${time}毫秒。${s.phase}。${s.status}。目标驻军${s.center}。`);
}
$('play').onclick=()=>{if(time>=maxTime())time=0;playing=!playing;last=null;draw();};
$('replay').onclick=()=>{time=0;playing=true;last=null;draw();};
$('time').oninput=e=>{playing=false;time=Number(e.target.value);draw();};
$('reduced').onchange=e=>{reduced=e.target.checked;draw();};
$('gray').onchange=e=>document.body.classList.toggle('gray',e.target.checked);
$('icon-state').onchange=e=>{document.querySelector('.size-check').dataset.state=e.target.value;};
function tick(now){if(playing){if(last!==null)time=Math.min(maxTime(),time+Math.round(Math.min(100,now-last)));last=now;if(time===maxTime())playing=false;draw();}else last=null;requestAnimationFrame(tick);}requestAnimationFrame(tick);
window.addEventListener('resize',draw);
document.addEventListener('visibilitychange',()=>{if(document.hidden){playing=false;last=null;draw();}});
window.strategyDesignPreview={select,seek(ms){playing=false;time=Math.max(0,Math.min(maxTime(),Math.round(ms)));draw();},snapshot(){return {id:selected.id,time,playing,reduced,...state()};}};
select('beacon');
})();
