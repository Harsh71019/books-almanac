import { HydratedDocument, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type ReadingSessionDocument = HydratedDocument<ReadingSession>;

@Schema({ timestamps: true, collection: 'reading_sessions' })
export class ReadingSession {
  /** UTC midnight of the calendar day */
  @Prop({ type: Date, required: true, index: true })
  date: Date;

  @Prop({ type: Number, required: true, min: 1, max: 5000 })
  pagesRead: number;

  @Prop({ type: Types.ObjectId, ref: 'Book', default: null })
  bookId: Types.ObjectId | null;

  @Prop({ type: String, trim: true, default: null })
  note: string | null;
}

export const ReadingSessionSchema = SchemaFactory.createForClass(ReadingSession);
ReadingSessionSchema.index({ date: -1 });
