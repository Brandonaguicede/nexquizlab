import { useState } from 'react';
import '../styles/quizzes.css';
import { Link, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Plus } from 'lucide-react';
import { QuizForm } from '../components/quiz/QuizForm';
import { QuestionForm } from '../components/quiz/QuestionForm';
import { QuestionImage } from '../components/quiz/QuestionImage';
import { StartLive } from '../components/live/StartLive';
import { messageOf } from '../services/format';
import { quizDelete, quizRequest, type Question, type QuizDetail } from '../services/quizzes';
import { useSession } from '../services/session';
import { useAction } from '../services/use-action';
import { useLoad } from '../services/use-load';
const MAX_QUESTIONS = 200;
export function QuizEditor() {
 const { id } = useParams(), { accessToken } = useSession(), action = useAction();
 const [editMetadata, setEditMetadata] = useState(false), [editing, setEditing] = useState<Question | 'new' | null>(null);
 const load = useLoad(signal => accessToken && id ? quizRequest<QuizDetail>(accessToken, '/quizzes/' + encodeURIComponent(id), 'GET', undefined, signal) : null, [id], 'No se pudo cargar.');
 const quiz = load.data, refresh = load.reload;
 if (!accessToken || !id) return null;
 const token = accessToken, path = '/quizzes/' + encodeURIComponent(id);
 // A reload in flight disables row actions, so none is sent against the previous question list.
 const busy = action.pending || !!editing || load.loading;
 async function saveQuestion(values: { prompt: string; correctAnswer: boolean }, file: File | null) {
  const success = await action.run(async () => {
   const existing = editing && editing !== 'new' ? editing : null;
   const saved = await quizRequest<Question>(token, path + '/questions' + (existing ? '/' + existing.id : ''), existing ? 'PATCH' : 'POST', values);
   setEditing(saved); // Preserve the new ID if a later image upload fails, preventing duplicate creation on retry.
   if (file) {
    const form = new FormData(); form.append('file', file);
    try { await quizRequest<Question>(token, path + '/questions/' + saved.id + '/image', 'POST', form); }
    catch (cause) { refresh(); throw new Error('La pregunta se guardó, pero la imagen no. ' + messageOf(cause, 'Vuelve a seleccionarla e inténtalo de nuevo.')); }
   }
   refresh();
  }, 'Pregunta guardada.');
  if (success) setEditing(null);
 }
 async function reorder(index: number, offset: number) {
  if (!quiz) return;
  const ids = quiz.questions.map(question => question.id), moved = ids.splice(index, 1)[0];
  if (!moved) return;
  ids.splice(index + offset, 0, moved);
  await action.run(async () => { load.setData(await quizRequest<QuizDetail>(token, path + '/questions/reorder', 'PATCH', { questionIds: ids })); }, 'Orden actualizado.');
 }
 function confirmed(question: string, work: () => Promise<unknown>, success: string) {
  if (window.confirm(question)) void action.run(async () => { await work(); refresh(); }, success);
 }
 return <section className="content-page quiz-workspace">
  <Link className="text-link quiz-back" to="/quizzes">← Mis cuestionarios</Link>
  {action.error && <p role="alert" className="form-error">{action.error}</p>}{action.notice && <p role="status" className="quiz-notice">{action.notice}</p>}
  {/* Reloads after saving keep the editor on screen; only the first load shows the placeholder. */}
  {load.loading && !quiz ? <p className="loading" role="status">Cargando cuestionario…</p> : load.error ? <div role="alert"><h1>No pudimos abrir el cuestionario.</h1><p className="form-error">{load.error}</p><button className="button secondary" onClick={refresh}>Reintentar</button></div> : quiz && <>
   <div className="quiz-page-heading"><div><h1>{quiz.title}</h1>{quiz.description && <p className="quiz-lead">{quiz.description}</p>}</div><button className="button secondary" disabled={action.pending} onClick={() => setEditMetadata(value => !value)}>Editar datos</button></div>
   <StartLive token={token} quizId={quiz.id} questionCount={quiz.questions.length}/>
   {editMetadata && <section className="quiz-edit-panel" aria-label="Datos del cuestionario"><QuizForm quiz={quiz} pending={action.pending} onCancel={() => setEditMetadata(false)} onSave={async values => { const success = await action.run(async () => { await quizRequest(token, path, 'PATCH', values); refresh(); }, 'Cuestionario guardado.'); if (success) setEditMetadata(false); }}/></section>}
   <div className="quiz-directory-heading"><div><h2>Preguntas</h2><p>{quiz.questions.length} de {MAX_QUESTIONS} · Verdadero o falso</p></div><button className="button primary" disabled={busy || quiz.questions.length >= MAX_QUESTIONS} onClick={() => setEditing('new')}><Plus size={18} aria-hidden="true"/>Agregar pregunta</button></div>
   {editing && <section className="quiz-edit-panel"><QuestionForm key={editing === 'new' ? 'new' : editing.id} question={editing === 'new' ? undefined : editing} pending={action.pending} onSave={saveQuestion} onCancel={() => setEditing(null)}/></section>}
   {quiz.questions.length === 0 ? <div className="quiz-empty"><h3>Todavía no hay preguntas.</h3><p>Agrega un enunciado y elige su respuesta correcta. Puedes incluir una imagen para darle contexto.</p></div> : <ol className="question-directory">{quiz.questions.map((question, index) => <li key={question.id}>
    <div className="question-number" aria-label={'Posición ' + (index + 1)}>{index + 1}</div><div className="question-copy"><h3>{question.prompt}</h3><span className={'answer-label ' + (question.correctAnswer ? 'true' : 'false')}>Respuesta: {question.correctAnswer ? 'Verdadero' : 'Falso'}</span>{question.imageId && <QuestionImage token={token} imageId={question.imageId}/>}
     <div className="quiz-actions"><button className="button secondary" disabled={busy} onClick={() => setEditing(question)}>Editar pregunta</button><button className="button secondary danger" disabled={busy} onClick={() => confirmed('¿Eliminar esta pregunta?', () => quizDelete(token, path + '/questions/' + question.id), 'Pregunta eliminada.')}>Eliminar pregunta</button>
      {question.imageId && <button className="button secondary" disabled={busy} onClick={() => confirmed('¿Eliminar la imagen de esta pregunta?', () => quizRequest(token, path + '/questions/' + question.id + '/image', 'DELETE'), 'Imagen eliminada.')}>Eliminar imagen</button>}
     </div></div>
    <div className="question-order"><button className="button secondary" aria-label={'Subir pregunta ' + (index + 1)} disabled={busy || index === 0} onClick={() => { void reorder(index, -1); }}><ArrowUp size={18} aria-hidden="true"/></button><button className="button secondary" aria-label={'Bajar pregunta ' + (index + 1)} disabled={busy || index === quiz.questions.length - 1} onClick={() => { void reorder(index, 1); }}><ArrowDown size={18} aria-hidden="true"/></button></div>
   </li>)}</ol>}
  </>}
 </section>;
}
