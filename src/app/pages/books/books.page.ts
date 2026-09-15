import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonAlert,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonSearchbar,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToolbar
} from '@ionic/angular';
import { addOutline, bookOutline, createOutline, documentTextOutline, refreshOutline, searchOutline, trashOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { Book } from '../../models/book.model';
import { BookService } from '../../services/book.service';

type AvailabilityFilter = 'All' | 'Available' | 'Unavailable';

@Component({
  selector: 'app-books',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IonAlert,
    IonBadge,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonSearchbar,
    IonSpinner,
    IonTitle,
    IonToast,
    IonToolbar
  ],
  templateUrl: './books.page.html',
  styleUrl: './books.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BooksPage implements OnInit, OnDestroy {
  readonly addOutline = addOutline;
  readonly bookOutline = bookOutline;
  readonly createOutline = createOutline;
  readonly documentTextOutline = documentTextOutline;
  readonly refreshOutline = refreshOutline;
  readonly searchOutline = searchOutline;
  readonly trashOutline = trashOutline;
  readonly filters: AvailabilityFilter[] = ['All', 'Available', 'Unavailable'];
  readonly deleteAlertButtons = [
    { text: 'Cancel', role: 'cancel' },
    { text: 'Delete', role: 'destructive', cssClass: 'danger-button' }
  ];

  books: Book[] = [];
  loading = true;
  errorMessage = '';
  searchTerm = '';
  activeFilter: AvailabilityFilter = 'All';
  pendingDelete: Book | null = null;
  deleting = false;
  toastOpen = false;
  toastMessage = '';
  toastColor: 'success' | 'danger' = 'success';

  private readonly bookService = inject(BookService);
  private readonly cdr = inject(ChangeDetectorRef);
  private booksSubscription?: Subscription;

  get filteredBooks(): Book[] {
    const query = this.searchTerm.trim().toLowerCase();
    return this.books.filter((book) => {
      const matchesFilter = this.activeFilter === 'All' || book.availabilityStatus === this.activeFilter;
      const searchable = `${book.title} ${book.author} ${book.category}`.toLowerCase();
      return matchesFilter && (!query || searchable.includes(query));
    });
  }

  get availableCount(): number {
    return this.books.filter((book) => book.availabilityStatus === 'Available').length;
  }

  ngOnInit(): void {
    this.connectToBooks();
  }

  ngOnDestroy(): void {
    this.booksSubscription?.unsubscribe();
  }

  connectToBooks(): void {
    this.booksSubscription?.unsubscribe();
    this.loading = true;
    this.errorMessage = '';
    this.booksSubscription = this.bookService.getBooks().subscribe({
      next: (books) => {
        this.books = books;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        this.loading = false;
        this.errorMessage = this.messageFrom(error, 'Cannot retrieve books.');
        this.cdr.markForCheck();
      }
    });
  }

  onSearch(event: Event): void {
    this.searchTerm = (event as CustomEvent<{ value?: string | null }>).detail.value ?? '';
  }

  setFilter(filter: AvailabilityFilter): void {
    this.activeFilter = filter;
  }

  requestDelete(book: Book): void {
    if (!this.deleting) this.pendingDelete = book;
  }

  async onDeleteDismiss(event: Event): Promise<void> {
    const book = this.pendingDelete;
    this.pendingDelete = null;
    if ((event as CustomEvent<{ role?: string }>).detail.role !== 'destructive' || !book?.id) return;

    this.deleting = true;
    try {
      await this.bookService.deleteBook(book.id);
      this.showToast('Book deleted successfully.', 'success');
    } catch (error) {
      this.showToast(this.messageFrom(error, 'Cannot delete book.'), 'danger');
    } finally {
      this.deleting = false;
      this.cdr.markForCheck();
    }
  }

  private showToast(message: string, color: 'success' | 'danger'): void {
    this.toastMessage = message;
    this.toastColor = color;
    this.toastOpen = true;
  }

  private messageFrom(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
