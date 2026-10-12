(function(root){
  function place(items,item,{start=480,end=1320,blocks=[],limits={},activities={},height=null}) {
    if(!Number.isInteger(item.start)||item.start%15!==0||!Number.isInteger(item.duration)||item.duration<15||item.duration%15!==0)throw Error('Use 15-minute start times and durations.');
    if(item.start<start||item.start+item.duration>end)throw Error('Activity must fit inside your visiting hours.');
    const remaining=items.filter(x=>x.id!==item.id);
    for(const block of [...blocks,...remaining.map(x=>({start:x.start,end:x.start+x.duration}))]) {
      if(item.start<block.end&&item.start+item.duration>block.start)throw Error('That time overlaps another activity or reservation.');
    }
    const activity=activities[item.activity];if(!activity)throw Error('Activity is no longer available in this park.');
    if(height!==null&&Number.isFinite(activity.height)&&activity.height>height)throw Error('Activity exceeds your selected rider height.');
    if(remaining.filter(x=>x.activity===item.activity).length)throw Error('Activity is already on this day’s calendar.');
    const count=remaining.filter(x=>activities[x.activity]?.category===activity.category).length;
    if(count>=(limits[activity.category]??Infinity))throw Error(activity.category+' has reached its daily maximum.');
    return [...remaining,item].sort((a,b)=>a.start-b.start);
  }
  const api={place};if(typeof module!=='undefined')module.exports=api;else root.CalendarCore=api;
})(globalThis);
