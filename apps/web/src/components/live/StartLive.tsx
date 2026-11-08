import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Radio } from 'lucide-react';
import { liveRequest, type SessionCreated } from '../../services/live';
import { useAction } from '../../services/use-action';
/** Opens a room from the current quiz; the server snapshots it, so later edits never change that game. */
export function StartLive({ token, quizId, questionCount }: { token: string; quizId: string; questionCount: number }) {
 const navigate = useNavigate(), action = useAction(), [seconds, setSeconds] = useState(20);
 return <section id="live" className="quiz-live-panel" aria-label="Jugar en vivo">
  <div><span className="icon-tile"><Radio size={22} aria-hidden="true"/></span><div><h2>Jugar en vivo</h2><p>Abre una sala con código. Las preguntas quedan fijas para esa partida.</p></div></div>
  <div className="quiz-live-controls">
   <label>Tiempo por pregunta<select value={seconds} onChange={event => setSeconds(Number(event.target.value))} disabled={action.pending}>{[10, 15, 20, 30, 45, 60].map(value => <option key={value} value={value}>{value} segundos</option>)}</select></label>
   <button className="button primary" disabled={action.pending || questionCount === 0} onClick={() => { void action.run(async () => { const session = await liveRequest<SessionCreated>(token, '/sessions', 'POST', { quizId, questionSeconds: seconds }); navigate('/host/' + session.id); }, ''); }}>Abrir sala<ArrowRight size={18} aria-hidden="true"/></button>
  </div>
  {questionCount === 0 && <p className="field-help">Agrega al menos una pregunta para abrir una sala.</p>}
  {action.error && <p role="alert" className="form-error">{action.error}</p>}
 </section>;
}
