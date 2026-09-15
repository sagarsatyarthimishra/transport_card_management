import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";

export type SDHTransactionStatus =
  | "pending"
  | "successful"
  | "failed";

export interface ISDHTransaction extends Document {
  userId: Types.ObjectId;
  cardId: Types.ObjectId;
  cardNumber: string;
  amount: number;
  sequence: number;
  status: SDHTransactionStatus;
  generatedFileId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const SDHTransactionSchema =
  new Schema<ISDHTransaction>(
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      cardId: {
        type: Schema.Types.ObjectId,
        ref: "SDHCard",
        required: true,
        index: true,
      },

      cardNumber: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50,
      },

      amount: {
        type: Number,
        required: true,
        min: 0,
      },

      /*
       * IMPORTANT:
       * This preserves the exact entry order.
       */
      sequence: {
        type: Number,
        required: true,
        min: 0,
      },

      status: {
        type: String,
        enum: [
          "pending",
          "successful",
          "failed",
        ],
        default: "pending",
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
    },
  );

SDHTransactionSchema.index({
  userId: 1,
  createdAt: -1,
});

SDHTransactionSchema.index({
  generatedFileId: 1,
  sequence: 1,
});

const SDHTransaction: Model<ISDHTransaction> =
  mongoose.models.SDHTransaction ||
  mongoose.model<ISDHTransaction>(
    "SDHTransaction",
    SDHTransactionSchema,
  );

export default SDHTransaction;