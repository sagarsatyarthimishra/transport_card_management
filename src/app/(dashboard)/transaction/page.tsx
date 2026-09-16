"use client";

import {
  CheckCircle2,
  CreditCard,
  Ellipsis,
  Loader2,
  Plus,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

interface CardItem {
  _id: string;
  cardNumber: string;
}

interface DraftTransaction {
  id: string;
  cardId: string;
  cardNumber: string;
  amount: number;
}

interface EditFileResponse {
  success: boolean;
  message?: string;
  data?: {
    department?: string;
    file?: {
      _id: string;
      fileName: string;
      transactionCount: number;
      totalAmount: number;
    };
    transactions?: {
      id: string;
      cardId: string;
      cardNumber: string;
      amount: number;
    }[];
  };
}

function normalizeCardNumber(
  value: string,
): string {
  return value
    .replace(/\s+/g, "")
    .trim();
}

function getFileIdFromUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  const params =
    new URLSearchParams(
      window.location.search,
    );

  return params.get("fileId");
}

export default function SDHTransactionPage() {
  const router = useRouter();
  /*
   * ============================================================
   * STATE
   * ============================================================
   */

  const [fileId, setFileId] =
    useState<string | null>(null);

  const [fileName, setFileName] =
    useState("");

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

  const [openMenuId, setOpenMenuId] =
    useState<string | null>(null);

  const cardSearchInputRef =
    useRef<HTMLInputElement>(null);

  const amountInputRef =
    useRef<HTMLInputElement>(null);

  const previewSearchInputRef =
    useRef<HTMLInputElement>(null);

  const isEditMode =
    Boolean(fileId);

  /*
   * ============================================================
   * GET FILE ID
   * ============================================================
   */

  useEffect(() => {
    setFileId(
      getFileIdFromUrl(),
    );
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

        if (
          !response.ok ||
          !result.success
        ) {
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
          result.data.transactions ||
          [];

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
              (
                transaction,
              ) => ({
                id:
                  transaction.id,
                cardId:
                  transaction.cardId,
                cardNumber:
                  transaction.cardNumber,
                amount:
                  Number(
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
            loadError instanceof
              Error
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
   *
   * 500ms debounce
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
      setLoadingCards(false);

      return;
    }

    const controller =
      new AbortController();

    const timer =
      setTimeout(
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
                  cache: "no-store",
                  signal:
                    controller.signal,
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
                "Unable to search SDH cards.",
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
              resultCards.length >
                0
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

            setCards([]);
            setHighlightedCardIndex(
              -1,
            );

            setError(
              searchError instanceof
                Error
                ? searchError.message
                : "Unable to search SDH cards.",
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

  function selectCard(
    card: CardItem,
  ) {
    setSelectedCard(card);

    /*
     * IMPORTANT:
     * Full card number stays visible.
     */

    setCardSearch(
      card.cardNumber,
    );

    setCards([]);
    setHighlightedCardIndex(-1);
    setError("");

    requestAnimationFrame(
      () => {
        amountInputRef.current?.focus();
        amountInputRef.current?.select();
      },
    );
  }

  /*
   * ============================================================
   * CARD INPUT
   * ============================================================
   */

  function handleCardInputChange(
    value: string,
  ) {
    setCardSearch(value);

    setHighlightedCardIndex(
      0,
    );

    const normalized =
      normalizeCardNumber(
        value,
      );

    const exactMatch =
      cards.find(
        (card) =>
          normalizeCardNumber(
            card.cardNumber,
          ) === normalized,
      );

    if (!exactMatch) {
      setSelectedCard(null);
    }
  }

  /*
   * ============================================================
   * CARD KEYBOARD
   * ============================================================
   */

  function handleCardSearchKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    /*
     * Escape
     */
    if (
      event.key ===
      "Escape"
    ) {
      event.preventDefault();

      setCards([]);
      setHighlightedCardIndex(-1);

      return;
    }

    /*
     * ArrowRight
     */
    if (
      event.key ===
      "ArrowRight"
    ) {
      event.preventDefault();

      if (cards.length > 0) {
        const index =
          highlightedCardIndex >=
            0
            ? highlightedCardIndex
            : 0;

        const card =
          cards[index];

        if (card) {
          selectCard(card);
        }
      } else if (
        selectedCard
      ) {
        amountInputRef.current?.focus();
        amountInputRef.current?.select();
      }

      return;
    }

    /*
     * No search results
     */
    if (
      cards.length === 0
    ) {
      return;
    }

    /*
     * ArrowDown
     */
    if (
      event.key ===
      "ArrowDown"
    ) {
      event.preventDefault();

      setHighlightedCardIndex(
        (current) => {
          if (
            current < 0
          ) {
            return 0;
          }

          if (
            current >=
            cards.length - 1
          ) {
            return 0;
          }

          return current + 1;
        },
      );

      return;
    }

    /*
     * ArrowUp
     */
    if (
      event.key ===
      "ArrowUp"
    ) {
      event.preventDefault();

      setHighlightedCardIndex(
        (current) => {
          if (
            current <= 0
          ) {
            return (
              cards.length - 1
            );
          }

          return current - 1;
        },
      );

      return;
    }

    /*
     * Enter
     */
    if (
      event.key ===
      "Enter"
    ) {
      event.preventDefault();

      const index =
        highlightedCardIndex >=
          0
          ? highlightedCardIndex
          : 0;

      const card =
        cards[index];

      if (card) {
        selectCard(card);
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
    if (
      event.key ===
      "ArrowLeft"
    ) {
      event.preventDefault();

      cardSearchInputRef.current?.focus();
      cardSearchInputRef.current?.select();

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
   * ADD / UPDATE TRANSACTION
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

    /*
     * UPDATE EXISTING PREVIEW ROW
     */

    if (editingId) {
      setDrafts(
        (current) =>
          current.map(
            (
              transaction,
            ) =>
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
       * NEWEST TRANSACTION FIRST
       */

      setDrafts(
        (current) => [
          {
            id:
              crypto.randomUUID(),
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

    requestAnimationFrame(
      () => {
        cardSearchInputRef.current?.focus();
      },
    );
  }

  /*
   * ============================================================
   * EDIT PREVIEW TRANSACTION
   * ============================================================
   */

  function handleEditTransaction(
    transaction: DraftTransaction,
  ) {
    setOpenMenuId(null);

    setEditingId(
      transaction.id,
    );

    setSelectedCard({
      _id:
        transaction.cardId,
      cardNumber:
        transaction.cardNumber,
    });

    setCardSearch(
      transaction.cardNumber,
    );

    setAmount(
      String(
        transaction.amount,
      ),
    );

    setError("");
    setSuccess("");

    requestAnimationFrame(
      () => {
        amountInputRef.current?.focus();
        amountInputRef.current?.select();
      },
    );
  }

  /*
   * ============================================================
   * DELETE TRANSACTION
   * ============================================================
   */

  function handleDeleteTransaction(
    id: string,
  ) {
    setOpenMenuId(null);

    setDrafts(
      (current) =>
        current.filter(
          (transaction) =>
            transaction.id !== id,
        ),
    );

    if (
      editingId === id
    ) {
      setEditingId(null);
      setSelectedCard(null);
      setCardSearch("");
      setAmount("");
    }
  }

  /*
   * ============================================================
   * CANCEL EDIT
   * ============================================================
   */

  function handleCancelEdit() {
    setEditingId(null);
    setSelectedCard(null);
    setCardSearch("");
    setCards([]);
    setHighlightedCardIndex(-1);
    setAmount("");

    requestAnimationFrame(
      () => {
        cardSearchInputRef.current?.focus();
      },
    );
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
    setOpenMenuId(null);
    setError("");
    setSuccess("");

    requestAnimationFrame(
      () => {
        cardSearchInputRef.current?.focus();
      },
    );
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
        (
          total,
          transaction,
        ) =>
          total +
          transaction.amount,
        0,
      );
    }, [drafts]);

  /*
   * ============================================================
   * UPDATE EXISTING FILE
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

    const response = await fetch(
      `/api/transactions/files/${fileId}`,
      {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          department: "SDH",

          transactions: drafts.map(
            (transaction) => ({
              cardId: transaction.cardId,
              amount: transaction.amount,
            }),
          ),

          format,
        }),
      },
    );

    const result = await response.json();

    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ||
        "Unable to update SDH file.",
      );
    }

    /*
     * Generate button:
     * download updated same file.
     */
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

      if (!blob.size) {
        throw new Error(
          "Generated file is empty.",
        );
      }

      const baseName =
        fileName.replace(
          /\.(xlsx|csv)$/i,
          "",
        ) ||
        "SALARY_SDH09066_20161229";

      const blobUrl =
        window.URL.createObjectURL(blob);

      const anchor =
        document.createElement("a");

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
   * GENERATE CSV / XLSX
   * ============================================================
   */

  async function downloadGeneratedFile(
    format:
      | "xlsx"
      | "csv",
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
       * EDIT MODE
       *
       * Update SAME GeneratedFile.
       */

      if (
        isEditMode &&
        fileId
      ) {
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
       * NORMAL MODE
       *
       * Existing SDH generator.
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
              /*
               * IMPORTANT:
               * Send exact preview order.
               *
               * Backend reverses it
               * for file order.
               */
              transactions:
                drafts.map(
                  (
                    transaction,
                  ) => ({
                    cardId:
                      transaction.cardId,
                    amount:
                      transaction.amount,
                  }),
                ),
            }),
          },
        );

      if (
        !response.ok
      ) {
        let message =
          "Unable to generate file.";

        try {
          const result =
            await response.json();

          message =
            result.message ||
            message;
        } catch { }

        throw new Error(
          message,
        );
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
        document.createElement(
          "a",
        );

      anchor.href =
        blobUrl;

      anchor.download =
        generatedFileName;

      document.body.appendChild(
        anchor,
      );

      anchor.click();

      anchor.remove();

      window.URL.revokeObjectURL(
        blobUrl,
      );

      /*
       * Reset after successful
       * normal generation.
       */

      setDrafts([]);
      setPreviewSearch("");
      setEditingId(null);
      setSelectedCard(null);
      setCardSearch("");
      setCards([]);
      setHighlightedCardIndex(-1);
      setAmount("");

      requestAnimationFrame(
        () => {
          cardSearchInputRef.current?.focus();
        },
      );

      setSuccess(
        `${generatedFileName} generated and saved successfully.`,
      );
    } catch (generateError) {
      console.error(
        `Generate SDH ${format} error:`,
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
       * EDIT MODE
       *
       * Update SAME GeneratedFile.
       */

      if (
        isEditMode &&
        fileId
      ) {
        await updateExistingFile(
          "xlsx",
          false,
        );

        setSuccess(
          "SDH transactions updated successfully in the same file.",
        );
        router.replace("/files");

        return;
      }

      /*
       * NORMAL MODE
       *
       * Existing SDH behavior.
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
                  (
                    transaction,
                  ) => ({
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

      requestAnimationFrame(
        () => {
          cardSearchInputRef.current?.focus();
        },
      );

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
        saveError instanceof
          Error
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {isEditMode
              ? "Edit SDH Transaction File"
              : "Create SDH Transaction File"}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {isEditMode
              ? fileName ||
              "Edit existing SDH transaction file."
              : "Add card numbers and amounts, review the transactions, and generate your payment file."}
          </p>
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
              className="shrink-0"
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
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ================================================== */}
        {/* ADD TRANSACTION */}
        {/* ================================================== */}

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

            {/* SAME ROW:
                Card Number + Amount + Add
            */}

            <div className="grid gap-4 md:grid-cols-[1fr_220px_auto]">

              {/* Card Number */}
              <div className="relative">

                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Card Number
                </label>

                <div className="relative">

                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    ref={
                      cardSearchInputRef
                    }
                    value={
                      cardSearch
                    }
                    onChange={(
                      event,
                    ) =>
                      handleCardInputChange(
                        event.target
                          .value,
                      )
                    }
                    onKeyDown={
                      handleCardSearchKeyDown
                    }
                    placeholder="Search card number..."
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />

                  {loadingCards && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                  )}

                </div>

                {/* Search Results */}
                {!selectedCard &&
                  cardSearch.trim() &&
                  cards.length >
                  0 && (
                    <div className="absolute left-0 right-0 top-[76px] z-30 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">

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
                              className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 ${index ===
                                highlightedCardIndex
                                ? "bg-blue-50"
                                : "hover:bg-slate-50"
                                }`}
                            >

                              <CreditCard className="h-4 w-4 shrink-0 text-slate-400" />

                              {/* FULL CARD NUMBER */}
                              <span className="flex-1 font-medium text-slate-800">
                                {
                                  card.cardNumber
                                }
                              </span>

                            </button>
                          ),
                        )}

                      </div>

                    </div>
                  )}

                {/* Selected Card */}
                {selectedCard && (
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">

                    <span>
                      Selected:{" "}
                      <strong>
                        {
                          selectedCard.cardNumber
                        }
                      </strong>
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCard(
                          null,
                        );

                        setCardSearch(
                          "",
                        );
                      }}
                      className="text-green-700 hover:text-green-900"
                    >
                      <X className="h-4 w-4" />
                    </button>

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
                  onChange={(
                    event,
                  ) =>
                    setAmount(
                      event.target
                        .value,
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

            {editingId && (
              <button
                type="button"
                onClick={
                  handleCancelEdit
                }
                className="mt-3 text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                Cancel Edit
              </button>
            )}

          </div>

        </section>

        {/* ================================================== */}
        {/* PREVIEW */}
        {/* ================================================== */}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

          {/* Preview Header */}
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

            <div className="flex w-full gap-2 lg:w-auto">

              <div className="relative w-full lg:w-80">

                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  ref={
                    previewSearchInputRef
                  }
                  value={
                    previewSearch
                  }
                  onChange={(
                    event,
                  ) =>
                    setPreviewSearch(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Search preview..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />

                {previewSearch && (
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewSearch(
                        "",
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}

              </div>

              <button
                type="button"
                onClick={
                  handleClearAll
                }
                disabled={
                  drafts.length ===
                  0
                }
                className="h-10 shrink-0 rounded-lg border border-red-200 bg-white px-4 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear All
              </button>

            </div>

          </div>

          {/* Empty */}
          {drafts.length ===
            0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-16 text-center">

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                <CreditCard className="h-5 w-5" />
              </div>

              <p className="mt-4 text-sm font-medium text-slate-700">
                No transactions added
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Search a card above and add an amount.
              </p>

            </div>
          ) : filteredDrafts.length ===
            0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              No transactions found for this search.
            </div>
          ) : (
            <>

              {/* Table */}
              <div className="overflow-x-auto">

                <table className="w-full min-w-[750px] text-sm">

                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">

                      <th className="px-5 py-3 text-left font-medium text-slate-600">
                        #
                      </th>

                      <th className="px-5 py-3 text-left font-medium text-slate-600">
                        Card Number
                      </th>

                      <th className="px-5 py-3 text-right font-medium text-slate-600">
                        Amount
                      </th>

                      <th className="px-5 py-3 text-right font-medium text-slate-600">
                        Actions
                      </th>

                    </tr>
                  </thead>

                  <tbody>

                    {filteredDrafts.map(
                      (
                        transaction,
                        index,
                      ) => {

                        const isEditing =
                          editingId ===
                          transaction.id;

                        return (
                          <tr
                            key={
                              transaction.id
                            }
                            className="border-b border-slate-100 last:border-0"
                          >

                            <td className="px-5 py-4 text-slate-500">
                              {index + 1}
                            </td>

                            {/* FULL CARD NUMBER */}
                            <td className="px-5 py-4 font-medium text-slate-700">
                              {
                                transaction.cardNumber
                              }
                            </td>

                            <td className="px-5 py-4 text-right">

                              {isEditing ? (
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={
                                    amount
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    setAmount(
                                      event
                                        .target
                                        .value,
                                    )
                                  }
                                  onKeyDown={(
                                    event,
                                  ) => {
                                    if (
                                      event.key ===
                                      "Enter"
                                    ) {
                                      handleAddTransaction();
                                    }

                                    if (
                                      event.key ===
                                      "Escape"
                                    ) {
                                      handleCancelEdit();
                                    }
                                  }}
                                  className="ml-auto h-9 w-32 rounded-lg border border-slate-200 px-3 text-right text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                              ) : (
                                <span className="font-semibold text-slate-800">
                                  ₹
                                  {transaction.amount.toLocaleString(
                                    "en-IN",
                                    {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    },
                                  )}
                                </span>
                              )}

                            </td>

                            {/* ACTIONS */}
                            <td className="px-5 py-4">

                              <div className="flex justify-end">

                                {isEditing ? (
                                  <div className="flex gap-2">

                                    <button
                                      type="button"
                                      onClick={
                                        handleAddTransaction
                                      }
                                      className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                                    >
                                      Save
                                    </button>

                                    <button
                                      type="button"
                                      onClick={
                                        handleCancelEdit
                                      }
                                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                                    >
                                      Cancel
                                    </button>

                                  </div>
                                ) : (
                                  <div className="relative">

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOpenMenuId(
                                          (
                                            current,
                                          ) =>
                                            current ===
                                              transaction.id
                                              ? null
                                              : transaction.id,
                                        )
                                      }
                                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                      aria-label="Transaction actions"
                                    >
                                      <Ellipsis className="h-4 w-4" />
                                    </button>

                                    {openMenuId ===
                                      transaction.id && (
                                        <div className="absolute right-0 top-11 z-20 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">

                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleEditTransaction(
                                                transaction,
                                              )
                                            }
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                          >
                                            <Pencil className="h-4 w-4" />
                                            Edit
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleDeleteTransaction(
                                                transaction.id,
                                              )
                                            }
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                            Delete
                                          </button>

                                        </div>
                                      )}

                                  </div>
                                )}

                              </div>

                            </td>

                          </tr>
                        );
                      },
                    )}

                  </tbody>

                </table>

              </div>

              {/* Bottom Summary */}
              <div className="flex flex-col gap-4 border-t border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">

                <div>

                  <p className="text-xs text-slate-500">
                    Total Amount
                  </p>

                  <p className="text-xl font-bold text-slate-900">
                    ₹
                    {totalAmount.toLocaleString(
                      "en-IN",
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      },
                    )}
                  </p>

                </div>

                <div className="flex flex-col gap-2 sm:flex-row">

                  <button
                    type="button"
                    onClick={() =>
                      downloadGeneratedFile(
                        "csv",
                      )
                    }
                    disabled={
                      saving ||
                      generatingFile
                    }
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {generatingFile
                      ? "Generating..."
                      : "Generate CSV"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      downloadGeneratedFile(
                        "xlsx",
                      )
                    }
                    disabled={
                      saving ||
                      generatingFile
                    }
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {generatingFile
                      ? "Generating..."
                      : "Generate Excel"}
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleSaveTransactions
                    }
                    disabled={
                      saving ||
                      generatingFile
                    }
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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

            </>
          )}

        </section>

      </div>
    </main>
  );
}