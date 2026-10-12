let manualSelections={};
const annualHistory={};
const category=r=>(r.Category||r['Transcription note']||'Uncategorized').trim();
function renderCategories(limits={}) {
  el('categoryLimits').replaceChildren();
  const parkRows=typeof activityCatalog==='function'?Object.values(activityCatalog()).map(a=>({Category:a.category})):rows.filter(r=>r.Park===plan.days[day].park);
  for(const name of [...new Set(parkRows.map(category))].sort()) {
    const label=document.createElement('label');label.textContent=`${name} (${parkRows.filter(r=>category(r)===name).length} available)`;
    const input=document.createElement('input');input.type='number';input.min='0';input.step='1';input.placeholder='Unlimited';input.dataset.category=name;input.value=limits[name]??'';
    input.onchange=()=>{try{settings();el('itinerary').textContent='Category limits changed. Build itinerary again to update recommendations.';renderSegments();}catch(e){el('selectionStatus').textContent=e.message;}};label.append(input);el('categoryLimits').append(label);
  }
}
function readCategoryLimits() {
  const limits={};for(const input of el('categoryLimits').querySelectorAll('input')) {
    if(input.value==='')continue;
    const value=Number(input.value);if(!Number.isInteger(value)||value<0)throw Error('Category maximums must be whole numbers of zero or more.');limits[input.dataset.category]=value;
  }return limits;
}
function timeMinutes(value) {
  if(!/^\d{2}:\d{2}$/.test(value))throw Error('Time points must use HH:MM.');
  const [h,m]=value.split(':').map(Number);if(h>23||m>59)throw Error('Invalid time point.');return h*60+m;
}
function daySections() {
  const start=timeMinutes(el('arrival').value),end=timeMinutes(el('departure').value);
  if(end<=start)throw Error('Departure must be after arrival.');
  const blocks=el('blocks').value.split('\n').filter(x=>x.trim()).map(line=>{
    const match=line.match(/^\s*(\d{2}:\d{2})-(\d{2}:\d{2})\s*\|\s*(.+)$/);if(!match)throw Error('Reservation format: 14:00-15:00 | Name');
    return {start:timeMinutes(match[1]),end:timeMinutes(match[2]),name:match[3]};
  }).concat(reservationBlocks()).sort((a,b)=>a.start-b.start);
  blocks.forEach((b,i)=>{if(b.start<start||b.end>end||b.end<=b.start||(i&&blocks[i-1].end>b.start))throw Error('Reservations must fit inside your day and cannot overlap.');});
  const extra=el('timepoints').value.split(',').map(x=>x.trim()).filter(Boolean).map(timeMinutes);
  if(extra.some(t=>t<=start||t>=end))throw Error('Additional time points must fall between arrival and departure.');
  const points=[...new Set([start,end,...extra,...blocks.flatMap(b=>[b.start,b.end])])].sort((a,b)=>a-b);
  return points.slice(0,-1).map((start,i)=>({start,end:points[i+1],fixed:blocks.find(b=>start>=b.start&&start<b.end)}));
}
function renderSegments() { renderCalendar(); }

