import '../styles/live.css';
import { Link, useParams } from 'react-router-dom';
import { Hourglass } from 'lucide-react';
import { AnswerName, ConnectionBanner, Countdown, LiveImage, Ranking } from '../components/live/LiveParts';
import { count } from '../services/format';
import { ApiError } from '../services/http';
import { liveRequest, type AnswerAccepted } from '../services/live';
import { useSession } from '../services/session';
import { useCountdown, useLiveSession } from '../services/use-live-session';
import { useAction } from '../services/use-action';
export function Play() {
 const { id = '' } = useParams(), { accessToken } = useSession(), live = useLiveSession(id), action = useAction();
 const state = live.state, question = state?.currentQuestion ?? null;
 const seconds = useCountdown(state?.status === 'QUESTION_OPEN' ? question?.deadline : undefined, live.offset);
 if (!accessToken) return null;
 const token = accessToken;
 async function answer(value: boolean) {
  if (!question) return;
  await action.run(async () => {
   try {
    const accepted = await liveRequest<AnswerAccepted>(token, `/sessions/${encodeURIComponent(id)}/answers`, 'POST', { gameQuestionId: question.id, value });
    live.patch(current => current.me && current.currentQuestion?.id === question.id ? { ...current, me: { ...current.me, answer: { value: accepted.value } } } : current);
   } catch (cause) { if (cause instanceof ApiError && cause.status === 409) void live.resync(); throw cause; }
  }, '');
 }
 if (live.fatal) return <section className="content-page live-page"><h1>No pudimos abrir la sala.</h1><p className="form-error" role="alert">{live.fatal}</p><Link className="button primary" to="/join">Ingresar otro código</Link></section>;
 if (!state || !state.me) return <section className="content-page live-page" role="status"><ConnectionBanner connection={live.connection}/>Entrando a la sala…</section>;
 const me = state.me, open = state.status === 'QUESTION_OPEN', closed = state.status === 'QUESTION_CLOSED', timeUp = open && seconds === 0;
 const mine = state.ranking?.find(standing => standing.participantId === me.participantId);
 return <section className="content-page live-page play">
  <div className="live-heading compact"><div><p className="live-eyebrow">{state.title}</p><p className="live-me">{me.displayName} · <strong>{count(me.score, 'punto')}</strong></p></div>{question && (open || closed) && <span className="live-progress">{question.position + 1}/{question.total}</span>}</div>
  <ConnectionBanner connection={live.connection}/>
  {action.error && <p role="alert" className="form-error">{action.error}</p>}
  {state.status === 'LOBBY' && <div className="card live-wait"><span className="icon-tile"><Hourglass size={22} aria-hidden="true"/></span><h1>Ya estás en la sala.</h1><p className="quiz-lead">Tu docente iniciará la partida en un momento. {state.participantCount === 1 ? '1 persona conectada' : count(state.participantCount, 'persona') + ' en la sala'}.</p></div>}
  {question && (open || closed) && <div className="live-play">
   <Countdown deadline={question.deadline} offset={live.offset} closed={closed} total={state.questionSeconds}/>
   <h1 className="live-prompt">{question.prompt}</h1>
   <LiveImage token={token} sessionId={id} question={question}/>
   {open && <>
    <div className="live-answers" role="group" aria-label="Elige tu respuesta">
     {[true, false].map(value => <button key={String(value)} className={'live-answer ' + (value ? 'true' : 'false') + (me.answer?.value === value ? ' chosen' : '')} disabled={action.pending || !!me.answer || timeUp} aria-pressed={me.answer?.value === value} onClick={() => { void answer(value); }}><AnswerName value={value}/></button>)}
    </div>
    <p className="live-hint" role="status">{me.answer ? 'Respuesta enviada. Espera a que se cierre la pregunta.' : timeUp ? 'Se acabó el tiempo.' : 'Tienes una sola oportunidad por pregunta.'}</p>
   </>}
   {closed && <div className={'live-reveal ' + (me.answer ? (me.answer.correct ? 'right' : 'wrong') : 'none')} role="status">
    <strong>{me.answer ? (me.answer.correct ? '¡Correcto!' : 'Incorrecto') : 'Sin respuesta'}</strong>
    <p>La respuesta era <span className={'answer-chip ' + (question.correctAnswer ? 'true' : 'false')}><AnswerName value={!!question.correctAnswer}/></span></p>
    <p>Llevas {count(me.score, 'punto')}. Espera la siguiente pregunta.</p>
   </div>}
  </div>}
  {state.status === 'FINISHED' && <div className="live-final"><h1>Partida terminada</h1>{mine && <p className="quiz-lead">Quedaste en el puesto <strong>{mine.rank}</strong> con {count(mine.score, 'punto')}.</p>}<Ranking ranking={state.ranking ?? []} highlight={me.participantId}/><div className="quiz-actions"><Link className="button primary" to="/sessions">Ver mis partidas</Link><Link className="button secondary" to="/join">Unirme a otra sala</Link></div></div>}
  {state.status === 'CANCELLED' && <div className="live-final"><h1>La sala se canceló.</h1><Link className="button secondary" to="/join">Unirme a otra sala</Link></div>}
 </section>;
}
