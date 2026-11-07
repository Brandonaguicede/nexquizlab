import { useEffect, useState, type CSSProperties } from 'react';
import { Check, Copy, WifiOff, X } from 'lucide-react';
import { sessionImage, type CurrentQuestion, type Standing } from '../../services/live';
import { count } from '../../services/format';
import { useCountdown, type Connection } from '../../services/use-live-session';
import { useBlobUrl } from '../../services/use-load';
export function ConnectionBanner({ connection }: { connection: Connection }) {
 if (connection === 'online') return null;
 return <p className="live-connection" role="status"><WifiOff size={18} aria-hidden="true"/>{connection === 'connecting' ? 'Conectando con la sala…' : 'Se perdió la conexión. Reintentando… Tu participación y tu puntaje se conservan.'}</p>;
}
export function LiveImage({ token, sessionId, question }: { token: string; sessionId: string; question: CurrentQuestion }) {
 // The token rotates every few minutes; the image only depends on the question.
 const { url, failed } = useBlobUrl(question.hasImage ? signal => sessionImage(token, sessionId, question.id, signal) : null, [sessionId, question.id, question.hasImage]);
 if (!question.hasImage) return null;
 if (failed) return <p className="form-error" role="alert">No se pudo cargar la imagen de esta pregunta.</p>;
 return url ? <img className="live-image" src={url} alt="Imagen de la pregunta"/> : <div className="live-image placeholder" role="status">Cargando imagen…</div>;
}
/** The ring empties against the question length (total seconds). */
export function Countdown({ deadline, offset, closed, total }: { deadline: string; offset: number; closed: boolean; total: number }) {
 const seconds = useCountdown(closed ? undefined : deadline, offset);
 const progress = { '--progress': Math.min(1, seconds / Math.max(1, total)) } as CSSProperties;
 return <div className={'live-countdown' + (closed ? ' closed' : seconds <= 5 ? ' urgent' : '')} style={progress} role="timer" aria-live="off" aria-label={closed ? 'Pregunta cerrada' : `Quedan ${seconds} segundos`}><span>{closed ? 'Cerrada' : seconds}</span></div>;
}
export function AnswerName({ value }: { value: boolean }) {
 return <>{value ? <Check size={20} aria-hidden="true"/> : <X size={20} aria-hidden="true"/>}{value ? 'Verdadero' : 'Falso'}</>;
}
export function Counts({ question, participants }: { question: CurrentQuestion; participants: number }) {
 const counts = question.counts ?? { true: 0, false: 0, none: participants };
 const total = Math.max(1, counts.true + counts.false + counts.none);
 const rows = [['Verdadero', counts.true, question.correctAnswer === true, 'true'], ['Falso', counts.false, question.correctAnswer === false, 'false'], ['Sin respuesta', counts.none, false, 'none']] as const;
 return <dl className="live-counts">{rows.map(([label, value, correct, kind]) => <div key={label} className={kind + (correct ? ' correct' : '')}><dt>{label}{correct && <span> · correcta</span>}</dt><dd><span className="bar" style={{ width: `${(value / total) * 100}%` }}/><strong>{value}</strong></dd></div>)}</dl>;
}
export function Ranking({ ranking, highlight }: { ranking: Standing[]; highlight?: string }) {
 if (!ranking.length) return <p className="quiz-lead">Nadie participó en esta partida.</p>;
 return <ol className="live-ranking">{ranking.map(standing => <li key={standing.participantId} className={standing.participantId === highlight ? 'me' : ''}>
  <span className="rank">{standing.rank}</span><span className="name">{standing.displayName}{standing.participantId === highlight && <small> (tú)</small>}</span><span className="score">{count(standing.score, 'punto')}</span>
 </li>)}</ol>;
}
/** Clipboard needs a secure context; on a classroom LAN over plain HTTP it falls back to selecting the text. */
export function CopyButton({ text, label }: { text: string; label: string }) {
 const [done, setDone] = useState<'' | 'ok' | 'manual'>('');
 useEffect(() => { if (!done) return; const timer = window.setTimeout(() => setDone(''), 2200); return () => window.clearTimeout(timer); }, [done]);
 async function copy() {
  try { await navigator.clipboard.writeText(text); setDone('ok'); }
  catch { window.prompt('Copia este texto:', text); setDone('manual'); }
 }
 return <button type="button" className="button secondary small" onClick={() => { void copy(); }}>{done === 'ok' ? <Check size={16} aria-hidden="true"/> : <Copy size={16} aria-hidden="true"/>}<span aria-live="polite">{done === 'ok' ? '¡Copiado!' : label}</span></button>;
}
