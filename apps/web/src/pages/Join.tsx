import '../styles/live.css';
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { messageOf } from '../services/format';
import { liveRequest, roomCode, type Joined } from '../services/live';
import { useSession } from '../services/session';
export function Join() {
 const { accessToken, user } = useSession(), navigate = useNavigate(), [params] = useSearchParams();
 // A shared link may carry a lowercase or spaced code; it gets the same cleanup as typing.
 const [code, setCode] = useState(roomCode(params.get('code') ?? '')), [pending, setPending] = useState(false), [error, setError] = useState('');
 if (!accessToken) return null;
 const token = accessToken;
 async function submit(event: FormEvent) {
  event.preventDefault(); if (pending) return;
  setPending(true); setError('');
  try { const joined = await liveRequest<Joined>(token, '/sessions/join', 'POST', { code }); navigate('/play/' + joined.sessionId); }
  catch (cause) { setError(messageOf(cause, 'No pudimos unirte a la sala.')); }
  finally { setPending(false); }
 }
 return <section className="content-page live-page join">
  <h1>Únete a la partida.</h1>
  <p className="quiz-lead">Escribe el código que muestra tu docente. Jugarás como <strong>{user?.displayName}</strong>.</p>
  <form className="card live-join-form" onSubmit={event => { void submit(event); }} aria-busy={pending}>
   <label>Código de la sala<input value={code} onChange={event => setCode(roomCode(event.target.value))} inputMode="text" autoCapitalize="characters" autoComplete="off" spellCheck={false} required minLength={6} maxLength={6} placeholder="K7P3QX" aria-describedby={error ? 'join-error' : undefined} disabled={pending}/></label>
   {error && <p id="join-error" role="alert" className="form-error">{error}</p>}
   <button className="button primary" disabled={pending || code.length !== 6}>{pending ? 'Entrando…' : 'Entrar a la sala'}<ArrowRight size={18} aria-hidden="true"/></button>
  </form>
 </section>;
}
