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

// ============================================================
// Helpers
// ============================================================

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

  if (
    normalized.length <= 4
  ) {
    return normalized;
  }

  return `•••• ${normalized.slice(
    -4,
  )}`;
}

function getFileIdFromUrl() {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  const params =
    new URLSearchParams(
      window.location.search,
    );

  return params.get("fileId");
}

// ============================================================
// Page
// ============================================================

export default function SDHTransactionPage() {
  // ==========================================================
  // Existing file
  // ==========================================================

  const [fileId, setFileId] =
    useState<string | null>(
      null,
    );

  const [fileName, setFileName] =
    useState("");

  const [loadingFile, setLoadingFile] =
    useState(false);

  // ==========================================================
  // Card Search
  // ==========================================================

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

  // ==========================================================
  // Amount
  // ==========================================================

  const [
    amount,
    setAmount,
  ] = useState("");

  // ==========================================================
  // Draft Transactions
  // ==========================================================

  const [
    drafts,
    setDrafts,
  ] = useState<
    DraftTransaction[]
  >([]);

  // ==========================================================
  // Preview Search
  // ==========================================================

  const [
    previewSearch,
    setPreviewSearch,
  ] = useState("");

  // ==========================================================
  // Loading States
  // ==========================================================

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

  // ==========================================================
  // Transaction Editing
  // ==========================================================

  const [
    editingId,
    setEditingId,
  ] = useState<string | null>(
    null,
  );

  // ==========================================================
  // Messages
  // ==========================================================

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  // ==========================================================
  // Refs
  // ==========================================================

  const cardSearchInputRef =
    useRef<HTMLInputElement>(
      null,
    );

  const amountInputRef =
    useRef<HTMLInputElement>(
      null,
    );

  const previewSearchInputRef =
    useRef<HTMLInputElement>(
      null,
    );

  const isEditMode =
    Boolean(fileId);

  // ============================================================
  // GET FILE ID
  // ============================================================

  useEffect(() => {
    setFileId(
      getFileIdFromUrl(),
    );
  }, []);

  // ============================================================
  // LOAD EXISTING SDH FILE
  //
  // This runs ONLY when Files -> Edit is used.
  //
  // Normal /transaction page remains the same.
  // ============================================================

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
              method: "GET",
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

        // ------------------------------------------------------
        // IMPORTANT:
        // SDH page must accept SDH file only.
        // ------------------------------------------------------

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
          result.data.file
            ?.fileName || "",
        );

        const loaded =
          result.data
            .transactions || [];

        /*
         * Backend returns:
         *
         * oldest -> newest
         *
         * Preview requires:
         *
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
      } catch (
        loadError
      ) {
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
          setLoadingFile(
            false,
          );
        }
      }
    }

    void loadExistingFile();

    return () => {
      cancelled = true;
    };
  }, [fileId]);

  // ============================================================
  // SDH CARD SEARCH
  //
  // IMPORTANT:
  // SDH page uses /api/sdh/cards.
  // MMM cards are never searched here.
  // ============================================================

  useEffect(() => {
    const query =
      cardSearch.trim();

    if (
      !query ||
      selectedCard
    ) {
      setCards([]);
      setHighlightedCardIndex(
        -1,
      );

      return;
    }

    const controller =
      new AbortController();

    const timer =
      setTimeout(
        async () => {
          try {
            setLoadingCards(
              true,
            );

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
          } catch (
            searchError
          ) {
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
              searchError instanceof
                Error
                ? searchError.message
                : "Unable to search cards.",
            );
          } finally {
            setLoadingCards(
              false,
            );
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

  // ============================================================
  // SELECT CARD
  // ============================================================

  function selectCard(
    card: CardItem,
  ) {
    setSelectedCard(
      card,
    );

    setCardSearch(
      formatCardNumber(
        card.cardNumber,
      ),
    );

    setCards([]);

    setHighlightedCardIndex(
      -1,
    );

    setError("");

    requestAnimationFrame(
      () => {
        amountInputRef.current?.focus();
      },
    );
  }

  // ============================================================
  // CARD KEYBOARD
  // ============================================================

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

  // ============================================================
  // AMOUNT KEYBOARD
  // ============================================================

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

  // ============================================================
  // ADD / UPDATE
  // ============================================================

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

    // ----------------------------------------------------------
    // UPDATE EXISTING PREVIEW TRANSACTION
    // ----------------------------------------------------------

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

      setEditingId(
        null,
      );
    } else {
      // --------------------------------------------------------
      // ADD NEW TRANSACTION
      //
      // Newest transaction goes
      // to the top of preview.
      // --------------------------------------------------------

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

    // ----------------------------------------------------------
    // Reset input
    // ----------------------------------------------------------

    setSelectedCard(
      null,
    );

    setCardSearch("");

    setCards([]);

    setHighlightedCardIndex(
      -1,
    );

    setAmount("");

    requestAnimationFrame(
      () => {
        cardSearchInputRef.current?.focus();
      },
    );
  }

  // ============================================================
  // EDIT PREVIEW TRANSACTION
  // ============================================================

  function handleEditTransaction(
    transaction: DraftTransaction,
  ) {
    const card: CardItem =
      {
        _id:
          transaction.cardId,

        cardNumber:
          transaction.cardNumber,
      };

    setEditingId(
      transaction.id,
    );

    setSelectedCard(
      card,
    );

    setCardSearch(
      formatCardNumber(
        transaction.cardNumber,
      ),
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

  // ============================================================
  // DELETE PREVIEW TRANSACTION
  // ============================================================

  function handleDeleteTransaction(
    id: string,
  ) {
    setDrafts(
      (current) =>
        current.filter(
          (transaction) =>
            transaction.id !==
            id,
        ),
    );

    if (
      editingId === id
    ) {
      setEditingId(null);

      setSelectedCard(
        null,
      );

      setCardSearch("");

      setAmount("");
    }
  }

  // ============================================================
  // CLEAR ALL
  // ============================================================

  function handleClearAll() {
    setDrafts([]);

    setPreviewSearch("");

    setEditingId(null);

    setSelectedCard(
      null,
    );

    setCardSearch("");

    setCards([]);

    setHighlightedCardIndex(
      -1,
    );

    setAmount("");

    setError("");

    setSuccess("");

    requestAnimationFrame(
      () => {
        cardSearchInputRef.current?.focus();
      },
    );
  }

  // ============================================================
  // PREVIEW SEARCH
  // ============================================================

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

  // ============================================================
  // TOTAL
  // ============================================================

  const totalAmount =
    useMemo(
      () =>
        drafts.reduce(
          (
            total,
            transaction,
          ) =>
            total +
            transaction.amount,
          0,
        ),
      [drafts],
    );

  // ============================================================
  // UPDATE EXISTING FILE
  //
  // This calls the shared file endpoint.
  //
  // Backend step must implement:
  //
  // PUT /api/transactions/files/:id
  //
  // and keep the SAME GeneratedFile ID.
  // ============================================================

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
            department:
              "SDH",

            format,

            transactions:
              drafts.map(
                (
                  transaction,
                ) => ({
                  cardId:
                    transaction.cardId,

                  amount:
                    Number(
                      transaction.amount,
                    ),
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
          "Unable to update SDH file.",
      );
    }

    // ----------------------------------------------------------
    // Download updated same file
    // ----------------------------------------------------------

    if (downloadAfterSave) {
      const downloadResponse =
        await fetch(
          `/api/transactions/files/${fileId}?format=${format}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

      if (
        !downloadResponse.ok
      ) {
        let message =
          "File updated, but download failed.";

        try {
          const downloadResult =
            await downloadResponse.json();

          message =
            downloadResult.message ||
            message;
        } catch {}

        throw new Error(
          message,
        );
      }

      const blob =
        await downloadResponse.blob();

      if (!blob.size) {
        throw new Error(
          "Updated file is empty.",
        );
      }

      const contentDisposition =
        downloadResponse.headers.get(
          "Content-Disposition",
        );

      const fileNameMatch =
        contentDisposition?.match(
          /filename="([^"]+)"/i,
        );

      const baseName =
        fileName
          .replace(
            /\.(xlsx|csv)$/i,
            "",
          ) ||
        "SALARY_SDH09066_20161229";

      const downloadName =
        fileNameMatch?.[1] ||
        `${baseName}.${format}`;

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
        downloadName;

      document.body.appendChild(
        anchor,
      );

      anchor.click();

      anchor.remove();

      window.URL.revokeObjectURL(
        blobUrl,
      );
    }

    if (
      result.data?.fileName
    ) {
      setFileName(
        result.data.fileName,
      );
    }

    return true;
  }

  // ============================================================
  // GENERATE CSV / XLSX
  // ============================================================

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
      setGeneratingFile(
        true,
      );

      // --------------------------------------------------------
      // EDIT MODE
      //
      // Update SAME GeneratedFile.
      // --------------------------------------------------------

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

      // --------------------------------------------------------
      // NORMAL MODE
      //
      // Existing SDH endpoint.
      // --------------------------------------------------------

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
               * Keep frontend preview
               * order unchanged.
               *
               * Backend handles:
               *
               * preview newest-first
               * ->
               * file oldest-first
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

      // --------------------------------------------------------
      // Clear after normal generation.
      // --------------------------------------------------------

      setDrafts([]);

      setPreviewSearch("");

      setEditingId(null);

      setSelectedCard(
        null,
      );

      setCardSearch("");

      setCards([]);

      setHighlightedCardIndex(
        -1,
      );

      setAmount("");

      requestAnimationFrame(
        () => {
          cardSearchInputRef.current?.focus();
        },
      );

      setSuccess(
        `${generatedFileName} generated and saved successfully.`,
      );
    } catch (
      generateError
    ) {
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
      setGeneratingFile(
        false,
      );
    }
  }

  // ============================================================
  // SAVE TRANSACTIONS
  // ============================================================

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

      // --------------------------------------------------------
      // EDIT MODE
      //
      // Update same GeneratedFile.
      // --------------------------------------------------------

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

        return;
      }

      // --------------------------------------------------------
      // NORMAL MODE
      //
      // Existing SDH Save behavior.
      // --------------------------------------------------------

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

      // --------------------------------------------------------
      // Clear normal draft.
      // --------------------------------------------------------

      setDrafts([]);

      setPreviewSearch("");

      setEditingId(null);

      setSelectedCard(
        null,
      );

      setCardSearch("");

      setCards([]);

      setHighlightedCardIndex(
        -1,
      );

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
          ? `Transactions saved successfully. ${savedFileName} is available in Uploaded Files.`
          : "Transactions and file saved successfully.",
      );
    } catch (
      saveError
    ) {
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

  // ============================================================
  // RENDER
  //
  // IMPORTANT:
  // Original UI is preserved.
  // ============================================================

  return (
    <main className="min-h-full bg-slate-50 p-4 sm:p-6">

      <div className="mx-auto max-w-[1400px] space-y-5">

        {/* ======================================================
            HEADER
        ======================================================= */}

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Create SDH Transaction File
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Add card numbers and amounts, review the
            transactions, and generate your payment file.
          </p>
        </div>

        {/* ======================================================
            ERROR
        ======================================================= */}

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">

            <span>
              {error}
            </span>

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

        {/* ======================================================
            SUCCESS
        ======================================================= */}

        {success && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">

            <span>
              {success}
            </span>

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

        {/* ======================================================
            EXISTING FILE LOADING
            No new UI.
            Just disables nothing; error/success handles failures.
        ======================================================= */}

        {loadingFile && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">

            <Loader2 className="h-4 w-4 animate-spin" />

            Loading transactions...

          </div>
        )}

        {/* ======================================================
            ADD TRANSACTION
        ======================================================= */}

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

            <div className="grid gap-5 md:grid-cols-[1fr_260px_auto]">

              {/* ==================================================
                  CARD
              =================================================== */}

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
                    value={
                      cardSearch
                    }
                    onChange={(
                      event,
                    ) => {
                      setCardSearch(
                        event.target
                          .value,
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
                        setCardSearch(
                          "",
                        );

                        setSelectedCard(
                          null,
                        );

                        setCards(
                          [],
                        );

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

                {/* Search Suggestions */}

                {!selectedCard &&
                  cardSearch.trim() &&
                  (cards.length >
                    0 ||
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

              </div>

              {/* ==================================================
                  AMOUNT
              =================================================== */}

              <div>

                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Amount
                </label>

                <input
                  ref={
                    amountInputRef
                  }
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

              {/* ==================================================
                  ADD BUTTON
              =================================================== */}

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

                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(
                        null,
                      );

                      setSelectedCard(
                        null,
                      );

                      setCardSearch(
                        "",
                      );

                      setCards([]);

                      setAmount("");
                    }}
                    className="ml-2 h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                )}

              </div>

            </div>

          </div>

        </section>

        {/* ======================================================
            PREVIEW
        ======================================================= */}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

          {/* Preview Header */}

          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">

            <div>

              <h2 className="text-base font-semibold text-slate-900">

                Preview ({drafts.length}{" "}

                {drafts.length ===
                1
                  ? "Entry"
                  : "Entries"})

              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Latest added transaction appears first.
              </p>

            </div>

            {/* Preview Search */}

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
                placeholder="Search preview by card number..."
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

          </div>

          {/* ====================================================
              EMPTY
          ===================================================== */}

          {drafts.length ===
          0 ? (

            <div className="flex flex-col items-center justify-center px-5 py-16 text-center">

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">

                <CreditCard className="h-6 w-6" />

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

            /* ==================================================
               TABLE
            =================================================== */

            <div className="overflow-x-auto">

              <table className="w-full min-w-[700px] text-sm">

                <thead>

                  <tr className="border-b border-slate-200 bg-slate-50/70 text-left">

                    <th className="px-5 py-3 font-medium text-slate-500">
                      #
                    </th>

                    <th className="px-5 py-3 font-medium text-slate-500">
                      Card Number
                    </th>

                    <th className="px-5 py-3 text-right font-medium text-slate-500">
                      Amount
                    </th>

                    <th className="px-5 py-3 text-right font-medium text-slate-500">
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

                        <td className="px-5 py-3 text-slate-400">
                          {index +
                            1}
                        </td>

                        <td className="px-5 py-3">

                          <div className="font-medium text-slate-800">
                            {maskCardNumber(
                              transaction.cardNumber,
                            )}
                          </div>

                        </td>

                        <td className="px-5 py-3 text-right font-semibold text-slate-800">
                          {formatCurrency(
                            transaction.amount,
                          )}
                        </td>

                        <td className="px-5 py-3">

                          <div className="flex justify-end gap-2">

                            <button
                              type="button"
                              onClick={() =>
                                handleEditTransaction(
                                  transaction,
                                )
                              }
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
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
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
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

          {/* ====================================================
              FOOTER
          ===================================================== */}

          <div className="flex flex-col gap-4 border-t border-slate-100 bg-slate-50/60 p-5 lg:flex-row lg:items-center lg:justify-between">

            {/* Total */}

            <div>

              <p className="text-xs text-slate-500">
                Total Amount
              </p>

              <p className="mt-1 text-xl font-bold text-slate-900">
                {formatCurrency(
                  totalAmount,
                )}
              </p>

            </div>

            {/* Actions */}

            <div className="flex flex-wrap justify-end gap-2">

              {/* Clear */}

              {drafts.length >
                0 && (
                <button
                  type="button"
                  onClick={
                    handleClearAll
                  }
                  disabled={
                    saving ||
                    generatingFile
                  }
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >

                  <Trash2 className="h-4 w-4" />

                  Clear All

                </button>
              )}

              {/* Save */}

              <button
                type="button"
                onClick={
                  handleSaveTransactions
                }
                disabled={
                  saving ||
                  generatingFile ||
                  !drafts.length
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >

                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}

                Save Transactions

              </button>

              {/* CSV */}

              <button
                type="button"
                onClick={() =>
                  downloadGeneratedFile(
                    "csv",
                  )
                }
                disabled={
                  saving ||
                  generatingFile ||
                  !drafts.length
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

              {/* XLSX */}

              <button
                type="button"
                onClick={() =>
                  downloadGeneratedFile(
                    "xlsx",
                  )
                }
                disabled={
                  saving ||
                  generatingFile ||
                  !drafts.length
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >

                {generatingFile ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}

                Generate XLSX

              </button>

            </div>

          </div>

        </section>

      </div>

    </main>
  );
}