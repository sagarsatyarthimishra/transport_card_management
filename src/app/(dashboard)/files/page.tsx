"use client";

import {
  AlertCircle,
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  Files,
  Loader2,
  Search,
  Trash2,
  TrendingUp,
} from "lucide-react";

import { useCallback, useEffect, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ============================================================
// Types
// ============================================================

interface GeneratedFileItem {
  id: string;
  fileName: string;
  fileSize?: number | null;
  transactionCount: number;
  totalAmount: number;
  contentType: string;
  createdAt: string;
  updatedAt: string;
}

interface FilesApiResponse {
  success: boolean;

  data?: GeneratedFileItem[];

  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  message?: string;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Convert bytes into a readable file size.
 */
function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) {
    return "—";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Format amount using Indian Rupee format.
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format created date/time.
 */
function formatDate(dateValue: string): string {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// ============================================================
// Page
// ============================================================

export default function FilesPage() {
  // ============================================================
  // Files
  // ============================================================

  const [files, setFiles] = useState<GeneratedFileItem[]>([]);

  // ============================================================
  // Filters
  // ============================================================

  const [search, setSearch] = useState("");

  const [fromDate, setFromDate] = useState("");

  const [toDate, setToDate] = useState("");

  // ============================================================
  // Pagination
  // ============================================================

  const [page, setPage] = useState(1);

  const [pageSize, setPageSize] = useState(10);

  const [totalPages, setTotalPages] = useState(1);

  const [totalFiles, setTotalFiles] = useState(0);

  // ============================================================
  // Loading / errors
  // ============================================================

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  // ============================================================
  // Download
  // ============================================================

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // ============================================================
  // Delete
  // ============================================================

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [deleteFile, setDeleteFile] = useState<GeneratedFileItem | null>(null);

  // ============================================================
  // Fetch Files
  // ============================================================

  const fetchFiles = useCallback(
    async (
      searchValue: string,
      pageNumber: number,
      fromDateValue: string,
      toDateValue: string,
      limitValue: number,
    ) => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams();

        params.set("page", String(pageNumber));

        params.set("limit", String(limitValue));

        if (searchValue.trim()) {
          params.set("search", searchValue.trim());
        }

        if (fromDateValue) {
          params.set("fromDate", fromDateValue);
        }

        if (toDateValue) {
          params.set("toDate", toDateValue);
        }

        const response = await fetch(
          `/api/transactions/files?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const result: FilesApiResponse = await response.json();

        if (!response.ok) {
          throw new Error(result.message ?? "Unable to fetch files.");
        }

        setFiles(result.data ?? []);

        setTotalFiles(result.pagination?.total ?? 0);

        setTotalPages(result.pagination?.totalPages ?? 1);
      } catch (fetchError) {
        console.error("Fetch files error:", fetchError);

        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to fetch files.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // ============================================================
  // Initial + Filter Fetch
  //
  // Search is debounced.
  // Date filters and page-size changes also trigger refresh.
  // ============================================================

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchFiles(search, page, fromDate, toDate, pageSize);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [search, page, fromDate, toDate, pageSize, fetchFiles]);

  // ============================================================
  // Search
  // ============================================================

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  // ============================================================
  // From Date
  // ============================================================

  function handleFromDate(value: string) {
    setFromDate(value);
    setPage(1);
  }

  // ============================================================
  // To Date
  // ============================================================

  function handleToDate(value: string) {
    setToDate(value);
    setPage(1);
  }

  // ============================================================
  // Clear Filters
  // ============================================================

  function handleClearFilters() {
    setSearch("");
    setFromDate("");
    setToDate("");
    setPage(1);
  }

  // ============================================================
  // Page Size
  // ============================================================

  function handlePageSizeChange(value: number) {
    setPageSize(value);
    setPage(1);
  }

  // ============================================================
  // Download
  // ============================================================
  async function handleDownload(
    file: GeneratedFileItem,
    format: "xlsx" | "csv",
  ) {
    try {
      setDownloadingId(`${file.id}-${format}`);
      setError("");

      const response = await fetch(
        `/api/transactions/files/${file.id}?format=${format}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        let message = `Unable to download ${format.toUpperCase()} file.`;

        try {
          const result = await response.json();
          message = result.message ?? message;
        } catch {
          // Response wasn't JSON.
        }

        throw new Error(message);
      }

      const blob = await response.blob();

      if (blob.size === 0) {
        throw new Error(`${format.toUpperCase()} file is empty.`);
      }

      const contentDisposition = response.headers.get("Content-Disposition");

      const fileNameMatch = contentDisposition?.match(/filename="([^"]+)"/i);

      const fallbackName = file.fileName.replace(/\.[^.]+$/, "") + `.${format}`;

      const fileName = fileNameMatch?.[1] ?? fallbackName;

      const blobUrl = window.URL.createObjectURL(blob);

      const anchor = document.createElement("a");

      anchor.href = blobUrl;
      anchor.download = fileName;

      document.body.appendChild(anchor);

      anchor.click();

      anchor.remove();

      window.URL.revokeObjectURL(blobUrl);
    } catch (downloadError) {
      console.error(`Download ${format} error:`, downloadError);

      setError(
        downloadError instanceof Error
          ? downloadError.message
          : `Unable to download ${format.toUpperCase()} file.`,
      );
    } finally {
      setDownloadingId(null);
    }
  }

  // ============================================================
  // Delete
  // ============================================================

  async function handleDelete() {
    if (!deleteFile) {
      return;
    }

    const fileId = deleteFile.id;

    try {
      setDeletingId(fileId);
      setError("");

      const response = await fetch(`/api/transactions/files/${fileId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message ?? "Unable to delete file.");
      }

      // ----------------------------------------------------------
      // Close dialog
      // ----------------------------------------------------------

      setDeleteFile(null);

      // ----------------------------------------------------------
      // Refresh
      //
      // IMPORTANT:
      // Pass ALL current filters.
      // ----------------------------------------------------------

      const currentPage = page;

      // If current page has only one
      // record and that record was deleted,
      // move to previous page when necessary.
      const nextPage =
        files.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;

      if (nextPage !== currentPage) {
        setPage(nextPage);
      } else {
        await fetchFiles(search, currentPage, fromDate, toDate, pageSize);
      }
    } catch (deleteError) {
      console.error("Delete file error:", deleteError);

      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete file.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  // ============================================================
  // Empty State
  // ============================================================

  const showEmptyState = !loading && files.length === 0;

  // ============================================================
  // Active Filters
  // ============================================================

  const hasFilters = Boolean(search || fromDate || toDate);

  // ============================================================
  // Render
  // ============================================================

  return (
    <>
      <div className="space-y-6">
        {/* ======================================================
            Page Header
        ======================================================= */}

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* --------------------------------------------------
                Title
            --------------------------------------------------- */}

            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                  <Files className="h-5 w-5" />
                </div>

                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                    File Collections
                  </h1>

                  <p className="mt-1 text-sm text-slate-500">
                    Manage your generated transaction Excel files.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ====================================================
              Filters
          ===================================================== */}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              {/* ------------------------------------------------
                  Search
              ------------------------------------------------- */}

              <div className="relative w-full lg:flex-1">
                <label
                  htmlFor="file-search"
                  className="mb-1.5 block text-xs font-medium text-slate-600"
                >
                  Search
                </label>

                <Search className="pointer-events-none absolute left-3 top-[34px] h-4 w-4 text-slate-400" />

                <Input
                  id="file-search"
                  value={search}
                  onChange={(event) => handleSearch(event.target.value)}
                  placeholder="Search files..."
                  className="h-10 pl-9"
                />
              </div>

              {/* ------------------------------------------------
                  From Date
              ------------------------------------------------- */}

              <div className="w-full lg:w-44">
                <label
                  htmlFor="from-date"
                  className="mb-1.5 block text-xs font-medium text-slate-600"
                >
                  From Date
                </label>

                <Input
                  id="from-date"
                  type="date"
                  value={fromDate}
                  onChange={(event) => handleFromDate(event.target.value)}
                  className="h-10 w-full"
                />
              </div>

              {/* ------------------------------------------------
                  To Date
              ------------------------------------------------- */}

              <div className="w-full lg:w-44">
                <label
                  htmlFor="to-date"
                  className="mb-1.5 block text-xs font-medium text-slate-600"
                >
                  To Date
                </label>

                <Input
                  id="to-date"
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(event) => handleToDate(event.target.value)}
                  className="h-10 w-full"
                />
              </div>

              {/* ------------------------------------------------
                  Clear
              ------------------------------------------------- */}

              {hasFilters && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10"
                  onClick={handleClearFilters}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ======================================================
            Summary Cards
        ======================================================= */}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Total Files */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Total Files
                </p>

                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {totalFiles}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                <Files className="h-5 w-5 text-slate-700" />
              </div>
            </div>
          </div>

          {/* Current Page */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Current Page
                </p>

                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {page}

                  <span className="text-base font-normal text-slate-400">
                    {" "}
                    / {totalPages}
                  </span>
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                <TrendingUp className="h-5 w-5 text-slate-700" />
              </div>
            </div>
          </div>

          {/* File Type */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">File Type</p>

                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  XLSX / CSV
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                <FileSpreadsheet className="h-5 w-5 text-slate-700" />
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================
            Error
        ======================================================= */}

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

            <span>{error}</span>
          </div>
        )}

        {/* ======================================================
            Files Table
        ======================================================= */}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* ----------------------------------------------------
              Table Header
          ----------------------------------------------------- */}

          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Generated Files</h2>

            <p className="mt-1 text-sm text-slate-500">
              Download or remove previously generated Excel files.
            </p>
          </div>

          {/* ----------------------------------------------------
              Loading
          ----------------------------------------------------- */}

          {loading ? (
            <div className="flex min-h-60 items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading files...
              </div>
            </div>
          ) : showEmptyState ? (
            /* --------------------------------------------------
               Empty State
            --------------------------------------------------- */

            <div className="flex min-h-60 flex-col items-center justify-center px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                <FileSpreadsheet className="h-7 w-7 text-slate-400" />
              </div>

              <h3 className="mt-4 font-semibold text-slate-900">
                No files found
              </h3>

              <p className="mt-1 max-w-md text-sm text-slate-500">
                {hasFilters
                  ? "No generated files match your current search or date filters."
                  : "Generate an Excel transaction file and it will appear here automatically."}
              </p>

              {hasFilters && (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={handleClearFilters}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* ==================================================
                  Desktop Table
              =================================================== */}

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-3">File</th>

                      <th className="px-5 py-3">Transactions</th>

                      <th className="px-5 py-3">Total Amount</th>

                      <th className="px-5 py-3">Size</th>

                      <th className="px-5 py-3">Created</th>

                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {files.map((file) => (
                      <tr
                        key={file.id}
                        className="transition-colors hover:bg-slate-50/70"
                      >
                        {/* File */}

                        <td className="px-5 py-4">
                          <div className="flex min-w-60 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                            </div>

                            <div className="min-w-0">
                              <p
                                className="truncate text-sm font-medium text-slate-900"
                                title={file.fileName}
                              >
                                {file.fileName}
                              </p>

                              <p className="mt-0.5 text-xs text-slate-500">
                                XLSX
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Transactions */}

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-700">
                          {file.transactionCount}
                        </td>

                        {/* Total Amount */}

                        <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-900">
                          {formatCurrency(file.totalAmount)}
                        </td>

                        {/* Size */}

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">
                          {formatFileSize(file.fileSize)}
                        </td>

                        {/* Created */}

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4" />

                            {formatDate(file.createdAt)}
                          </div>
                        </td>

                        {/* Actions */}

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            {/* XLSX */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={downloadingId === `${file.id}-xlsx`}
                              onClick={() => void handleDownload(file, "xlsx")}
                              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                            >
                              {downloadingId === `${file.id}-xlsx` ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <FileSpreadsheet className="mr-2 h-4 w-4" />
                              )}
                              XLSX
                            </Button>

                            {/* CSV */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={downloadingId === `${file.id}-csv`}
                              onClick={() => void handleDownload(file, "csv")}
                              className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                            >
                              {downloadingId === `${file.id}-csv` ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <FileText className="mr-2 h-4 w-4" />
                              )}
                              CSV
                            </Button>

                            {/* DELETE */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              disabled={deletingId === file.id}
                              onClick={() => setDeleteFile(file)}
                              aria-label={`Delete ${file.fileName}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ==================================================
                  Mobile Cards
              =================================================== */}

              <div className="divide-y divide-slate-100 md:hidden">
                {files.map((file) => (
                  <div key={file.id} className="space-y-4 p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                        <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p
                          className="break-all text-sm font-medium text-slate-900"
                          title={file.fileName}
                        >
                          {file.fileName}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {formatDate(file.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Transactions</p>

                        <p className="mt-1 font-medium text-slate-900">
                          {file.transactionCount}
                        </p>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Total</p>

                        <p className="mt-1 font-medium text-slate-900">
                          {formatCurrency(file.totalAmount)}
                        </p>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">File Size</p>

                        <p className="mt-1 font-medium text-slate-900">
                          {formatFileSize(file.fileSize)}
                        </p>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Type</p>

                        <p className="mt-1 font-medium text-slate-900">XLSX</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {/* XLSX */}
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                        disabled={downloadingId === `${file.id}-xlsx`}
                        onClick={() => void handleDownload(file, "xlsx")}
                      >
                        {downloadingId === `${file.id}-xlsx` ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <FileSpreadsheet className="mr-2 h-4 w-4" />
                        )}
                        XLSX
                      </Button>

                      {/* CSV */}
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                        disabled={downloadingId === `${file.id}-csv`}
                        onClick={() => void handleDownload(file, "csv")}
                      >
                        {downloadingId === `${file.id}-csv` ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <FileText className="mr-2 h-4 w-4" />
                        )}
                        CSV
                      </Button>

                      {/* DELETE */}
                      <Button
                        type="button"
                        variant="outline"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        disabled={deletingId === file.id}
                        onClick={() => setDeleteFile(file)}
                        aria-label={`Delete ${file.fileName}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ==================================================
                  Pagination
              =================================================== */}

              <div className="flex flex-col gap-4 border-t border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                {/* ------------------------------------------------
                    Pagination Information
                ------------------------------------------------- */}

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
                  <p className="text-sm text-slate-500">
                    Page{" "}
                    <span className="font-medium text-slate-700">{page}</span>{" "}
                    of{" "}
                    <span className="font-medium text-slate-700">
                      {totalPages}
                    </span>
                  </p>

                  {/* Rows Per Page */}

                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <label htmlFor="page-size">Rows per page:</label>

                    <select
                      id="page-size"
                      value={pageSize}
                      onChange={(event) =>
                        handlePageSizeChange(Number(event.target.value))
                      }
                      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value={10}>10</option>

                      <option value={20}>20</option>

                      <option value={30}>30</option>
                    </select>
                  </div>

                  <p className="text-xs text-slate-400">
                    {totalFiles} total {totalFiles === 1 ? "file" : "files"}
                  </p>
                </div>

                {/* ------------------------------------------------
                    Previous / Next
                ------------------------------------------------- */}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                  >
                    Previous
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || loading}
                    onClick={() =>
                      setPage((current) => Math.min(totalPages, current + 1))
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ==========================================================
          Delete Confirmation
      =========================================================== */}

      <AlertDialog
        open={deleteFile !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteFile(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Generated File?</AlertDialogTitle>

            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-slate-900">
                {deleteFile?.fileName}
              </span>
              ? The Excel file will be permanently removed. Your transaction
              history will remain safe.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              disabled={deletingId !== null}
              onClick={(event) => {
                event.preventDefault();

                void handleDelete();
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete File
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
