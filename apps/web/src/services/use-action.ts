import { useRef, useState } from 'react';
import { messageOf } from './format';
/** One user action at a time (save, delete, host command…) with its pending, error and success notice state. */
export function useAction() {
 const active = useRef(false);
 const [pending, setPending] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
 async function run(work: () => Promise<void>, success: string) {
  if (active.current) return false;
  active.current = true; setPending(true); setError(''); setNotice('');
  try { await work(); setNotice(success); return true; }
  catch (cause) { setError(messageOf(cause, 'No se pudo completar la solicitud.')); return false; }
  finally { active.current = false; setPending(false); }
 }
 return { pending, error, notice, run };
}
