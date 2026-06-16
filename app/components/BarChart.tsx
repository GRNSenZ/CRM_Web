// กราฟแท่งแนวนอน เรนเดอร์เป็น SVG ฝั่งเซิร์ฟเวอร์ (ไม่ใช้ไลบรารี)
export default function BarChart({
  title,
  data,
  accent = "#13213f",
  unit = "",
}: {
  title: string;
  data: { label: string; value: number }[];
  accent?: string;
  unit?: string;
}) {
  const W = 480;
  const ROW = 30;
  const LABEL_W = 92;
  const VALUE_W = 64;
  const barArea = W - LABEL_W - VALUE_W;
  const max = Math.max(1, ...data.map((d) => d.value));
  const H = Math.max(1, data.length) * ROW + 6;
  const fmt = (n: number) => n.toLocaleString("th-TH");

  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
      <h3 className="mb-3 text-sm font-semibold text-[#13213f]">{title}</h3>
      {data.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-400">ไม่มีข้อมูลในช่วงนี้</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title}>
          {data.map((d, i) => {
            const y = i * ROW + 3;
            const bw = Math.max(2, (d.value / max) * barArea);
            return (
              <g key={i}>
                <text x={0} y={y + ROW / 2} dominantBaseline="middle" fontSize="12" fill="#52525b">
                  {d.label}
                </text>
                <rect x={LABEL_W} y={y + 6} width={barArea} height={ROW - 14} rx="4" fill="#f1f1f4" />
                <rect x={LABEL_W} y={y + 6} width={bw} height={ROW - 14} rx="4" fill={accent} />
                <text
                  x={W}
                  y={y + ROW / 2}
                  dominantBaseline="middle"
                  textAnchor="end"
                  fontSize="11"
                  fill="#3f3f46"
                >
                  {fmt(d.value)}
                  {unit}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
