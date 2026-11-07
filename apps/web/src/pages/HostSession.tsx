import '../styles/live.css';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Play, Users } from 'lucide-react';
import { AnswerName, ConnectionBanner, CopyButton, Countdown, Counts, LiveImage, Ranking } from '../components/live/LiveParts';
import { count } from '../services/format';
import { ApiError } from '../services/http';
import { liveRequest, type SessionState } from '../services/live';
import { useSession } from '../services/session';
import { useLiveSession } from '../services/use-live-session';
import { useAction } from '../services/use-action';
function heading(state: SessionState) {
 const question = state.currentQuestion;
 switch (state.status) {
  case 'LOBBY': return 'Esperando participantes';
  case 'FINISHED': return 'Resultados finales';
  case 'CANCELLED': return 'Sala cancelada';
  default: return question ? `Pregunta ${question.position + 1} de ${question.total}` : 'Partida en curso';
 }
}
export function HostSession() {
 const { id = '' } = useParams(), { accessToken } = useSession(), live = useLiveSession(id), action = useAction();
 const state = live.state;
 if (!accessToken) return null;
 const token = accessToken;
 async function command(name: 'start' | 'close' | 'next' | 'finish' | 'cancel') {
  await action.run(async () => {
   try { live.replace(await liveRequest<SessionState>(token, `/sessions/${encodeURIComponent(id)}/${name}`, 'POST')); }
   catch (cause) { if (cause instanceof ApiError && cause.code === 'INVALID_STATE') void live.resync(); throw cause; }
  }, '');
 }
 if (live.fatal) return <section className="content-page live-page"><h1>No pudimos abrir la sala.</h1><p className="form-error" role="alert">{live.fatal}</p><Link className="button secondary" to="/quizzes">Volver a mis cuestionarios</Link></section>;
 if (!state) return <section className="content-page live-page" role="status"><ConnectionBanner connection={live.connection}/>Abriendo la sala…</section>;
 const question = state.currentQuestion, last = question ? question.position + 1 >= question.total : false;
 const joinUrl = `${window.location.origin}/join?code=${state.code}`;
 const playing = state.status === 'QUESTION_OPEN' || state.status === 'QUESTION_CLOSED';
 return <section className="content-page live-page host">
  <div className="live-heading"><div><h1>{heading(state)}</h1><p className="live-meta">{state.title}</p></div>
   {playing && <button className="button secondary danger" disabled={action.pending} onClick={() => { if (window.confirm('¿Terminar la partida ahora? Se guardará la clasificación actual.')) void command('finish'); }}>Terminar partida</button>}</div>
  <ConnectionBanner connection={live.connection}/>
  {action.error && <p role="alert" className="form-error">{action.error}</p>}
  {state.status === 'LOBBY' && <div className="live-lobby">
   <div className="card live-code-panel"><p>Código de la sala</p><strong className="live-code" aria-label={'Código ' + state.code.split('').join(' ')}>{state.code}</strong><p className="live-join-url">Entra a <span>{joinUrl.replace(/^https?:\/\//, '').replace(/\?.*$/, '')}</span> o abre <a href={joinUrl}>{joinUrl}</a></p><div className="live-share"><CopyButton text={state.code} label="Copiar código"/><CopyButton text={joinUrl} label="Copiar enlace"/></div></div>
   <div className="card live-participants"><h2><Users size={22} aria-hidden="true"/> {state.participantCount} de {state.maxParticipants}</h2>
    {state.participants?.length ? <ul>{state.participants.map(participant => <li key={participant.id}><span className={'presence' + (live.online[participant.id] === false ? ' away' : '')} aria-hidden="true"/>{participant.displayName}{live.online[participant.id] === false && <small> · desconectado</small>}</li>)}</ul> : <p className="quiz-lead">Comparte el código. Los nombres aparecerán aquí en cuanto se unan.</p>}
    <div className="quiz-actions"><button className="button primary" disabled={action.pending || state.participantCount === 0} onClick={() => { void command('start'); }}><Play size={18} aria-hidden="true"/>Iniciar partida</button><button className="button secondary" disabled={action.pending} onClick={() => { if (window.confirm('¿Cancelar esta sala?')) void command('cancel'); }}>Cancelar sala</button></div>
    <p className="field-help">{count(state.questionCount, 'pregunta')} · {state.questionSeconds} segundos por pregunta</p>
   </div>
  </div>}
  {playing && question && <div className="live-stage">
   <div className="card live-question"><Countdown deadline={question.deadline} offset={live.offset} closed={state.status === 'QUESTION_CLOSED'} total={state.questionSeconds}/><h2>{question.prompt}</h2><LiveImage token={token} sessionId={id} question={question}/></div>
   <aside className="card live-control">
    {state.status === 'QUESTION_OPEN' ? <>
     <p className="live-answered" aria-live="polite"><strong>{question.answered}</strong> de {state.participantCount} respondieron</p>
     <div className="live-answer-bar" aria-hidden="true"><span style={{ transform: `scaleX(${Math.min(1, question.answered / Math.max(1, state.participantCount))})` }}/></div>
     <button className="button primary" disabled={action.pending} onClick={() => { void command('close'); }}>Cerrar pregunta</button>
    </> : <>
     <p className="live-correct">Respuesta correcta: <span className={'answer-chip ' + (question.correctAnswer ? 'true' : 'false')}><AnswerName value={!!question.correctAnswer}/></span></p>
     <Counts question={question} participants={state.participantCount}/>
     <button className="button primary" disabled={action.pending} onClick={() => { void command('next'); }}>{last ? 'Ver resultados finales' : 'Siguiente pregunta'}<ArrowRight size={18} aria-hidden="true"/></button>
    </>}
   </aside>
  </div>}
  {state.status === 'FINISHED' && <><Ranking ranking={state.ranking ?? []}/><div className="quiz-actions live-after"><Link className="button primary" to={'/results/' + id}>Ver resultados guardados</Link><Link className="button secondary" to="/quizzes">Volver a mis cuestionarios</Link></div></>}
  {state.status === 'CANCELLED' && <><p className="quiz-lead">La sala se cerró sin resultados.</p><Link className="button secondary" to="/quizzes">Volver a mis cuestionarios</Link></>}
 </section>;
}
