import ArchivePhotoCard from "./_components/archive-photo-card";

const recent = [
  { id: "BA-2201", region: "서울 영등포구", image: "https://picsum.photos/seed/banner-2201/1200/900" },
  { id: "BA-2196", region: "부산 남구", image: "https://picsum.photos/seed/banner-2196/1200/1600" },
  { id: "BA-2189", region: "전남 나주시", image: "https://picsum.photos/seed/banner-2189/1600/900" },
  { id: "BA-2181", region: "대전 서구", image: "https://picsum.photos/seed/banner-2181/1000/1000" },
  { id: "BA-2174", region: "광주 북구", image: "https://picsum.photos/seed/banner-2174/1200/900" },
  { id: "BA-2162", region: "경기 성남시", image: "https://picsum.photos/seed/banner-2162/1200/1600" },
];

export default function HomePage() {
  return (
    <div className="stack-lg">
      {/* <section className="grid gap-1">
        <h1 className="m-0">최근 업로드된 배너</h1>
        <p className="m-0 text-[13px] text-[var(--text-muted)]">최신 업로드 순으로 표시됩니다.</p>
      </section> */}

      <section className="masonry">
        {recent.map((item, idx) => (
          <ArchivePhotoCard
            key={item.id}
            item={item}
            mediaClass={`media-${(idx % 4) + 1}`}
            fromPath="/"
          />
        ))}
      </section>
    </div>
  );
}
