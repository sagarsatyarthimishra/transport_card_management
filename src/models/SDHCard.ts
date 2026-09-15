import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";

export interface ISDHCard extends Document {
  userId: Types.ObjectId;
  cardNumber: string;
  cardNumberNormalized: string;
  createdAt: Date;
  updatedAt: Date;
}

const SDHCardSchema = new Schema<ISDHCard>(
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
      maxlength: [
        50,
        "Card number cannot exceed 50 characters",
      ],
    },

    cardNumberNormalized: {
      type: String,
      required: [
        true,
        "Normalized card number is required",
      ],
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

/**
 * One SDH card can exist only once
 * for a particular user.
 */
SDHCardSchema.index(
  {
    userId: 1,
    cardNumberNormalized: 1,
  },
  {
    unique: true,
  },
);

const SDHCard: Model<ISDHCard> =
  mongoose.models.SDHCard ||
  mongoose.model<ISDHCard>(
    "SDHCard",
    SDHCardSchema,
  );

export default SDHCard;