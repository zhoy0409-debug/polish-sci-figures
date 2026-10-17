/* Actual local editor, controlled status text only; no project or save-state transport claims. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const H=require('./test_studio_carbon_helpers.cjs');
const url=H.localUrl(process.env.STUDIO_THEME_URL||'http://127.0.0.1:18961/');
const statuses={
 en:{saved:'Saved locally',saving:'Saving the current project…',error:'Autosave failed · Download the current project backup before closing',conflict:'Another window updated this project · Download the current project first'},
 'zh-CN':{saved:'已自动保存 · 含撤销记录',saving:'正在保存当前工程…',error:'自动保存失败 · 请下载当前工程备份后再关闭',conflict:'其他窗口已更新此工程 · 请先下载当前工程备份'},
};
async function main(){
 const browser=await chromium.launch({headless:true,...(process.env.STUDIO_BROWSER?{executablePath:process.env.STUDIO_BROWSER}:{channel:'chrome'})});
 const out=path.resolve(process.env.STUDIO_HEADER_PROOF_DIR||'.cache/carbon-qa/header-layout-final');fs.mkdirSync(out,{recursive:true});
 const targetLabel=process.env.STUDIO_HEADER_TARGET_LABEL||'source editor';
 const report={schema:'figure-studio-header-layout/1',targetLabel,scope:'Actual '+targetLabel+' with controlled bilingual save-status text; layout and keyboard reachability, not induced autosave failures',generatedUTC:new Date().toISOString(),browser:browser.version(),cases:[],errors:[],remoteRequests:[]};
 try{
  for(const [width,height]of [[1280,720],[1440,900],[1920,1080]]){
   const {context,page,remote,errors}=await H.browserPage(browser,{viewport:{width,height}});
   await page.goto(url);await H.dismiss(page);await page.waitForTimeout(250);
   const servedBuild=await page.evaluate(()=>{const info=JSON.parse(document.getElementById('local-engine').textContent).updateInfo;return {currentVersion:info.currentVersion,suiteVersion:info.suiteVersion,platform:info.platform};});
   if(process.env.STUDIO_HEADER_EXPECT_VERSION)assert.equal(servedBuild.currentVersion,process.env.STUDIO_HEADER_EXPECT_VERSION);
   report.servedBuild=servedBuild;
   for(const language of ['en','zh-CN']){
    await page.locator('#language').selectOption(language);await page.waitForTimeout(200);
    for(const theme of ['carbon','pearl']){
     await page.locator('#appearanceMenu>summary').click();await page.locator('#studioTheme').selectOption(theme);await page.locator('#appearanceMenu>summary').click();
     for(const [state,text]of Object.entries(statuses[language])){
      await page.locator('#autosaveStatus').evaluate((node,text)=>{node.textContent=text;},text);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const item=await page.evaluate(()=>{
       const rect=n=>{const r=n.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
       const identity=document.querySelector('.project-identity'),status=document.getElementById('autosaveStatus'),range=document.createRange();range.selectNodeContents(status);
       const selectors=['#appearanceMenu>summary','#language','#undo','#redo','#compare','#projectMenu>summary','#save','#exportMenu>summary','#studioCheckUpdates','#commandSearch'];
       return{identity:rect(identity),status:rect(status),text:status.textContent,textRects:[...range.getClientRects()].map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom})),statusStyle:{overflow:getComputedStyle(status).overflow,textOverflow:getComputedStyle(status).textOverflow,whiteSpace:getComputedStyle(status).whiteSpace},buttons:selectors.map(selector=>{const n=document.querySelector(selector);if(!n)return{selector,missing:true};const r=rect(n),hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);return{selector,...r,disabled:!!n.disabled,hit:hit===n||n.contains(hit),visible:!!n.getClientRects().length};}),documentWidth:document.documentElement.scrollWidth};
      });
      item.viewport={width,height};item.language=language;item.theme=theme;item.state=state;
      assert.equal(item.text,text);assert.equal(item.statusStyle.textOverflow,'clip','Status must not use ellipsis');assert.notEqual(item.statusStyle.overflow,'hidden','Status must not hide critical text');
      for(const r of item.textRects){assert.ok(r.left>=item.identity.left-1&&r.right<=item.identity.right+1,'Save status text stays inside its identity column');assert.ok(r.top>=item.status.top-1&&r.bottom<=item.status.bottom+1,'All save-status lines remain visible');}
      assert.ok(item.status.right<=item.identity.right+1);assert.ok(item.documentWidth<=width+1,'Header must not cause page horizontal overflow');
      for(const button of item.buttons){assert.ok(!button.missing&&button.visible&&button.hit,button.selector+' remains unobstructed');assert.ok(button.left>=item.identity.right+4,button.selector+' must not overlap the project identity or save status');assert.ok(button.left>=-1&&button.right<=width+1&&button.top>=0&&button.bottom<=height,button.selector+' remains in viewport');if(!button.disabled){await page.locator(button.selector).focus();assert.equal(await page.locator(button.selector).evaluate(n=>n===document.activeElement),true,button.selector+' remains keyboard reachable');}}
      if(width===1280&&language==='en'&&['saved','conflict'].includes(state)){const filename=`header-${theme}-${state}-1280.png`;await page.screenshot({path:path.join(out,filename)});item.screenshot=filename;}
      report.cases.push(item);
     }
    }
   }
   report.errors.push(...errors);report.remoteRequests.push(...remote);await context.close();
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.remoteRequests,[]);report.status='PASS';fs.writeFileSync(path.join(out,'header-layout.json'),JSON.stringify(report,null,2));console.log('PASS header: 3 viewports × 2 languages × 2 themes × 4 status texts, visible complete status and keyboard-reachable primary controls; no remote requests');
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
