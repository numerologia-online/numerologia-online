const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const pages = ['index.html', 'year/index.html', 'pro/index.html',
  'child/index.html', 'moment/index.html', 'moment/yes-no/index.html'];
const setting = fs.readFileSync('analytics-settings.html', 'utf8');
const script = setting.match(/<script>([\s\S]*?)<\/script>/)[1];

function env(){
  const saved = new Map(), session = new Map();
  const elements = new Map();
  const el = id => ({id, textContent:'', attrs:{}, listeners:{},
    setAttribute(k,v){this.attrs[k]=v;},
    addEventListener(k,fn){this.listeners[k]=fn;},
    click(){this.listeners.click();}});
  for(const id of ['analytics-status','analytics-allow','analytics-deny','analytics-message'])
    elements.set(id, el(id));
  const localStorage = {getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)};
  const sessionStorage = {removeItem:k=>session.delete(k),setItem:(k,v)=>session.set(k,v)};
  const context = {localStorage,sessionStorage,navigator:{doNotTrack:'0',globalPrivacyControl:false},
    document:{getElementById:id=>elements.get(id)}};
  vm.runInNewContext(script,context);
  return {saved,session,elements,context};
}

test('settings are off by default, and allow/deny can be reversed',()=>{
  const e=env();
  assert.match(e.elements.get('analytics-status').textContent,/отключена/);
  e.elements.get('analytics-allow').click();
  assert.equal(e.saved.get('numi_analytics_permission'),'allow');
  assert.equal(e.elements.get('analytics-allow').attrs['aria-pressed'],'true');
  for(const k of ['ni2_session','ni2_source','ni2_campaign'])e.session.set(k,'test');
  e.elements.get('analytics-deny').click();
  assert.equal(e.saved.get('numi_analytics_permission'),'deny');
  assert.equal(e.session.size,0);
});

test('all page analytics bootstraps refuse collection until permission',()=>{
  for(const page of pages){
    const source=fs.readFileSync(page,'utf8');
    const bootstrap=source.match(/<!-- Numi Insights v2: independent background collector -->\s*<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(bootstrap,'missing bootstrap on '+page);
    assert.match(bootstrap,/numi_analytics_permission/);
    function count(permission,dnt='0',gpc=false){
      let attached=0;
      const context={
        localStorage:{getItem:()=>permission},
        navigator:{doNotTrack:dnt,globalPrivacyControl:gpc},
        document:{readyState:'complete',head:{append:()=>attached++},createElement:()=>({}),
          addEventListener:()=>{}},
        window:{requestIdleCallback:(cb)=>cb()},
        setTimeout:(cb)=>cb()
      };
      vm.runInNewContext(bootstrap,context);
      return attached;
    }
    assert.equal(count(null),0,page+' collected before consent');
    assert.equal(count('deny'),0,page+' collected despite denial');
    assert.equal(count('allow'),1,page+' did not load after permission');
    assert.equal(count('allow','1'),0,page+' ignored DNT');
    assert.equal(count('allow','0',true),0,page+' ignored GPC');
  }
});
