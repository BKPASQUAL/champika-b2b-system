/**
 * Placeholder screens shown by the shop's loading.tsx files the moment a link
 * is clicked, while the next page renders on the server. They fade in after a
 * short delay (.shop-skel-in) so quick navigations don't flash.
 */

function Bar({ className = "" }: { className?: string }) {
  return <div className={`shop-skel rounded-md ${className}`} />;
}

function CardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-(--s-line) bg-(--s-surface)">
      <div className="shop-skel aspect-square" />
      <div className="space-y-2 border-t border-(--s-line) p-3.5">
        <Bar className="h-3 w-16" />
        <Bar className="h-4 w-full" />
        <Bar className="h-4 w-2/3" />
        <Bar className="mt-3 h-5 w-24" />
        <Bar className="mt-2 h-9 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))] sm:gap-4">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Listing pages: breadcrumb · category bar · filter box · product grid. */
export function ListingSkeleton() {
  return (
    <div className="shop-skel-in mx-auto px-4 py-6 md:px-6 lg:py-8 xl:px-10" aria-busy="true" aria-label="Loading">
      <Bar className="mb-5 h-3.5 w-32" />
      <div className="mb-5 flex gap-2 overflow-hidden lg:hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <Bar key={i} className="h-9 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="flex gap-6 xl:gap-8">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="space-y-2 rounded-2xl border border-(--s-line) bg-(--s-surface) p-3">
            <Bar className="mb-3 h-4 w-24" />
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-1 py-1.5">
                <Bar className="h-8 w-8 rounded-lg" />
                <Bar className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </aside>
        <div className="min-w-0 flex-1 space-y-5">
          <div className="space-y-3.5 rounded-2xl border border-(--s-line) bg-(--s-surface) p-4">
            <Bar className="h-10 w-full rounded-xl" />
            <div className="flex gap-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Bar key={i} className="h-8 w-24 rounded-full" />
              ))}
            </div>
          </div>
          <GridSkeleton />
        </div>
      </div>
    </div>
  );
}

/** Product page: gallery · details. */
export function ProductSkeleton() {
  return (
    <div className="shop-skel-in mx-auto px-4 py-6 md:px-6 lg:py-8 xl:px-10" aria-busy="true" aria-label="Loading">
      <Bar className="mb-5 h-3.5 w-48" />
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="shop-skel aspect-square w-full rounded-2xl" />
        <div className="space-y-4">
          <Bar className="h-3.5 w-20" />
          <Bar className="h-7 w-full" />
          <Bar className="h-7 w-3/4" />
          <Bar className="mt-6 h-9 w-40" />
          <Bar className="h-4 w-full" />
          <Bar className="h-4 w-5/6" />
          <Bar className="h-4 w-2/3" />
          <Bar className="mt-6 h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/** Any other shop page. */
export function PageSkeleton() {
  return (
    <div className="shop-skel-in mx-auto px-4 py-6 md:px-6 lg:py-8 xl:px-10" aria-busy="true" aria-label="Loading">
      <Bar className="mb-6 h-3.5 w-32" />
      <Bar className="mb-6 h-40 w-full rounded-2xl md:h-56" />
      <GridSkeleton count={5} />
    </div>
  );
}
