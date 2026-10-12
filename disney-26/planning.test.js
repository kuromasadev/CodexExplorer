const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const elements={};
function element(){return {value:'',textContent:'',children:[],dataset:{},append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},querySelectorAll(){return this.children.flatMap(x=>x.children||[]);},setAttribute(){}};}
const calls=[];
const context=vm.createContext({console,Intl,Date,URL,Set,Map,Option:function(text,value){this.textContent=text;this.value=value;},document:{getElementById:id=>elements[id]??=element(),createElement:element},el:id=>elements[id]??=element(),plan:{timezone:'America/New_York',days:[{date:'2026-11-24',park:'Park'}]},day:0,generation:1,parkIds:{Park:'park'},rows:[{Park:'Park',Experience:'Ride','Transcription note':'Ride'}],profiles:{},histories:{},votes:()=>3,resolve:()=>({id:'ride'}),clock:m=>String(m),settings:()=>{},draw:()=>{},reservationBlocks:()=>[],renderCalendar:()=>{},PlannerAnalysis:require('./analysis.js')});
vm.runInContext(fs.readFileSync(__dirname+'/planning.js','utf8'),context);
elements.arrival=Object.assign(element(),{value:'09:00'});elements.departure=Object.assign(element(),{value:'18:00'});elements.blocks=Object.assign(element(),{value:'14:00-15:00 | Boutique'});elements.timepoints=Object.assign(element(),{value:'12:00, 16:00'});
for(const id of ['walk','duration','height','comparison'])elements[id]=Object.assign(element(),{value:id==='comparison'?'recent':id==='walk'?'10':id==='duration'?'15':''});
const sections=vm.runInContext('daySections()',context);
assert.equal(sections.length,5);
assert.equal(sections.find(s=>s.fixed).start,840);
elements.blocks.value='14:00-15:00 | A\n14:30-16:00 | B';assert.throws(()=>vm.runInContext('daySections()',context),/overlap/);
elements.blocks.value='';elements.timepoints.value='19:00';assert.throws(()=>vm.runInContext('daySections()',context),/between/);elements.timepoints.value='12:00, 15:00';
assert.equal(vm.runInContext('thanksgiving(2025)',context),'2025-11-27');
assert.equal(vm.runInContext('category(rows[0])',context),'Ride');
vm.runInContext('renderCategories({Ride:0})',context);assert.equal(vm.runInContext('readCategoryLimits().Ride',context),0);
context.get=async path=>{
  calls.push(path);
  if(path.includes('/history/daily')) {
    if(calls.filter(x=>x.includes('/history/daily')).length===1){const error=Error('window');error.status=403;error.data={error:{earliestAllowedDate:'2026-10-05'}};throw error;}
    const second=calls.filter(x=>x.includes('/history/daily')).length===2;
    return {range:{from:second?'2026-10-05':'2026-10-08'},entities:[{id:'ride',name:'Ride',days:[{date:second?'2026-10-05':'2026-10-08',standby:{p50:20}}]}],next:second?'https://api.themeparks.wiki/v1/entity/park/history/daily?from=2026-10-08&to=2026-10-10':null};
  }
  if(path.includes('/history?'))return {entities:[]};
  return {schedule:[]};
};
(async()=>{await vm.runInContext('loadYearHistory()',context);assert(calls[0].includes('/history/daily?from='));assert(calls[1].includes('from=2026-10-05'));assert.match(elements.historyStatus.textContent,/API access limits/);assert.equal(elements.history.disabled,false);elements.comparison.value='thanksgiving';await vm.runInContext('loadComparison()',context);assert.match(elements.historicalSchedule.textContent,/outside available history/);console.log('CSV categories, time sections, conflicts, Thanksgiving dates and API-window fallback passed.');})().catch(e=>{console.error(e);process.exitCode=1;});
