import '../styles/live.css';
import { Link, useParams } from 'react-router-dom';
import { Ranking } from '../components/live/LiveParts';
import { count } from '../services/format';
import { liveRequest, type SessionResults } from '../services/live';
import { useSession } from '../services/session';
import { useLoad } from '../services/use-load';
/** Persisted results from GET /sessions/:id/results; available to the host and participants after finishing. */
export function Results() {
 const { id = '' } = useParams(), { accessToken } = useSession();
 const load = useLoad(signal => accessToken ? liveRequest<SessionResults>(accessToken, `/sessions/${encodeURIComponent(id)}/results`, 'GET', undefined, signal) : null, [id], 'No se pudieron cargar los resultados.');
 const results = load.data;
 if (load.error) return <section className="content-page live-page"><h1>Resultados no disponibles.</h1><p className="form-error" role="alert">{load.error}</p><div className="quiz-actions"><button className="button secondary" onClick={load.reload}>Reintentar</button><Link className="button secondary" to="/sessions">Mis partidas</Link></div></section>;
 if (!results) return <section className="content-page live-page" role="status">Cargando resultados…</section>;
 return <section className="content-page live-page">
  <h1>{results.title}</h1>
  <p className="quiz-lead">Resultados guardados el {new Date(results.finishedAt).toLocaleString('es-CR')} · {count(results.questionCount, 'pregunta')} · {count(results.ranking.length, 'participante')} · un punto por acierto.</p>
  <div className="section-title"><h2>Clasificación</h2></div>
  <Ranking ranking={results.ranking}/>
  <div className="quiz-actions live-after"><Link className="button primary" to="/sessions">Ver todas mis partidas</Link><Link className="button secondary" to="/">Ir al inicio</Link></div>
 </section>;
}