function shiftDate(date,days){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function thanksgiving(year){const d=new Date(Date.UTC(year,10,1));return `${year}-11-${String(1+(4-d.getUTCDay()+7)%7+21).padStart(2,'0')}`;}
async function loadYearHistory() {
  const token=generation,id=parkIds[plan.days[day].park];if(!id)return;
  el('history').disabled=true;el('yearSummary').replaceChildren();el('historyStatus').textContent='Loading last 12 months…';
  try {
    let archive=annualHistory[id];
    if(!archive) {
      const today=new Intl.DateTimeFormat('en-CA',{timeZone:plan.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      const end=shiftDate(today,-1),begin=new Date(today+'T12:00:00Z');begin.setUTCFullYear(begin.getUTCFullYear()-1);let start=begin.toISOString().slice(0,10),restricted=false;
      const entities={};let path=`entity/${id}/history/daily?from=${start}&to=${end}`,pages=0;
      while(path) {
        if(token!==generation)return;
        let data;try{data=await get(path);}catch(e){const earliest=e.data?.error?.earliestAllowedDate;if(e.status===403&&earliest&&earliest>start){start=earliest;restricted=true;path=`entity/${id}/history/daily?from=${start}&to=${end}`;continue;}throw e;}
        for(const entity of data.entities||[]){const merged=entities[entity.id]??={id:entity.id,name:entity.name,days:[]};merged.days.push(...entity.days||[]);}
        pages++;el('historyStatus').textContent=`Loading year summaries · ${pages} pages received…`;
        if(data.next){const next=new URL(data.next,'https://api.themeparks.wiki');const from=next.searchParams.get('from');if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||from<=data.range.from)throw Error('Invalid history pagination');path=`entity/${id}/history/daily?from=${from}&to=${end}`;}else path=null;
      }
      archive={start,end,restricted,entities:Object.values(entities)};annualHistory[id]=archive;
    }
    if(token!==generation)return;
    el('historyStatus').textContent=`Daily history ${archive.start}–${archive.end}. `+(archive.restricted?'API access limits the requested year; last Thanksgiving may be unavailable. Set a server-side API key with year-long access.':'Last 12 months loaded.');
    renderYearSummary(archive);await loadComparison(archive,token);
  }catch(e){if(token===generation)el('historyStatus').textContent='History unavailable: '+e.message;}finally{el('history').disabled=false;}
}
function renderYearSummary(archive) {
  el('yearSummary').replaceChildren();const table=document.createElement('table'),heading=document.createElement('tr');
  for(const text of ['Experience','Year: median of daily medians','Last Thanksgiving week: median of daily medians','Sample days']){const th=document.createElement('th');th.textContent=text;heading.append(th);}table.append(heading);
  const holiday=thanksgiving(+plan.days[day].date.slice(0,4)-1);
  const median=values=>{values.sort((a,b)=>a-b);return values.length?values[Math.floor(values.length/2)]+' min':'No wait data';};
  for(const r of rows.filter(r=>r.Park===plan.days[day].park)) {
    const entity=archive.entities.find(e=>e.id===resolve(r)?.id);if(!entity)continue;
    const days=entity.days.filter(d=>Number.isFinite(d.standby?.p50));const week=days.filter(d=>d.date>=shiftDate(holiday,-3)&&d.date<=shiftDate(holiday,3));
    const tr=document.createElement('tr');for(const text of [r.Experience,median(days.map(d=>d.standby.p50)),median(week.map(d=>d.standby.p50)),`${days.length} year / ${week.length} holiday`]){const td=document.createElement('td');td.textContent=text;tr.append(td);}table.append(tr);
  }const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Compare year and Thanksgiving daily waits';details.append(summary,table);el('yearSummary').append(details);
}
async function loadComparison(archive=annualHistory[parkIds[plan.days[day].park]],token=generation) {
  if(!archive)return;const id=parkIds[plan.days[day].park],mode=el('comparison').value;
  profiles={};draw();renderSegments();
  const holiday=thanksgiving(+plan.days[day].date.slice(0,4)-1);
  let dates=mode==='date'?[el('historyDate').value]:mode==='thanksgiving'?Array.from({length:7},(_,i)=>shiftDate(holiday,i-3)):Array.from({length:6},(_,i)=>shiftDate(archive.end,-i));
  dates=dates.filter(d=>d&&d>=archive.start&&d<=archive.end);
  el('historicalSchedule').replaceChildren();
  if(!dates.length){profiles={};draw();renderSegments();el('historicalSchedule').textContent='Selected comparison is outside available history. Last Thanksgiving needs a key with year-long access.';return;}
  try {
    const documents=[];for(const date of dates){if(token!==generation)return;el('historicalSchedule').textContent=`Loading hourly comparison ${documents.length+1}/${dates.length}…`;const key=id+date;histories[key]??=await get(`entity/${id}/history?date=${date}`);documents.push({date,data:histories[key]});}
    if(token!==generation)return;
    profiles=PlannerAnalysis.analyze(documents,plan.days[day].date,plan.timezone,mode!=='date');draw();renderSegments();el('historicalSchedule').textContent=`Hourly comparison: ${dates.slice().sort()[0]}–${dates.slice().sort().at(-1)} · ${Object.keys(profiles).length} attractions. `+(mode==='date'?'Selected date only.':'Weekday/weekend matching applies.');
    // Historical schedules are evidence for planning, never confirmed future showtimes.
    const sample=dates[0],schedule=await get(`entity/${id}/schedule/${sample.slice(0,4)}/${sample.slice(5,7)}`);if(token!==generation)return;
    const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Historical operating hours and performances';details.append(summary);
    for(const slot of schedule.schedule||[]){if(!dates.includes(slot.date))continue;const p=document.createElement('p');p.textContent=`${slot.date}: ${slot.openingTime}–${slot.closingTime} (${slot.type})`;details.append(p);}
    for(const {date,data} of documents)for(const entity of data.entities||[]){const seen=new Set();for(const state of [entity.opening,...entity.history||[]])for(const show of state?.showtimes||[]){if(seen.has(show.startTime))continue;seen.add(show.startTime);const p=document.createElement('p');p.textContent=`${date} · ${entity.name}: ${show.startTime} (${show.type||'performance'})`;details.append(p);}}
    el('historicalSchedule').append(details);
  }catch(e){if(token===generation)el('historicalSchedule').textContent='Comparison unavailable: '+e.message;}
}
document.getElementById('divide').onclick=()=>{try{settings();renderSegments();}catch(e){el('selectionStatus').textContent=e.message;}};
document.getElementById('compare').onclick=()=>loadComparison();
