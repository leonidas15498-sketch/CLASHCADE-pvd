const fs=require('fs'),path=require('path'),http=require('http'),{spawn}=require('child_process');
const root=path.resolve(__dirname,'../dist');
const results=[],errors=[]; const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const server=http.createServer((req,res)=>{ const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0])); if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;} fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;} res.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.mp3':'audio/mpeg'})[path.extname(file)]||'application/octet-stream');res.end(b);});});
let browser,ws; let seq=0; const waiting=new Map();
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++seq; const timer=setTimeout(()=>{waiting.delete(id);reject(Error('CDP timeout '+method));},20000);waiting.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+JSON.stringify(r.exceptionDetails.exception));return r.result.value;}
async function waitFor(expr){for(let i=0;i<100;i++){if(await evaluate(expr))return;await sleep(100);}throw Error('waitFor '+expr);}
async function click(selector){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control');e.click()})()`);}
async function navigate(hash,selector){await send('Page.navigate',{url:'http://127.0.0.1:4182/'+hash});await waitFor(`!!document.querySelector(${JSON.stringify(selector)})`);}
(async()=>{
 await new Promise(r=>server.listen(4182,'127.0.0.1',r));
 browser=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--remote-debugging-port=9225','--user-data-dir='+path.resolve(__dirname,'../.v13-browser-profile'),'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});
 let pages;for(let i=0;i<100;i++){try{pages=await(await fetch('http://127.0.0.1:9225/json/list')).json();if(pages.some(x=>x.type==='page'))break;}catch{}await sleep(100);}
 const page=pages?.find(x=>x.type==='page');if(!page)throw Error('No CDP page');ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const q=waiting.get(m.id);if(q){clearTimeout(q.timer);waiting.delete(m.id);m.error?q.reject(Error(JSON.stringify(m.error))):q.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params);};
 await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 for(const h of ['#%','#unknown','']){await navigate(h,'.card');if(await evaluate("document.querySelectorAll('.card').length")!==10)throw Error('Catalogue count');results.push({route:h||'home',status:'passed'});}
 await navigate('', '.card');
 for(const [label,count] of [['Contra IA',8],['Solo',3],['2P no aparelho',10],['Todos',10]]) {
   await evaluate(`[...document.querySelectorAll('.game-filters button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`);
   if(await evaluate("document.querySelectorAll('.card').length")!==count)throw Error('Mode filter '+label);
   results.push({scenario:'filter '+label,status:'passed'});
 }
 const games={'air-hockey':['ai','local'],'duelo-rastros':['ai','local'],empilha:['solo','ai','local'],'lig-4':['ai','local'],pong:['ai','local'],blocos:['solo','local'],'sumo-neon':['ai','local'],'cabo-de-guerra':['ai','local']};
 for(const [route,modes] of Object.entries(games))for(const mode of modes)for(const diff of mode==='ai'?['easy','medium','hard']:[null]){
   await navigate('#'+route,'[data-k="play-'+mode+'"]');if(diff)await click('[data-d="'+diff+'"]');await click('[data-k="play-'+mode+'"]');await sleep(150);
   await click('[data-k="home"]');if(!await evaluate('document.querySelector(\'[data-k="confirm"]\').classList.contains("show")'))throw Error('Confirmation missing '+route);
   const alias=({'air-hockey':'airhockey','duelo-rastros':'trails',empilha:'stack','lig-4':'connect4',blocos:'blocks','sumo-neon':'sumo','cabo-de-guerra':'tug'})[route]||route;
   const snapshot=`(()=>{const g=window['__'+${JSON.stringify(alias)}];return JSON.stringify(g.m?{phase:g.m.phase,placed:g.m.placed,pieces:g.m.sw.snapshot()}:g.s)})()`;
   const before=await evaluate(snapshot);await sleep(250);if(await evaluate(snapshot)!==before)throw Error('Simulation advanced during confirmation: '+route);
   await click('[data-k="c-no"]');await click('[data-k="pause"]');await click('[data-k="resume"]');
   if(['pong','air-hockey','sumo-neon'].includes(route)){
     await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'w'}));window.dispatchEvent(new Event('blur'));`);
     if(await evaluate(`window['__'+${JSON.stringify(alias)}].keys.size`)!==0)throw Error('Stuck key '+route);
     await click('[data-k="resume"]');
   }
   await click('[data-k="home"]');await click('[data-k="c-yes"]');await waitFor('document.querySelector(\'[data-k="menu"]\').classList.contains("show")');
   results.push({route,mode,difficulty:diff,status:'passed',confirmationSimulationFrozen:true});
 }
 for(const [route,selector] of [['sinuca','#btn-play-local'],['sinuca','#btn-play-ai'],['minigolfe','#mg-play-duo'],['minigolfe','#mg-play-solo']]){
   await navigate('#'+route,selector);await click(selector);await sleep(200);
   if(route==='sinuca')await evaluate("window.__sinuca.beginStrike(0,0.4)");
   else await evaluate("window.__minigolf.setPower(0.4);window.__minigolf.shoot()");
   await sleep(180);await click(route==='sinuca'?'#btn-home':'#mg-home');
   const snapshot=route==='sinuca'?"JSON.stringify({balls:window.__sinuca.game.world.balls,clock:window.__sinuca.turnLeft,match:window.__sinuca.matchTime})":"JSON.stringify({world:window.__minigolf.world,match:window.__minigolf.match})";
   const before=await evaluate(snapshot);await sleep(300);if(await evaluate(snapshot)!==before)throw Error('Own simulation advanced '+route);
   await click(route==='sinuca'?'#btn-confirm-no':'#mg-confirm-no');
   if(await evaluate(route==='sinuca'?'window.__sinuca.paused':'window.__minigolf.paused'))throw Error('Own game did not resume');
   results.push({route,mode:selector,status:'passed',confirmationSimulationFrozen:true});
 }
 await navigate('', '.card');
 await evaluate("window.__savedGetContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(){throw Error('injected mount failure')};location.hash='sinuca'");
 await waitFor("!!document.querySelector('.game-msg[role=alert]')");
 if(await evaluate("!!document.querySelector('style[data-game],#jogaco-power-gauge')"))throw Error('Styles leaked after mount failure');
 await evaluate("HTMLCanvasElement.prototype.getContext=window.__savedGetContext;location.hash=''");
 await waitFor("document.querySelectorAll('.card').length===10");results.push({scenario:'partial mount rollback',status:'passed'});
 if(errors.length)throw Error('Browser exceptions: '+errors.length);
 console.log(JSON.stringify({results,errors},null,2));
})().catch(e=>{errors.push({harness:e.message});process.exitCode=1;console.error(e);}).finally(async()=>{fs.writeFileSync(path.join(__dirname,'v13-browser-results.json'),JSON.stringify({results,errors},null,2));if(ws){try{await send('Browser.close');}catch{}ws.close();}if(browser&&!browser.killed)browser.kill();server.closeAllConnections();server.close();browser?.unref();setTimeout(()=>process.exit(process.exitCode||0),1000);});
