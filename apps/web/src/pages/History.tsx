import '../styles/quizzes.css';
import '../styles/live.css';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Pagination } from '../components/ui/Pagination';
import { count } from '../services/format';
import { liveRequest, type HistoryPage } from '../services/live';
import { useSession } from '../services/session';
import { useLoad } from '../services/use-load';
/** Finished games the user played or hosted (GET /sessions?role=…). */
export function History() {
 const { accessToken, user } = useSession(), [params, setParams] = useSearchParams();
 const role = user?.role === 'TEACHER' ? 'host' : 'participant', page = Math.max(1, Number(params.get('page')) || 1);
 const history = useLoad(signal => accessToken ? liveRequest<HistoryPage>(accessToken, `/sessions?role=${role}&page=${page}&pageSize=10`, 'GET', undefined, signal) : null, [role, page], 'No se pudo cargar el historial.');
 const data = history.data;
 const go = (next: { role?: string; page?: number }) => setParams({ role: next.role ?? role, page: String(next.page ?? 1) });
 return <section className="content-page quiz-workspace">
  <div className="quiz-page-heading"><div><h1>Mis partidas</h1><p className="quiz-lead">Resultados guardados de las partidas terminadas.</p></div></div>

  {history.error ? <div role="alert"><p className="form-error">{history.error}</p><button className="button secondary" onClick={history.reload}>Reintentar</button></div>
   : history.loading || !data ? <p role="status">Cargando partidas…</p>
   : data.items.length === 0 ? <div className="quiz-empty"><h3>{role === 'host' ? 'Todavía no has terminado ninguna partida como anfitrión.' : 'Todavía no has terminado ninguna partida.'}</h3><p>{role === 'host' ? 'Abre una sala desde uno de tus cuestionarios.' : 'Pide el código a tu docente y únete a una sala.'}</p><Link className="button secondary" to={role === 'host' ? '/quizzes' : '/join'}>{role === 'host' ? 'Ir a mis cuestionarios' : 'Unirme a una sala'}</Link></div>
   : <>
    <ul className="quiz-directory">{data.items.map(item => <li key={item.sessionId}>
     <div className="quiz-row-copy"><Link to={'/results/' + item.sessionId}><h3>{item.title}</h3></Link><small>{new Date(item.finishedAt).toLocaleString('es-CR')} · {count(item.participantCount, 'participante')} · {count(item.questionCount, 'pregunta')}</small>
      {role === 'participant' && <p className="history-score">Puesto <strong>{item.rank}</strong> · {count(item.score ?? 0, 'punto')}</p>}</div>
     <div className="quiz-actions"><Link className="button primary" to={'/results/' + item.sessionId}>Ver resultados<ArrowRight size={16} aria-hidden="true"/></Link></div>
    </li>)}</ul>
    <Pagination page={page} pageSize={data.pageSize} total={data.total} label="Páginas del historial" onPage={next => go({ page: next })}/>
   </>}
 </section>;
}
