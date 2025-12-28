'use client';

interface PaginationProps {
    currentPage: number;
    totalPages?: number;
    hasNextPage?: boolean;
    hasPrevPage?: boolean;
    onPageChange: (page: number) => void;
    totalItems?: number;
    pageSize?: number;
    loading?: boolean;
}

export default function Pagination({
    currentPage,
    totalPages,
    hasNextPage = false,
    hasPrevPage,
    onPageChange,
    totalItems,
    pageSize = 20,
    loading = false,
}: PaginationProps) {
    const hasPrev = hasPrevPage !== undefined ? hasPrevPage : currentPage > 1;
    const hasNext = hasNextPage || (totalPages !== undefined && currentPage < totalPages);

    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = totalItems
        ? Math.min(currentPage * pageSize, totalItems)
        : currentPage * pageSize;

    return (
        <div className="pagination">
            <div className="pagination-info">
                {totalItems !== undefined ? (
                    <span>
                        Showing {startItem}-{endItem} of {totalItems} items
                    </span>
                ) : (
                    <span>Page {currentPage}</span>
                )}
            </div>

            <div className="pagination-controls">
                <button
                    className="btn btn-secondary pagination-btn"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={!hasPrev || loading}
                >
                    ← Previous
                </button>

                <span className="pagination-current">
                    {currentPage}
                    {totalPages && ` / ${totalPages}`}
                </span>

                <button
                    className="btn btn-secondary pagination-btn"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={!hasNext || loading}
                >
                    Next →
                </button>
            </div>
        </div>
    );
}
