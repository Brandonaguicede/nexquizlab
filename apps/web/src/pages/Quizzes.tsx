import { useState } from 'react';
import '../styles/quizzes.css';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDownUp, BookOpen, CalendarDays, ChevronDown, CircleHelp, Filter, Layers3, Pencil, Plus, Play, Search, Settings, Trash2 } from 'lucide-react';
import { QuizForm } from '../components/quiz/QuizForm';
import { Pagination } from '../components/ui/Pagination';
import { count } from '../services/format';
import { quizDelete, quizRequest, type Quiz, type QuizPage } from '../services/quizzes';
import { useSession } from '../services/session';
import { useAction } from '../services/use-action';
import { useLoad } from '../services/use-load';
export function Quizzes() {
 const { accessToken } = useSession(), navigate = useNavigate(), action = useAction();
 const [params, setParams] = useSearchParams();
 const [page, setPage] = useState(1), [editor, setEditor] = useState<Quiz | 'new' | null>(params.get('create') === '1' ? 'new' : null);
 const [search, setSearch] = useState(''), [filter, setFilter] = useState('all'), [sort, setSort] = useState('recent');
 const library = useLoad(async signal => {
  if (!accessToken) return null;
  const first = await quizRequest<QuizPage>(accessToken, '/quizzes?page=1&pageSize=50', 'GET', undefined, signal);
  const items = [...first.items];
  for (let next = 2; (next - 1) * first.pageSize < first.total; next++) {
   const result = await quizRequest<QuizPage>(accessToken, `/quizzes?page=${next}&pageSize=50`, 'GET', undefined, signal);
   items.push(...result.items);
  }
  return { ...first, items, pageSize: 10 };
 }, [accessToken], 'No se pudo cargar.');
 const data = library.data;
 const filtered = (data?.items ?? []).filter(quiz => (quiz.title + ' ' + (quiz.description ?? '')).toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')) && (filter === 'all' || (filter === 'ready' ? quiz.questionCount > 0 : quiz.questionCount === 0))).sort((a, b) => sort === 'name' ? a.title.localeCompare(b.title, 'es') : sort === 'oldest' ? a.updatedAt.localeCompare(b.updatedAt) : b.updatedAt.localeCompare(a.updatedAt));
 const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 10))), visible = filtered.slice((currentPage - 1) * 10, currentPage * 10);
 function closeEditor() { setEditor(null); if (params.has('create')) setParams({}, { replace: true }); }
 if (!accessToken) return null;
 const token = accessToken;
 async function save(values: { title: string; description: string }) {
  await action.run(async () => {
   if (editor === 'new') { const quiz = await quizRequest<Quiz>(token, '/quizzes', 'POST', values); navigate('/quizzes/' + quiz.id); }
   else if (editor) { await quizRequest<Quiz>(token, '/quizzes/' + editor.id, 'PATCH', values); closeEditor(); library.reload(); }
  }, 'Cuestionario guardado.');
 }
 async function remove(quiz: Quiz) {
  if (!window.confirm(`¿Eliminar «${quiz.title}» y todas sus preguntas?`)) return;
  await action.run(async () => {
   await quizDelete(token, '/quizzes/' + quiz.id);
   // Removing the last quiz of a page moves back one page instead of showing an empty one.
   if (visible.length === 1 && page > 1) setPage(value => value - 1);
   library.reload();
  }, 'Cuestionario eliminado.');
 }
 return <section className="content-page quiz-workspace library-page">
  <div className="quiz-page-heading library-hero"><svg className="library-ribbon" viewBox="0 0 1600 220" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="library-ribbon-fill" x1="0" y1="1" x2="1" y2="0"><stop stopColor="#0b52c2" stopOpacity=".08"/><stop offset=".5" stopColor="#1558bb" stopOpacity=".4"/><stop offset="1" stopColor="#082147" stopOpacity="0"/></linearGradient></defs><path d="M740 220 C820 115 930 205 1080 0 L1320 0 C1140 160 1200 220 960 220Z" fill="url(#library-ribbon-fill)"/><path d="M740 220 C820 115 930 205 1080 0" fill="none" stroke="#1c7bff" strokeWidth="1.2"/></svg><span className="icon-tile"><Layers3 size={40} aria-hidden="true"/></span><div><h1>Mis cuestionarios</h1><p className="quiz-lead">Prepara preguntas. Dale espacio a lo que quieres enseñar.</p></div><button className="button primary" onClick={() => setEditor('new')} disabled={action.pending}><Plus size={25} aria-hidden="true"/>Crear cuestionario</button></div>
  {action.error && <p role="alert" className="form-error">{action.error}</p>}{action.notice && <p role="status" className="quiz-notice">{action.notice}</p>}
  {editor && <section className="quiz-edit-panel" aria-label={editor === 'new' ? 'Crear cuestionario' : 'Editar cuestionario'}><h2>{editor === 'new' ? 'Un nuevo cuestionario' : 'Editar cuestionario'}</h2><QuizForm key={editor === 'new' ? 'new' : editor.id} quiz={editor === 'new' ? undefined : editor} pending={action.pending} onSave={save} onCancel={closeEditor}/></section>}
  {library.loading ? <p className="loading" role="status">Cargando tus cuestionarios…</p> : library.error ? <div role="alert"><p className="form-error">{library.error}</p><button className="button secondary" onClick={library.reload}>Reintentar</button><Link className="button secondary" to="/login">Ir a inicio de sesión</Link></div> : data && <>
   <div className="quiz-directory-heading"><h2><BookOpen size={35} aria-hidden="true"/>Tu biblioteca</h2><span className="pill">{count(data.total, 'cuestionario')}</span></div>
   <div className="library-filters"><label className="library-search"><Search size={23} aria-hidden="true"/><span className="sr-only">Buscar cuestionario</span><input type="search" placeholder="Buscar cuestionario..." value={search} onChange={event => { setSearch(event.target.value); setPage(1); }}/></label><label className="library-select"><Filter size={23} aria-hidden="true"/><span className="sr-only">Filtrar cuestionarios</span><select value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }}><option value="all">Todos los cuestionarios</option><option value="ready">Listos para jugar</option><option value="draft">Sin preguntas</option></select><ChevronDown size={17} aria-hidden="true"/></label><label className="library-select"><ArrowDownUp size={22} aria-hidden="true"/><span className="sr-only">Ordenar cuestionarios</span><select value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}><option value="recent">Más recientes</option><option value="oldest">Más antiguos</option><option value="name">Por nombre</option></select><ChevronDown size={17} aria-hidden="true"/></label></div>
   {filtered.length === 0 ? <div className="quiz-empty"><h3>{data.total === 0 ? 'Tu primera pregunta empieza aquí.' : 'No encontramos cuestionarios.'}</h3><p>{data.total === 0 ? 'Crea un cuestionario y agrega preguntas de verdadero o falso, con imágenes cuando ayuden a explicar.' : 'Prueba otro nombre o cambia el filtro.'}</p>{data.total === 0 && !editor && <button className="button primary" onClick={() => setEditor('new')}><Plus size={18} aria-hidden="true"/>Crear mi primer cuestionario</button>}</div> : <ul className="quiz-directory">{visible.map(quiz => <li key={quiz.id}>
    <div className="library-thumbnail" aria-hidden="true"><img src="/art/clipboard.png" alt=""/></div><div className="quiz-row-copy"><Link to={'/quizzes/' + quiz.id}><h3>{quiz.title}</h3></Link>{quiz.description && <p>{quiz.description}</p>}<div className="library-meta"><span className="pill"><CircleHelp size={20} aria-hidden="true"/>{count(quiz.questionCount, 'pregunta')}</span><span className="pill"><CalendarDays size={20} aria-hidden="true"/>Modificado el {new Date(quiz.updatedAt).toLocaleDateString('es-CR')}</span></div></div>
    <div className="quiz-actions">{quiz.questionCount > 0 && <Link className="button primary" to={'/quizzes/' + quiz.id + '#live'}><Play size={22} aria-hidden="true"/>Jugar en vivo</Link>}<Link className="button secondary" to={'/quizzes/' + quiz.id}><Pencil size={21} aria-hidden="true"/>Abrir editor</Link><button className="button secondary" disabled={action.pending} onClick={() => setEditor(quiz)}><Settings size={21} aria-hidden="true"/>Editar datos</button><button className="button secondary danger" disabled={action.pending} onClick={() => { void remove(quiz); }}><Trash2 size={21} aria-hidden="true"/>Eliminar</button></div>
   </li>)}</ul>}
   <Pagination page={currentPage} pageSize={10} total={filtered.length} label="Páginas de cuestionarios" disabled={action.pending} onPage={setPage}/>
  </>}
 </section>;
}
