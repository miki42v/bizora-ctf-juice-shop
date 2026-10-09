const vm=require('node:vm'),fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
let server;
const fakeHttp={...http,createServer:fn=>{server=http.createServer(fn);return server;}};
const env={CTF_ACCESS_PASSWORD:'test-password-1234567890',CTF_SESSION_SECRET:'x'.repeat(64),PORT:'18080'};
vm.runInNewContext(fs.readFileSync(__dirname+'/gateway.cjs','utf8'),{require:name=>name==='node:http'?fakeHttp:name==='node:child_process'?{spawn:()=>({on(){},kill(){}})}:require(name),process:{env,execPath:process.execPath,on(){},exit(){throw Error('exit');}},Buffer,URLSearchParams,console});
const upstream=http.createServer((req,res)=>res.end(req.headers.authorization||'ok')).listen(3000,'127.0.0.1');
async function request(path,method='GET',body='',headers={}){return new Promise((resolve,reject)=>{const r=http.request({host:'127.0.0.1',port:18080,path,method,headers},s=>{let text='';s.on('data',x=>text+=x);s.on('end',()=>resolve({status:s.statusCode,headers:s.headers,text}));});r.on('error',reject);r.end(body);});}
(async()=>{try{
assert.equal((await request('/')).status,303);
assert.equal((await request('/__ctf/login','POST','password=wrong')).status,401);
const login=await request('/__ctf/login','POST','password='+env.CTF_ACCESS_PASSWORD);
assert.equal(login.status,303);const cookie=login.headers['set-cookie'][0].split(';')[0];
assert.match(login.headers['set-cookie'][0],/Secure; HttpOnly; SameSite=Strict/);
const good=await request('/rest/user/authentication-details','GET','',{cookie,authorization:'Bearer challenge-token'});
assert.equal(good.status,200);assert.equal(good.text,'Bearer challenge-token');
assert.equal((await request('/','GET','',{cookie:cookie+'bad'})).status,303);
console.log('PASS: unauthenticated, incorrect password, login, secure cookie, tamper rejection, bearer forwarding');
}finally{server.close();upstream.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
