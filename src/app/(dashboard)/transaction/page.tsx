"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  CheckCircle2,
  CreditCard,
  Download,
  FileSpreadsheet,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
  ArrowLeft,
} from "lucide-react";

type CardItem = {
  _id: string;
  cardNumber: string;
};

type DraftTransaction = {
  id: string;
  cardId: string;
  cardNumber: string;
  amount: number;
};

type EditFileResponse = {
  success: boolean;
  message?: string;
  data?: {
    file?: {
      id: string;
      fileName: string;
      fileSize?: number | null;
      transactionCount: number;
      totalAmount: number;
      contentType: string;
      createdAt: string;
      updatedAt: string;
    };
    department: "MMM" | "SDH";
    transactions: Array<{
      id: string;
      cardId: string;
      cardNumber: string;
      amount: number;
      sequence?: number;
      status?: string;
    }>;
  };
};

function normalizeCardNumber(value: string) {
  return value
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCardNumber(value: string) {
  const digits =
    value.replace(/\s+/g, "");

  return digits
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function maskCardNumber(value: string) {
  const normalized =
    value.replace(/\s+/g, "");

  if (normalized.length <= 4) {
    return normalized;
  }

  return `•••• ${normalized.slice(-4)}`;
}

function getFileIdFromUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(
    window.location.search,
  );

  return params.get("fileId");
}

export default function SDHTransactionPage() {
  const [fileId, setFileId] =
    useState<string | null>(null);

  const [cardSearch, setCardSearch] =
    useState("");

  const [cards, setCards] =
    useState<CardItem[]>([]);

  const [selectedCard, setSelectedCard] =
    useState<CardItem | null>(null);

  const [
    highlightedCardIndex,
    setHighlightedCardIndex,
  ] = useState(-1);

  const [amount, setAmount] =
    useState("");

  const [drafts, setDrafts] =
    useState<DraftTransaction[]>([]);

  const [previewSearch, setPreviewSearch] =
    useState("");

  const [loadingCards, setLoadingCards] =
    useState(false);

  const [loadingFile, setLoadingFile] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [generatingFile, setGeneratingFile] =
    useState(false);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [fileName, setFileName] =
    useState("");

  const cardSearchInputRef =
    useRef<HTMLInputElement>(null);

  const amountInputRef =
    useRef<HTMLInputElement>(null);

  const previewSearchInputRef =
    useRef<HTMLInputElement>(null);

  const isEditMode = Boolean(fileId);

  /*
   * ============================================================
   * GET FILE ID
   * ============================================================
   */

  useEffect(() => {
    setFileId(getFileIdFromUrl());
  }, []);

  /*
   * ============================================================
   * LOAD EXISTING SDH FILE
   * ============================================================
   */

  useEffect(() => {
    if (!fileId) {
      return;
    }

    let cancelled = false;

    async function loadExistingFile() {
      try {
        setLoadingFile(true);
        setError("");
        setSuccess("");

        const response =
          await fetch(
            `/api/transactions/files/${fileId}?mode=edit`,
            {
              cache: "no-store",
            },
          );

        const result: EditFileResponse =
          await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message ||
              "Unable to load transaction file.",
          );
        }

        if (
          result.data?.department !==
          "SDH"
        ) {
          throw new Error(
            "This is not an SDH transaction file.",
          );
        }

        if (cancelled) {
          return;
        }

        setFileName(
          result.data.file?.fileName ||
            "",
        );

        const loaded =
          result.data.transactions || [];

        /*
         * Backend:
         * oldest -> newest
         *
         * UI:
         * newest -> oldest
         */
        setDrafts(
          [...loaded]
            .reverse()
            .map(
              (transaction) => ({
                id: transaction.id,
                cardId:
                  transaction.cardId,
                cardNumber:
                  transaction.cardNumber,
                amount: Number(
                  transaction.amount,
                ),
              }),
            ),
        );
      } catch (loadError) {
        console.error(
          "Load SDH file error:",
          loadError,
        );

        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load file.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingFile(false);
        }
      }
    }

    loadExistingFile();

    return () => {
      cancelled = true;
    };
  }, [fileId]);

  /*
   * ============================================================
   * SDH CARD SEARCH
   * ============================================================
   */

  useEffect(() => {
    const query = cardSearch.trim();

    if (!query || selectedCard) {
      setCards([]);
      setHighlightedCardIndex(-1);
      return;
    }

    const controller =
      new AbortController();

    const timer = setTimeout(
      async () => {
        try {
          setLoadingCards(true);
          setError("");

          const response =
            await fetch(
              `/api/sdh/cards?search=${encodeURIComponent(
                query,
              )}&page=1&limit=20`,
              {
                signal:
                  controller.signal,
              },
            );

          const result =
            await response.json();

          if (!response.ok) {
            throw new Error(
              result.message ||
                "Unable to search SDH cards.",
            );
          }

          const resultCards =
            Array.isArray(result.data)
              ? result.data
              : [];

          setCards(resultCards);

          setHighlightedCardIndex(
            resultCards.length > 0
              ? 0
              : -1,
          );
        } catch (searchError) {
          if (
            searchError instanceof
              DOMException &&
            searchError.name ===
              "AbortError"
          ) {
            return;
          }

          console.error(
            "SDH card search error:",
            searchError,
          );

          setError(
            searchError instanceof Error
              ? searchError.message
              : "Unable to search cards.",
          );
        } finally {
          setLoadingCards(false);
        }
      },
      500,
    );

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    cardSearch,
    selectedCard,
  ]);

  /*
   * ============================================================
   * SELECT CARD
   * ============================================================
   */

  function selectCard(card: CardItem) {
    setSelectedCard(card);

    setCardSearch(
      formatCardNumber(
        card.cardNumber,
      ),
    );

    setCards([]);
    setHighlightedCardIndex(-1);
    setError("");

    requestAnimationFrame(() => {
      amountInputRef.current?.focus();
    });
  }

  /*
   * ============================================================
   * CARD KEYBOARD
   * ============================================================
   */

  function handleCardSearchKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (!cards.length) {
        return;
      }

      setHighlightedCardIndex(
        (current) =>
          Math.min(
            current + 1,
            cards.length - 1,
          ),
      );

      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (!cards.length) {
        return;
      }

      setHighlightedCardIndex(
        (current) =>
          Math.max(current - 1, 0),
      );

      return;
    }

    if (
      event.key === "Enter" ||
      event.key === "ArrowRight"
    ) {
      if (
        highlightedCardIndex >= 0 &&
        cards[highlightedCardIndex]
      ) {
        event.preventDefault();

        selectCard(
          cards[highlightedCardIndex],
        );
      }
    }
  }

  /*
   * ============================================================
   * AMOUNT KEYBOARD
   * ============================================================
   */

  function handleAmountKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();

      cardSearchInputRef.current?.focus();

      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

      handleAddTransaction();
    }
  }

  /*
   * ============================================================
   * ADD / UPDATE
   * ============================================================
   */

  function handleAddTransaction() {
    setError("");
    setSuccess("");

    if (!selectedCard) {
      setError(
        "Please select a card first.",
      );

      cardSearchInputRef.current?.focus();

      return;
    }

    const numericAmount =
      Number(amount);

    if (
      !Number.isFinite(
        numericAmount,
      ) ||
      numericAmount <= 0
    ) {
      setError(
        "Please enter a valid amount.",
      );

      amountInputRef.current?.focus();

      return;
    }

    const roundedAmount =
      Math.round(
        (numericAmount +
          Number.EPSILON) *
          100,
      ) / 100;

    if (editingId) {
      setDrafts((current) =>
        current.map(
          (transaction) =>
            transaction.id ===
            editingId
              ? {
                  ...transaction,
                  cardId:
                    selectedCard._id,
                  cardNumber:
                    selectedCard.cardNumber,
                  amount:
                    roundedAmount,
                }
              : transaction,
        ),
      );

      setEditingId(null);
    } else {
      /*
       * Newest transaction goes
       * at the top of preview.
       */
      setDrafts((current) => [
        {
          id: crypto.randomUUID(),
          cardId: selectedCard._id,
          cardNumber:
            selectedCard.cardNumber,
          amount:
            roundedAmount,
        },
        ...current,
      ]);
    }

    setSelectedCard(null);
    setCardSearch("");
    setCards([]);
    setHighlightedCardIndex(-1);
    setAmount("");

    requestAnimationFrame(() => {
      cardSearchInputRef.current?.focus();
    });
  }

  /*
   * ============================================================
   * EDIT
   * ============================================================
   */

  function handleEditTransaction(
    transaction: DraftTransaction,
  ) {
    setEditingId(transaction.id);

    setSelectedCard({
      _id: transaction.cardId,
      cardNumber:
        transaction.cardNumber,
    });

    setCardSearch(
      formatCardNumber(
        transaction.cardNumber,
      ),
    );

    setAmount(
      String(transaction.amount),
    );

    setError("");
    setSuccess("");

    requestAnimationFrame(() => {
      amountInputRef.current?.focus();
      amountInputRef.current?.select();
    });
  }

  /*
   * ============================================================
   * DELETE
   * ============================================================
   */

  function handleDeleteTransaction(
    id: string,
  ) {
    setDrafts((current) =>
      current.filter(
        (transaction) =>
          transaction.id !== id,
      ),
    );

    if (editingId === id) {
      setEditingId(null);
      setSelectedCard(null);
      setCardSearch("");
      setAmount("");
    }
  }

  /*
   * ============================================================
   * CLEAR ALL
   * ============================================================
   */

  function handleClearAll() {
    setDrafts([]);
    setPreviewSearch("");
    setEditingId(null);
    setSelectedCard(null);
    setCardSearch("");
    setCards([]);
    setHighlightedCardIndex(-1);
    setAmount("");
    setError("");
    setSuccess("");

    requestAnimationFrame(() => {
      cardSearchInputRef.current?.focus();
    });
  }

  /*
   * ============================================================
   * PREVIEW SEARCH
   * ============================================================
   */

  const filteredDrafts =
    useMemo(() => {
      const query =
        normalizeCardNumber(
          previewSearch,
        );

      if (!query) {
        return drafts;
      }

      return drafts.filter(
        (transaction) =>
          normalizeCardNumber(
            transaction.cardNumber,
          ).includes(query),
      );
    }, [
      drafts,
      previewSearch,
    ]);

  /*
   * ============================================================
   * TOTAL
   * ============================================================
   */

  const totalAmount =
    useMemo(() => {
      return drafts.reduce(
        (total, transaction) =>
          total + transaction.amount,
        0,
      );
    }, [drafts]);

  /*
   * ============================================================
   * UPDATE SAME FILE
   * ============================================================
   */

  async function updateExistingFile(
    format: "xlsx" | "csv",
    downloadAfterSave: boolean,
  ) {
    if (!fileId) {
      return false;
    }

    if (!drafts.length) {
      setError(
        "Please keep at least one transaction.",
      );

      return false;
    }

    const response =
      await fetch(
        `/api/transactions/files/${fileId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            transactions:
              drafts.map(
                (transaction) => ({
                  cardId:
                    transaction.cardId,
                  amount:
                    Number(
                      transaction.amount,
                    ),
                }),
              ),
            format,
          }),
        },
      );

    const result =
      await response.json();

    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ||
          "Unable to update SDH file.",
      );
    }

    if (downloadAfterSave) {
      const downloadResponse =
        await fetch(
          `/api/transactions/files/${fileId}?format=${format}`,
          {
            cache: "no-store",
          },
        );

      if (!downloadResponse.ok) {
        throw new Error(
          "File updated, but download failed.",
        );
      }

      const blob =
        await downloadResponse.blob();

      const baseName =
        fileName
          .replace(
            /\.(xlsx|csv)$/i,
            "",
          ) ||
        `SALARY_SDH09066_20161229`;

      const anchor =
        document.createElement("a");

      const blobUrl =
        window.URL.createObjectURL(
          blob,
        );

      anchor.href = blobUrl;
      anchor.download =
        `${baseName}.${format}`;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.URL.revokeObjectURL(
        blobUrl,
      );
    }

    setFileName(
      result.data?.fileName ||
        fileName,
    );

    return true;
  }

  /*
   * ============================================================
   * GENERATE
   * ============================================================
   */

  async function downloadGeneratedFile(
    format: "xlsx" | "csv",
  ) {
    setError("");
    setSuccess("");

    if (!drafts.length) {
      setError(
        "Please add at least one transaction.",
      );

      return;
    }

    try {
      setGeneratingFile(true);

      /*
       * EDIT MODE:
       * update same GeneratedFile.
       */
      if (isEditMode && fileId) {
        await updateExistingFile(
          format,
          true,
        );

        setSuccess(
          `SDH file updated and ${format.toUpperCase()} generated successfully.`,
        );

        return;
      }

      /*
       * NORMAL MODE:
       * existing POST behavior.
       */
      const response =
        await fetch(
          `/api/sdh/transactions/generate?format=${format}`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              transactions:
                drafts.map(
                  (transaction) => ({
                    cardId:
                      transaction.cardId,
                    amount:
                      transaction.amount,
                  }),
                ),
            }),
          },
        );

      if (!response.ok) {
        let message =
          "Unable to generate file.";

        try {
          const result =
            await response.json();

          message =
            result.message ||
            message;
        } catch {}

        throw new Error(message);
      }

      const blob =
        await response.blob();

      if (!blob.size) {
        throw new Error(
          "Generated file is empty.",
        );
      }

      const contentDisposition =
        response.headers.get(
          "Content-Disposition",
        );

      const fileNameMatch =
        contentDisposition?.match(
          /filename="([^"]+)"/i,
        );

      const extension =
        format === "csv"
          ? "csv"
          : "xlsx";

      const generatedFileName =
        fileNameMatch?.[1] ||
        `SALARY_SDH09066_20161229.${extension}`;

      const blobUrl =
        window.URL.createObjectURL(
          blob,
        );

      const anchor =
        document.createElement("a");

      anchor.href = blobUrl;
      anchor.download =
        generatedFileName;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.URL.revokeObjectURL(
        blobUrl,
      );

      setDrafts([]);
      setPreviewSearch("");
      setEditingId(null);
      setSelectedCard(null);
      setCardSearch("");
      setCards([]);
      setHighlightedCardIndex(-1);
      setAmount("");

      setSuccess(
        `${generatedFileName} generated and saved successfully.`,
      );
    } catch (generateError) {
      console.error(
        "Generate SDH file error:",
        generateError,
      );

      setError(
        generateError instanceof Error
          ? generateError.message
          : "Unable to generate file.",
      );
    } finally {
      setGeneratingFile(false);
    }
  }

  /*
   * ============================================================
   * SAVE
   * ============================================================
   */

  async function handleSaveTransactions() {
    setError("");
    setSuccess("");

    if (!drafts.length) {
      setError(
        "Please keep at least one transaction.",
      );

      return;
    }

    try {
      setSaving(true);

      /*
       * EDIT MODE:
       * SAME GeneratedFile.
       */
      if (isEditMode && fileId) {
        await updateExistingFile(
          "xlsx",
          false,
        );

        setSuccess(
          "SDH transactions updated successfully in the same file.",
        );

        return;
      }

      /*
       * NORMAL MODE:
       * Existing POST behavior.
       */
      const response =
        await fetch(
          "/api/sdh/transactions/generate?download=false",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              transactions:
                drafts.map(
                  (transaction) => ({
                    cardId:
                      transaction.cardId,
                    amount:
                      transaction.amount,
                  }),
                ),
            }),
          },
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ||
            "Unable to save transactions.",
        );
      }

      setDrafts([]);
      setPreviewSearch("");
      setEditingId(null);
      setSelectedCard(null);
      setCardSearch("");
      setCards([]);
      setHighlightedCardIndex(-1);
      setAmount("");

      const savedFileName =
        result.data?.fileName;

      setSuccess(
        savedFileName
          ? `Transactions saved successfully. ${savedFileName} is available in Generated Files.`
          : "Transactions and file saved successfully.",
      );
    } catch (saveError) {
      console.error(
        "Save SDH transactions error:",
        saveError,
      );

      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save transactions.",
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <main className="min-h-full bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-[1400px] space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              {isEditMode && (
                <button
                  type="button"
                  onClick={() =>
                    window.history.back()
                  }
                  className="rounded-lg border bg-white p-2 hover:bg-slate-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}

              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {isEditMode
                  ? "Edit SDH Transaction File"
                  : "Create SDH Transaction File"}
              </h1>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {isEditMode
                ? fileName ||
                  "Edit existing SDH transaction file."
                : "Add card numbers and amounts, review the transactions, and generate your payment file."}
            </p>
          </div>

          {isEditMode && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
              Editing existing file
            </div>
          )}
        </div>

        {/* Loading */}
        {loadingFile && (
          <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading existing transactions...
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <span>{success}</span>

            <button
              type="button"
              onClick={() =>
                setSuccess("")
              }
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Add transaction */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-600" />

              <h2 className="text-base font-semibold text-slate-900">
                {editingId
                  ? "Edit Transaction"
                  : "Add Transaction"}
              </h2>
            </div>
          </div>

          <div className="p-5">
            <div className="grid gap-5 md:grid-cols-2">
              {/* Card */}
              <div className="relative">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  SDH Card Number
                </label>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    ref={
                      cardSearchInputRef
                    }
                    value={cardSearch}
                    onChange={(event) => {
                      setCardSearch(
                        event.target.value,
                      );

                      if (
                        selectedCard
                      ) {
                        setSelectedCard(
                          null,
                        );
                      }
                    }}
                    onKeyDown={
                      handleCardSearchKeyDown
                    }
                    placeholder="Search SDH card number..."
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />

                  {loadingCards && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                  )}
                </div>

                {cards.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                    {cards.map(
                      (
                        card,
                        index,
                      ) => (
                        <button
                          key={
                            card._id
                          }
                          type="button"
                          onClick={() =>
                            selectCard(
                              card,
                            )
                          }
                          className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm ${
                            highlightedCardIndex ===
                            index
                              ? "bg-blue-50"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <span className="font-medium text-slate-800">
                            {formatCardNumber(
                              card.cardNumber,
                            )}
                          </span>

                          <span className="text-xs text-slate-400">
                            Select
                          </span>
                        </button>
                      ),
                    )}
                  </div>
                )}

                {selectedCard && (
                  <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                    Selected:{" "}
                    <span className="font-semibold">
                      {maskCardNumber(
                        selectedCard.cardNumber,
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Amount
                </label>

                <input
                  ref={
                    amountInputRef
                  }
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) =>
                    setAmount(
                      event.target.value,
                    )
                  }
                  onKeyDown={
                    handleAmountKeyDown
                  }
                  placeholder="Enter amount"
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={
                  handleAddTransaction
                }
                disabled={
                  !selectedCard ||
                  !amount
                }
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editingId ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Update
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add
                  </>
                )}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setSelectedCard(
                      null,
                    );
                    setCardSearch("");
                    setCards([]);
                    setAmount("");
                  }}
                  className="h-11 rounded-lg border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Preview */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Preview ({drafts.length}{" "}
                {drafts.length === 1
                  ? "Entry"
                  : "Entries"})
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Latest added transaction
                appears first.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  ref={
                    previewSearchInputRef
                  }
                  value={previewSearch}
                  onChange={(event) =>
                    setPreviewSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Search preview..."
                  className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-64"
                />
              </div>

              {drafts.length > 0 && (
                <button
                  type="button"
                  onClick={
                    handleClearAll
                  }
                  className="h-10 rounded-lg border border-red-200 bg-white px-4 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          <div className="p-5">
            {filteredDrafts.length ===
            0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center">
                <CreditCard className="mx-auto h-8 w-8 text-slate-300" />

                <p className="mt-3 text-sm font-medium text-slate-600">
                  No transactions
                  found.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="px-3 py-3 font-medium text-slate-500">
                        #
                      </th>

                      <th className="px-3 py-3 font-medium text-slate-500">
                        Card Number
                      </th>

                      <th className="px-3 py-3 text-right font-medium text-slate-500">
                        Amount
                      </th>

                      <th className="px-3 py-3 text-right font-medium text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredDrafts.map(
                      (
                        transaction,
                        index,
                      ) => (
                        <tr
                          key={
                            transaction.id
                          }
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="px-3 py-3 text-slate-400">
                            {index + 1}
                          </td>

                          <td className="px-3 py-3">
                            <div className="font-medium text-slate-800">
                              {maskCardNumber(
                                transaction.cardNumber,
                              )}
                            </div>
                          </td>

                          <td className="px-3 py-3 text-right font-semibold text-slate-800">
                            {formatCurrency(
                              transaction.amount,
                            )}
                          </td>

                          <td className="px-3 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleEditTransaction(
                                    transaction,
                                  )
                                }
                                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteTransaction(
                                    transaction.id,
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-5 flex flex-col gap-3 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs text-slate-500">
                  Total Amount
                </p>

                <p className="text-xl font-bold text-slate-900">
                  {formatCurrency(
                    totalAmount,
                  )}
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={
                    saving ||
                    generatingFile ||
                    !drafts.length
                  }
                  onClick={
                    handleSaveTransactions
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}

                  {isEditMode
                    ? "Save Changes"
                    : "Save Transactions"}
                </button>

                <button
                  type="button"
                  disabled={
                    saving ||
                    generatingFile ||
                    !drafts.length
                  }
                  onClick={() =>
                    downloadGeneratedFile(
                      "xlsx",
                    )
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generatingFile ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4" />
                  )}

                  {isEditMode
                    ? "Update & Generate XLSX"
                    : "Generate XLSX"}
                </button>

                <button
                  type="button"
                  disabled={
                    saving ||
                    generatingFile ||
                    !drafts.length
                  }
                  onClick={() =>
                    downloadGeneratedFile(
                      "csv",
                    )
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />

                  {isEditMode
                    ? "Update & Generate CSV"
                    : "Generate CSV"}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}