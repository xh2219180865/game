import {CARDS,CARD_IDS,MAPS,rankName,artReady,artCount,mountArt,setMap,setMotion,freezeMap,playScene,playGuide,resetGuide} from './render.js';

const pages=[
 ['home','S01','首页','出征前庭','已认可的城门、旌旗、军士与暖火，作为整套设计的参照。','城门保持完整，主动作压在下方；底部三个实物入口。','首页现有插画，近旗／中景军士／远景城楼。','低幅火光与烟云，减少动态静止。'],
 ['loading','S00','启动','城门启封','从同一个城门进入游戏，启动只说明真实工作。','游戏名与门缝暖光，底部单行步骤；失败时提供对应重试。','复用首页局部，无独立开场影片。','180ms 暖光显现，不造百分比，不强制等待。'],
 ['lessons','S05','练兵','城外演武场','三处训练关目摆进真实的演武场，能看出训练内容。','上部题名，下方三处错落关目；小屏滚动，返回固定。','全新演武场插画，配现有步营／塔营／骑营。','按下木签 1px；场景缓慢暖光；无星级或虚构奖品。'],
 ['prepare','S08','战前准备','俯视军图案','先看清下一战的地形与道路，再看可用军令。','地图为主体，下方主动库存与被动摘要，开始固定在底部。','新军图案底图；全部六图节点、道路与正式配置同源。','军图轻收束 160ms；开始不等动画；不加选地图玩法。'],
 ['battle','S02','战场','俯瞰山河','路、兵、城各有层次；行动结果必须一眼看清。','顶部小牌，中央最大地图，底部四道军令；兵数与等级置顶。','三种地表、十二营地、四兵种及真实路网复用正式素材。','右侧可重播派兵／交战／四主动，调用隔离规则实例；非玩家对局。'],
 ['pause','S03','暂停','战场军令','让玩家确认战场已停，最先找到继续。','原尺寸战场上悬一块小木令；军情单独展开。','冻结当前地图，不切回城门或军帐。','弹层 140ms；模拟和战场装饰冻结，明确继续才走时。'],
 ['result','S04','结果','战后报捷','赢得什么、为什么输，先于装饰出现。','胜负旗在上，短战报居中，主动作固定；四方战报展开。','城门暖光配军旗；败局降低饱和度，不做血红惩罚页。','240ms 盖印不阻塞按钮，真实数值直接显示；不滚出假奖励。'],
 ['choice','S09','选策','案上择令','三道实物军令，选一个再领取，候选始终可比较。','并排候选＋一处领取前后说明＋固定确认；少于三种按实数居中。','深木案、朱绳令签、七策同源器物。','选中上移 4px、盖印；保存成功才播放领取反馈。'],
 ['library','S10','策略图鉴','军令库','每道策略有自己的器物，军令架不是普通网格菜单。','主动两排共四项，被动一排三项，详情从原位置展开。','全新军令架；战鼓、军旗、乡勇、粮袋、稻穗、马蹄、营栅。','取令 160ms；灰态有锁和文字，详情返回原滚动位置。'],
 ['ranks','S11','军衔','城楼授印','把军衔做成值得拥有的旗饰，保留精确成长信息。','一面大旗＋军功刻尺＋历史战功簿，路线按需展开。','首页城楼局部，现有军旗纹章，旧绢战功簿。','仅真实晋升展旗 320ms，进入页面不重放奖励。'],
 ['settings','S06','设置','置身军帐','设置项直接融进案上绢面，功能名称保持清楚。','三行印位开关；帮助与记录分组；返回和完成固定。','既有军帐底图，朱印／墨印开关，小铜片试听。','印位变化 100ms，减少动态直接切换；不自动播放声音。'],
 ['about','S14','玩法与关于','战地手册','用翻开的手册讲操作，和设置的正面军帐区别开。','派兵／升级／施策三枚章节签，一次一张大图；正文与详细规则分层。','俯视军图案＋装订线；实际城池、道路、军士与卡片。','手动演示，3 秒后停住；减少动态切关键帧；不自动循环。'],
 ['leaderboard','S13','好友周榜','城门告示墙','先展示本机表现，平台能力未开启就明确说明。','榜笺钉在独立木告示板，自己的胜场和未启用说明分层。','首页城墙局部、木榜板、铜钉、旧绢榜笺。','120ms 短淡入；不画假头像假排行，不出现假授权。'],
 ['recovery','S07','记录处理','军报档案案','出错时知道记录还在，也知道每个动作的后果。','原因 → 保留范围 → 重读 → 有副本才恢复 → 临时练兵。','俯视案上的档案题签，不用焚烧和碎裂装饰吓人。','静止；无可读资料不提供返回首页捷径。'],
 ['week','S12','周更替','首页短笺','消息可看可收，保留首页主动作。','首页小笺说明到期、保留与已归档战绩，完整内容可展开。','复用首页和一张短笺，不另造整屏页面。','180ms 展笺一次；战内通知不得挡派兵。'],
 ['reset','S15','清除记录','确认文书','对象和后果明确，取消与确认清除分开。','保留设置场景，中央文书列本机影响，取消为默认操作。','旧绢文书、朱砂题名，不复刻设置的开关列表。','160ms 出现；无焚档特效，原子成功后才报告清除。']
];
const phone=document.querySelector('#phone'),screen=document.querySelector('#screen'),overlay=document.querySelector('#overlay'),notes=document.querySelector('#notes');
const state={page:'about',map:'A01',chapter:'dispatch',chosen:null,sound:true,vibration:false,reduced:false,loss:false,locked:false,backup:true};
let toastTimer;
function art(attrs,klass='art'){return '<div class="'+klass+'"><canvas class="design-canvas" '+attrs+' aria-label="同源游戏素材"></canvas></div>';}
function button(label,action,klass='wood'){return '<button type="button" class="'+klass+'" data-action="'+action+'">'+label+'</button>';}
function head(title,back='home'){return '<header class="page-head"><h2>'+title+'</h2>'+ (back?button('‹ 返回','page:'+back,'back'):'')+'</header>';}
function foot(label,action,extra=''){return '<footer class="page-foot">'+button(label,action,'primary wide')+extra+'</footer>';}
function scroll(body,klass=''){return '<div class="page-scroll '+klass+'">'+body+'</div>';}
function miniCard(id,kind='mini-order'){return '<button class="'+kind+'" data-action="detail:'+id+'">'+CARDS[id].short+art('data-card="'+id+'"','card-art')+'<small>'+({mobilize:'×3',march:'×2',supply:'×1',feint:'×4'}[id]??'已解锁')+'</small></button>';}
function home(){return '<div class="home-top"><button class="home-rank" data-action="page:ranks">军衔<br>中郎将</button>'+button('设置','page:settings','wood')+'</div><h2 class="home-title">谋定山河<small>一城一策 · 尽在指间</small></h2><div class="spacer"></div><div class="home-actions">'+button('出 征','page:battle','primary')+'<div>'+button('战前情报 ›','page:prepare','ghost')+'</div><div class="home-nav">'+button('练兵','page:lessons')+button('策略','page:library')+button('周榜','page:leaderboard')+'</div></div><div class="ambient"></div>';}
function lessonPage(){return head('练兵场')+'<p class="lesson-intro sub">三关习兵 · 首胜解锁选策资格</p>'+scroll('<div class="lesson-list">'+['L01','L02','L03'].map((id,i)=>'<article class="lesson"><span class="lesson-ordinal">'+['壹','贰','叁'][i]+'</span>'+art('data-camp="'+['barracks','fort','relay'][i]+'" data-tier="'+[1,2,2][i]+'"')+'<div><h3>'+MAPS[id].name+'</h3><p class="sub">'+(i===0?'已通关':i===1?'塔营射击 · 手动升级':'先通关「塔营与升级」')+'</p>'+button(i===0?'重温此课':i===1?'进入练兵':'未解锁',i<2?'lesson:'+id:'toast:先完成第二课，即可解锁。','wood')+'</div></article>').join('')+'</div><div class="lesson-foot body-note">首胜解锁候选资格，不直接赠卡。<br>有未完成对局时，练兵不计奖励，原对局保留。</div>')+'<div class="ambient"></div>';}
function prepare(){return head('战前准备')+scroll('<div class="map-heading"><h3>'+MAPS[state.map].name+'</h3><p class="body-note">你与 3 个电脑 · 最多四分钟</p></div><div class="map-preview">'+art('data-map="'+state.map+'"','design-canvas')+'</div><p class="map-caption">占城最多者胜，同城数比兵力</p><div class="mini-orders">'+['mobilize','march','supply','feint'].map(id=>miniCard(id)).join('')+'</div><div class="passives"><span>屯田 3 层</span><span>神速 1 层</span><span>扩营 10 层</span></div>'+button('查看对局与军功规则 ›','prepare-rules','slim-link'),'map-scroll')+foot('开始对战','page:battle');}
function battle(paused=false){return '<div class="battle-top">'+button('Ⅱ','page:pause','wood')+'<div class="timer number">03:12</div><button class="wood" data-action="toast:样例战况：1 城 · 第四名">1 城 · 第四</button></div><div class="battle-map">'+art('data-map="'+state.map+'" data-counts="true" data-live="true"','design-canvas')+'</div><div class="battle-bottom"><div class="battle-hint">按住己营，沿路拖向邻城</div><div class="mini-orders">'+['mobilize','march','supply','feint'].map(id=>miniCard(id,'battle-card')).join('')+'</div></div>'+(paused?'<div class="pause-layer"><div class="pause-board"><span class="eyebrow-in">军令暂歇</span><h3>已暂停</h3><p class="sub">已用时 00:48 · 样例存档已保存</p>'+button('继续对战','page:battle','primary wide')+'<div class="pause-minor">'+button('回首页','page:home','ghost')+button('设置','page:settings','ghost')+button('放弃本局','forfeit','ghost')+'</div>'+button('查看军情 ›','army','ghost')+'</div></div>':'');}
function result(){return head('战报')+scroll('<div class="result-banner"><p class="eyebrow-in">四旗争城 · 四分钟截止</p><h3>'+(state.loss?'整军再战':'独立冠军')+'</h3></div><div class="paper result-sheet"><span class="seal">'+(state.loss?'第四名':'得胜')+'</span><div class="merit">'+(state.loss?'不扣军功':'+30 军功')+'</div><p>'+(state.loss?'截止时落后首名 3 城、86 兵。':'城数领先，守下最后的优势。')+'</p><div class="stats"><div><strong>'+(state.loss?'1':'4')+'</strong><span>城池</span></div><div><strong>'+(state.loss?'40':'163')+'</strong><span>有效兵力</span></div><div><strong>04:00</strong><span>对局用时</span></div></div><div class="divider"></div><p class="display">'+(state.loss?'军功保持 450':'450 → 480 · 晋升中郎将Ⅰ')+'</p><p class="sub">'+(state.loss?'本局无策略奖励，不计周胜。':'本周第 8 胜 · 可择一领取策略')+'</p>'+button('查看四方战报 ›','report','slim-link')+'</div>')+foot(state.loss?'再来一局':'领取奖励',state.loss?'page:battle':'page:choice',button('回首页','page:home','ghost'));}
function choice(){const ids=['mobilize','supply','farming'];return head('择一领令')+scroll('<div class="choice-heading"><h3>功成受赏，择策再征</h3><p class="body-note">本次只领取一张</p></div><div class="choice-cards">'+ids.map(id=>'<button class="choice-card '+(state.chosen===id?'selected':'')+'" data-action="choose:'+id+'">'+(state.chosen===id?'<span class="seal">已选</span>':'')+art('data-card="'+id+'"','card-art')+CARDS[id].name+'<small>'+ (CARDS[id].kind==='active'?'主动锦囊':'被动兵法')+'</small></button>').join('')+'</div><div class="choice-description"><h3>'+(state.chosen?CARDS[state.chosen].name:'先选一道军令')+'</h3><p>'+(state.chosen?CARDS[state.chosen].description:'点选上方候选查看领取效果，确认前可随时改选。')+'</p><p class="display">'+(state.chosen==='farming'?'屯田 3 → 4 层 · 下一局自动生效':state.chosen==='supply'?'乡勇 1 → 2 张':state.chosen==='mobilize'?'征兵 3 → 4 张':'')+'</p><p class="body-note">本周资源 · 北京时间周一 00:00 到期</p></div>','choice-body')+foot(state.chosen?'确认领取':'先选择一张',state.chosen?'claim':'toast:请先选择一道军令。','<div class="choice-options">'+button('稍后再选','page:home','ghost')+button('放弃机会','abandon','ghost')+'</div>');}
function library(){return head('策略图鉴')+scroll('<div class="shelf"><h3>主动锦囊 <span class="sub">对局中施放</span></h3><div class="shelf-grid">'+['mobilize','march','supply','feint'].map(id=>slip(id)).join('')+'</div></div><div class="shelf shelf-passive"><h3>被动兵法 <span class="sub">本周自动生效</span></h3><div class="shelf-grid">'+['farming','logistics','fortification'].map(id=>slip(id)).join('')+'</div></div><p class="library-footer sub">点选军令，查看效果与解锁条件</p>','library-body');}
function slip(id){const locked=state.locked&&['march','logistics'].includes(id);return '<button class="order-slip '+(locked?'locked':'')+'" data-action="detail:'+id+'">'+art('data-card="'+id+'"','card-art')+CARDS[id].name+'<small>'+(locked?'锁 · 未解锁':{mobilize:'持续征募',march:'本次提速',supply:'即时补兵',feint:'停产停射',farming:'自然产兵',logistics:'行军速度',fortification:'驻军容量'}[id])+'</small></button>';}
function ranks(){return head('军衔册')+scroll('<div class="rank-flag">'+art('data-rank="true"')+'<h3>'+rankName(470)+'</h3><p>军 功 旌 表</p></div><div class="rank-readout"><span class="sub">当前军功</span> <strong>470</strong><div class="ruler"></div><p class="sub">20 / 30 · 距下一级还需 10 军功</p></div><div class="paper rank-record"><h3>战功簿</h3><p>历史最高　'+rankName(480)+' · 480</p><div class="divider"></div><p>上周冠军　7 次<br>累计归档　3 周<br>最佳单周　8 胜</p>'+button('查看军衔路线 ›','rank-rules','slim-link')+'<p class="sub">军衔不提供战斗属性。</p></div>');}
function settings(){return head('设置',state.origin==='pause'?'pause':'home')+'<div class="settings-body">'+[['sound','声音','操作与战斗短音效'],['vibration','震动','夺城与末城受袭提示'],['reduced','减少动态','保留必要行军与状态']].map(([key,title,hint])=>'<div class="setting-line"><div><h3>'+title+'</h3><p>'+hint+'</p></div><div class="row">'+(key==='sound'?button('试听','toast:设计稿不播放声音；正式版保留原试听逻辑。','listen'):'')+'<button class="switch" role="switch" aria-label="'+title+'" aria-checked="'+state[key]+'" data-action="toggle:'+key+'"><span class="off">关</span><span class="on">开</span></button></div></div>').join('')+'<h3 class="settings-help">帮助与记录</h3>'+button('玩法与关于','page:about','slim-link')+button('清除本地游戏记录','clear','slim-link danger')+'</div><div class="settings-done">'+button('完成','page:'+(state.origin==='pause'?'pause':'home'),'primary wide')+'</div>';}
const rules=[
 ['夺城与守城','沿道路派出当前一半兵力，最后一城失守即淘汰。不能越城派兵。进行中的 v1.5 旧局按原直达规则继续。'],
 ['四类营地','步、弓、骑、塔生产各自兵种。友援到达或成功占领后按目标营地整编，途中不换兵。一级自然产兵：步 0.9、弓／骑 0.6、塔 0.3 兵／秒。'],
 ['弓兵与塔营','弓兵出发至少 0.5 秒且距目标 70 内，只检查一次齐射，当时人数 30% 向下取整；友方、空营、零伤害跳过。塔射程 120，每次 1 兵。清零不等于占领。'],
 ['到达与整编','到达按 1∶1 交战，相等只清零。多方同刻到达按真实规则合并结算，不能把演示动画当成逐队抢先判定。'],
 ['驻兵升级','一级达到 30 兵，花 10 升二级；二级达到 70 兵，花 25 升三级。基础容量 50／90／140。出兵不降级，易主保留等级。'],
 ['四方与军功','正式局最多四分钟，先比城数，同城数再比驻军及有效在途兵力。有效独立冠军且曾派兵获得 +30 军功、一次选卡与周胜；其余新局不扣分。旧局按开局约定。'],
 ['策略与周界','四主动用一张扣一张，三被动本周累计，每局自动生效。周一清当周库存、被动和待选，军功、最高与永久解锁保留，已知周胜归档。'],
 ['保存与隐私','后台不补算离线战斗，恢复需明确继续。现实超过 24 小时不能续战。核心记录仅在本机，好友榜不等于云存档。'],
 ['版本与原创','谋定山河 0.1.0 · 新局 v1.6，兼容合法 v1.5 旧局。本页为独立设计预览；正式画面载入计数按运行时报告。']
];
function about(){const ch=state.chapter;return head('玩法与关于','settings')+'<div class="manual-body"><div class="manual-title">战地手册 <span class="seal">图解</span></div><div class="chapter-tabs">'+[['dispatch','派兵'],['upgrade','升级'],['supply','施策']].map(([id,label])=>button(label,'chapter:'+id,id===ch?'selected':'')).join('')+'</div><div class="manual-picture">'+art('data-guide="'+ch+'"','design-canvas')+'</div><ol class="manual-steps">'+(ch==='dispatch'?'<li>按住己方营地</li><li>沿道路拖向相邻营地</li><li>松手派出一半，留下守军</li>':ch==='upgrade'?'<li>兵够时，点建筑檐角箭头</li><li>30 兵花 10，升二级</li><li>70 兵花 25，升三级</li>':'<li>点底部军令，再点合法目标</li><li>乡勇立即补兵，受容量限制</li><li>兼行随下一次合法派兵生效</li>')+'</ol><p class="manual-note">图解样例 · 不开局，不消耗策略</p>'+button(ch==='upgrade'?'查看全部营地等级':'▶ 演示一次',ch==='upgrade'?'tiers':'guide','wood wide')+'<div class="divider"></div><h3 class="display">详细规则</h3>'+rules.map(([name,copy])=>'<details><summary>'+name+'</summary><p>'+copy+'</p></details>').join('')+'</div>'+foot('去练兵试一试','page:lessons');}
function leaderboard(){return head('好友周榜')+scroll('<div class="notice-board"><div class="paper"><p class="display">本机本周冠军</p><strong class="local-wins">8 <span class="display" style="font-size:18px">胜</span></strong><div class="divider"></div><span class="seal">尚未启用</span><h3>微信好友榜未启用</h3><p>你仍可离线征战。<br>军功与策略照常保存在本机。</p><p class="sub">比较对电脑的独立冠军次数，<br>同分并列，不是真人对战。</p></div></div><div class="lesson-foot body-note">榜单不是云存档。当前不上传成绩，也不请求好友资料。</div>')+foot('返回首页','page:home');}
function recovery(){return head('记录需要处理',null)+scroll('<div class="file-label">军报档案 · 本机记录</div><h3>原记录已保留</h3><p>最新记录校验未通过。可以先重新读取，不会清除当前记录。</p><div class="divider"></div>'+ (state.backup?'<p class="display">发现完整副本</p><p>样例时间：11 月 9 日 10:42<br>恢复可能回退此后未确认的进度。</p>':'<p>暂未找到可用副本，请保留原记录。</p>')+button('重新读取','toast:这里只演示记录处理界面，不读取本机玩家记录。','primary wide')+(state.backup?button('恢复完整副本','restore','wood wide'):'')+button('临时无奖励练兵','page:lessons','wood wide')+'<p class="sub">练兵不覆盖原记录，不计军功或奖励。</p>'+button('清除本地记录…','clear','ghost'),'recovery-body');}
const renderers={home,loading:()=>'<h2 class="home-title">谋定山河</h2><div class="loading-copy"><p class="display" style="font-size:23px">城门启封</p><div class="loading-line"><i></i></div><p class="body-note">载入画面 '+artCount+' / '+artCount+'</p><p class="sub">设计状态样例 · 完成后自动进入</p></div>',lessons:lessonPage,prepare,battle:()=>battle(),pause:()=>battle(true),result,choice,library,ranks,settings,about,leaderboard,recovery,week:()=>home()+'<div class="paper week-slip"><h3>新周启程</h3><p>旧周锦囊与兵法已到期，军功与解锁保留。</p>'+button('查看周更说明 ›','week-detail','slim-link')+'</div>',reset:settings};
function render(){
  overlay.innerHTML='';resetGuide();freezeMap(state.page!=='battle');screen.className='screen-'+(['week'].includes(state.page)?'home':state.page==='reset'?'settings':state.page);
  if(state.page==='result'&&state.loss)screen.classList.add('result-loss');
  screen.innerHTML=renderers[state.page]();
  document.querySelectorAll('#pages button').forEach(b=>b.setAttribute('aria-current',b.dataset.page===state.page?'page':'false'));
  const d=pages.find(p=>p[0]===state.page);document.querySelector('#caption').textContent=d[3]+' · 可点击页面内入口；所有数值均为设计样例。';
  notes.innerHTML='<span class="code">'+d[1]+' / '+state.page+'</span><h2>'+d[3]+'</h2><p>'+d[4]+'</p><h3>构图与层次</h3><p>'+d[5]+'</p><h3>字体与控件</h3><p>标题 29px 文楷，按钮 18–20px 文楷，正文 14–16px 系统字；关键数字等宽。朱漆仅用于主动作，返回为细木签，触区 ≥44px。</p><h3>配图与地图</h3><p>'+d[6]+'</p><h3>动效与状态</h3><p>'+d[7]+'</p><div id="variants"></div><h3>资料</h3><p><a href="/docs/04-界面与交互设计.md" target="_blank">逐页完整规格 · 04 B0</a><br><a href="/docs/05-美术与动效设计.md" target="_blank">字阶、素材、地图与动效 · 05 G0</a></p>';
  const v=document.querySelector('#variants');
  if(['battle','prepare','pause'].includes(state.page))v.innerHTML='<h3>地图样式对照</h3>'+['A01','A02','A03','L01','L02','L03'].map(id=>button(id,'map:'+id,'')).join('')+'<p>仅设计工具切图；正式战前页不增加选地图。</p>';
  if(state.page==='battle')v.innerHTML+='<h3>重播规则样例</h3>'+[['dispatch','派兵与交战'],['march','兼行'],['supply','乡勇'],['mobilize','征兵'],['feint','火袭']].map(([id,label])=>button(label,'scene:'+id,'')).join('')+'<p>点一次播放一次，7 秒后停。部队位置与结算来自隔离规则实例。</p>';
  if(state.page==='result')v.innerHTML='<h3>结果状态</h3>'+button('胜局','result:win','')+button('败局','result:loss','');
  if(state.page==='library')v.innerHTML='<h3>解锁状态</h3>'+button(state.locked?'查看全部解锁':'查看未解锁样例','locked','');
  if(state.page==='recovery')v.innerHTML='<h3>副本状态</h3>'+button(state.backup?'查看无副本样例':'查看有副本样例','backup','');
  if(state.page==='settings')v.innerHTML='<h3>来源状态</h3>'+button('从首页进入','origin:home','')+button('从暂停进入','origin:pause','');
  if(['battle','about','prepare'].includes(state.page))v.innerHTML+='<h3>造型对照</h3>'+button('十二款分级营地','tiers','')+button('四兵种动作','troops','');
  mountArt();if(state.page==='reset')clearDialog();
}
function navigate(page){if(!renderers[page])return;if(page==='settings'&&state.page==='pause')state.origin='pause';else if(page==='settings'&&state.page==='home')state.origin='home';state.page=page;history.replaceState(null,'','#'+page);render();}
function toast(message){document.querySelector('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.textContent=message;screen.append(el);clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.remove(),3600);}
function dialog(title,body,actions,cls=''){overlay.innerHTML='<section class="paper dialog '+cls+'" role="dialog" aria-modal="true" aria-label="'+title+'"><h3>'+title+'</h3>'+body+'<div class="actions">'+actions+'</div></section>';mountArt();overlay.querySelector('button')?.focus();}
function close(){overlay.innerHTML='';mountArt();}
function clearDialog(){dialog('清除本地游戏记录？','<p>军功、历史最高、教学进度、永久解锁、策略、周进度、当前对局和设置都将清除。</p><p>仅影响本机记录，无法从好友榜找回；不删除本人托管成绩。</p><p class="sub">此处为确认弹框设计，不执行删除。</p>',button('取消','close','wood')+button('确认清除本地','preview-clear','primary'));}
function details(id){
  const card=CARDS[id],locked=state.locked&&['march','logistics'].includes(id),personal=state.page==='prepare'||state.page==='battle';
  dialog(card.name,art('data-card="'+id+'"','dialog-art')+'<span class="seal">'+(card.kind==='active'?'主动锦囊':'被动兵法')+'</span><p>'+card.description+'</p><p class="sub">'+(locked?'未解锁 · 完成「'+MAPS[card.lesson].name+'」首胜后解锁':'首胜「'+MAPS[card.lesson].name+'」解锁候选资格')+'</p>'+(personal?'<p>当前样例：'+({mobilize:'3 张',march:'2 张',supply:'1 张',feint:'4 张',farming:'3 层',logistics:'1 层',fortification:'10 层'}[id])+'</p>':'')+'<details><summary>详细规则</summary><p class="full-rules">主动使用扣一张，未接受的动作不消费；被动本周累计，下一局自动生效。图鉴只作介绍，不从此处施策。到期按北京时间周一处理。</p></details>',button('返回','close','wood wide'));
}
function handle(action){
  const [kind,value]=action.split(':');
  if(kind==='page')return navigate(value);
  if(kind==='close')return close();
  if(kind==='detail'){if(state.page==='battle'){playScene(value);toast('重播 '+CARDS[value].name+' 的规则样例');return;}return details(value);}
  if(kind==='toast')return toast(value);
  if(kind==='choose'){state.chosen=value;return render();}
  if(kind==='chapter'){state.chapter=value;return render();}
  if(kind==='guide'){playGuide();return;}
  if(kind==='tiers')return dialog('四类营地 · 三级辨识',art('data-guide="tiers"','tier-sheet')+'<p class="sub">轮廓与体量递进，等级汉字始终明确。</p>',button('返回','close','wood wide'));
  if(kind==='troops'){dialog('四军行进',art('data-guide="troops"','troop-sheet')+'<p class="sub">长矛与盾、长弓与箭囊、骑手与马、厚盾守备。减少动态保留静态轮廓。</p>',button('返回','close','wood wide'));playGuide();return;}
  if(kind==='scene'){playScene(value);return;}
  if(kind==='map'){state.map=value;setMap(value);return render();}
  if(kind==='result'){state.loss=value==='loss';return render();}
  if(kind==='locked'){state.locked=!state.locked;return render();}
  if(kind==='backup'){state.backup=!state.backup;return render();}
  if(kind==='origin'){state.origin=value;return render();}
  if(kind==='toggle'){state[value]=!state[value];if(value==='reduced'){document.querySelector('#reduced').checked=state.reduced;motion();}return render();}
  if(kind==='clear')return clearDialog();
  if(kind==='preview-clear'){close();return toast('确认样式演示结束，没有清除任何记录。');}
  if(kind==='lesson'){state.map=value;setMap(value);navigate('battle');return toast('练兵界面样例，不计奖励。');}
  if(kind==='claim'){navigate('home');return toast('领令样式演示：'+CARDS[state.chosen].name+'。未写入实际库存。');}
  if(kind==='forfeit')return dialog('放弃本局？','<p>本局不扣军功，不获策略或周胜；已用锦囊不返还。</p><p class="sub">本页仅为新局确认样例；旧局按开局时政策显示。</p>',button('取消','close','wood')+button('放弃本局','page:home','primary'));
  if(kind==='abandon')return dialog('放弃本次选策？','<p>本次领取机会将失效，已获得的军功与周胜保留。</p>',button('取消','close','wood')+button('放弃机会','page:home','primary'));
  if(kind==='restore')return dialog('恢复较早的完整副本？','<p>样例副本：11 月 9 日 10:42。此后未确认的进度可能回退，不会混合库存或补发奖励。</p>',button('取消','close','wood')+button('确认恢复','page:pause','primary'));
  if(kind==='week-detail')return dialog('新周启程','<p>上周主动锦囊、被动层数和旧待选已到期。本周冠军从零开始。</p><p>军功、历史最高、教学和永久解锁保留。已知上周冠军已归档；旧局按快照效果收尾。</p>',button('知道了','close','wood wide'));
  if(kind==='prepare-rules')return dialog('对局与军功','<p>电脑各有乡勇 1 张，无被动。新局有效独立冠军且曾派兵获得 +30；失败、平局和放弃不扣分，无策略与周胜。</p>',button('返回军图','close','wood wide'));
  if(kind==='rank-rules')return dialog('军衔路线','<p>军司马 → 都尉 → 校尉 → 中郎将 → 偏将军 → 车骑将军 → 骠骑将军 → 大将军</p><p>每 30 军功一个小级，军衔无战斗属性。旧局依开局约定计分。</p>',button('返回军衔册','close','wood wide'));
  if(kind==='report')return dialog('四方战报','<table class="result-table"><thead><tr><th>军旗</th><th>城数</th><th>兵力</th></tr></thead><tbody><tr><td>青 · 你</td><td>'+ (state.loss?'1':'4') +'</td><td>'+ (state.loss?'40':'163') +'</td></tr><tr><td>赤</td><td>'+ (state.loss?'4':'2') +'</td><td>'+ (state.loss?'126':'90') +'</td></tr><tr><td>金</td><td>'+ (state.loss?'2':'1') +'</td><td>'+ (state.loss?'90':'54') +'</td></tr><tr><td>紫</td><td>'+ (state.loss?'2':'0') +'</td><td>'+ (state.loss?'54':'0') +'</td></tr></tbody></table><p class="sub">设计样例，兵力含有效在途。</p>',button('收起战报','close','wood wide'));
  if(kind==='army')return dialog('暂停军情','<p class="sub">样例行军册 · 战场保持暂停</p><div class="army-row">青旗步兵　10 兵<br>前往邻城 · 约 2.1 秒</div><div class="army-row">赤旗骑兵　12 兵<br>前往中央通道 · 约 1.4 秒</div><p>正式页面逐队显示实际人数，不合并成假总数。</p>',button('返回暂停','close','wood wide'));
}
document.querySelector('#pages').innerHTML=pages.map(([id,code,label])=>'<button data-page="'+id+'" data-action="page:'+id+'"><span>'+code+'</span>'+label+'</button>').join('');
document.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(el&&!el.disabled)handle(el.dataset.action);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay.innerHTML){e.preventDefault();close();}});
document.querySelector('#size').addEventListener('change',e=>{const [w,h]=e.target.value.split(',');phone.style.width=w+'px';phone.style.height=h+'px';phone.dataset.width=w;});
function motion(){phone.classList.toggle('reduced',state.reduced);setMotion(state.reduced);}
document.querySelector('#reduced').addEventListener('change',e=>{state.reduced=e.target.checked;motion();if(state.page==='settings')render();});
document.querySelector('#gray').addEventListener('change',e=>phone.classList.toggle('gray',e.target.checked));
const initial=location.hash.slice(1);if(renderers[initial])state.page=initial;
render();
artReady.then(()=>{mountArt();});
document.fonts.load('500 20px Campaign','谋定山河设置玩法与关于').then(()=>{
  document.body.dataset.fontReady=String(document.fonts.check('500 20px Campaign','谋定山河设置玩法与关于'));
}).catch(()=>{document.body.dataset.fontReady='false';});
