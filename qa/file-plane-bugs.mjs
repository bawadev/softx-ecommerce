import { chromium } from '@playwright/test';
import { readFileSync } from 'fs';
const bugs = JSON.parse(readFileSync('/tmp/qa-plane/bugs.json','utf8'));
const EMAIL='fox@softx.world', PASS='SoftX_Fox_2026!';
const NEW = 'https://plane.softx.world/ai-software-company/projects/014d0285-4f4a-4122-9722-ad7fd9258e3e/work-items/?peekId=new';
const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:1440,height:900}});
const p = await ctx.newPage();
await p.goto('https://plane.softx.world/', {waitUntil:'networkidle', timeout:60000});
if (await p.locator('input[name="email"], input[type="email"]').first().isVisible().catch(()=>false)) {
  await p.locator('input[name="email"], input[type="email"]').first().fill(EMAIL);
  await p.locator('button[type="submit"]').first().click();
  await p.waitForTimeout(2500);
  const pw = p.locator('input[type="password"]').first();
  await pw.waitFor({state:'visible', timeout:20000});
  await pw.fill(PASS);
  await p.locator('button[type="submit"]').first().click();
  await p.waitForURL(/ai-software-company|profile|workspace|projects/, {timeout:60000}).catch(()=>{});
  await p.waitForTimeout(4000);
}
console.log('after login url:', p.url());
const created = [];
for (const bug of bugs) {
  try {
    await p.goto(NEW, {waitUntil:'domcontentloaded', timeout:60000});
    await p.waitForTimeout(4500);
    // modal inputs: title input + description editor
    const title = p.locator('textarea, input[placeholder*="Title" i]').first();
    await title.waitFor({state:'visible', timeout:20000});
    await title.fill(`[QA ${bug.key}] ${bug.title}`);
    const desc = p.locator('[contenteditable="true"]').first();
    if (await desc.isVisible().catch(()=>false)) {
      await desc.click();
      await p.keyboard.type(`${bug.desc}\n\n— Filed from multi-browser QA (batches 1–4, 2026-11-02).`, {delay: 2});
    }
    // priority select: Plane uses a dropdown button showing current priority
    const priBtn = p.locator('button:has-text("Priority"), [data-testid*="priority"]').first();
    if (await priBtn.isVisible().catch(()=>false)) {
      await priBtn.click(); await p.waitForTimeout(600);
      const opt = p.locator(`[role="option"]:has-text("${bug.pri}"), li:has-text("${bug.pri}")`).first();
      if (await opt.isVisible({timeout:4000}).catch(()=>false)) { await opt.click(); }
      else await p.keyboard.press('Escape');
    }
    await p.locator('button:has-text("Create"), button:has-text("Submit")').first().click();
    await p.waitForTimeout(3500);
    created.push(`${bug.key} OK @ ${p.url()}`);
  } catch (e) { created.push(`${bug.key} FAIL ${String(e).slice(0,120)}`); }
  await p.screenshot({path:`/tmp/qa-plane/${bug.key}.png`, fullPage:false});
}
console.log(created.join('\n'));
await b.close();
