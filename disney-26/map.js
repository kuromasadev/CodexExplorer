let locationDocument=null,parkMap=null,mapMarkers=null,mapRoutes=null,routeGraph=null,routeNetwork=null,routeOrder=[],routeProposal=null,mapDay=null,mapCalendarSignature='';
let locationOverrides={};try{locationOverrides=JSON.parse(localStorage.getItem('planner-location-overrides')||'{}');}catch{}
const locationKey=key=>plan.days[day].park+'|'+key;
function validLocation(location){return location&&Number.isFinite(location.latitude)&&Number.isFinite(location.longitude)&&location.latitude>28.3&&location.latitude<28.5&&location.longitude> -81.65&&location.longitude< -81.45;}
function matchedEntity(activity){
  const park=locationDocument?.parks[plan.days[day].park];if(!park)return null;
  const override=locationOverrides[locationKey(activity.key)];
  if(override)return park.entities.find(e=>e.id===override.entityId)||null;
  const matches=locationDocument.matches.filter(r=>r.park===plan.days[day].park&&r.entityId&&((activity.info&&r.kind==='website'&&r.websiteId===activity.info['Website entity ID'])||(activity.choice&&r.kind==='preference'&&r.name===activity.choice.Experience)));
  const ids=[...new Set(matches.map(r=>r.entityId))];return ids.length===1?park.entities.find(e=>e.id===ids[0]):null;
}
function locationFor(activity){const entity=matchedEntity(activity);return validLocation(entity?.location)?[entity.location.latitude,entity.location.longitude]:null;}
function persistOverride(key,entity){locationOverrides[locationKey(key)]={entityId:entity.id,location:entity.location,verifiedAt:locationDocument.verifiedAt,identityConfirmedAt:new Date().toISOString(),source:locationDocument.source};localStorage.setItem('planner-location-overrides',JSON.stringify(locationOverrides));}
function syncMapCalendar(){
  const signature=JSON.stringify(calendarItems);if(signature!==mapCalendarSignature){mapCalendarSignature=signature;routeProposal=null;}
  el('mapTab').disabled=!calendarItems.length;
  if(!calendarItems.length)showPlanTab('calendar');
  if(mapDay!==plan.days[day].date){mapDay=plan.days[day].date;routeGraph=null;routeNetwork=null;routeOrder=[];routeProposal=null;}
  if(!el('mapPanel').hidden)renderMap();
}
function showPlanTab(name){el('calendarPanel').hidden=name!=='calendar';el('mapPanel').hidden=name!=='map';el('calendarTab').classList.toggle('active',name==='calendar');el('mapTab').classList.toggle('active',name==='map');if(name==='map')renderMap();}
let leafletPromise=null;
function loadLeaflet(){
  if(window.L)return Promise.resolve();
  return leafletPromise??=new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.append(link);const script=document.createElement('script');script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';script.onload=resolve;script.onerror=()=>{leafletPromise=null;reject(Error('Leaflet could not load. Retry when online.'));};document.head.append(script);});
}
function dayStops(){
  const catalog=activityCatalog(),stops=calendarItems.map(item=>{const activity=catalog[item.activity],entity=activity&&matchedEntity(activity);return {...item,key:item.activity,name:activity?.name||'Unknown activity',activityData:activity,entityId:entity?.id,location:activity&&locationFor(activity),fixed:entity?.entityType==='SHOW'||activity?.category.includes('Show'),reservation:false};});
  let blocks=[];try{blocks=daySections().filter(s=>s.fixed).map(s=>s.fixed);}catch(e){el('routeStatus').textContent=e.message;}
  const seen=new Set();for(const block of blocks){const id='reservation:'+block.start+':'+block.name;if(seen.has(id))continue;seen.add(id);const key=locationKey(id),override=locationOverrides[key],entity=locationDocument?.parks[plan.days[day].park]?.entities.find(e=>e.id===override?.entityId);stops.push({id,key:id,name:block.name,start:block.start,duration:block.end-block.start,fixed:true,reservation:true,entityId:entity?.id,location:validLocation(entity?.location)?[entity.location.latitude,entity.location.longitude]:null});}
  return stops.sort((a,b)=>a.start-b.start);
}
function matchControl(key,selected=null){
  const select=document.createElement('select');select.setAttribute('aria-label','Verify location for '+key);select.append(new Option('Choose the matching API entity…',''));
  const park=locationDocument?.parks[plan.days[day].park];for(const entity of (park?.entities||[]).filter(e=>validLocation(e.location)).sort((a,b)=>a.name.localeCompare(b.name)))select.append(new Option(entity.name,entity.id));select.value=selected||'';
  select.onchange=()=>{if(!select.value){locationOverrides[locationKey(key)]={entityId:null};localStorage.setItem('planner-location-overrides',JSON.stringify(locationOverrides));}else{const entity=park.entities.find(e=>e.id===select.value);persistOverride(key,entity);}routeProposal=null;renderMap();};return select;
}
async function renderMap(){
  if(!calendarItems.length)return;const token=generation;
  try{if(!locationDocument){const response=await fetch('./entity-locations.json');if(!response.ok)throw Error('Verified location dataset unavailable. Run build_locations.py with the server running.');locationDocument=await response.json();}await loadLeaflet();if(token!==generation||el('mapPanel').hidden)return;
    const L=window.L;if(!parkMap){parkMap=L.map('parkMap').setView([28.4,-81.58],16);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(parkMap);mapMarkers=L.layerGroup().addTo(parkMap);mapRoutes=L.layerGroup().addTo(parkMap);}parkMap.invalidateSize();mapMarkers.clearLayers();mapRoutes.clearLayers();
    const stops=dayStops(),bounds=[];el('locationMatches').replaceChildren();
    stops.forEach((stop,index)=>{if(stop.location){bounds.push(stop.location);const popup=document.createElement('div'),title=document.createElement('strong');title.textContent=stop.name;popup.append(title);const schedule=document.createElement('p');schedule.textContent=`Scheduled ${clock(stop.start)}–${clock(stop.start+stop.duration)}`;popup.append(schedule);if(stop.activityData?.choice){const preferences=document.createElement('p');preferences.textContent=['Alberto','Aria','Me'].map(p=>(p==='Me'?'Kristina':p)+': '+(stop.activityData.choice[p]==='Yes'?'Selected':'Unknown')).join(' · ');popup.append(preferences);}const wait=document.createElement('p');const current=live[stop.entityId];wait.textContent=`Live standby: ${Number.isFinite(current?.queue?.STANDBY?.waitTime)?current.queue.STANDBY.waitTime+' min':'Unavailable'} · ${current?.status||'No current status'}`;popup.append(wait);const source=document.createElement('small');source.textContent='API location; entrance not verified. '+stop.entityId;popup.append(source);L.marker(stop.location,{title:stop.name,alt:stop.name}).bindPopup(popup).bindTooltip((index+1)+'. '+stop.name).addTo(mapMarkers);}const row=document.createElement('p');row.textContent=stop.name+' · '+(stop.location?'API coordinates stored':'Location unresolved')+' ';row.append(matchControl(stop.key,stop.entityId));el('locationMatches').append(row);});
    if(bounds.length)parkMap.fitBounds(bounds,{padding:[30,30],maxZoom:17});
    const preferences=locationDocument.matches.filter(r=>r.kind==='preference');el('mapStatus').textContent=`${stops.filter(s=>s.location).length}/${stops.length} scheduled stops located. ${preferences.filter(r=>r.entityId).length}/${preferences.length} preference rows matched across all parks. API snapshot: ${new Date(locationDocument.verifiedAt).toLocaleString()}.`;
    const ids=new Set(stops.map(s=>s.id));routeOrder=routeOrder.filter(id=>ids.has(id));for(const stop of stops)if(!routeOrder.includes(stop.id))routeOrder.push(stop.id);renderRoute();
  }catch(e){if(token===generation)el('mapStatus').textContent=e.message;}
}
const routeCache=new Map();
function leg(a,b){if(!routeGraph)return {error:'Load the pedestrian network first'};const key=JSON.stringify([a.location,b.location]);if(!routeCache.has(key))routeCache.set(key,RouteCore.route(routeGraph,a.location,b.location));return routeCache.get(key);}
function routeOptions(){
  const speed=+el('walkingSpeed').value;if(!Number.isFinite(speed)||speed<20||speed>120)throw Error('Walking speed must be 20–120 meters per minute.');
  const constraints=calendarConstraints();
  return {leg,speed,start:constraints.start,end:constraints.end,blocks:constraints.blocks,wait:(stop,minute)=>{if(stop.fixed)return 0;return (profiles[stop.entityId]||[]).find(p=>p.hour===Math.floor(minute/60))?.median??null;},service:stop=>{
    // Calendar allocations include the original walking buffer; replace that with network travel.
    const oldWait=(profiles[stop.entityId]||[]).find(p=>p.hour===Math.floor(stop.start/60))?.median??0;
    return Math.max(15,stop.duration-(+el('walk').value)-oldWait);
  }};
}
function orderedStops(){const byId=Object.fromEntries(dayStops().map(s=>[s.id,s]));return routeOrder.map(id=>byId[id]).filter(Boolean);}
function moveStop(id,targetId){const order=orderedStops(),from=order.findIndex(s=>s.id===id),to=order.findIndex(s=>s.id===targetId);if(from<0||to<0||order[from].fixed||order[to].fixed)return;const low=Math.min(from,to),high=Math.max(from,to);if(order.slice(low,high+1).some(s=>s.fixed)){el('routeStatus').textContent='Reorder attractions within the same fixed-show or reservation window.';return;}routeOrder.splice(to,0,routeOrder.splice(from,1)[0]);routeProposal=null;renderRoute();}
function routeDrag(node,id){let origin=null,moved=false;node.onpointerdown=e=>{if(e.target.closest('button'))return;origin=[e.clientX,e.clientY];node.setPointerCapture(e.pointerId);};node.onpointermove=e=>{if(origin&&Math.hypot(e.clientX-origin[0],e.clientY-origin[1])>6){moved=true;node.classList.add('dragging');}};node.onpointerup=e=>{if(!origin)return;origin=null;node.classList.remove('dragging');if(moved){const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-stop-id]');if(target)moveStop(id,target.dataset.stopId);}moved=false;};node.onpointercancel=()=>{origin=null;moved=false;};}
function renderRoute(){
  const order=orderedStops();el('routeStops').replaceChildren();mapRoutes?.clearLayers();
  order.forEach((stop,index)=>{const row=document.createElement('div');row.className='route-stop';row.dataset.stopId=stop.id;const text=document.createElement('span');text.textContent=`${index+1}. ${stop.name} · Calendar slot ${clock(stop.start)}${stop.fixed?' · Fixed anchor':''}`;row.append(text);if(!stop.fixed){routeDrag(row,stop.id);for(const [name,offset] of [['Move earlier',-1],['Move later',1]]){const button=document.createElement('button');button.textContent=name;button.onclick=()=>{if(order[index+offset])moveStop(stop.id,order[index+offset].id);};row.append(button);}}el('routeStops').append(row);});
  if(!routeGraph){el('routeStatus').textContent='Load walking paths to calculate distances. No straight-line routes are used.';el('routeLegs').replaceChildren();return;}
  try{const options=routeOptions(),current=RouteCore.summary(dayStops(),leg,options.speed),result=RouteCore.summary(order,leg,options.speed);el('routeLegs').replaceChildren();
    for(const path of result.legs){const p=document.createElement('p');p.textContent=`${path.from.name} → ${path.to.name}: `+(path.error?path.error:`${Math.round(path.meters)} m · ${(path.meters/options.speed).toFixed(1)} min · path offsets ${path.snap.map(x=>Math.round(x)).join('/')} m`);el('routeLegs').append(p);if(!path.error&&path.geometry.length>1)window.L.polyline(path.geometry,{color:'#12577a',weight:4}).addTo(mapRoutes);}
    const baseline=current.complete?`${Math.round(current.meters)} m / ${current.minutes.toFixed(1)} min`:'incomplete';el('routeStatus').textContent=result.complete?`Calendar order: ${baseline}. Proposed order: ${Math.round(result.meters)} m / ${result.minutes.toFixed(1)} min. Travel between mapped paths only; path offsets and entrance/exit travel are excluded.`:'Route incomplete; total walking time and optimization are unavailable until missing locations or paths are resolved.';
    const preview=result.complete?RouteCore.simulate(order,options):null;
    el('suggestOrder').disabled=!result.complete;el('applyOrder').disabled=!preview?.feasible;
    if(preview?.feasible){const heading=document.createElement('h4');heading.textContent='Schedule preview (calendar unchanged until applied)';el('routeLegs').append(heading);for(const stop of preview.scheduled){const p=document.createElement('p');p.textContent=`${clock(stop.start)}–${clock(stop.start+stop.duration)} · ${stop.name}${stop.fixed?' · Fixed anchor':''}`;el('routeLegs').append(p);}if(preview.warnings.length){const p=document.createElement('p');p.textContent='Queue estimate incomplete: '+preview.warnings.join(' · ');el('routeLegs').append(p);}}
    else if(preview){const p=document.createElement('p');p.textContent='Sequence cannot be applied: '+preview.error;el('routeLegs').append(p);}
    if(routeProposal?.feasible){const note=document.createElement('p');note.textContent=`Suggested sequence: ${routeProposal.walking.toFixed(1)} walking min + ${routeProposal.waiting.toFixed(1)} estimated queue min. ${routeProposal.warnings.join(' · ')}`;el('routeLegs').append(note);}
  }catch(e){el('routeStatus').textContent=e.message;}
}
async function loadWalking(){const token=generation;el('loadWalking').disabled=true;el('routeStatus').textContent='Loading mapped pedestrian paths…';try{const id=parkIds[plan.days[day].park]||locationDocument.parks[plan.days[day].park].id;routeNetwork=await get('walk-network/'+id);if(token!==generation)return;routeGraph=RouteCore.networkGraph(routeNetwork);routeCache.clear();renderRoute();el('networkStatus').textContent=`OpenStreetMap pedestrian network · ${Object.keys(routeNetwork.nodes).length} nodes · data timestamp ${routeNetwork.osmTimestamp||'unavailable'}. Public/customer paths only; mapped access may change.`;}catch(e){if(token===generation)el('routeStatus').textContent=e.message;}finally{el('loadWalking').disabled=false;}}
function suggestSequence(){try{const result=RouteCore.optimize(orderedStops(),routeOptions());if(!result.feasible)throw Error(result.error);routeProposal=result;routeOrder=result.order.map(s=>s.id);renderRoute();}catch(e){el('routeStatus').textContent='No feasible suggestion: '+e.message;}}
function applySequence(){try{const options=routeOptions(),result=RouteCore.simulate(orderedStops(),options);if(!result.feasible)throw Error(result.error);const constraints=calendarConstraints();let updated=[];for(const stop of result.scheduled.filter(s=>!s.reservation)){const original=calendarItems.find(i=>i.id===stop.id);const item={...original,start:stop.start,duration:stop.duration};updated=CalendarCore.place(updated,item,constraints);}calendarItems=updated;settings();routeProposal=null;renderCalendar();renderMap();el('routeStatus').textContent='Suggested times applied to the calendar.';}catch(e){el('routeStatus').textContent='Calendar unchanged: '+e.message;}}
elSafe('calendarTab',()=>showPlanTab('calendar'));elSafe('mapTab',()=>showPlanTab('map'));elSafe('loadWalking',loadWalking);elSafe('suggestOrder',suggestSequence);elSafe('applyOrder',applySequence);elSafe('resetOrder',()=>{routeOrder=dayStops().map(s=>s.id);routeProposal=null;renderRoute();});
function elSafe(id,handler){document.getElementById(id).onclick=handler;}
document.getElementById('walkingSpeed').onchange=()=>{routeProposal=null;renderRoute();};
