import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";

export type TransactionStatus =
  | "pending"
  | "successful"
  | "failed";

export interface ITransaction extends Document {
  userId: Types.ObjectId;
  cardId: Types.ObjectId;
  cardNumber: string;
  amount: number;
  status: TransactionStatus;
  generatedFileId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema =
  new Schema<ITransaction>(
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: [true, "User is required"],
        index: true,
      },

      cardId: {
        type: Schema.Types.ObjectId,
        ref: "Card",
        required: [true, "Card is required"],
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

      amount: {
        type: Number,
        required: [true, "Amount is required"],
        min: [0.01, "Amount must be greater than zero"],
      },

      status: {
        type: String,
        enum: [
          "pending",
          "successful",
          "failed",
        ],
        default: "pending",
        index: true,
      },

      generatedFileId: {
        type: Schema.Types.ObjectId,
        ref: "GeneratedFile",
        default: null,
        index: true,
      },
    },
    {
      timestamps: true,
    }
  );

/*
 * Dashboard/report queries will commonly filter
 * transactions by user and date.
 */
TransactionSchema.index({
  userId: 1,
  createdAt: -1,
});

/*
 * Useful for card-wise transaction history.
 */
TransactionSchema.index({
  userId: 1,
  cardId: 1,
  createdAt: -1,
});

const Transaction: Model<ITransaction> =
  mongoose.models.Transaction ||
  mongoose.model<ITransaction>(
    "Transaction",
    TransactionSchema
  );

export default Transaction;