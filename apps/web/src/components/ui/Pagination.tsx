import { ChevronLeft, ChevronRight } from 'lucide-react';
export function Pagination({ page, pageSize, total, label, disabled = false, onPage }: { page: number; pageSize: number; total: number; label: string; disabled?: boolean; onPage: (page: number) => void }) {
 return <nav className="quiz-pagination" aria-label={label}>
  <button className="button secondary" disabled={disabled || page === 1} onClick={() => onPage(page - 1)}><ChevronLeft size={20} aria-hidden="true"/>Anterior</button>
  <span>Página {page} de {Math.max(1, Math.ceil(total / pageSize))}</span>
  <button className="button secondary" disabled={disabled || page * pageSize >= total} onClick={() => onPage(page + 1)}>Siguiente<ChevronRight size={20} aria-hidden="true"/></button>
 </nav>;
}
