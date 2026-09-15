import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";

export interface IGeneratedFile extends Document {
  userId: Types.ObjectId;
  fileName: string;
  fileSize?: number | null;
  transactionCount: number;
  totalAmount: number;
  fileData: Buffer;
  contentType: string;
  createdAt: Date;
  updatedAt: Date;
}

const GeneratedFileSchema =
  new Schema<IGeneratedFile>(
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      fileName: {
        type: String,
        required: true,
        trim: true,
      },

      fileSize: {
        type: Number,
        default: null,
      },

      transactionCount: {
        type: Number,
        required: true,
        min: 0,
      },

      totalAmount: {
        type: Number,
        required: true,
        min: 0,
      },

      /**
       * Actual XLSX binary.
       *
       * MongoDB stores this as BSON Binary.
       */
      fileData: {
        type: Buffer,
        required: true,
      },

      contentType: {
        type: String,
        required: true,
        default:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    },
    {
      timestamps: true,
    },
  );

GeneratedFileSchema.index({
  userId: 1,
  createdAt: -1,
});

const GeneratedFile: Model<IGeneratedFile> =
  mongoose.models.GeneratedFile ||
  mongoose.model<IGeneratedFile>(
    "GeneratedFile",
    GeneratedFileSchema,
  );

export default GeneratedFile;