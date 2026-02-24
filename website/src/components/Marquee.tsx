"use client";

const items = [
  "Claimed 0.34 SOL",
  "Burned 85,000 tokens",
  "Bought back 42K",
  "Added 0.8 SOL to LP",
  "Claimed 0.19 SOL",
  "Burned 28,000 tokens",
  "Pool depth +6.2%",
  "Supply reduced to 998.2M",
];

export default function Marquee() {
  const repeated = [...items, ...items, ...items, ...items];

  return (
    <div className="marquee">
      <div className="marquee-track">
        {repeated.map((item, i) => (
          <span className="marquee-item" key={i}>
            <span className="marquee-dot" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
