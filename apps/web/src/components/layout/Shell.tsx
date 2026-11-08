import { Suspense } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import { ChevronDown, Home, Layers3, Network, Play, Users, Zap } from 'lucide-react';
import { useSession } from '../../services/session';
export function Shell() { const { user } = useSession(), location = useLocation(); const showTeacherNav = user?.role === 'TEACHER' || (!user && location.pathname === '/'); return <>
 <a className="skip-link" href="#main">Saltar al contenido</a>
 <header className="topbar"><div className="topbar-inner">
  <Link className="brand" to="/" aria-label="NexQuiz, inicio"><span className="brand-mark"><Zap size={18} aria-hidden="true" fill="currentColor"/></span><span>NexQuiz</span><small>en ProfeLink</small></Link>
  <nav className="main-nav" aria-label="Navegación principal"><NavLink to="/" end><Home size={23} aria-hidden="true"/>Inicio</NavLink>{showTeacherNav && <NavLink to="/quizzes"><Layers3 size={23} aria-hidden="true"/>Mis cuestionarios</NavLink>}{(showTeacherNav || user) && <NavLink to="/sessions"><Play size={23} aria-hidden="true"/>Mis partidas</NavLink>}{!showTeacherNav && <NavLink to="/join"><Users size={23} aria-hidden="true"/>Estudiante · Unirse</NavLink>}</nav>
  {user ? <NavLink className="user-chip topbar-action" to="/profile" aria-label={'Mi perfil: ' + user.displayName}><span className="avatar" aria-hidden="true">{user.displayName.trim().charAt(0).toUpperCase() || '?'}</span><span>{user.displayName}</span><ChevronDown size={18} aria-hidden="true"/></NavLink> : <Link className="button primary small topbar-action" to="/login">Iniciar sesión</Link>}
 </div></header>
 <div className="shell">
  {/* Lazy routes load inside the shell, so navigation and footer never disappear. */}
  <main id="main"><Suspense fallback={<section className="content-page loading" role="status">Cargando…</section>}><Outlet/></Suspense></main>
  <footer><div className="footer-brand"><Link className="brand" to="/"><span className="brand-mark"><Zap size={22} aria-hidden="true" fill="currentColor"/></span>NexQuiz</Link><span>Evaluaciones en vivo para ProfeLink</span></div><nav aria-label="Información técnica"><NavLink to="/system"><Layers3 size={21} aria-hidden="true"/>Sistema</NavLink><NavLink to="/architecture"><Network size={21} aria-hidden="true"/>Arquitectura</NavLink></nav></footer>
 </div>
</>; }
