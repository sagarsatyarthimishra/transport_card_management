export function normalizeCardNumber(cardNumber: string): string {
  return cardNumber.replace(/\s+/g, "").trim();
}