import { Injectable } from '@angular/core';
import { FirebaseApp, FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Database,
  DataSnapshot,
  get,
  getDatabase,
  onValue,
  push,
  ref,
  remove,
  set,
  update
} from 'firebase/database';
import {
  FirebaseStorage,
  deleteObject,
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes
} from 'firebase/storage';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Book } from '../models/book.model';

const BOOKS_PATH = 'books';
const MAX_BOOK_FILE_SIZE = 20 * 1024 * 1024;

@Injectable({ providedIn: 'root' })
export class BookService {
  private appInstance?: FirebaseApp;
  private databaseInstance?: Database;
  private storageInstance?: FirebaseStorage;

  getBooks(): Observable<Book[]> {
    return new Observable<Book[]>((subscriber) => {
      let unsubscribe: (() => void) | undefined;

      try {
        unsubscribe = onValue(
          ref(this.database, BOOKS_PATH),
          (snapshot) => subscriber.next(this.toBookArray(snapshot)),
          (error) => subscriber.error(this.friendlyError(error, 'Cannot retrieve books.'))
        );
      } catch (error) {
        subscriber.error(this.friendlyError(error, 'Cannot retrieve books.'));
      }

      return () => unsubscribe?.();
    });
  }

  async getBookById(id: string): Promise<Book | null> {
    this.assertValidId(id);
    try {
      const snapshot = await get(ref(this.database, `${BOOKS_PATH}/${id}`));
      if (!snapshot.exists()) return null;
      return { id: snapshot.key ?? id, ...(snapshot.val() as Omit<Book, 'id'>) };
    } catch (error) {
      throw this.friendlyError(error, 'Cannot retrieve this book.');
    }
  }

  async addBook(book: Book, file?: File): Promise<string> {
    let uploadedPath: string | undefined;
    try {
      const newBookRef = push(ref(this.database, BOOKS_PATH));
      if (!newBookRef.key) throw new Error('Firebase could not generate a book ID.');

      const timestamp = new Date().toISOString();
      const fileDetails = file ? await this.uploadBookFile(newBookRef.key, file) : {};
      uploadedPath = fileDetails.fileStoragePath;
      await set(newBookRef, {
        title: book.title.trim(),
        author: book.author.trim(),
        category: book.category,
        publicationYear: Number(book.publicationYear),
        availabilityStatus: book.availabilityStatus,
        ...fileDetails,
        createdAt: timestamp,
        updatedAt: timestamp
      });
      return newBookRef.key;
    } catch (error) {
      if (uploadedPath) {
        try {
          await deleteObject(storageRef(this.storage, uploadedPath));
        } catch (cleanupError) {
          console.error('Could not clean up the uploaded book file.', cleanupError);
        }
      }
      throw this.friendlyError(error, 'Cannot create book.');
    }
  }

