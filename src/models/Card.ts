import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface ICard extends Document {
  userId: Types.ObjectId;
  cardNumber: string;
  cardNumberNormalized: string;
  createdAt: Date;
  updatedAt: Date;
}

const CardSchema = new Schema<ICard>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
      index: true,
    },

    cardNumber: {
      type: String,
      required: [true, "Card number is required"],
      trim: true,
      maxlength: [50, "Card number cannot exceed 50 characters"],
    },

    cardNumberNormalized: {
      type: String,
      required: [true, "Normalized card number is required"],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

CardSchema.index(
  {
    userId: 1,
    cardNumberNormalized: 1,
  },
  {
    unique: true,
  }
);

const Card: Model<ICard> =
  mongoose.models.Card || mongoose.model<ICard>("Card", CardSchema);

export default Card;