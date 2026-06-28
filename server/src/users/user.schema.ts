import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: false })
export class UserSettings {
  @Prop({ type: Number, default: 30, min: 1, max: 500 })
  yearlyGoal: number;

  @Prop({ type: String, enum: ['night', 'day'], default: 'night' })
  theme: 'night' | 'day';
}

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, trim: true })
  username: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ required: true, trim: true })
  displayName: string;

  @Prop({ type: UserSettings, default: () => ({}) })
  settings: UserSettings;
}

export const UserSchema = SchemaFactory.createForClass(User);
