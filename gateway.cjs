'use strict';
const http = require('node:http');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const password = process.env.CTF_ACCESS_PASSWORD;
const secret = process.env.CTF_SESSION_SECRET;
if (!password || password.length < 20 || !secret || secret.length < 32) throw new Error('Strong CTF access and session secrets are required');
const port = Number(process.env.PORT || 10000);
const sign = value => crypto.createHmac('sha256', secret).update(value).digest('hex');
const equal = (a, b) => { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };
function authorized(req) {
  const cookie = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('__Host-ctf='));
  if (!cookie) return false;
  const [expiry, signature] = cookie.slice(11).split('.');
  return /^\d+$/.test(expiry || '') && Number(expiry) > Date.now() && equal(signature || '', sign(expiry));
}
const env = { ...process.env, PORT: '3000', NODE_ENV: 'production', NODE_CONFIG: JSON.stringify({server:{port:3000},challenges:{restrictToTutorialsFirst:true,safetyMode:'disabled'},hackingInstructor:{isEnabled:true}}) };
delete env.CTF_ACCESS_PASSWORD; delete env.CTF_SESSION_SECRET;
const child = spawn(process.execPath, ['--require', '/gateway/loopback.cjs', '/juice-shop/build/app.js'], {cwd:'/juice-shop',env,stdio:'inherit'});
child.on('exit', code => process.exit(code || 1));
const page = '<!doctype html><html><meta name="viewport" content="width=device-width"><title>Bizora Invent CTF</title><body style="font:18px system-ui;max-width:480px;margin:12vh auto;padding:24px"><h1>Bizora Invent CTF</h1><p>Enter the session access password to open the security training lab.</p><form method="post" action="/__ctf/login"><label>Access password <input type="password" name="password" required autocomplete="current-password"></label><p><button>Enter lab</button></p></form></body></html>';
let attempts = 0; let windowStart = Date.now();
const server = http.createServer((req,res) => {
  res.setHeader('Cache-Control','no-store');
  if (req.url === '/__ctf/login') {
    if (req.method === 'GET') { res.setHeader('Content-Type','text/html; charset=utf-8'); return res.end(page); }
    if (req.method !== 'POST') { res.writeHead(405); return res.end(); }
    if (Date.now()-windowStart > 60000) { attempts=0; windowStart=Date.now(); }
    if (++attempts > 30) { res.writeHead(429); return res.end('Too many attempts. Try again in a minute.'); }
    let body='';
    req.on('data', chunk => { body += chunk; if (body.length > 4096) req.destroy(); });
    req.on('end', () => {
      if (!equal(new URLSearchParams(body).get('password') || '',password)) { res.writeHead(401); return res.end('Incorrect access password.'); }
      const expiry = String(Date.now()+8*60*60*1000);
      res.writeHead(303, {'Location':'/','Set-Cookie':`__Host-ctf=${expiry}.${sign(expiry)}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800`}); res.end();
    }); return;
  }
  if (!authorized(req)) { res.writeHead(303,{Location:'/__ctf/login'}); return res.end(); }
  const headers = {...req.headers};
  headers.cookie = (headers.cookie || '').split(';').filter(x=>!x.trim().startsWith('__Host-ctf=')).join(';');
  const upstream = http.request({host:'127.0.0.1',port:3000,path:req.url,method:req.method,headers}, response => {
    const h={...response.headers};
    if (h['set-cookie']) h['set-cookie']=h['set-cookie'].filter(x=>!x.startsWith('__Host-ctf='));
    res.writeHead(response.statusCode,h); response.pipe(res);
  });
  upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503);res.end('Lab is starting. Refresh shortly.');});
  req.pipe(upstream);
});
server.on('upgrade',(req,socket,head)=>{
  if(!authorized(req)){socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');return;}
  const upstream=net.connect(3000,'127.0.0.1',()=>{
    const headers={...req.headers}; headers.cookie=(headers.cookie||'').split(';').filter(x=>!x.trim().startsWith('__Host-ctf=')).join(';');
    upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`+Object.entries(headers).map(([k,v])=>`${k}: ${v}`).join('\r\n')+'\r\n\r\n');
    if(head.length)upstream.write(head); socket.pipe(upstream).pipe(socket);
  }); upstream.on('error',()=>socket.destroy()); socket.on('error',()=>upstream.destroy());socket.on('close',()=>upstream.destroy());
});
server.listen(port,'0.0.0.0',()=>console.log('Protected CTF gateway listening'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{child.kill(signal);server.close(()=>process.exit(0));});
