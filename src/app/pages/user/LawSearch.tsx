export function LawSearch() {
  return (
    <div className="bg-[#f5f5f5] md:bg-[#f6f8fb]">
      <div className="mx-auto max-w-[1600px] md:px-6 md:py-6 xl:px-8">
        <div className="overflow-hidden md:rounded-[28px] md:border md:border-slate-200 md:bg-white md:shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <iframe
            title="法条检索"
            src="/law-search/law_search.html"
            className="block h-[calc(100dvh-80px)] w-full border-0 bg-[#f5f5f5] md:h-[calc(100dvh-120px)] md:min-h-[760px]"
          />
        </div>
      </div>
    </div>
  );
}
