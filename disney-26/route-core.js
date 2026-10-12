(function(root){
  const radians=n=>n*Math.PI/180;
  function distance(a,b){const x=radians(b[0]-a[0]),y=radians(b[1]-a[1]);return 6371000*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(x/2)**2+Math.cos(radians(a[0]))*Math.cos(radians(b[0]))*Math.sin(y/2)**2)));}
  function networkGraph(network){const adjacency={};for(const [a,b,meters,,,,direction] of network.edges){if(direction!==-1)(adjacency[a]??=[]).push([b,meters]);if(direction!==1)(adjacency[b]??=[]).push([a,meters]);}return {nodes:network.nodes,adjacency};}
  function nearest(graph,location,maxMeters=50){let best=null;for(const [id,point] of Object.entries(graph.nodes)){const meters=distance(point,location);if(meters<=maxMeters&&(!best||meters<best.meters))best={id,meters};}return best;}
  class Heap {constructor(){this.values=[];}push(value){const a=this.values;let i=a.length;a.push(value);while(i){const p=(i-1)>>1;if(a[p][0]<=value[0])break;a[i]=a[p];i=p;}a[i]=value;}pop(){const a=this.values,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1][0]<a[c][0])c++;if(a[c][0]>=last[0])break;a[i]=a[c];i=c;}a[i]=last;}return first;}get length(){return this.values.length;}}
  function shortest(graph,start,end){const heap=new Heap(),cost={[start]:0},previous={};heap.push([0,start]);while(heap.length){const [meters,id]=heap.pop();if(meters!==cost[id])continue;if(id===end){const ids=[id];while(ids.at(-1)!==start)ids.push(previous[ids.at(-1)]);return {meters,geometry:ids.reverse().map(n=>graph.nodes[n])};}for(const [next,weight] of graph.adjacency[id]||[]){const candidate=meters+weight;if(candidate<(cost[next]??Infinity)){cost[next]=candidate;previous[next]=id;heap.push([candidate,next]);}}}return null;}
  function route(graph,a,b,maxSnap=50){if(!a||!b)return {error:'Location unresolved'};
    const candidates=point=>Object.entries(graph.nodes).map(([id,p])=>({id,meters:distance(p,point)})).filter(n=>n.meters<=maxSnap).sort((a,b)=>a.meters-b.meters).slice(0,12);
    const starts=candidates(a),ends=candidates(b);if(!starts.length||!ends.length)return {error:'No pedestrian path within '+maxSnap+' m of the API location'};
    const pairs=starts.flatMap(start=>ends.map(end=>({start,end,offset:start.meters+end.meters}))).sort((a,b)=>a.offset-b.offset);
    for(const {start,end} of pairs){const path=shortest(graph,start.id,end.id);if(path)return {...path,snap:[start.meters,end.meters]};}
    return {error:'Pedestrian paths are disconnected'};
  }
  function summary(stops,leg,speed=65){const legs=stops.slice(1).map((stop,i)=>({...leg(stops[i],stop),from:stops[i],to:stop}));const complete=legs.every(l=>!l.error);return {legs,complete,meters:complete?legs.reduce((sum,l)=>sum+l.meters,0):null,minutes:complete?legs.reduce((sum,l)=>sum+l.meters/speed,0):null};}
  function simulate(order,{leg,speed=65,start,end,blocks=[],wait,service}){
    let time=start,last=null,walking=0,waiting=0;const scheduled=[],warnings=[];
    for(const stop of order){let travel=0;if(last){const path=leg(last,stop);if(path.error)return {feasible:false,error:path.error};travel=path.meters/speed;walking+=travel;}
      let visit=time+travel;
      if(stop.fixed){if(visit>stop.start)return {feasible:false,error:'Cannot reach fixed stop in time'};visit=stop.start;}
      else {
        for(const block of blocks){if(visit<block.end&&visit+service(stop)+ (wait(stop,visit)??0)>block.start)visit=block.end;}
      }
      if(!stop.fixed)visit=Math.ceil(visit/15)*15;
      const expected=wait(stop,visit);if(!stop.fixed&&expected===null)warnings.push(stop.name+': predicted wait unavailable');
      const duration=stop.fixed?stop.duration:Math.ceil((service(stop)+(expected??0))/15)*15;
      if(visit+duration>end)return {feasible:false,error:'Sequence exceeds departure time'};
      if(!stop.fixed&&blocks.some(b=>visit<b.end&&visit+duration>b.start))return {feasible:false,error:'Sequence conflicts with a reservation'};
      waiting+=stop.fixed?0:expected??0;scheduled.push({...stop,start:visit,duration,wait:expected,travel});time=visit+duration;last=stop;
    }
    return {feasible:true,scheduled,walking,waiting,score:walking+waiting,warnings};
  }
  function optimize(order,options){let bestOrder=[...order],best=simulate(bestOrder,options);let changed=true,rounds=0;
    // Local search within fixed-anchor partitions; fixed/show stops never move.
    while(changed&&rounds++<8){changed=false;for(let i=0;i<bestOrder.length;i++){if(bestOrder[i].fixed)continue;for(let j=i+1;j<bestOrder.length&&!bestOrder[j].fixed;j++){const candidate=[...bestOrder];[candidate[i],candidate[j]]=[candidate[j],candidate[i]];const result=simulate(candidate,options);if(result.feasible&&(!best.feasible||result.score<best.score-.01)){bestOrder=candidate;best=result;changed=true;}}}}
    return {...best,order:bestOrder};
  }
  const api={distance,networkGraph,nearest,shortest,route,summary,simulate,optimize};if(typeof module!=='undefined')module.exports=api;else root.RouteCore=api;
})(globalThis);
