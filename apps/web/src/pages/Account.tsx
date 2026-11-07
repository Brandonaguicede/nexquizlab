import { useState, type FormEvent } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, Eye, EyeOff, LockKeyhole, LogIn, Mail, Play, UserPlus, UserRound, Zap } from 'lucide-react';
import { BrandWaves, EducationBadge } from '../components/ui/BrandArt';
import { messageOf } from '../services/format';
import { useSession } from '../services/session';
export function ProtectedRoute({ role }: { role?: 'TEACHER' | 'STUDENT' }) {
 const { user, loading } = useSession(), location = useLocation();
 if (user && role === 'STUDENT' && user.role === 'TEACHER') return <section className="content-page"><h1>Este enlace es para estudiantes.</h1><p>Has iniciado sesi?n como profesor. Controla tu sala desde el panel del profesor.</p><p>Para probar la participaci?n, abre este mismo enlace en una ventana privada u otro navegador e inicia sesi?n con una cuenta de estudiante.</p><div className="quiz-actions"><Link className="button primary" to="/quizzes">Panel del profesor</Link><Link className="button secondary" to="/profile">Ver mi cuenta</Link></div></section>;
 if (loading) return <section className="content-page" role="status">Comprobando tu sesión…</section>;
 // Remember the destination (e.g. /join?code=…) so a participant lands back in the room after login.
 return user ? (role && user.role !== role ? <Navigate to={user.role === 'TEACHER' ? '/quizzes' : '/join'} replace/> : <Outlet/>) : <Navigate to="/login" replace state={{ from: location.pathname + location.search }}/>;
}
export function AccountForm({ register = false }: { register?: boolean }) {
 const auth = useSession(); const navigate = useNavigate(); const location = useLocation();
 const requested = (location.state as { from?: unknown } | null)?.from;
 // Only same-origin paths: '//host' would be an open redirect.
 const from = typeof requested === 'string' && requested.startsWith('/') && !requested.startsWith('//') ? requested : '/';
 const [pending, setPending] = useState(false); const [error, setError] = useState(''); const [showPassword, setShowPassword] = useState(false);
 if (auth.loading) return <section className="content-page" role="status">Comprobando tu sesión…</section>;
 if (auth.user) return <Navigate to={from} replace/>;
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); if (pending) return;
  const form = event.currentTarget; const data = new FormData(form);
  setPending(true); setError('');
  try {
   const input = { email: String(data.get('email') || ''), password: String(data.get('password') || '') };
   if (register) await auth.register({ ...input, displayName: String(data.get('displayName') || '') }); else await auth.signIn(input);
   form.reset(); navigate(from, { replace: true });
  } catch (cause) { setError(messageOf(cause, 'No se pudo completar la solicitud.')); }
  finally { setPending(false); }
 }
 return <section className="content-page account-layout auth-page"><BrandWaves/>
  <div className="account-intro"><div className="auth-copy"><EducationBadge/><h1>{register ? <>Tu próximo<br/><em>comienzo.</em></> : <>Qué bueno<br/>verte <em>de nuevo.</em></>}</h1><p>{register ? 'Crea tu cuenta de estudiante, únete con el código de tu profesor y juega con tu clase.' : 'Inicia sesión para volver a tu espacio en NexQuiz, crear cuestionarios, organizar partidas y seguir el progreso de tus clases.'}</p></div><img className="auth-illustration" src="/art/clipboard.png" alt=""/><div className="auth-benefits"><span><span className="icon-tile"><Zap fill="currentColor"/></span>Crea<br/>cuestionarios</span><span><span className="icon-tile"><Play fill="currentColor"/></span>Juega<br/>en vivo</span><span><span className="icon-tile"><BarChart3/></span>Analiza<br/>resultados</span></div></div>
  <form className="card account-form" onSubmit={event => { void submit(event); }} aria-busy={pending}>
   <h2>{register ? 'Crear cuenta' : 'Iniciar sesión'}</h2>
   <p className="auth-form-lead">{register ? 'Crea tu cuenta de estudiante para unirte a las salas y responder.' : 'Accede a tu cuenta de NexQuiz.'}</p>
   {register && <label className="field">Nombre<span className="input-with-icon"><UserRound size={22} aria-hidden="true"/><input className="input" name="displayName" placeholder="Tu nombre" autoComplete="name" required minLength={1} maxLength={100} disabled={pending}/></span></label>}
   <label className="field">Correo electrónico<span className="input-with-icon"><Mail size={22} aria-hidden="true"/><input className="input" name="email" type="email" placeholder="Correo electrónico" autoComplete="email" required maxLength={254} disabled={pending}/></span></label>
   <label className="field">Contraseña<span className="input-with-icon"><LockKeyhole size={22} aria-hidden="true"/><input className="input" name="password" placeholder="Tu contraseña" type={showPassword ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} required minLength={12} maxLength={128} aria-describedby="password-help" disabled={pending}/><button className="password-toggle" type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <Eye size={22}/> : <EyeOff size={22}/>}</button></span></label>
   <p id="password-help" className="field-help">Entre 12 y 128 caracteres. Puedes usar una frase fácil de recordar.</p>
   {error && <p className="form-error" role="alert">{error}</p>}
   <button className="button primary" type="submit" disabled={pending}>{register ? <UserPlus size={23} aria-hidden="true"/> : <LogIn size={23} aria-hidden="true"/>}{pending ? 'Un momento…' : register ? 'Crear mi cuenta' : 'Entrar'}</button>
   <div className="auth-divider"><span>o</span></div><Link className="button secondary" to={register ? '/login' : '/register'} state={location.state}>{register ? <LogIn size={23} aria-hidden="true"/> : <UserPlus size={23} aria-hidden="true"/>}{register ? 'Ya tengo una cuenta' : 'Crear una cuenta'}</Link>
  </form>
 </section>;
}
export function ProfilePage() {
 const auth = useSession(); const navigate = useNavigate();
 const [pending, setPending] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
 const user = auth.user;
 if (!user) return null;
 async function logout() {
  setPending(true); setError('');
  try { await auth.signOut(); navigate('/login', { replace: true }); }
  catch (cause) { setError(messageOf(cause, 'No pudimos cerrar la sesión. Inténtalo otra vez.')); }
  finally { setPending(false); }
 }
 async function verify() {
  setPending(true); setError(''); setMessage('');
  try { setMessage(await auth.verifyGame()); }
  catch (cause) { setError(messageOf(cause, 'No pudimos verificar tu identidad.')); }
  finally { setPending(false); }
 }
 return <section className="content-page account-layout"><div className="account-intro"><h1>Hola, {user.displayName}.</h1><p>Tu espacio muestra las opciones de tu rol. Usa una cuenta de estudiante distinta para participar en las salas del profesor. Tu nombre es el que ven los demás en la partida.</p><Link className="text-link" to="/">Ir al inicio <ArrowRight size={16} aria-hidden="true"/></Link></div>
 <div className="card account-details"><h2>Mi perfil</h2><dl><div><dt>Rol</dt><dd>{user.role === 'TEACHER' ? 'Profesor' : 'Estudiante'}</dd></div><div><dt>Nombre</dt><dd>{user.displayName}</dd></div><div><dt>Correo electrónico</dt><dd>{user.email}</dd></div><div><dt>Miembro desde</dt><dd>{new Intl.DateTimeFormat('es-CR', { dateStyle: 'long' }).format(new Date(user.createdAt))}</dd></div></dl>
 <div className="account-actions"><button className="button secondary" disabled={pending} onClick={() => { void verify(); }}>Comprobar identidad</button><button className="button primary" disabled={pending} onClick={() => { void logout(); }}>Cerrar sesión</button></div>
 {pending && <p className="loading" role="status">Un momento…</p>}{message && <p className="notice" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}
 </div></section>;
}
