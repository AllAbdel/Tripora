import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const OUT='/tmp/claude-0/-home-user-Tripora/4dd1079e-cac0-5e87-8c4e-0c2c496707ee/scratchpad/footer';
const PORT=4201, BASE=`http://localhost:${PORT}`;
const serveur=spawn('node',['/home/user/Tripora/apps/web/scripts/serve-dist.mjs'],{env:{...process.env,SMOKE_PORT:String(PORT)},stdio:'ignore'});
await new Promise(r=>setTimeout(r,1500));
const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const page=await nav.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
try{
  await page.goto(BASE,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:/mode local/i}).click();
  await page.goto(`${BASE}/profil`,{waitUntil:'networkidle'});
  await page.waitForTimeout(400);

  // Capture au format écran, pas pleine page : c'est ce que voit l'utilisateur.
  await page.screenshot({path:`${OUT}/profil-haut.png`});
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await page.screenshot({path:`${OUT}/profil-bas.png`});

  // Mesures : la barre est-elle bien collée au bas de la fenêtre ?
  const mesures = await page.evaluate(() => {
    const nav = document.querySelector('nav');
    const r = nav?.getBoundingClientRect();
    const style = nav ? getComputedStyle(nav) : null;
    return {
      hauteurFenetre: window.innerHeight,
      navBas: r?.bottom, navHaut: r?.top, position: style?.position,
      defilement: window.scrollY,
      hauteurDocument: document.documentElement.scrollHeight,
      paddingBasMain: getComputedStyle(document.querySelector('main')).paddingBottom,
    };
  });
  console.log(JSON.stringify(mesures, null, 1));
}catch(e){ console.log('ÉCHEC:',e.message.slice(0,200)); }
finally{ await nav.close(); serveur.kill(); }
