export abstract class ImageStorage {
 abstract open(id: string): Promise<AsyncIterable<Uint8Array>>;
 abstract save(id: string, temporaryPath: string): Promise<void>;
 /** Duplicates a stored image under a new identifier; the source stays untouched. */
 abstract copy(sourceId: string, targetId: string): Promise<void>;
 abstract remove(id: string): Promise<void>;
 abstract cleanTemporary(before: Date): Promise<void>;
}
