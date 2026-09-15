export interface Book {
  id?: string;
  title: string;
  author: string;
  category: string;
  publicationYear: number;
  availabilityStatus: 'Available' | 'Unavailable';
  fileName?: string;
  fileUrl?: string;
  fileStoragePath?: string;
  fileSize?: number;
  fileType?: string;
  createdAt?: string;
  updatedAt?: string;
}
