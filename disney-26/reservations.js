// Reservation details live only in imported files and this browser's storage.
function reservationData() {
  try {return JSON.parse(localStorage.getItem('planner-reservations')||'[]');}catch{return [];}
}
function validateReservations(data) {
  if(!Array.isArray(data))throw Error('Reservation file must contain a JSON array.');
  return data.map(r=>{
    if(!r||typeof r.name!=='string'||!r.name.trim()||/[\r\n|]/.test(r.name)||!/^\d{4}-\d{2}-\d{2}$/.test(r.date))throw Error('Each reservation needs a date, name and start time.');
    if(new Date(r.date+'T12:00:00Z').toISOString().slice(0,10)!==r.date)throw Error('Invalid reservation date.');
    timeMinutes(r.start);
    if(r.end){if(timeMinutes(r.end)<=timeMinutes(r.start))throw Error('Reservation end must be after its start.');}
    return {date:r.date,name:r.name.trim(),start:r.start,end:r.end||null};
  });
}
function reservationBlocks() {
  const today=reservationData().filter(r=>r.date===plan.days[day].date);
  if(today.some(r=>!r.end))throw Error('Set a planning end time for each imported reservation before building or dividing this day.');
  return today.map(r=>({start:timeMinutes(r.start),end:timeMinutes(r.end),name:r.name}));
}
function renderReservations() {
  const data=reservationData();el('reservations').replaceChildren();
  data.forEach((r,index)=>{
    if(r.date!==plan.days[day].date)return;
    const line=document.createElement('p'),text=document.createElement('span');text.textContent=`${r.name} · ${r.start} start · ${r.end? r.end+' planning end':'end time unset'} `;line.append(text);
    for(const field of ['start','end']) {
      const label=document.createElement('label');label.textContent=field==='start'?'Start ':'Planning end (estimate) ';
      const input=document.createElement('input');input.type='time';input.value=r[field]||'';input.onchange=()=>{
        try{const updated=data.map((v,i)=>i===index?{...v,[field]:input.value||null}:v);localStorage.setItem('planner-reservations',JSON.stringify(validateReservations(updated)));el('itinerary').textContent='Reservations changed. Build itinerary again.';renderReservations();renderSegments();}catch(e){el('reservationStatus').textContent=e.message;}
      };label.append(input);line.append(label);
    }
    const remove=document.createElement('button');remove.textContent='Remove';remove.onclick=()=>{data.splice(index,1);localStorage.setItem('planner-reservations',JSON.stringify(data));renderReservations();renderSegments();el('itinerary').textContent='Reservations changed. Build itinerary again.';};line.append(remove);el('reservations').append(line);
  });
  el('reservationStatus').textContent=data.length?'Imported reservations are stored in this browser. End times are planning estimates; they are not confirmed booking details.':'Import your reservation file. No reservation details are embedded in the app.';
}
document.getElementById('reservationImport').onchange=async event=>{
  try {
    const file=event.target.files[0];if(!file)return;
    const imported=validateReservations(JSON.parse(await file.text()));
    const data=reservationData();for(const r of imported){const index=data.findIndex(v=>v.date===r.date&&v.name===r.name&&v.start===r.start);if(index<0)data.push(r);}
    localStorage.setItem('planner-reservations',JSON.stringify(data));renderReservations();renderSegments();el('itinerary').textContent='Reservations imported. Set planning end times, then build itinerary again.';
  }catch(e){el('reservationStatus').textContent='Import failed: '+e.message;}finally{event.target.value='';}
};
