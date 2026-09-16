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

function normalizeCardNumber(
  value: string,
) {
  return value
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function formatCurrency(
  value: number,
) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    },
  ).format(value);
}

function formatCardNumber(
  value: string,
) {
  const digits =
    value.replace(/\s+/g, "");

  return digits
    .replace(
      /(.{4})/g,
      "$1 ",
    )
    .trim();
}

function maskCardNumber(
  value: string,
) {
  const normalized =
    value.replace(/\s+/g, "");

  if (normalized.length <= 4) {
    return normalized;
  }

  return `•••• ${normalized.slice(-4)}`;
}

export default function SDHTransactionPage() {
  const [
    cardSearch,
    setCardSearch,
  ] = useState("");

  const [
    cards,
    setCards,
  ] = useState<CardItem[]>([]);

  const [
    selectedCard,
    setSelectedCard,
  ] = useState<CardItem | null>(
    null,
  );

  const [
    highlightedCardIndex,
    setHighlightedCardIndex,
  ] = useState(-1);

  const [
    amount,
    setAmount,
  ] = useState("");

  const [
    drafts,
    setDrafts,
  ] = useState<
    DraftTransaction[]
  >([]);

  const [
    previewSearch,
    setPreviewSearch,
  ] = useState("");

  const [
    loadingCards,
    setLoadingCards,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    generatingFile,
    setGeneratingFile,
  ] = useState(false);

  const [
    editingId,
    setEditingId,
  ] = useState<string | null>(
    null,
  );

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const cardSearchInputRef =
    useRef<HTMLInputElement>(null);

  const amountInputRef =
    useRef<HTMLInputElement>(null);

  const previewSearchInputRef =
    useRef<HTMLInputElement>(null);

  /*
   * ============================================================
   * SDH CARD SEARCH
   * ============================================================
   */
  useEffect(() => {
    const query =
      cardSearch.trim();

    if (
      !query ||
      selectedCard
    ) {
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
              result.message ??
                "Unable to search cards.",
            );
          }

          const resultCards =
            Array.isArray(
              result.data,
            )
              ? result.data
              : [];

          setCards(
            resultCards,
          );

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

          setError(
            searchError instanceof
              Error
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

  function selectCard(
    card: CardItem,
  ) {
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

  function handleCardSearchKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (
      event.key ===
      "ArrowDown"
    ) {
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

    if (
      event.key ===
      "ArrowUp"
    ) {
      event.preventDefault();

      if (!cards.length) {
        return;
      }

      setHighlightedCardIndex(
        (current) =>
          Math.max(
            current - 1,
            0,
          ),
      );

      return;
    }

    if (
      event.key ===
        "Enter" ||
      event.key ===
        "ArrowRight"
    ) {
      if (
        highlightedCardIndex >=
          0 &&
        cards[
          highlightedCardIndex
        ]
      ) {
        event.preventDefault();

        selectCard(
          cards[
            highlightedCardIndex
          ],
        );
      }
    }
  }

  function handleAmountKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (
      event.key ===
      "ArrowLeft"
    ) {
      event.preventDefault();

      cardSearchInputRef.current?.focus();

      return;
    }

    if (
      event.key ===
      "Enter"
    ) {
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
      setDrafts(
        (current) =>
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
       * Newest entry stays FIRST
       * in preview.
       *
       * Backend receives this same
       * array order during generate.
       */
      setDrafts(
        (current) => [
          {
            id: crypto.randomUUID(),
            cardId:
              selectedCard._id,
            cardNumber:
              selectedCard.cardNumber,
            amount:
              roundedAmount,
          },
          ...current,
        ],
      );
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

  function handleEditTransaction(
    transaction: DraftTransaction,
  ) {
    setEditingId(
      transaction.id,
    );

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

  function handleDeleteTransaction(
    id: string,
  ) {
    setDrafts(
      (current) =>
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

  const totalAmount =
    useMemo(
      () =>
        drafts.reduce(
          (total, transaction) =>
            total +
            transaction.amount,
          0,
        ),
      [drafts],
    );

  /*
   * ============================================================
   * GENERATE CSV / XLSX
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
              /*
               * IMPORTANT:
               *
               * This array is NOT sorted.
               * It is sent exactly as preview.
               */
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
            result.message ??
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

      const fileName =
        fileNameMatch?.[1] ??
        `SALARY_SDH09066_20161229.${extension}`;

      const blobUrl =
        window.URL.createObjectURL(
          blob,
        );

      const anchor =
        document.createElement(
          "a",
        );

      anchor.href =
        blobUrl;

      anchor.download =
        fileName;

      document.body.appendChild(
        anchor,
      );

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

      requestAnimationFrame(() => {
        cardSearchInputRef.current?.focus();
      });

      setSuccess(
        `${fileName} generated and saved successfully.`,
      );
    } catch (generateError) {
      console.error(
        `Generate ${format} error:`,
        generateError,
      );

      setError(
        generateError instanceof
          Error
          ? generateError.message
          : "Unable to generate file.",
      );
    } finally {
      setGeneratingFile(false);
    }
  }

  /*
   * ============================================================
   * SAVE TRANSACTIONS
   * ============================================================
   *
   * IMPORTANT:
   * One API call only.
   *
   * Backend:
   * 1. creates XLSX
   * 2. saves file
   * 3. saves SDH transactions
   *
   * No duplicate insertion.
   */
  async function handleSaveTransactions() {
    setError("");
    setSuccess("");

    if (!drafts.length) {
      setError(
        "Please add at least one transaction.",
      );

      return;
    }

    try {
      setSaving(true);

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

      if (!response.ok) {
        throw new Error(
          result.message ??
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

      requestAnimationFrame(() => {
        cardSearchInputRef.current?.focus();
      });

      const savedFileName =
        result.data?.fileName;

      setSuccess(
        savedFileName
          ? `Transactions saved successfully. ${savedFileName} is available in Uploaded Files.`
          : "Transactions and file saved successfully.",
      );
    } catch (saveError) {
      console.error(
        "Save SDH transactions error:",
        saveError,
      );

      setError(
        saveError instanceof
          Error
          ? saveError.message
          : "Unable to save transactions.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-full bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-[1400px] space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Create SDH Transaction File
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Add card numbers and amounts, review the
            transactions, and generate your payment file.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            <span>{success}</span>
          </div>
        )}

        {/* Entry */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <CreditCard className="h-5 w-5" />
              </div>

              <div>
                <h2 className="font-semibold text-slate-900">
                  Transaction Entry
                </h2>

                <p className="text-xs text-slate-500">
                  Search a card and enter the transaction amount.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto]">

              {/* Card */}
              <div className="relative">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Card Number
                </label>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    ref={
                      cardSearchInputRef
                    }
                    value={cardSearch}
                    onChange={(event) => {
                      setCardSearch(
                        event.target.value,
                      );
                      setSelectedCard(
                        null,
                      );
                    }}
                    onKeyDown={
                      handleCardSearchKeyDown
                    }
                    placeholder="Search card number..."
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />

                  {cardSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setCardSearch("");
                        setSelectedCard(
                          null,
                        );
                        setCards([]);
                        setHighlightedCardIndex(
                          -1,
                        );
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {selectedCard && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />

                    <span>
                      Selected:{" "}
                      {maskCardNumber(
                        selectedCard.cardNumber,
                      )}
                    </span>
                  </div>
                )}

                {!selectedCard &&
                  cardSearch.trim() &&
                  (cards.length > 0 ||
                    loadingCards) && (
                    <div className="absolute left-0 right-0 top-[76px] z-30 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                      {loadingCards ? (
                        <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Searching cards...
                        </div>
                      ) : (
                        <div className="max-h-64 overflow-y-auto">
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
                                onMouseDown={(
                                  event,
                                ) => {
                                  event.preventDefault();
                                  selectCard(
                                    card,
                                  );
                                }}
                                className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 ${
                                  index ===
                                  highlightedCardIndex
                                    ? "bg-blue-50"
                                    : "hover:bg-slate-50"
                                }`}
                              >
                                <CreditCard className="h-4 w-4 shrink-0 text-slate-400" />

                                <span className="text-sm font-medium text-slate-800">
                                  {formatCardNumber(
                                    card.cardNumber,
                                  )}
                                </span>
                              </button>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  )}
              </div>

              {/* Amount */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Amount (₹)
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
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Add */}
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={
                    handleAddTransaction
                  }
                  disabled={
                    !selectedCard ||
                    !amount
                  }
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
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
              </div>
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
                Latest added transaction appears first.
              </p>
            </div>

            <div className="relative w-full lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

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
                placeholder="Search preview by card number..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              {previewSearch && (
                <button
                  type="button"
                  onClick={() =>
                    setPreviewSearch("")
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {drafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                <ReceiptIcon />
              </div>

              <p className="mt-4 text-sm font-medium text-slate-700">
                No transactions added
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Search a card above and add an amount.
              </p>
            </div>
          ) : filteredDrafts.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Search className="mx-auto h-7 w-7 text-slate-300" />

              <p className="mt-3 text-sm font-medium text-slate-600">
                No matching transaction
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Try another card number.
              </p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                        #
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                        Card Number
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                        Amount
                      </th>

                      <th className="px-5 py-3 text-right text-xs font-medium text-slate-500">
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
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                        >
                          <td className="px-5 py-3.5 text-xs text-slate-400">
                            {index + 1}
                          </td>

                          <td className="px-5 py-3.5 font-medium text-slate-700">
                            {formatCardNumber(
                              transaction.cardNumber,
                            )}
                          </td>

                          <td className="px-5 py-3.5 font-semibold text-slate-900">
                            {formatCurrency(
                              transaction.amount,
                            )}
                          </td>

                          <td className="px-5 py-3.5">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleEditTransaction(
                                    transaction,
                                  )
                                }
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
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
                                className="rounded-lg border border-red-100 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-100 md:hidden">
                {filteredDrafts.map(
                  (
                    transaction,
                    index,
                  ) => (
                    <div
                      key={
                        transaction.id
                      }
                      className="p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-slate-400">
                            #{index + 1}
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-800">
                            {formatCardNumber(
                              transaction.cardNumber,
                            )}
                          </p>

                          <p className="mt-2 text-base font-bold text-slate-900">
                            {formatCurrency(
                              transaction.amount,
                            )}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleEditTransaction(
                                transaction,
                              )
                            }
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600"
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
                            className="rounded-lg border border-red-100 p-2 text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </>
          )}

          {/* Bottom */}
          <div className="flex flex-col gap-4 border-t border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs text-slate-500">
                {previewSearch
                  ? `${filteredDrafts.length} matching entries`
                  : "All preview entries"}
              </p>

              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">
                  Total Amount:
                </span>

                <span className="text-xl font-bold text-blue-600">
                  {formatCurrency(
                    totalAmount,
                  )}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">

              <button
                type="button"
                onClick={
                  handleClearAll
                }
                disabled={
                  drafts.length ===
                    0 ||
                  saving ||
                  generatingFile
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Clear All
              </button>

              <button
                type="button"
                onClick={() =>
                  downloadGeneratedFile(
                    "csv",
                  )
                }
                disabled={
                  drafts.length ===
                    0 ||
                  saving ||
                  generatingFile
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generatingFile ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}

                Generate CSV
              </button>

              <button
                type="button"
                onClick={() =>
                  downloadGeneratedFile(
                    "xlsx",
                  )
                }
                disabled={
                  drafts.length ===
                    0 ||
                  saving ||
                  generatingFile
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generatingFile ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}

                Generate XLSX
              </button>

              <button
                type="button"
                onClick={
                  handleSaveTransactions
                }
                disabled={
                  drafts.length ===
                    0 ||
                  saving ||
                  generatingFile
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Save Transactions
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function ReceiptIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-6 w-6"
    >
      <rect
        x="5"
        y="3"
        width="14"
        height="18"
        rx="2"
      />

      <path d="M8 7h8M8 11h8M8 15h5" />
    </svg>
  );
}