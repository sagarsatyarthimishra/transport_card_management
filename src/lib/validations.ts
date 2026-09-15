import { z } from "zod";

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters"),

  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .max(255, "Email cannot exceed 255 characters"),

  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username cannot exceed 30 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can contain only letters, numbers and underscore"
    ),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Email or username is required"),

  password: z
    .string()
    .min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const createCardSchema = z.object({
  cardNumber: z
    .string()
    .trim()
    .min(1, "Card number is required.")
    .max(19, "Card number cannot exceed 19 digits.")
    .regex(
      /^\d{8,19}$/,
      "Card number must contain only 8 to 19 digits."
    ),
});

export const updateCardSchema = z.object({
  cardNumber: z
    .string()
    .trim()
    .min(1, "Card number is required.")
    .max(19, "Card number cannot exceed 19 digits.")
    .regex(
      /^\d{8,19}$/,
      "Card number must contain only 8 to 19 digits."
    ),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;


export const createTransactionSchema = z.object({
  cardId: z
    .string()
    .trim()
    .min(1, "Card is required."),

  amount: z
    .number({
      error: "Amount must be a number.",
    })
    .positive("Amount must be greater than zero.")
    .finite("Amount must be a valid number."),
});

export type CreateTransactionInput = z.infer<
  typeof createTransactionSchema
>;