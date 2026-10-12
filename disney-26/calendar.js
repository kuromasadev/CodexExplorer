let websiteActivities=[],calendarItems=[],pickedActivity=null;
function activityCatalog() {
  const park=plan.days[day].park,choices=rows.filter(r=>r.Park===park),catalog={};
  for(const info of websiteActivities.filter(r=>r.Park===park)) {
    const websiteMatch=typeof locationDocument==='undefined'?null:locationDocument?.matches.find(m=>m.park===park&&m.kind==='website'&&m.websiteId===info['Website entity ID']&&m.entityId);
    const matches=choices.filter(r=>norm(r.Experience)===norm(info.Experience)||(websiteMatch&&locationDocument.matches.some(m=>m.park===park&&m.kind==='preference'&&m.name===r.Experience&&m.entityId===websiteMatch.entityId)));const choice=matches.length===1?matches[0]:null;
    const heightMatch=(info['Height tags']||'').match(/(\d+)-inches/);
    const key=info['Website entity ID'];
    catalog[key]={key,name:info.Experience,category:choice?category(choice):info.Summary.includes('Character')?'Character':info.Summary.includes('Show')?'Show':info.Summary.includes('Live Entertainment')?'Outside Show':/rides|spinning/i.test(info.Summary+' '+info.Tags)?'Ride':'Attraction',votes:choice?votes(choice):0,height:choice&&Number.isFinite(parseFloat(choice['Min height (in)']))?parseFloat(choice['Min height (in)']):heightMatch?+heightMatch[1]:NaN,info,choice};
  }
  for(const choice of choices) {
    if(Object.values(catalog).some(a=>a.choice===choice))continue;
    const key='choice:'+norm(choice.Experience);catalog[key]={key,name:choice.Experience,category:category(choice),votes:votes(choice),height:parseFloat(choice['Min height (in)']),info:null,choice};
  }return catalog;
}
function calendarConstraints() {
  const sections=daySections();
  const height=el('height').value===''?null:+el('height').value;
  if(height!==null&&(!Number.isFinite(height)||height<0))throw Error('Enter a valid rider height.');
  return {start:Math.max(480,timeMinutes(el('arrival').value)),end:Math.min(1320,timeMinutes(el('departure').value)),blocks:sections.filter(s=>s.fixed).map(s=>({start:s.start,end:s.end})),limits:readCategoryLimits(),activities:activityCatalog(),height};
}
function estimatedDuration(activity,start) {
  const entity=activity.choice?resolve(activity.choice):children.find(e=>norm(e.name)===norm(activity.name));
  const wait=(profiles[entity?.id]||[]).find(p=>p.hour===Math.floor(start/60))?.median;
  return {minutes:Math.max(15,Math.ceil((+el('walk').value+ +el('duration').value+(wait??0))/15)*15),wait};
}
function commitCalendar(activityKey,start,itemId=null,newDuration=null) {
  try {
    const constraints=calendarConstraints(),activity=constraints.activities[activityKey];if(!activity)throw Error('Choose an activity first.');
    const old=calendarItems.find(x=>x.id===itemId),estimate=estimatedDuration(activity,start);
    const item={id:itemId||crypto.randomUUID(),activity:activityKey,start,duration:newDuration??old?.duration??estimate.minutes};
    const updated=CalendarCore.place(calendarItems,item,constraints);calendarItems=updated;pickedActivity=null;settings();renderSegments();
    el('selectionStatus').textContent=activity.name+' scheduled at '+clock(start)+'. '+(estimate.wait===undefined?'Wait is unknown; adjust the estimated duration as needed.':'Duration includes an estimated '+estimate.wait+' minute wait.');
  }catch(e){el('selectionStatus').textContent=e.message;}
}
function thumbnail(activity) {
  const info=activity.info;if(!info)return null;
  const path=info['Thumbnail local']||info['Thumbnail URL'];if(!path)return null;
  const img=document.createElement('img');img.src=path;img.alt=info['Thumbnail alt']||activity.name;img.loading='lazy';img.onerror=()=>img.remove();return img;
}
function draggable(node,activity,id=null) {
  // Pointer dragging also works on touch devices and in embedded browsers.
  node.draggable=false;let origin=null,moved=false;
  node.onpointerdown=e=>{if(e.button!==0||e.target.closest('input')||(id&&e.target.closest('button')))return;origin={x:e.clientX,y:e.clientY};moved=false;node.setPointerCapture(e.pointerId);};
  node.onpointermove=e=>{if(!origin)return;if(Math.hypot(e.clientX-origin.x,e.clientY-origin.y)>6){moved=true;node.classList.add('dragging');}};
  node.onpointercancel=()=>{origin=null;node.classList.remove('dragging');};
  node.onpointerup=e=>{if(!origin)return;origin=null;node.classList.remove('dragging');if(!moved)return;e.preventDefault();const grid=el('segments').querySelector('.calendar-grid'),rect=grid.getBoundingClientRect();if(e.clientX>=rect.left&&e.clientX<=rect.right&&e.clientY>=rect.top&&e.clientY<rect.top+1568){commitCalendar(activity,480+Math.floor((e.clientY-rect.top)/28)*15,id);}else el('selectionStatus').textContent='Drop the activity inside the calendar time grid.';};
  node.addEventListener('click',e=>{if(moved){e.preventDefault();e.stopImmediatePropagation();moved=false;}},true);
}
function activityCard(activity) {
  const card=document.createElement('button');card.type='button';card.className='activity-card';card.draggable=true;
  const image=thumbnail(activity);if(image)card.append(image);
  const name=document.createElement('strong');name.textContent=activity.name;card.append(name);
  const details=document.createElement('small');details.textContent=`${activity.category} · ${activity.votes} family votes`;card.append(details);
  if(activity.info){const tags=document.createElement('small');tags.textContent=[activity.info.Summary,activity.info.Tags.split('|').slice(0,4).join(', ')].filter(Boolean).join(' · ').slice(0,160);card.append(tags);if(activity.info.Showtimes){const times=document.createElement('small');const showtimes=activity.info.Showtimes.split('|');times.textContent=`Snapshot ${activity.info['Schedule date']}: ${showtimes.slice(0,4).join(', ')}${showtimes.length>4?' · +'+(showtimes.length-4)+' more':''}`;times.title=showtimes.join(', ');card.append(times);}}
  card.onclick=()=>{pickedActivity=activity.key;el('selectionStatus').textContent='Choose a calendar time for '+activity.name+'.';};
  draggable(card,activity.key);return card;
}
function renderCalendar() {
  if(!plan)return;const host=el('segments');
  const viewState={search:host.querySelector('.activity-library input')?.value||'',category:host.querySelector('.activity-library select')?.value||'',cards:host.querySelector('.activity-library')?.scrollTop||0,time:host.querySelector('.calendar-viewport')?.scrollTop||0};
  host.replaceChildren();const catalog=activityCatalog();
  const layout=document.createElement('div');layout.className='calendar-layout';const library=document.createElement('aside');library.className='activity-library';
  const search=document.createElement('input');search.placeholder='Find activities or tags';search.setAttribute('aria-label','Search activity cards');
  const categoryFilter=document.createElement('select');categoryFilter.setAttribute('aria-label','Activity category');categoryFilter.append(new Option('All categories',''));for(const category of [...new Set(Object.values(catalog).map(a=>a.category))].sort())categoryFilter.append(new Option(category,category));
  search.value=viewState.search;categoryFilter.value=viewState.category;
  const cards=document.createElement('div');cards.className='activity-cards';
  const populate=()=>{cards.replaceChildren();for(const activity of Object.values(catalog).sort((a,b)=>b.votes-a.votes||a.name.localeCompare(b.name))){if(categoryFilter.value&&activity.category!==categoryFilter.value)continue;if(!`${activity.name} ${activity.info?.Tags||''}`.toLowerCase().includes(search.value.toLowerCase()))continue;cards.append(activityCard(activity));}};
  search.oninput=populate;categoryFilter.onchange=populate;library.append(search,categoryFilter,cards);populate();layout.append(library);
  const viewport=document.createElement('div');viewport.className='calendar-viewport';const grid=document.createElement('div');grid.className='calendar-grid';grid.setAttribute('aria-label','Daily calendar from 8 AM to 10 PM');
  let constraints;const issues=[];try{constraints=calendarConstraints();}catch(e){issues.push(e.message);}
  let sections=[];try{sections=daySections();}catch{}
  for(let start=480;start<1320;start+=15){const slot=document.createElement('button');slot.className='calendar-slot'+(start%60===0?' hour':'');slot.style.top=((start-480)/15*28)+'px';slot.textContent=clock(start);slot.setAttribute('aria-label','Schedule at '+clock(start));if(sections.some(s=>s.start===start))slot.classList.add('section-boundary');if(constraints&&(start<constraints.start||start>=constraints.end))slot.classList.add('outside-hours');slot.onclick=()=>{if(pickedActivity)commitCalendar(pickedActivity,start);};slot.ondragover=e=>{e.preventDefault();slot.classList.add('drop-target');};slot.ondragleave=()=>slot.classList.remove('drop-target');slot.ondrop=e=>{e.preventDefault();slot.classList.remove('drop-target');try{const payload=JSON.parse(e.dataTransfer.getData('application/json'));commitCalendar(payload.activity,start,payload.id);}catch{el('selectionStatus').textContent='Drag an activity card or calendar appointment.';}};grid.append(slot);}
  const endLabel=document.createElement('span');endLabel.className='calendar-end';endLabel.textContent='22:00';grid.append(endLabel);
  // Keep reservations visible even if their end time has not yet been supplied.
  const fixed=reservationData().filter(r=>r.date===plan.days[day].date).map(r=>({name:r.name,start:timeMinutes(r.start),end:r.end?timeMinutes(r.end):null}));
  const fixedKeys=new Set(fixed.map(b=>`${b.start}|${b.name}`));
  for(const section of sections.filter(s=>s.fixed)){if(!fixedKeys.has(`${section.fixed.start}|${section.fixed.name}`)){fixed.push(section.fixed);fixedKeys.add(`${section.fixed.start}|${section.fixed.name}`);}}
  for(const block of fixed){const box=document.createElement('div');box.className='calendar-appointment fixed';box.style.top=((block.start-480)/15*28)+'px';box.style.height=Math.max(28,((block.end??block.start+15)-block.start)/15*28)+'px';box.textContent=`${clock(block.start)}${block.end?'–'+clock(block.end):' · end unset'} ${block.name}`;grid.append(box);}
  for(const item of calendarItems){const activity=catalog[item.activity];if(!activity){issues.push('A saved activity is no longer in the catalog.');continue;}const box=document.createElement('div');box.className='calendar-appointment';box.style.top=((item.start-480)/15*28)+'px';box.style.height=(item.duration/15*28)+'px';draggable(box,item.activity,item.id);const title=document.createElement('strong');title.textContent=`${clock(item.start)}–${clock(item.start+item.duration)} ${activity.name}`;box.append(title);const duration=document.createElement('input');duration.type='number';duration.min='15';duration.step='15';duration.value=item.duration;duration.setAttribute('aria-label',activity.name+' duration in minutes');duration.onchange=()=>commitCalendar(item.activity,item.start,item.id,+duration.value);const remove=document.createElement('button');remove.textContent='Remove';remove.onclick=()=>{calendarItems=calendarItems.filter(x=>x.id!==item.id);settings();renderSegments();};box.append(duration,remove);grid.append(box);if(constraints){try{CalendarCore.place(calendarItems,item,constraints);}catch(e){issues.push(activity.name+': '+e.message);}}}
  viewport.append(grid);layout.append(viewport);host.append(layout);library.scrollTop=viewState.cards;viewport.scrollTop=viewState.time;
  const print=document.createElement('div');print.className='calendar-print';const printed=[...calendarItems.map(x=>({start:x.start,end:x.start+x.duration,name:catalog[x.activity]?.name||'Unknown activity'})),...fixed].sort((a,b)=>a.start-b.start);for(const item of printed){const p=document.createElement('p');p.textContent=`${clock(item.start)}–${item.end?clock(item.end):'end unset'} · ${item.name}`;print.append(p);}host.append(print);
  if(typeof syncMapCalendar==='function')syncMapCalendar();
  el('selectionStatus').textContent=issues.length?[...new Set(issues)].join(' '):'Drag a card to a time, or select a card and then select a time. Drag appointments to move them. Durations are editable estimates.';
}
function migrateSelections() {
  if(calendarItems.length)return;
  const catalog=activityCatalog();for(const [key,names] of Object.entries(manualSelections)){let start=+key.split('-')[0];for(const name of names){const activity=Object.values(catalog).find(a=>a.name===name);if(!activity)continue;const snapped=Math.ceil(start/15)*15,duration=estimatedDuration(activity,snapped).minutes;calendarItems.push({id:crypto.randomUUID(),activity:activity.key,start:snapped,duration});start=snapped+duration;}}
}
function normalizeCalendarKeys() {
  const catalog=activityCatalog();let changed=false;
  calendarItems=calendarItems.map(item=>{if(catalog[item.activity]||!item.activity.startsWith('choice:'))return item;const matches=Object.values(catalog).filter(a=>a.choice&&norm(a.choice.Experience)===item.activity.slice(7));if(matches.length!==1)return item;changed=true;return {...item,activity:matches[0].key};});
  if(changed)settings();
}
