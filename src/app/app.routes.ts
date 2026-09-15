import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'books' },
  {
    path: 'books/add',
    loadComponent: () => import('./pages/add-book/add-book.page').then((m) => m.AddBookPage)
  },
  {
    path: 'books/edit/:id',
    loadComponent: () => import('./pages/edit-book/edit-book.page').then((m) => m.EditBookPage)
  },
  {
    path: 'books',
    loadComponent: () => import('./pages/books/books.page').then((m) => m.BooksPage)
  },
  { path: '**', redirectTo: 'books' }
];
