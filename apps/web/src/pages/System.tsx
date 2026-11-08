import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { getHealth, services } from '../services/http';
type State = 'loading' | 'ok' | 'error';
export function System() {
 const [states,setStates] = useState<State[]>(['loading','loading']);
 const controller = useRef<AbortController | null>(null);
 const refresh = useCallback(() => { controller.current?.abort(); const active = new AbortController(); controller.current = active; setStates(['loading','loading']);
 services.forEach((service,index) => { void getHealth(service.base,active.signal).then(()=> { if(!active.signal.aborted) setStates(current=>current.map((s,i)=>i===index?'ok':s)); }).catch(()=> { if(!active.signal.aborted) setStates(current=>current.map((s,i)=>i===index?'error':s)); }); });
 },[]);
 useEffect(()=>{refresh();return ()=>controller.current?.abort();},[refresh]);
 const busy=states.includes('loading');
 return <section className="content-page"><h1>Estado del <em>sistema</em></h1><p className="page-lead">Consulta la conexión de cada API con su base de datos. El estado se comprueba al abrir esta página.</p><div className="section-toolbar"><h2>Estado de servicios</h2><button className="button secondary" onClick={refresh} disabled={busy}><RefreshCw size={16} aria-hidden="true"/>{busy?'Comprobando…':'Volver a comprobar'}</button></div><div className="status-list" aria-live="polite" aria-busy={busy}>{services.map((service,i)=><article className="card status-row" key={service.name}><div><h3>{service.name}</h3><p>{service.purpose}</p></div><span className={'status '+states[i]}>{states[i]==='loading'?'Comprobando…':states[i]==='ok'?'Disponible':'Sin conexión'}</span><a href={service.base+'/docs'} target="_blank" rel="noreferrer">Documentación <ExternalLink size={15} aria-hidden="true"/><span className="sr-only"> (nueva pestaña)</span></a></article>)}</div><p className="help-text">¿Sin conexión? Comprueba que las APIs y PostgreSQL estén iniciados y vuelve a intentarlo. No se muestran datos simulados.</p></section>;
}
