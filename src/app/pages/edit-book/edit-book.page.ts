import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController
} from '@ionic/angular';
import { checkmarkCircleOutline, createOutline, refreshOutline, saveOutline } from 'ionicons/icons';
import { Book } from '../../models/book.model';
import { BookService } from '../../services/book.service';

@Component({
  selector: 'app-edit-book',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTitle,
    IonToolbar
  ],
  templateUrl: './edit-book.page.html',
  styleUrl: './edit-book.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditBookPage implements OnInit {
  readonly checkmarkCircleOutline = checkmarkCircleOutline;
  readonly createOutline = createOutline;
  readonly refreshOutline = refreshOutline;
  readonly saveOutline = saveOutline;
  readonly currentYear = new Date().getFullYear();
  readonly categories = ['Programming', 'Fantasy', 'Science', 'History', 'Education', 'Fiction', 'Non-Fiction', 'Self-Help', 'Technology', 'Other'];

  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    author: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    category: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    publicationYear: new FormControl<number | null>(null, [Validators.required, Validators.min(1), Validators.max(this.currentYear)]),
    availabilityStatus: new FormControl<'Available' | 'Unavailable'>('Available', { nonNullable: true, validators: [Validators.required] })
  });

  loading = true;
  saving = false;
  loadError = '';
  private bookId = '';

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly bookService = inject(BookService);
  private readonly toastController = inject(ToastController);
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.bookId = this.route.snapshot.paramMap.get('id') ?? '';
    void this.loadBook();
  }

  async loadBook(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    try {
      const book = await this.bookService.getBookById(this.bookId);
      if (!book) {
        this.loadError = 'This book was not found. It may have been deleted.';
        return;
      }
      this.form.patchValue({
        title: book.title,
        author: book.author,
        category: book.category,
        publicationYear: book.publicationYear,
        availabilityStatus: book.availabilityStatus
      });
    } catch (error) {
      this.loadError = this.messageFrom(error, 'Cannot retrieve this book.');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async updateBook(): Promise<void> {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    const value = this.form.getRawValue();
    const changes: Partial<Book> = {
      title: value.title,
      author: value.author,
      category: value.category,
      publicationYear: value.publicationYear as number,
      availabilityStatus: value.availabilityStatus
    };

    try {
      await this.bookService.updateBook(this.bookId, changes);
      await this.showToast('Book updated successfully.', 'success');
      await this.router.navigateByUrl('/books', { replaceUrl: true });
    } catch (error) {
      await this.showToast(this.messageFrom(error, 'Cannot update book.'), 'danger');
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  showError(controlName: keyof typeof this.form.controls, error?: string): boolean {
    const control = this.form.controls[controlName];
    return control.touched && control.invalid && (!error || control.hasError(error));
  }

  private async showToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastController.create({ message, color, duration: 2800, position: 'bottom' });
    await toast.present();
  }

  private messageFrom(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
