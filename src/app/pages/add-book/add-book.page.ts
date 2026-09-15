import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
import { bookmarkOutline, checkmarkCircleOutline, closeOutline, cloudUploadOutline, documentTextOutline, saveOutline } from 'ionicons/icons';
import { Book } from '../../models/book.model';
import { BookService } from '../../services/book.service';

@Component({
  selector: 'app-add-book',
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
  templateUrl: './add-book.page.html',
  styleUrl: './add-book.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddBookPage {
  readonly maxBookFileSize = 20 * 1024 * 1024;
  readonly bookmarkOutline = bookmarkOutline;
  readonly checkmarkCircleOutline = checkmarkCircleOutline;
  readonly closeOutline = closeOutline;
  readonly cloudUploadOutline = cloudUploadOutline;
  readonly documentTextOutline = documentTextOutline;
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

  saving = false;
  selectedFile: File | null = null;

  private readonly bookService = inject(BookService);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);
  private readonly cdr = inject(ChangeDetectorRef);

  async saveBook(): Promise<void> {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    const value = this.form.getRawValue();
    const book: Book = {
      title: value.title,
      author: value.author,
      category: value.category,
      publicationYear: value.publicationYear as number,
      availabilityStatus: value.availabilityStatus
    };

    try {
      await this.bookService.addBook(book, this.selectedFile ?? undefined);
      await this.showToast('Book added successfully.', 'success');
      await this.router.navigateByUrl('/books', { replaceUrl: true });
    } catch (error) {
      await this.showToast(this.messageFrom(error, 'Cannot create book.'), 'danger');
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  showError(controlName: keyof typeof this.form.controls, error?: string): boolean {
    const control = this.form.controls[controlName];
    return control.touched && control.invalid && (!error || control.hasError(error));
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      input.value = '';
      await this.showToast('Please choose a PDF file.', 'danger');
      return;
    }
    if (file.size > this.maxBookFileSize) {
      input.value = '';
      await this.showToast('The PDF must be 20 MB or smaller.', 'danger');
      return;
    }

    this.selectedFile = file;
    this.cdr.markForCheck();
  }

  removeSelectedFile(input: HTMLInputElement): void {
    this.selectedFile = null;
    input.value = '';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private async showToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastController.create({ message, color, duration: 2800, position: 'bottom' });
    await toast.present();
  }

  private messageFrom(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
