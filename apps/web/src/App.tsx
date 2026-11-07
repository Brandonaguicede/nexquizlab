import { lazy } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { Shell } from './components/layout/Shell';
import { Home } from './pages/Home';
import { System } from './pages/System';
import { Architecture } from './pages/Architecture';
import { AccountForm, ProfilePage, ProtectedRoute } from './pages/Account';
import { SessionProvider } from './services/session';
const Quizzes = lazy(() => import('./pages/Quizzes').then(module => ({ default: module.Quizzes })));
const QuizEditor = lazy(() => import('./pages/QuizEditor').then(module => ({ default: module.QuizEditor })));
const HostSession = lazy(() => import('./pages/HostSession').then(module => ({ default: module.HostSession })));
const Join = lazy(() => import('./pages/Join').then(module => ({ default: module.Join })));
const Play = lazy(() => import('./pages/Play').then(module => ({ default: module.Play })));
const History = lazy(() => import('./pages/History').then(module => ({ default: module.History })));
const Results = lazy(() => import('./pages/Results').then(module => ({ default: module.Results })));
export function App() { return <SessionProvider><Routes><Route element={<Shell/>}><Route index element={<Home/>}/><Route path="system" element={<System/>}/><Route path="architecture" element={<Architecture/>}/><Route path="register" element={<AccountForm register/>}/><Route path="login" element={<AccountForm/>}/><Route element={<ProtectedRoute/>}><Route path="profile" element={<ProfilePage/>}/><Route element={<ProtectedRoute role="TEACHER"/>}><Route path="quizzes" element={<Quizzes/>}/><Route path="quizzes/:id" element={<QuizEditor/>}/><Route path="host/:id" element={<HostSession/>}/></Route><Route element={<ProtectedRoute role="STUDENT"/>}><Route path="join" element={<Join/>}/><Route path="play/:id" element={<Play/>}/></Route><Route path="results/:id" element={<Results/>}/><Route path="sessions" element={<History/>}/></Route><Route path="*" element={<section className="content-page"><h1>Esta página no existe.</h1><Link className="button primary" to="/">Volver al inicio</Link></section>}/></Route></Routes></SessionProvider>; }
