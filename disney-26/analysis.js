(function(root) {
  const local = (time, zone) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone:zone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(time)).map(p=>[p.type,p.value]));
  function quantile(samples, q) {
    const sorted = [...samples].sort((a,b)=>a.wait-b.wait);
    const total = sorted.reduce((s,x)=>s+x.minutes,0);
    let sum=0;
    for (const sample of sorted) {sum+=sample.minutes;if(sum>=total*q)return sample.wait;}
    return null;
  }
  function analyze(documents, targetDate, zone='America/New_York') {
    const buckets = new Map();
    const weekday = date=>new Date(date+'T12:00:00Z').getUTCDay();
    const comparable = date=>[0,6].includes(weekday(date))===[0,6].includes(weekday(targetDate));
    for (const {date,data} of documents) {
      if (!comparable(date)) continue;
      for (const entity of data.entities||[]) {
        const opening=entity.opening||{};
        let queueSeen=opening.observedAtByKind?.['queue.STANDBY'];
        let statusSeen=opening.observedAtByKind?.status;
        const states=[opening,...entity.history||[]].filter(x=>x.time).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
        for(let i=0;i<states.length;i++) {
          const state=states[i];
          const start=Date.parse(state.time);
          if((state.changed||[]).some(k=>k.startsWith('queue.STANDBY')))queueSeen=state.time;
          if((state.changed||[]).includes('status'))statusSeen=state.time;
          const wait=state.queue?.STANDBY?.waitTime;
          if(state.status!=='OPERATING'||typeof wait!=='number'||wait<0||wait>600||!queueSeen||!statusSeen||opening.degraded)continue;
          // Conservative freshness cap; never extrapolate an unchanged feed indefinitely.
          const end=Math.min(states[i+1]?.time ? Date.parse(states[i+1].time) : start+4*3600000,Date.parse(queueSeen)+4*3600000,Date.parse(statusSeen)+24*3600000);
          for(let t=start;t<end;) {
            const next=Math.min(end,(Math.floor(t/3600000)+1)*3600000);
            const p=local(t,zone),day=`${p.year}-${p.month}-${p.day}`;
            if(day===date) {
              const key=entity.id+'|'+p.hour;
              if(!buckets.has(key))buckets.set(key,{id:entity.id,hour:+p.hour,samples:[],dates:new Set()});
              const b=buckets.get(key);b.samples.push({wait,minutes:(next-t)/60000});b.dates.add(date);
            }
            t=next;
          }
        }
      }
    }
    const result={};
    for(const b of buckets.values()) {
      const minutes=b.samples.reduce((s,x)=>s+x.minutes,0);
      if(minutes<30)continue;
      (result[b.id]??=[]).push({hour:b.hour,p10:quantile(b.samples,.1),median:quantile(b.samples,.5),p90:quantile(b.samples,.9),days:b.dates.size,minutes:Math.round(minutes)});
    }
    return result;
  }
  function itinerary(candidates, profiles, {start,end,blocks=[],walk=10,duration=15,height=null}) {
    const sortedBlocks=[...blocks].sort((a,b)=>a.start-b.start);
    const items=[];const remaining=[...candidates];let time=start;
    while(time<end&&remaining.length) {
      const active=sortedBlocks.find(b=>time>=b.start&&time<b.end);
      if(active){time=active.end;continue;}
      const nextBlock=sortedBlocks.find(b=>b.start>=time);
      const limit=Math.min(end,nextBlock?.start??end);
      const options=remaining.map(r=>{
        const profile=(profiles[r.id]||[]).find(p=>p.hour===Math.floor((time+walk)/60));
        return {r,profile,finish:time+walk+duration+(profile?.median??0)};
      }).filter(x=>x.profile&&x.finish<=limit&&(height===null||!Number.isFinite(x.r.height)||x.r.height<=height))
        .sort((a,b)=>b.r.votes-a.r.votes||a.profile.median-b.profile.median);
      if(!options.length){time=Math.min(limit, (Math.floor(time/60)+1)*60);continue;}
      const {r,profile,finish}=options[0];items.push({start:time,end:finish,name:r.name,wait:profile.median,range:[profile.p10,profile.p90],days:profile.days});
      remaining.splice(remaining.indexOf(r),1);time=finish;
    }
    return {items:[...items,...sortedBlocks.map(b=>({...b,fixed:true}))].sort((a,b)=>a.start-b.start),remaining};
  }
  const exports={analyze,itinerary,quantile};
  if(typeof module!=='undefined')module.exports=exports;else root.PlannerAnalysis=exports;
})(globalThis);
