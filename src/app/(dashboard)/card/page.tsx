"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  Check,
  CreditCard,
  Download,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CardItem {
  _id: string;
  cardNumber: string;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ImportSummary {
  totalRows: number;
  validRows: number;
  imported: number;
  skippedDuplicates: number;
  invalidRows: number;
}

const CARD_NUMBER_REGEX = /^\d{8,19}$/;

const PAGE_SIZE_OPTIONS = [10, 20, 30];

export default function CardsPage() {
  const [cards, setCards] = useState<CardItem[]>([]);

  const [cardNumber, setCardNumber] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [deleteTarget, setDeleteTarget] =
    useState<CardItem | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pagination, setPagination] =
    useState<Pagination>({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    });

  /*
   * Fetch SDH cards from server.
   *
   * UI is intentionally the same as MMM.
   * Only API endpoint is different.
   */
  const fetchCards = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const response = await fetch(
        `/api/sdh/cards?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to fetch cards."
        );
      }

      setCards(data.data);
      setPagination(data.pagination);
    } catch (fetchError) {
      console.error("Fetch SDH cards error:", fetchError);

      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to fetch cards."
      );
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search]);

  /*
   * Debounced search.
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextSearch = searchInput.trim();

      setPage(1);
      setSearch(nextSearch);
    }, 500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  function validateCardNumber(value: string): boolean {
    return CARD_NUMBER_REGEX.test(value.trim());
  }

  /*
   * Add SDH card
   */
  async function handleAddCard(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const value = cardNumber.trim();

    if (!validateCardNumber(value)) {
      setError(
        "Invalid card number. Enter 8 to 19 digits only."
      );
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      setMessage("");

      const response = await fetch("/api/sdh/cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cardNumber: value,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message || "Unable to add card."
        );
        return;
      }

      setMessage(data.message);
      setCardNumber("");

      await fetchCards();
    } catch (saveError) {
      console.error("Add SDH card error:", saveError);

      setError(
        "Unable to add card. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  }

  /*
   * Start inline edit.
   */
  function startInlineEdit(card: CardItem) {
    setEditingId(card._id);
    setEditingValue(card.cardNumber);
    setError("");
    setMessage("");
  }

  /*
   * Cancel inline edit.
   */
  function cancelInlineEdit() {
    if (isSaving) {
      return;
    }

    setEditingId(null);
    setEditingValue("");
  }

  /*
   * Save inline edit.
   */
  async function saveInlineEdit(id: string) {
    const value = editingValue.trim();

    if (!validateCardNumber(value)) {
      setError(
        "Invalid card number. Enter 8 to 19 digits only."
      );
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      setMessage("");

      const response = await fetch(
        `/api/sdh/cards/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cardNumber: value,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message || "Unable to update card."
        );
        return;
      }

      setMessage(data.message);

      setEditingId(null);
      setEditingValue("");

      await fetchCards();
    } catch (updateError) {
      console.error(
        "Update SDH card error:",
        updateError
      );

      setError("Unable to update card.");
    } finally {
      setIsSaving(false);
    }
  }

  /*
   * Request delete confirmation.
   */
  function requestDelete(card: CardItem) {
    setDeleteTarget(card);
    setError("");
    setMessage("");
  }

  /*
   * Close delete dialog.
   */
  function closeDeleteDialog() {
    if (isDeleting) {
      return;
    }

    setDeleteTarget(null);
  }

  /*
   * Confirm SDH card deletion.
   */
  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    try {
      setIsDeleting(true);
      setError("");
      setMessage("");

      const response = await fetch(
        `/api/sdh/cards/${deleteTarget._id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message || "Unable to delete card."
        );
        return;
      }

      setMessage(data.message);
      setDeleteTarget(null);

      /*
       * If deleting the last item on a page,
       * move to the previous page.
       */
      if (cards.length === 1 && page > 1) {
        setPage((previous) => previous - 1);
      } else {
        await fetchCards();
      }
    } catch (deleteError) {
      console.error(
        "Delete SDH card error:",
        deleteError
      );

      setError("Unable to delete card.");
    } finally {
      setIsDeleting(false);
    }
  }

  /*
   * Page size.
   */
  function handlePageSizeChange(
    event: ChangeEvent<HTMLSelectElement>
  ) {
    const nextSize = Number(event.target.value);

    if (!PAGE_SIZE_OPTIONS.includes(nextSize)) {
      return;
    }

    setPageSize(nextSize);
    setPage(1);
  }

  /*
   * Open Excel import picker.
   */
  function openImportPicker() {
    setError("");
    setMessage("");
    fileInputRef.current?.click();
  }

  /*
   * Import SDH cards.
   */
  async function handleImport(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError(
        "Please select an .xlsx Excel file."
      );
      return;
    }

    try {
      setIsImporting(true);
      setError("");
      setMessage("");

      const formData = new FormData();

      formData.append("file", file);

      const response = await fetch(
        "/api/sdh/cards/import",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message || "Unable to import cards."
        );
        return;
      }

      const summary =
        data.summary as ImportSummary;

      setMessage(
        `Import completed: ${summary.imported} imported, ${summary.skippedDuplicates} duplicates skipped, ${summary.invalidRows} invalid rows.`
      );

      setPage(1);
      setSearch("");
      setSearchInput("");

      await fetchCards();
    } catch (importError) {
      console.error(
        "Import SDH cards error:",
        importError
      );

      setError(
        "Unable to import cards. Please try again."
      );
    } finally {
      setIsImporting(false);
    }
  }

  /*
   * Export SDH cards.
   */
  async function handleExport() {
    try {
      setIsExporting(true);
      setError("");
      setMessage("");

      const response = await fetch(
        "/api/sdh/cards/export"
      );

      if (!response.ok) {
        const data = await response.json();

        throw new Error(
          data.message || "Unable to export cards."
        );
      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = "sdh_cards.xlsx";

      document.body.appendChild(anchor);

      anchor.click();

      anchor.remove();

      window.URL.revokeObjectURL(url);

      setMessage(
        "Cards exported successfully."
      );
    } catch (exportError) {
      console.error(
        "Export SDH cards error:",
        exportError
      );

      setError(
        exportError instanceof Error
          ? exportError.message
          : "Unable to export cards."
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-600">
            Card Management
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            SDH Manage Cards
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Manage cards with secure validation,
            Excel import and export.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleImport}
            className="hidden"
          />

          <Button
            type="button"
            variant="outline"
            onClick={openImportPicker}
            disabled={isImporting}
            className="h-10 rounded-xl"
          >
            <Upload className="mr-2 h-4 w-4" />

            {isImporting
              ? "Importing..."
              : "Import Excel"}
          </Button>

          <Button
            type="button"
            onClick={handleExport}
            disabled={
              isExporting ||
              pagination.total === 0
            }
            className="h-10 rounded-xl bg-blue-600 shadow-md shadow-blue-600/20 hover:bg-blue-700"
          >
            <Download className="mr-2 h-4 w-4" />

            {isExporting
              ? "Exporting..."
              : "Export Excel"}
          </Button>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Add Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Plus className="h-5 w-5" />
          </div>

          <div>
            <h2 className="font-semibold text-slate-900">
              Add New Card
            </h2>

            <p className="mt-0.5 text-xs text-slate-500">
              Enter 8 to 19 digits. Letters and special
              characters are not allowed.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleAddCard}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <Input
            value={cardNumber}
            onChange={(event) => {
              const value = event.target.value;

              /*
               * Only allow digits while typing.
               */
              const digitsOnly =
                value.replace(/\D/g, "");

              setCardNumber(digitsOnly);
            }}
            inputMode="numeric"
            maxLength={19}
            placeholder="Enter card number"
            disabled={isSaving}
            className="h-11 flex-1 rounded-xl font-mono"
          />

          <Button
            type="submit"
            disabled={
              isSaving || !cardNumber.trim()
            }
            className="h-11 rounded-xl bg-blue-600 px-5 hover:bg-blue-700"
          >
            <Plus className="mr-2 h-4 w-4" />

            {isSaving ? "Adding..." : "Add Card"}
          </Button>
        </form>
      </section>

      {/* Cards Section */}
      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-blue-600" />

              <h2 className="font-semibold text-slate-900">
                Your Cards
              </h2>
            </div>

            <p className="mt-1 text-xs text-slate-500">
              {pagination.total} card
              {pagination.total === 1
                ? ""
                : "s"} in your account
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Debounced Search */}
            <div className="relative sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <Input
                value={searchInput}
                onChange={(event) =>
                  setSearchInput(
                    event.target.value
                  )
                }
                placeholder="Search card number..."
                className="h-10 rounded-xl pl-9 pr-9"
              />

              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                    setPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Page Size */}
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-xs font-medium text-slate-500">
                Rows
              </span>

              <select
                value={pageSize}
                onChange={
                  handlePageSizeChange
                }
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
              </select>
            </div>
          </div>
        </div>

        {/* Search status */}
        {search && (
          <div className="flex items-center justify-between border-b border-blue-100 bg-blue-50/50 px-5 py-2.5">
            <p className="text-xs text-blue-700">
              Searching for{" "}
              <span className="font-semibold">
                &quot;{search}&quot;
              </span>
            </p>

            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setPage(1);
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              Clear
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
          </div>
        ) : cards.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              <CreditCard className="h-5 w-5" />
            </div>

            <p className="mt-4 font-semibold text-slate-700">
              No cards found
            </p>

            <p className="mt-1 text-sm text-slate-400">
              {search
                ? "Try another card number."
                : "Add a card or import an Excel file."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop heading */}
            <div className="hidden border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:grid sm:grid-cols-[60px_1fr_180px_190px]">
              <span>#</span>
              <span>Card Number</span>
              <span>Added On</span>
              <span className="text-right">
                Actions
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {cards.map((card, index) => {
                const isEditing =
                  editingId === card._id;

                return (
                  <div
                    key={card._id}
                    className="px-5 py-4 transition hover:bg-slate-50/70"
                  >
                    {isEditing ? (
                      <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50/40 p-3 sm:flex-row sm:items-center">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-blue-700">
                          {index +
                            1 +
                            (page - 1) *
                              pageSize}
                        </div>

                        <div className="flex-1">
                          <Input
                            autoFocus
                            value={editingValue}
                            onChange={(event) => {
                              const digitsOnly =
                                event.target.value.replace(
                                  /\D/g,
                                  ""
                                );

                              setEditingValue(
                                digitsOnly
                              );
                            }}
                            onKeyDown={(event) => {
                              if (
                                event.key ===
                                "Enter"
                              ) {
                                event.preventDefault();

                                saveInlineEdit(
                                  card._id
                                );
                              }

                              if (
                                event.key ===
                                "Escape"
                              ) {
                                cancelInlineEdit();
                              }
                            }}
                            inputMode="numeric"
                            maxLength={19}
                            disabled={isSaving}
                            className="h-10 rounded-lg bg-white font-mono"
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              saveInlineEdit(
                                card._id
                              )
                            }
                            disabled={isSaving}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-700"
                          >
                            <Check className="mr-1.5 h-4 w-4" />
                            Save
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={
                              cancelInlineEdit
                            }
                            disabled={isSaving}
                            className="rounded-lg"
                          >
                            <X className="mr-1.5 h-4 w-4" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[60px_1fr_180px_190px] sm:items-center">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-blue-600">
                          {index +
                            1 +
                            (page - 1) *
                              pageSize}
                        </div>

                        <div>
                          <p className="font-mono text-sm font-semibold tracking-wide text-slate-900">
                            {card.cardNumber}
                          </p>

                          <p className="mt-1 text-xs text-slate-400 sm:hidden">
                            Added{" "}
                            {new Date(
                              card.createdAt
                            ).toLocaleDateString()}
                          </p>
                        </div>

                        <p className="hidden text-sm text-slate-500 sm:block">
                          {new Date(
                            card.createdAt
                          ).toLocaleDateString()}
                        </p>

                        <div className="flex gap-2 sm:justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              startInlineEdit(
                                card
                              )
                            }
                            className="rounded-lg"
                          >
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Edit
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              requestDelete(card)
                            }
                            className="rounded-lg"
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex flex-col gap-3 border-t border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  Showing{" "}
                  <span className="font-semibold text-slate-700">
                    {(page - 1) * pageSize + 1}
                  </span>{" "}
                  -
                  <span className="font-semibold text-slate-700">
                    {" "}
                    {Math.min(
                      page * pageSize,
                      pagination.total
                    )}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-slate-700">
                    {pagination.total}
                  </span>
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() =>
                      setPage(
                        (previous) =>
                          previous - 1
                      )
                    }
                    className="rounded-lg"
                  >
                    Previous
                  </Button>

                  <div className="min-w-24 text-center text-sm font-medium text-slate-600">
                    Page {pagination.page} of{" "}
                    {pagination.totalPages}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      page >=
                      pagination.totalPages
                    }
                    onClick={() =>
                      setPage(
                        (previous) =>
                          previous + 1
                      )
                    }
                    className="rounded-lg"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Custom Delete Dialog */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-card-title"
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <Trash2 className="h-5 w-5" />
                </div>

                <div>
                  <h3
                    id="delete-card-title"
                    className="text-lg font-semibold text-slate-900"
                  >
                    Delete Card?
                  </h3>

                  <p className="mt-1.5 text-sm leading-6 text-slate-500">
                    This card will be permanently
                    removed from your card master.
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Card Number
                </p>

                <p className="mt-1 font-mono text-sm font-semibold tracking-wide text-slate-800">
                  {deleteTarget.cardNumber}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeDeleteDialog}
                disabled={isDeleting}
                className="rounded-xl"
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="destructive"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="rounded-xl"
              >
                <Trash2 className="mr-2 h-4 w-4" />

                {isDeleting
                  ? "Deleting..."
                  : "Yes, Delete Card"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}