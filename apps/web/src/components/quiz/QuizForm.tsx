import { useState, type FormEvent } from 'react';
import type { Quiz } from '../../services/quizzes';
export function QuizForm({ quiz, pending, onSave, onCancel }: { quiz?: Quiz; pending: boolean; onSave: (values: { title: string; description: string }) => Promise<void>; onCancel?: () => void }) {
 const [title, setTitle] = useState(quiz?.title ?? '');
 const [description, setDescription] = useState(quiz?.description ?? '');
 function submit(event: FormEvent) { event.preventDefault(); if (title.trim() && !pending) void onSave({ title: title.trim(), description: description.trim() }); }
 return <form className="quiz-form" onSubmit={submit} aria-busy={pending}>
  <fieldset disabled={pending}><legend className="sr-only">Datos del cuestionario</legend>
   <label>Título<input required maxLength={160} value={title} onChange={event => setTitle(event.target.value)} autoComplete="off"/></label>
   <label>Descripción <span className="optional">(opcional)</span><textarea maxLength={2000} rows={3} value={description} onChange={event => setDescription(event.target.value)}/></label>
   <div className="quiz-actions"><button className="button primary" disabled={!title.trim()}>{pending ? 'Guardando…' : quiz ? 'Guardar cuestionario' : 'Crear cuestionario'}</button>{onCancel && <button type="button" className="button secondary" onClick={onCancel}>Cancelar</button>}</div>
  </fieldset>
 </form>;
}
