import styles from "./Ladder.module.scss";

const RUNGS = [
  { label: "Master", fill: "#B197FC", y: 72 },
  { label: "Very Hard", fill: "#FF8A8A", y: 144 },
  { label: "Hard", fill: "#FFA94D", y: 216 },
  { label: "Medium", fill: "#FFD43B", y: 288 },
  { label: "Easy", fill: "#8CE99A", y: 360 },
];

export default function Ladder() {
  return (
    <svg
      className={styles.ladder}
      viewBox="0 0 360 440"
      role="img"
      aria-label="A ladder with five rungs, one per level from Easy to Master, and a small green square climbing it"
    >
      <rect x="56" y="16" width="12" height="408" rx="6" fill="#111" />
      <rect x="292" y="16" width="12" height="408" rx="6" fill="#111" />
      {RUNGS.map((r) => (
        <g key={r.label}>
          <rect x="68" y={r.y} width="224" height="46" rx="10" fill={r.fill} stroke="#111" strokeWidth="3" />
          <text
            x="180"
            y={r.y + 24}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="var(--font-body), sans-serif"
            fontWeight="700"
            fontSize="18"
            fill="#111"
          >
            {r.label}
          </text>
        </g>
      ))}
      <g className={styles.climber}>
        <rect x="150" y="248" width="34" height="34" rx="8" fill="#1FB75B" stroke="#111" strokeWidth="3" />
        <rect x="159" y="258" width="5" height="8" rx="2" fill="#111" />
        <rect x="171" y="258" width="5" height="8" rx="2" fill="#111" />
      </g>
    </svg>
  );
}
