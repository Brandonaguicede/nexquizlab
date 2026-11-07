import { imageBlob } from '../../services/quizzes';
import { useBlobUrl } from '../../services/use-load';
export function QuestionImage({ token, imageId }: { token: string; imageId: string }) {
 // The token rotates every few minutes; the image only depends on its id.
 const { url, failed } = useBlobUrl(signal => imageBlob(token, imageId, signal), [imageId]);
 return failed ? <p role="alert" className="form-error">No se pudo cargar la imagen. Vuelve a abrir el editor para reintentar.</p> : url ? <img className="question-image" src={url} alt="Imagen adjunta de la pregunta"/> : <p role="status">Cargando imagen…</p>;
}