  async updateBook(id: string, book: Partial<Book>): Promise<void> {
    this.assertValidId(id);
    try {
      const bookRef = ref(this.database, `${BOOKS_PATH}/${id}`);
      const existingSnapshot = await get(bookRef);
      if (!existingSnapshot.exists()) throw new Error('This book no longer exists.');

      const existing = existingSnapshot.val() as Book;
      await update(bookRef, {
        title: book.title?.trim() ?? existing.title,
        author: book.author?.trim() ?? existing.author,
        category: book.category ?? existing.category,
        publicationYear: book.publicationYear === undefined ? existing.publicationYear : Number(book.publicationYear),
        availabilityStatus: book.availabilityStatus ?? existing.availabilityStatus,
        createdAt: existing.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      throw this.friendlyError(error, 'Cannot update book.');
    }
  }

  async deleteBook(id: string): Promise<void> {
    this.assertValidId(id);
    try {
      const bookRef = ref(this.database, `${BOOKS_PATH}/${id}`);
      const snapshot = await get(bookRef);
      if (snapshot.exists()) {
        const book = snapshot.val() as Book;
        if (book.fileStoragePath) {
          try {
            await deleteObject(storageRef(this.storage, book.fileStoragePath));
          } catch (error) {
            if (!this.isMissingStorageObject(error)) throw error;
          }
        }
      }
      await remove(bookRef);
    } catch (error) {
      throw this.friendlyError(error, 'Cannot delete book.');
    }
  }

  private get database(): Database {
    if (!this.databaseInstance) {
      this.databaseInstance = getDatabase(this.app);
    }
    return this.databaseInstance;
  }

  private get storage(): FirebaseStorage {
    if (!this.storageInstance) this.storageInstance = getStorage(this.app);
    return this.storageInstance;
  }

  private get app(): FirebaseApp {
    if (!this.appInstance) {
      const config = environment.firebase as FirebaseOptions;
      this.validateConfiguration(config);
      this.appInstance = getApps().length ? getApp() : initializeApp(config);
    }
    return this.appInstance;
  }

  private async uploadBookFile(bookId: string, file: File): Promise<Pick<Book, 'fileName' | 'fileUrl' | 'fileStoragePath' | 'fileSize' | 'fileType'>> {
    this.validateBookFile(file);
    const fileName = this.safePdfFileName(file.name);
    const fileStoragePath = `${BOOKS_PATH}/${bookId}/${fileName}`;
    const snapshot = await uploadBytes(storageRef(this.storage, fileStoragePath), file, {
      contentType: 'application/pdf',
      customMetadata: { bookId }
    });
    let fileUrl: string;
    try {
      fileUrl = await getDownloadURL(snapshot.ref);
    } catch (error) {
      try {
        await deleteObject(snapshot.ref);
      } catch (cleanupError) {
        console.error('Could not clean up a PDF whose download URL failed.', cleanupError);
      }
      throw error;
    }
    return {
      fileName: file.name,
      fileUrl,
      fileStoragePath,
      fileSize: file.size,
      fileType: 'application/pdf'
    };
  }

  private validateBookFile(file: File): void {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) throw new Error('Only PDF book files are supported.');
    if (file.size > MAX_BOOK_FILE_SIZE) throw new Error('The PDF must be 20 MB or smaller.');
  }

  private safePdfFileName(fileName: string): string {
    const baseName = fileName.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
    return `${baseName || 'book'}.pdf`;
  }

  private isMissingStorageObject(error: unknown): boolean {
    return error instanceof Error && error.message.includes('storage/object-not-found');
  }

  private toBookArray(snapshot: DataSnapshot): Book[] {
    const value = snapshot.val() as Record<string, Omit<Book, 'id'>> | null;
    if (!value) return [];
    return Object.entries(value)
      .map(([id, book]) => ({ id, ...book }))
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  }

  private validateConfiguration(config: FirebaseOptions): void {
    const required = [config.apiKey, config.projectId, config.databaseURL, config.storageBucket, config.appId];
    if (required.some((value) => !value || String(value).startsWith('YOUR_') || String(value).includes('YOUR_PROJECT'))) {
      throw new Error('Invalid Firebase configuration. Add your project values in src/environments/environment.ts.');
    }
  }

  private assertValidId(id: string): void {
    if (!id || /[.#$\[\]/]/.test(id)) throw new Error('Invalid Firebase book ID.');
  }

  private friendlyError(error: unknown, fallback: string): Error {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('Invalid Firebase configuration') || message.includes('no longer exists') || message.includes('Invalid Firebase')) {
      return new Error(message);
    }
    if (message.includes('Only PDF') || message.includes('20 MB or smaller')) return new Error(message);
    if (message.includes('storage/unauthorized')) {
      return new Error(`${fallback} Firebase Storage rules denied access.`);
    }
    if (message.includes('PERMISSION_DENIED') || message.includes('permission_denied')) {
      return new Error(`${fallback} Firebase Database rules denied access.`);
    }
    if (message.toLowerCase().includes('network') || message.toLowerCase().includes('offline')) {
      return new Error(`${fallback} Check your network connection.`);
    }
    return new Error(fallback);
  }
}
