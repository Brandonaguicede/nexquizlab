import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { api, bearer, image, newQuestion, newQuiz, register } from './helpers';
let owner: Awaited<ReturnType<typeof register>>, other: Awaited<ReturnType<typeof register>>;
test.beforeAll(async ({ request }) => { owner = await register(request); other = await register(request); });
test('quiz CRUD, stable paginated own list and idempotent deletion', async ({ request }) => {
 const quiz = await newQuiz(request, owner.token), path = api + '/quizzes/' + quiz.id;
 await newQuestion(request, owner.token, quiz.id);
 const list = await request.get(api + '/quizzes?page=1&pageSize=1', { headers: bearer(owner.token) });
 expect(list.status()).toBe(200); const page = await list.json(); expect(page.pageSize).toBe(1); expect(page.items[0].id).toBe(quiz.id); expect(page.items[0].questionCount).toBe(1);
 const foreign = await request.get(api + '/quizzes', { headers: bearer(other.token) }); expect((await foreign.json()).items).toEqual([]);
 expect((await request.patch(path, { headers: bearer(owner.token), data: { title: '  Editado  ', description: 'Nuevo' } })).status()).toBe(200);
 const detail = await (await request.get(path, { headers: bearer(owner.token) })).json(); expect(detail.title).toBe('Editado'); expect(detail.description).toBe('Nuevo'); expect(detail.questions).toHaveLength(1);
 for (let i=0;i<2;i++) expect((await request.delete(path, { headers: bearer(owner.token) })).status()).toBe(204);
 expect((await request.get(path, { headers: bearer(owner.token) })).status()).toBe(404);
});
test('rejects invalid DTOs, paging, null, ownership injection and explicit position', async ({ request }) => {
 for (const data of [{ title: ' ' }, { title: 'x'.repeat(161) }, { title: 'Quiz', ownerId: other.id }, { title: 'Quiz', description: null }]) expect((await request.post(api + '/quizzes', { headers: bearer(owner.token), data })).status()).toBe(400);
 for (const query of ['page=0','pageSize=51','page=NaN','page=1.5','page=1000001','ownerId='+other.id]) expect((await request.get(api + '/quizzes?'+query, { headers: bearer(owner.token) })).status()).toBe(400);
 const quiz = await newQuiz(request, owner.token), path = api + '/quizzes/' + quiz.id;
 for (const data of [{ prompt: ' ' , correctAnswer: true }, { prompt: 'Pregunta', correctAnswer: 'TRUE' }, { prompt: 'Pregunta', correctAnswer: true, position: 0 }]) expect((await request.post(path+'/questions', { headers: bearer(owner.token), data })).status()).toBe(400);
 expect((await request.patch(path, { headers: bearer(owner.token), data: { title: null } })).status()).toBe(400);
});
test('question CRUD, true/false edits, atomic order and compaction', async ({ request }) => {
 const quiz = await newQuiz(request, owner.token), path = api + '/quizzes/' + quiz.id;
 const first = await newQuestion(request, owner.token, quiz.id), second = await newQuestion(request, owner.token, quiz.id, 'Segunda');
 const edit = await request.patch(path+'/questions/'+first.id, { headers: bearer(owner.token), data: { prompt: 'Enunciado editado', correctAnswer: false } });
 expect(edit.status()).toBe(200); expect((await edit.json()).correctAnswer).toBe(false);
 const response = await request.patch(path+'/questions/reorder', { headers: bearer(owner.token), data: { questionIds: [second.id,first.id] } });
 expect(response.status()).toBe(200); const questions = (await response.json()).questions; expect(questions.map((q: {id:string})=>q.id)).toEqual([second.id, first.id]); expect(questions.map((q:{position:number})=>q.position)).toEqual([0,1]);
 for (const ids of [[first.id], [first.id,randomUUID()]]) expect((await request.patch(path+'/questions/reorder', { headers: bearer(owner.token), data: { questionIds: ids } })).status()).toBe(409);
 expect((await request.patch(path+'/questions/reorder', { headers: bearer(owner.token), data: { questionIds: [first.id,first.id] } })).status()).toBe(400);
 for(let i=0;i<2;i++) expect((await request.delete(path+'/questions/'+second.id, { headers: bearer(owner.token) })).status()).toBe(204);
 const remaining = (await (await request.get(path, { headers: bearer(owner.token) })).json()).questions; expect(remaining).toHaveLength(1); expect(remaining[0].position).toBe(0); expect(remaining[0].prompt).toBe('Enunciado editado');
});
test('concurrent appends and stale reorder preserve contiguous unique positions', async ({ request }) => {
 const quiz = await newQuiz(request, owner.token), path = api + '/quizzes/'+quiz.id;
 const initial = await newQuestion(request, owner.token, quiz.id);
 const results = await Promise.all([request.patch(path+'/questions/reorder', { headers: bearer(owner.token), data: { questionIds: [initial.id] } }), ...Array.from({length:5}, (_,index)=>request.post(path+'/questions', { headers: bearer(owner.token), data: { prompt: 'Concurrente '+index, correctAnswer: false } }))]);
 expect([200,409]).toContain(results[0]?.status()); for(const response of results.slice(1)) expect(response.status()).toBe(201);
 const questions = (await (await request.get(path, { headers: bearer(owner.token) })).json()).questions; expect(questions.map((q:{position:number})=>q.position)).toEqual([0,1,2,3,4,5]);
});
test('all quiz, question and file mutations reject foreign owners and missing auth', async ({ request }) => {
 const quiz = await newQuiz(request, owner.token), q = await newQuestion(request, owner.token, quiz.id), path = api+'/quizzes/'+quiz.id;
 const operations = [
  { method:'GET', url:path }, { method:'PATCH', url:path, data:{title:'Intruso'} }, { method:'DELETE', url:path },
  { method:'POST', url:path+'/questions', data:{prompt:'Intruso',correctAnswer:true} },
  { method:'PATCH', url:path+'/questions/'+q.id, data:{prompt:'Intruso'} }, { method:'DELETE', url:path+'/questions/'+q.id },
  { method:'PATCH', url:path+'/questions/reorder', data:{questionIds:[q.id]} }, { method:'DELETE', url:path+'/questions/'+q.id+'/image' },
 ];
 for (const operation of operations) {
  expect((await request.fetch(operation.url, { method:operation.method, data:operation.data, headers:bearer(other.token) })).status()).toBe(404);
  expect((await request.fetch(operation.url, { method:operation.method, data:operation.data })).status()).toBe(401);
 }
 const upload = { file:{name:'../attack.png',mimeType:'image/png',buffer:await image()} };
 expect((await request.post(path+'/questions/'+q.id+'/image',{headers:bearer(other.token),multipart:upload})).status()).toBe(404);
 expect((await request.post(path+'/questions/'+q.id+'/image',{multipart:upload})).status()).toBe(401);
 expect((await request.get(api+'/quizzes')).status()).toBe(401);
});
test('real JPEG PNG WebP upload, protected reads, replacement and deletion', async ({ request }) => {
 const quiz=await newQuiz(request,owner.token), q=await newQuestion(request,owner.token,quiz.id), path=api+'/quizzes/'+quiz.id+'/questions/'+q.id+'/image';
 let previous='';
 for(const format of ['jpeg','png','webp'] as const) {
  const response=await request.post(path,{headers:bearer(owner.token),multipart:{file:{name:'../../image.'+format,mimeType:'application/octet-stream',buffer:await image(format)}}});
  expect(response.status()).toBe(201); const imageId=(await response.json()).imageId; expect(imageId).toMatch(/^[a-f0-9-]{36}$/);
  const read=await request.get(api+'/images/'+imageId,{headers:bearer(owner.token)});expect(read.status()).toBe(200);expect(read.headers()['content-type']).toContain('image/webp');expect(read.headers()['cache-control']).toContain('no-store');expect((await read.body()).length).toBeGreaterThan(0);
  expect((await request.get(api+'/images/'+imageId,{headers:bearer(other.token)})).status()).toBe(404);expect((await request.get(api+'/images/'+imageId)).status()).toBe(401);
  if(previous)expect((await request.get(api+'/images/'+previous,{headers:bearer(owner.token)})).status()).toBe(404);previous=imageId;
 }
 for(let i=0;i<2;i++)expect((await request.delete(path,{headers:bearer(owner.token)})).status()).toBe(200);
 expect((await request.get(api+'/images/'+previous,{headers:bearer(owner.token)})).status()).toBe(404);
});
test('invalid and oversized images cannot replace an existing image', async ({ request }) => {
 const quiz=await newQuiz(request,owner.token), q=await newQuestion(request,owner.token,quiz.id), path=api+'/quizzes/'+quiz.id+'/questions/'+q.id+'/image';
 const good=await request.post(path,{headers:bearer(owner.token),multipart:{file:{name:'valid.png',mimeType:'image/png',buffer:await image()}}}); expect(good.status()).toBe(201);const imageId=(await good.json()).imageId;
 for(const buffer of [Buffer.from('<svg/>'),Buffer.from('fake image'),Buffer.alloc(0)]) expect((await request.post(path,{headers:bearer(owner.token),multipart:{file:{name:'fake.png',mimeType:'image/png',buffer}}})).status()).toBe(400);
 expect((await request.post(path,{headers:bearer(owner.token),multipart:{file:{name:'large.png',mimeType:'image/png',buffer:Buffer.alloc(5*1024*1024+1)}}})).status()).toBe(413);
 const current=await (await request.get(api+'/quizzes/'+quiz.id,{headers:bearer(owner.token)})).json();expect(current.questions[0].imageId).toBe(imageId);
});
