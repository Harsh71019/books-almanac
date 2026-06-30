import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type BookDocument = HydratedDocument<Book>;

@Schema({ timestamps: true, collection: 'books' })
export class Book {
  @Prop({ required: true, trim: true, index: true })
  title: string;

  @Prop({ type: [String], default: [], index: true })
  authors: string[];

  @Prop({ type: String, default: null })
  coverUrl: string | null;

  @Prop({ type: String, default: null, index: true })
  isbn13: string | null;

  @Prop({ type: Number, default: null })
  publishedYear: number | null;

  @Prop({ type: [String], default: [] })
  genres: string[];

  @Prop({ type: Number, default: null, min: 1 })
  pageCount: number | null;

  @Prop({ type: Number, default: null, min: 0 })
  currentPage: number | null;

  @Prop({ type: String, default: null })
  language: string | null;

  @Prop({ type: String, enum: ['physical', 'ebook', 'audio'], default: 'physical' })
  format: 'physical' | 'ebook' | 'audio';

  @Prop({ type: String, enum: ['want_to_read', 'reading', 'read'], default: 'want_to_read' })
  status: 'want_to_read' | 'reading' | 'read';

  @Prop({ type: Number, default: null, min: 0.5, max: 5 })
  rating: number | null;

  @Prop({ type: Boolean, default: false, index: true })
  favorite: boolean;

  @Prop({ type: Date, default: null })
  startedAt: Date | null;

  @Prop({ type: Date, default: null, index: true })
  finishedAt: Date | null;

  @Prop({ type: String, default: null })
  review: string | null;

  @Prop({ type: String, enum: ['google_books', 'open_library', 'manual'], default: 'manual' })
  source: 'google_books' | 'open_library' | 'manual';

  @Prop({ type: String, default: null })
  epubPath: string | null;

  @Prop({ type: Number, default: null })
  epubSize: number | null;

  @Prop({ type: String, default: null })
  lastReadCfi: string | null;
}

export const BookSchema = SchemaFactory.createForClass(Book);

BookSchema.index({ finishedAt: -1 });
BookSchema.index({ status: 1 });
BookSchema.index({ genres: 1 });
BookSchema.index({ title: 'text', authors: 'text' }, { language_override: 'searchLang' });
