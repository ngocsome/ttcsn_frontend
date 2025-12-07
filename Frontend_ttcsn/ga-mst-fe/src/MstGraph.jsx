// src/MstGraph.jsx
import React from "react";

function MstGraph({ vertexCount, edges }) {
  const n = Number(vertexCount) || 0;
  if (!n || !edges || !edges.length) {
    return (
      <p style={{ fontSize: 13, opacity: 0.8 }}>
        Chưa có dữ liệu để vẽ cây khung.
      </p>
    );
  }

  const size = 320; // kích thước SVG
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 40; // bán kính vòng tròn các đỉnh

  // Tính tọa độ cho từng đỉnh, đặt đều trên vòng tròn
  const nodes = Array.from({ length: n }, (_, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2; // bắt đầu từ trên cùng
    return {
      id: i,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });

  return (
    <div className="mst-graph-card">
      <div className="table-header">
        <h3>Sơ đồ cây khung nhỏ nhất</h3>
      </div>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="mst-graph-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Vẽ các cạnh */}
        {edges.map((e, idx) => {
          const from = nodes[e.u];
          const to = nodes[e.v];
          if (!from || !to) return null;

          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;

          return (
            <g key={`edge-${idx}`}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="#38bdf8"
                strokeWidth="2"
              />
              {/* trọng số cạnh */}
              <text
                x={midX}
                y={midY - 4}
                fontSize="10"
                textAnchor="middle"
                fill="#facc15"
              >
                {e.weight}
              </text>
            </g>
          );
        })}

        {/* Vẽ các đỉnh */}
        {nodes.map((node) => (
          <g key={`node-${node.id}`}>
            <circle
              cx={node.x}
              cy={node.y}
              r="14"
              fill="#020617"
              stroke="#38bdf8"
              strokeWidth="2"
            />
            <text
              x={node.x}
              y={node.y + 4}
              fontSize="11"
              textAnchor="middle"
              fill="#e5e7eb"
            >
              {node.id}
            </text>
          </g>
        ))}
      </svg>
      <p style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>
        Các đỉnh được đặt đều trên vòng tròn, các cạnh được vẽ theo kết quả
        cây khung nhỏ nhất.
      </p>
    </div>
  );
}

export default MstGraph;
