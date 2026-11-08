const { chromium } = require('@playwright/test');
const { randomUUID } = require('crypto');
(async()=>{
const browser=await chromium.launch({headless:true});const teacher=await browser.newContext({viewport:{width:1440,height:1000}}),student=await browser.newContext({viewport:{width:390,height:844}});
const password=randomUUID()+'!aA7'; const base='http://localhost:8080';
async function register(context,role){const response=await context.request.post(base+'/auth/api/v1/auth/register',{headers:{'X-NexQuiz-CSRF':'1',Origin:base},data:{email:'roles-'+randomUUID()+'@example.invalid',displayName:role==='TEACHER'?'Profesor QA':'Estudiante QA',password,role}});if(response.status()!==201)throw Error('Register '+response.status());return response.json();}
const t=await register(teacher,'TEACHER'),s=await register(student,'STUDENT');
async function call(user,path,body,status=200){const response=await teacher.request.fetch(base+'/game/api/v1'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+user.accessToken},data:body});if(response.status()!==status)throw Error(path+' '+response.status()+' '+await response.text());return response.json();}
const quiz=await call(t,'/quizzes',{title:'Verificación de roles'},201);await call(t,`/quizzes/${quiz.id}/questions`,{prompt:'Dos más dos es cuatro.',correctAnswer:true},201);
await call(s,'/quizzes',{title:'Debe rechazarse'},403);
const room=await call(t,'/sessions',{quizId:quiz.id,questionSeconds:120},201);
await call(t,'/sessions/join',{code:room.code},403);await call(s,'/sessions/join',{code:room.code});
const tp=await teacher.newPage(),sp=await student.newPage();await tp.goto(base+'/host/'+room.id);await sp.goto(base+'/play/'+room.id);await tp.getByRole('heading',{name:'Esperando participantes'}).waitFor();await sp.getByRole('heading',{name:'Ya estás en la sala.'}).waitFor();
await tp.getByRole('button',{name:'Iniciar partida',exact:true}).click();await sp.getByRole('button',{name:'Verdadero',exact:true}).click();await sp.getByText('Respuesta enviada. Espera a que se cierre la pregunta.').waitFor();
await tp.screenshot({path:'test-results/roles-teacher.png',fullPage:true});await sp.screenshot({path:'test-results/roles-student.png',fullPage:true});
await tp.getByRole('button',{name:'Cerrar pregunta',exact:true}).click();await sp.getByText('¡Correcto!',{exact:true}).waitFor();await tp.getByRole('button',{name:'Ver resultados finales',exact:true}).click();await sp.getByRole('heading',{name:'Partida terminada',exact:true}).waitFor();
const results=await call(s,`/sessions/${room.id}/results`);if(results.ranking[0].score!==1)throw Error('Score');
await sp.goto(base+'/quizzes');await sp.waitForURL('**/join');await tp.goto(base+'/join');await tp.getByRole('heading',{name:'Este enlace es para estudiantes.'}).waitFor();
console.log('PASS: roles, quiz and room creation, forbidden actions, desktop teacher/mobile student, realtime answer, score, results, route isolation');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
