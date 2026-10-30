/* KFC electricity analytics extension. Original BI export is unchanged. */
(()=>{
'use strict';
const $=id=>document.getElementById(id), h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const config={url:'https://gebcfakxhgbvpdiqcnue.supabase.co',key:'sb_publishable_Wex7BAn-qkOpKKspQcydtg_74ZxeDx6'};
const client=window.supabase?.createClient(config.url,config.key,{auth:{persistSession:true}});
let monthly=[], cloudStores=[], chart=null,paceDetails=[],anomalyDetails=[], logged=false, loadedPeriods=new Set(), trendLoaded=false, lastTrendRows=[];
const fmtKwh=v=>v==null||!Number.isFinite(Number(v))?'—':Math.round(Number(v)).toLocaleString('en-US');
const say=(s,error=false)=>{const el=$('dbMessage');el.textContent=s;el.classList.toggle('error',error)};
function showApp(user){logged=true;$('authGate').hidden=true;$('appShell').hidden=false;$('accountEmail').textContent=user?.email||'';}
function showLogin(message='請使用已授權的管理員帳號登入。') {logged=false;$('authGate').hidden=false;$('appShell').hidden=true;$('dbStatus').textContent='尚未登入';say(message);}
const norm=s=>String(s||'').trim().toUpperCase();
const active=x=>x.status!=='closed'&&x.status!=='suspected';
function storeList(){let local=mapping.map(x=>({store_code:norm(x.餐廳代號),store_name:x.餐廳名稱,region:regionCode(x.區域),ac:x.AC||'',band:x.Group||'',status:x._status||'active'}));let m=new Map(cloudStores.map(x=>[x.store_code,x]));local.forEach(x=>m.set(x.store_code,{...m.get(x.store_code),...x}));return [...m.values()]}
function allData(){return monthly}
async function getAll(table,cols='*') {let all=[];for(let offset=0;;offset+=800){let {data,error}=await client.from(table).select(cols).range(offset,offset+799);if(error)throw error;all.push(...data);if(data.length<800)break}return all}
async function reload(){if(!client||!logged)return;try{cloudStores=await getAll('electricity_stores');if(!cloudStores.length){$('dbStatus').textContent='已登入／無餐廳資料';say('登入成功，但目前沒有可讀取的餐廳資料。請檢查 electricity_stores 匯入與 RLS 授權。',true);return;}mapping=cloudStores.map(x=>({區域:x.region,AC:x.ac,Group:x.band,餐廳代號:x.store_code,餐廳名稱:x.store_name,_status:x.status||'active'}));saveMapping();loadedPeriods.clear();monthly=[];trendLoaded=false;$('dbStatus').textContent='已連線';say(`已連線，載入 ${cloudStores.length} 家餐廳。月份資料會在開啟分析頁時按需讀取。`);render();await loadVisible()}catch(e){$('dbStatus').textContent='已登入／資料讀取失敗';say('帳號已登入，但資料庫讀取失敗：'+e.message+'。請檢查管理員授權及 RLS。',true);console.error('Electricity data load:',e)}}
async function verifyAndEnter(user){if(!user){showLogin();return}showApp(user);$('dbStatus').textContent='已登入／讀取中';await reload()}
async function auth(){if(!client){say('Supabase SDK 載入失敗，請確認網路',true);return}const btn=$('dbLogin');btn.disabled=true;say('正在驗證 Supabase 帳號…');try{let {data,error}=await client.auth.signInWithPassword({email:$('dbEmail').value.trim(),password:$('dbPassword').value});if(error)throw error;$('dbPassword').value='';await verifyAndEnter(data.user)}catch(e){showLogin('帳號驗證失敗：'+e.message);$('dbMessage').classList.add('error')}finally{btn.disabled=false}}
$('authForm').addEventListener('submit',e=>{e.preventDefault();auth()});
$('dbLogout').onclick=async()=>{await client?.auth.signOut();monthly=[];cloudStores=[];loadedPeriods.clear();trendLoaded=false;showLogin('已登出，請重新登入。')};$('dbReload').onclick=reload;
if(client)client.auth.getSession().then(({data,error})=>{if(error||!data.session){showLogin();return}verifyAndEnter(data.session.user)}).catch(e=>showLogin('無法確認登入狀態：'+e.message));else showLogin('Supabase SDK 未載入，請確認網路連線。');
function mergeMonthly(rows){let m=new Map(monthly.map(x=>[`${x.store_code}|${x.year}|${x.month}`,x]));rows.forEach(x=>m.set(`${x.store_code}|${x.year}|${x.month}`,x));monthly=[...m.values()]}
async function loadPeriod(year,month){if(!logged||!year||!month)return;let key=`${year}-${month}`;if(loadedPeriods.has(key))return;let {data,error}=await client.from('electricity_monthly').select('store_code,year,month,daily_avg_kwh,data_status').eq('year',year).eq('month',month).range(0,999);if(error)throw error;if(data?.length===1000)throw new Error('單月超過 1000 筆，請調整分頁讀取');mergeMonthly(data||[]);loadedPeriods.add(key)}
async function loadTrend(){if(!logged||trendLoaded)return;let rows=await getAll('electricity_monthly','store_code,year,month,daily_avg_kwh,data_status');mergeMonthly(rows);trendLoaded=true;renderTrend()}
async function loadVisible(){if(!logged)return;let tab=document.querySelector('.tab.active')?.dataset.tab;try{if(tab==='trend')await loadTrend();if(tab==='pace'){await loadPeriod(+$('paceYear').value,+$('paceMonth').value);renderPace()}if(tab==='anomaly'){let y=+$('anomalyYear').value,m=+$('anomalyMonth').value;await Promise.all([loadPeriod(y,m),loadPeriod(y-1,m)]);renderAnomaly()}}catch(e){say('分析資料讀取失敗：'+e.message)}}
function monthMap(){return new Map(allData().map(x=>[`${x.store_code}|${x.year}|${x.month}`,x]))}
function options(id,values,all=false){let el=$(id),old=el.value;el.innerHTML=(all?'<option value="">全部</option>':'')+values.map(x=>`<option value="${h(x)}">${h(x)}</option>`).join('');if(values.map(String).includes(old))el.value=old}
function periodOptions(){let years=[2026,2025,2024,...new Set(monthly.map(x=>x.year))].filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>b-a),months=Array.from({length:12},(_,i)=>i+1);['paceYear','anomalyYear'].forEach(id=>options(id,years));['paceMonth','anomalyMonth'].forEach(id=>options(id,months));if(!$('paceMonth').dataset.init){let latest=[...monthly].sort((a,b)=>b.year-a.year||b.month-a.month)[0];if(latest){$('paceMonth').value=latest.month;$('anomalyMonth').value=latest.month} if(!latest){$('paceMonth').value=9;$('anomalyMonth').value=9} $('paceMonth').dataset.init='1'}}
function filterUI(){let ss=storeList();let names=[['region','區域'],['ac','AC'],['band','Band'],['store_code','餐廳']];let previous={};names.forEach(([k])=>previous[k]=$('f_'+k)?.value||'');$('filters').innerHTML=names.map(([k,label])=>`<label>${label} <select id="f_${k}"><option value="">全部</option>${[...new Set(ss.map(x=>x[k]).filter(Boolean))].sort().map(v=>`<option value="${h(v)}">${h(k==='store_code'?(ss.find(x=>x.store_code===v)?.store_name||v)+' '+v:v)}</option>`).join('')}</select></label>`).join('')+`<label>餐廳狀態 <select id="f_status"><option value="active">營運中</option><option value="closed">已關店</option><option value="all">全部</option></select></label>`;names.forEach(([k])=>{if(previous[k])$('f_'+k).value=previous[k]});$('filters').querySelectorAll('select').forEach(x=>x.onchange=renderTrend)}
function filteredStores(){return storeList().filter(x=>{let state=$('f_status')?.value||'active';return (state==='all'||(state==='closed'?!active(x):active(x)))&&['region','ac','band','store_code'].every(k=>!$('f_'+k)?.value||x[k]===$('f_'+k).value)})}
function renderTrend(){let codes=new Set(filteredStores().map(x=>x.store_code)), agg=new Map();allData().forEach(x=>{if(!codes.has(x.store_code)||x.daily_avg_kwh==null||x.data_status==='missing')return;let k=`${x.year}-${x.month}`,v=agg.get(k)||{sum:0,n:0};v.sum+=Number(x.daily_avg_kwh);v.n++;agg.set(k,v)});let rows=[...agg].map(([k,v])=>{let [year,month]=k.split('-').map(Number);return {year,month,n:v.n,avg:v.sum/v.n}}).sort((a,b)=>a.year-b.year||a.month-b.month);lastTrendRows=rows;$('trendRows').innerHTML=rows.map(r=>`<tr><td>${r.year}</td><td>${r.month}</td><td>${r.n}</td><td>${Math.round(r.avg).toLocaleString()}</td></tr>`).join('');$('trendStats').innerHTML=`<div class="stat">目前餐廳<div class="n">${codes.size}</div></div><div class="stat">有效月份<div class="n">${rows.length}</div></div><div class="stat">最新有資料年度<div class="n">${rows.at(-1)?.year||'—'}</div></div>`;let years=[...new Set(rows.map(x=>x.year))],colors=['#2563eb','#0f766e','#e76f35','#8b5cf6'];chart?.destroy();if(window.Chart)chart=new Chart($('trendChart'),{type:'line',data:{labels:Array.from({length:12},(_,i)=>`${i+1}月`),datasets:years.map((y,i)=>({label:String(y),data:Array.from({length:12},(_,j)=>rows.find(x=>x.year===y&&x.month===j+1)?.avg??null),borderColor:colors[i%colors.length],backgroundColor:colors[i%colors.length],tension:.2,spanGaps:false}))},options:{responsive:true,plugins:{legend:{position:'top'}},scales:{y:{title:{display:true,text:'平均每日度數'},grid:{display:true}},x:{grid:{display:true}}}}})}
function calcPace(){let year=+$('paceYear').value,month=+$('paceMonth').value, sm=new Map(storeList().map(x=>[x.store_code,x])),bands=new Map();allData().filter(x=>x.year===year&&x.month===month&&x.daily_avg_kwh!=null&&Number(x.daily_avg_kwh)>=0&&x.data_status==='normal').forEach(x=>{let st=sm.get(x.store_code);if(!st||!active(st)||!st.band)return;let a=bands.get(st.band)||[];a.push({...st,kwh:Number(x.daily_avg_kwh)});bands.set(st.band,a)});return [...bands].sort((a,b)=>a[0].localeCompare(b[0])).map(([band,items])=>{items.sort((a,b)=>a.kwh-b.kwh);let remaining=items.slice(1),count=Math.ceil(remaining.length/2),chosen=remaining.slice(0,count),avg=count?chosen.reduce((a,b)=>a+b.kwh,0)/count:null;return {band,items,chosen,excluded:items[0],avg,count}})}
function renderPace(){paceDetails=calcPace();$('paceRows').innerHTML=paceDetails.map((p,i)=>`<tr><td>${h(p.band)}</td><td>${p.items.length}</td><td>${h(p.excluded?.store_name)} (${fmtKwh(p.excluded?.kwh)})</td><td>${p.count}</td><td>${p.avg==null?'N/A':fmtKwh(p.avg)}</td><td><button class="btn light" data-p="${i}">查看</button></td></tr>`).join('');const report=paceDetails.flatMap(p=>p.items.map((x,i)=>({band:p.band,code:x.store_code,name:x.store_name,region:x.region||'',ac:x.ac||'',rank:i+1,kwh:x.kwh,base:p.avg,diff:p.avg==null?null:x.kwh-p.avg,used:p.chosen.includes(x),excluded:p.excluded===x})));const reportBody=$('paceReportRows');if(reportBody)reportBody.innerHTML=report.map(x=>`<tr><td>${h(x.band)}</td><td>${x.rank}</td><td>${h(x.code)}</td><td>${h(x.name)}</td><td>${h(x.region)}</td><td>${h(x.ac)}</td><td class="num">${fmtKwh(x.kwh)}</td><td class="num">${fmtKwh(x.base)}</td><td class="num">${fmtKwh(x.diff)}</td><td>${x.excluded?'排除最低':x.used?'基準採計':'一般比較'}</td></tr>`).join('');$('paceRows').querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{let p=paceDetails[+b.dataset.p];$('paceExplain').innerHTML=`<b>${h(p.band)}｜計算明細</b><p>有效 ${p.items.length} 家；排除最省電 ${h(p.excluded.store_name)}（${fmtKwh(p.excluded.kwh)} 度）；剩餘 ${p.items.length-1} 家；採計 ceil(剩餘家數 × 50%) = ${p.count} 家。</p><p>採計餐廳：${p.chosen.map(x=>`${h(x.store_name)} ${fmtKwh(x.kwh)}`).join('、')||'無'}</p><p>基準 = (${p.chosen.map(x=>fmtKwh(x.kwh)).join(' + ')||'—'}) ÷ ${p.count||'—'} = <b>${fmtKwh(p.avg)||'N/A'} 度／日</b></p>`})}
function calcAnomaly(){let year=+$('anomalyYear').value,month=+$('anomalyMonth').value,threshold=+$('anomalyThreshold').value, m=monthMap();return storeList().filter(active).map(st=>{let cur=m.get(`${st.store_code}|${year}|${month}`),prev=m.get(`${st.store_code}|${year-1}|${month}`),v=cur?.daily_avg_kwh,p=prev?.daily_avg_kwh,change=v!=null&&p!=null&&Number(p)>0?(Number(v)/Number(p)-1)*100:null;return {...st,now:v==null?null:Number(v),prev:p==null?null:Number(p),change,flag:change==null?'無同比資料':change>=threshold?'用電增加':'正常'}}).filter(x=>x.now!=null).sort((a,b)=>(b.change??-999)-(a.change??-999))}
function renderAnomaly(){anomalyDetails=calcAnomaly();$('anomalyRows').innerHTML=anomalyDetails.map(x=>`<tr><td>${h(x.store_code+' '+x.store_name)}</td><td>${h(x.region)}</td><td>${h(x.ac)}</td><td>${h(x.band)}</td><td>${x.now.toFixed(0)}</td><td>${x.prev?.toFixed(0)??'N/A'}</td><td>${x.change==null?'N/A':x.change.toFixed(2)+'%'}</td><td>${x.flag}</td></tr>`).join('')}
function exportXlsx(rows,name){if(!rows.length){alert('目前沒有可匯出的資料');return}let ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'報表');XLSX.writeFile(wb,name)}
function sheet(rows,name,percentCols=[]){let ws=XLSX.utils.json_to_sheet(rows);ws['!cols']=Object.keys(rows[0]||{}).map(k=>({wch:Math.max(14,Math.min(38,k.length*2+10))}));ws['!autofilter']={ref:ws['!ref']};ws['!freeze']={xSplit:0,ySplit:1};ws['!rows']=[{hpt:28}];let headers=Object.keys(rows[0]||{});percentCols.forEach(k=>{let col=headers.indexOf(k);if(col<0)return;for(let r=2;r<=rows.length+1;r++){let cell=ws[XLSX.utils.encode_cell({r:r-1,c:col})];if(cell&&typeof cell.v==='number')cell.z='0.00%'}});for(let row=2;row<=rows.length+1;row++)for(let col=0;col<headers.length;col++){let cell=ws[XLSX.utils.encode_cell({r:row-1,c:col})];if(cell&&typeof cell.v==='number'&&!percentCols.includes(headers[col]))cell.z='#,##0.00';}for(let c=0;c<headers.length;c++){let cell=ws[XLSX.utils.encode_cell({r:0,c})];if(cell)cell.s={font:{bold:true,color:{rgb:'FFFFFF'}},fill:{fgColor:{rgb:'C41230'}},alignment:{horizontal:'center',vertical:'center'}}}for(let r=1;r<=rows.length;r++){let last=rows[r-1]?.Band==='合計';for(let c=0;c<headers.length;c++){let cell=ws[XLSX.utils.encode_cell({r,c})];if(cell)cell.s={font:{bold:last,color:{rgb:last?'FFFFFF':'202A35'}},fill:{fgColor:{rgb:last?'263746':r%2===0?'F1F5F9':'FFFFFF'}},alignment:{vertical:'center'}}}}return ws}
function workbook(tabs,filename){let wb=XLSX.utils.book_new();for(let [name,rows,percents] of tabs){XLSX.utils.book_append_sheet(wb,sheet(rows,name,percents||[]),name.slice(0,31))}XLSX.writeFile(wb,filename)}
$('masterExport').onclick=()=>workbook([['最新餐廳資料',storeList().map(x=>({區域:x.region,AC:x.ac,Band:x.band,餐廳代號:x.store_code,餐廳名稱:x.store_name,營運狀態:x.status}))]],'餐廳基本資料.xlsx');
$('trendExport').onclick=()=>{let codes=new Set(filteredStores().map(x=>x.store_code)),stores=new Map(storeList().map(x=>[x.store_code,x]));let detail=monthly.filter(x=>codes.has(x.store_code)).map(x=>{let st=stores.get(x.store_code)||{};return {區域:st.region,AC:st.ac,Band:st.band,餐廳代號:x.store_code,餐廳名稱:st.store_name,年度:x.year,月份:x.month,平均每日度數:x.daily_avg_kwh??''}});workbook([['每月趨勢彙總',lastTrendRows.map(x=>({年度:x.year,月份:x.month,有效餐廳:x.n,平均每日度數:x.avg}))],['餐廳月份明細',detail]],'用電趨勢.xlsx')};
// ExcelJS 支援真正的 Excel 儲存格底色、邊框及群組分隔線。
async function exportStyledPacesetter(tabs, filename){
 if(!window.ExcelJS){alert('Excel 樣式模組尚未載入，請確認網路連線後重新整理。');return}
 const wb=new ExcelJS.Workbook();wb.creator='KFC Energy';wb.created=new Date();
 for(const [name,records] of tabs){
  const ws=wb.addWorksheet(name,{views:[{state:'frozen',ySplit:1}]});
  if(!records.length)continue;
  const keys=Object.keys(records[0]);ws.columns=keys.map(k=>({header:k,key:k,width:k==='計算邏輯'?100:k==='餐廳名稱'?24:k==='Band'?22:Math.max(14,k.length*2+5)}));
  ws.getRow(1).height=33;
  ws.getRow(1).eachCell(cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFC8102E'}};cell.font={name:'Microsoft JhengHei',bold:true,color:{argb:'FFFFFFFF'},size:12};cell.alignment={vertical:'middle',horizontal:'center'};cell.border={bottom:{style:'medium',color:{argb:'FF891025'}}}});
  let lastBand=null;
  records.forEach((obj,i)=>{
   const row=ws.addRow(keys.map(k=>obj[k]));row.height=name==='計算邏輯說明'?42:25;
   const band=obj.Band;
   const bandStart=name==='餐廳用電排名'&&band!==lastBand;
   const total=band==='合計';
   const fill=total?'FF263746':bandStart?'FFE1EAF4':i%2===0?'FFF1F5F9':'FFFFFFFF';
   row.eachCell({includeEmpty:true},(cell,col)=>{
    cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
    cell.font={name:'Microsoft JhengHei',size:11,bold:total||bandStart,color:{argb:total?'FFFFFFFF':'FF243343'}};
    cell.alignment={vertical:'middle',horizontal:typeof cell.value==='number'?'right':'left',wrapText:name==='計算邏輯說明'};
    cell.border={bottom:{style:'hair',color:{argb:'FFD8E0E8'}},...(bandStart?{top:{style:'medium',color:{argb:'FF55738E'}}}:{})};
    if(typeof cell.value==='number')cell.numFmt=keys[col-1].includes('百分比')?'0%':'#,##0';
   });
   if(band!==undefined)lastBand=band;
  });
  ws.autoFilter=name==='餐廳用電排名'?{from:'A1',to:ws.getRow(1).lastCell.address}:undefined;
  ws.pageSetup={fitToPage:true,fitToWidth:1,fitToHeight:0,orientation:'landscape'};
 }
 const bytes=await wb.xlsx.writeBuffer();const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
$('paceExport').onclick=async()=>{
 const all=paceDetails.flatMap(p=>p.items.map((x,i)=>({p,x,groupRank:i+1})));
 const national=[...all].sort((a,b)=>a.x.kwh-b.x.kwh||a.x.store_code.localeCompare(b.x.store_code));
 const nationalRank=new Map(national.map((r,i)=>[r.x.store_code,i+1]));
 const counts=new Map();storeList().filter(x=>x.status==='active'&&x.band).forEach(x=>counts.set(x.band,(counts.get(x.band)||0)+1));
 const bands=[...new Set([...counts.keys(),...paceDetails.map(p=>p.band)])].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
 const summary=bands.map(b=>{const p=paceDetails.find(x=>x.band===b);return {Band:b,餐廳數:counts.get(b)||0,群組平均度數:p?.avg??''}});
 const totalStores=summary.reduce((n,r)=>n+r.餐廳數,0);
 const totalChosen=paceDetails.reduce((n,p)=>n+p.count,0);
 const weighted=totalChosen?paceDetails.reduce((n,p)=>n+(p.avg??0)*p.count,0)/totalChosen:'';
 summary.push({Band:'合計',餐廳數:totalStores,群組平均度數:weighted});
 const compare=all.sort((a,b)=>a.p.band.localeCompare(b.p.band,'zh-Hant')||a.groupRank-b.groupRank).map(({p,x,groupRank})=>({Band:p.band,群組排名:groupRank,全國排名:nationalRank.get(x.store_code),區域:x.region,AC:x.ac,餐廳代號:x.store_code,餐廳名稱:x.store_name,實際度數:x.kwh,群組平均度數:p.avg??'',差異度數:p.avg==null?'':x.kwh-p.avg,差異百分比:p.avg?x.kwh/p.avg-1:''}));
 const notes=[
 {項目:'餐廳數',計算邏輯:'依最新餐廳基本資料統計營運中且有 Band 的餐廳；即使當月缺少用電資料仍計入。合計為各 Band 加總。'},
 {項目:'有效用電資料',計算邏輯:'選定年月內，僅納入營運中、有 Band 且每日平均度數有效的餐廳進行排名及群組平均度數計算。'},
 {項目:'群組平均度數',計算邏輯:'各 Band 排除每日用電最低的 1 家，再取剩餘餐廳中用電最低的前 50%（無條件進位）計算算術平均；少於 2 家不產生平均。'},
 {項目:'合計平均度數',計算邏輯:'以各 Band 的實際採計家數作權重計算加權平均，不直接平均各 Band 的平均度數。'},
 {項目:'群組排名',計算邏輯:'同 Band 的有效餐廳依每日平均度數由低到高排序，同度數依餐廳代號排序。'},
 {項目:'全國排名',計算邏輯:'全部 Band 的有效餐廳依每日平均度數由低到高排序，同度數依餐廳代號排序。'},
 {項目:'差異度數',計算邏輯:'實際度數－所屬 Band 群組平均度數。'},
 {項目:'差異百分比',計算邏輯:'實際度數 ÷ 群組平均度數－1；負值表示低於群組平均。'},
 {項目:'顯示規則',計算邏輯:'所有數值顯示整數（百分比亦不顯示小數位），計算仍保留原始精度。'}
 ];
 try{await exportStyledPacesetter([['Pacesetter總覽',summary],['餐廳用電排名',compare],['計算邏輯說明',notes]],`Pacesetter_${$('paceYear').value}M${$('paceMonth').value}.xlsx`)}catch(e){console.error(e);alert('匯出失敗：'+e.message)}
};
$('anomalyExport').onclick=()=>workbook([['用電異常',anomalyDetails.map(x=>({餐廳代號:x.store_code,餐廳名稱:x.store_name,區域:x.region,AC:x.ac,Band:x.band,今年每日度數:x.now,去年每日度數:x.prev??'',年增率:x.change==null?'':x.change/100,判斷:x.flag})),['年增率']]],`用電異常_${$('anomalyYear').value}M${$('anomalyMonth').value}.xlsx`);
['paceYear','paceMonth'].forEach(id=>$(id).onchange=()=>loadVisible());['anomalyYear','anomalyMonth'].forEach(id=>$(id).onchange=()=>loadVisible());$('anomalyThreshold').onchange=renderAnomaly;
function render(){filterUI();periodOptions();renderTrend();renderPace();renderAnomaly()}
async function upsertBatches(table,rows,conflict){for(let i=0;i<rows.length;i+=150){let {error}=await client.from(table).upsert(rows.slice(i,i+150),{onConflict:conflict});if(error)throw error}}
window.elecSyncMapping=async()=>{if(!logged){say('請先登入管理員帳號。');return}try{let ss=storeList().map(x=>({store_code:x.store_code,store_name:x.store_name||'',region:x.region||'',ac:x.ac||'',band:x.band||'',status:x.status||'active'}));await upsertBatches('electricity_stores',ss,'store_code');say('Mapping 已同步到 Supabase');await reload()}catch(e){say('Mapping 同步失敗：'+e.message)}};
$('savePeriod').onclick=async()=>{if(!logged){alert('請先登入已授權的 Supabase 帳號');return}if(!results.length)return;if(results.some(x=>x._missing)){alert('有未配對餐廳，請先更新 Mapping');return}if(!confirm(`確定將 ${period.year} M${period.month} 的 ${results.length} 家餐廳資料寫入資料庫？相同店號、年月將覆蓋舊值。`))return;try{let rows=results.map(x=>({store_code:x.餐廳代號,year:x.年份,month:x.月份,daily_avg_kwh:x.度數,data_status:'normal',source_name:'網站每月台電計算'}));await upsertBatches('electricity_monthly',rows,'store_code,year,month');say(`已儲存 ${rows.length} 家 ${period.year} M${period.month}，重新載入分析中。`);loadedPeriods.delete(`${period.year}-${period.month}`);await reload()}catch(e){say('儲存失敗：'+e.message)}};
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{loadVisible()}));
render();
})();
