import { useEffect, useState, type FormEvent } from 'react';
import { IMAGE_RULES, type Question } from '../../services/quizzes';
export function QuestionForm({ question, pending, onSave, onCancel }: { question?: Question; pending: boolean; onSave: (values: { prompt: string; correctAnswer: boolean }, file: File | null) => Promise<void>; onCancel: () => void }) {
 const [prompt, setPrompt] = useState(question?.prompt ?? '');
 const [answer, setAnswer] = useState(question?.correctAnswer === false ? 'false' : 'true');
 const [file, setFile] = useState<File | null>(null), [preview, setPreview] = useState(''), [error, setError] = useState('');
 useEffect(() => { if (!file) { setPreview(''); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
 function submit(event: FormEvent) { event.preventDefault(); if (!pending && prompt.trim() && !error) void onSave({ prompt: prompt.trim(), correctAnswer: answer === 'true' }, file); }
 function choose(next: File | null) {
  const invalid = next !== null && (next.size > IMAGE_RULES.maxBytes || !(IMAGE_RULES.types as readonly string[]).includes(next.type));
  setError(invalid ? 'Selecciona JPEG, PNG o WebP de hasta 5 MB.' : '');
  setFile(invalid ? null : next);
 }
 return <form className="quiz-form question-form" onSubmit={submit} aria-busy={pending}>
  <fieldset disabled={pending}><legend>{question ? 'Editar pregunta' : 'Nueva pregunta'}</legend>
   <label>Enunciado<textarea required maxLength={2000} rows={3} value={prompt} onChange={event => setPrompt(event.target.value)}/></label>
   <label>Respuesta correcta<select value={answer} onChange={event => setAnswer(event.target.value)}><option value="true">Verdadero</option><option value="false">Falso</option></select></label>
   <label>{question?.imageId ? 'Reemplazar imagen' : 'Imagen (opcional)'}<input type="file" accept={IMAGE_RULES.types.join(',')} onChange={event => choose(event.target.files?.[0] ?? null)}/></label>
   <p className="field-help">JPEG, PNG o WebP. Hasta 5 MB y 16 megapíxeles; sin animación.</p>
   {preview && <img className="question-image" src={preview} alt="Vista previa de la imagen seleccionada"/>}
   {error && <p role="alert" className="form-error">{error}</p>}
   <div className="quiz-actions"><button className="button primary" disabled={!prompt.trim() || !!error}>{pending ? 'Guardando…' : 'Guardar pregunta'}</button><button type="button" className="button secondary" onClick={onCancel}>Cancelar</button></div>
  </fieldset>
 </form>;
}
