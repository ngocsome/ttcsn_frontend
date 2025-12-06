import { useState } from "react";
import "./App.css";

function App() {
  // Cấu hình GA (để dạng string cho phép nhập 0,8 / 0.8)
  const [populationSize, setPopulationSize] = useState("50");
  const [maxGenerations, setMaxGenerations] = useState("200");
  const [crossoverRate, setCrossoverRate] = useState("0.8");
  const [mutationRate, setMutationRate] = useState("0.1");
  const [vertexCount, setVertexCount] = useState("5");

  // Cách đánh số đỉnh: 0-based hay 1-based
  const [indexing, setIndexing] = useState("zero"); // "zero" hoặc "one"

  // Dữ liệu cạnh – user có thể sửa tuỳ ý
  const [edgesInput, setEdgesInput] = useState(
    `0 1 2
0 2 3
1 2 1
1 3 4
2 4 5
3 4 2`
  );

  // Trạng thái kết quả + lỗi
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ========= HÀM TIỆN ÍCH =========
  // Chuẩn hoá số (hỗ trợ "0,8" hoặc "0.8")
  const parseNumber = (value, fieldName, options = {}) => {
    const normalized = String(value).replace(",", ".").trim();
    if (normalized === "") {
      throw new Error(`"${fieldName}" không được để trống.`);
    }
    const num = Number(normalized);
    if (Number.isNaN(num)) {
      throw new Error(`"${fieldName}" phải là số.`);
    }
    if (options.integer && !Number.isInteger(num)) {
      throw new Error(`"${fieldName}" phải là số nguyên.`);
    }
    if (options.min != null && num < options.min) {
      throw new Error(`"${fieldName}" phải ≥ ${options.min}.`);
    }
    if (options.max != null && num > options.max) {
      throw new Error(`"${fieldName}" phải ≤ ${options.max}.`);
    }
    return num;
  };

  // Parse dữ liệu cạnh từ textarea → edges cho BACKEND
  const parseEdgesForBackend = (text, vCount, indexingMode) => {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (!lines.length) {
      return { edges: null, error: "Chưa có dòng cạnh nào." };
    }

    const edgesForBackend = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(/[\s,]+/);
      if (parts.length !== 3) {
        return {
          edges: null,
          error: `Dòng ${i + 1} phải có đúng 3 số: "u v weight".`,
        };
      }

      const uRaw = Number(parts[0]);
      const vRaw = Number(parts[1]);
      const w = Number(parts[2]);

      if ([uRaw, vRaw, w].some((x) => Number.isNaN(x))) {
        return {
          edges: null,
          error: `Dòng ${i + 1} chứa giá trị không phải số.`,
        };
      }

      if (indexingMode === "zero") {
        // Đỉnh 0..vertexCount-1
        if (uRaw < 0 || vRaw < 0 || uRaw >= vCount || vRaw >= vCount) {
          return {
            edges: null,
            error: `Dòng ${i + 1}: u, v phải nằm trong khoảng [0, ${
              vCount - 1
            }].`,
          };
        }
        edgesForBackend.push({ u: uRaw, v: vRaw, weight: w });
      } else {
        // Đỉnh 1..vertexCount, FE tự trừ 1 cho backend
        if (uRaw < 1 || vRaw < 1 || uRaw > vCount || vRaw > vCount) {
          return {
            edges: null,
            error: `Dòng ${i + 1}: u, v phải nằm trong khoảng [1, ${vCount}].`,
          };
        }
        edgesForBackend.push({ u: uRaw - 1, v: vRaw - 1, weight: w });
      }
    }

    return { edges: edgesForBackend, error: null };
  };

  // ========= GỌI API =========
  const handleRunClick = async () => {
    setError("");
    setResult(null);

    let vCountNum;
    let popSize, maxGen, cross, mut;

    // 1. Đọc & kiểm tra các tham số cấu hình
    try {
      vCountNum = parseNumber(vertexCount, "Số đỉnh (vertexCount)", {
        integer: true,
        min: 1,
      });

      popSize = parseNumber(populationSize, "Population size", {
        integer: true,
        min: 1,
      });
      maxGen = parseNumber(maxGenerations, "Max generations", {
        integer: true,
        min: 1,
      });
      cross = parseNumber(crossoverRate, "Crossover rate", {
        min: 0,
        max: 1,
      });
      mut = parseNumber(mutationRate, "Mutation rate", {
        min: 0,
        max: 1,
      });
    } catch (e) {
      setError(e.message);
      return;
    }

    // 2. Parse dữ liệu cạnh & convert về dạng backend cần
    const { edges, error: edgesErr } = parseEdgesForBackend(
      edgesInput,
      vCountNum,
      indexing
    );
    if (edgesErr) {
      setError(edgesErr);
      return;
    }

    // 3. Tạo payload đúng như Postman
    const payload = {
      config: {
        populationSize: popSize,
        crossoverRate: cross,
        mutationRate: mut,
        maxGenerations: maxGen,
      },
      graph: {
        vertexCount: vCountNum,
        edges,
      },
    };

    console.log("PAYLOAD GỬI LÊN:", payload);

    // 4. Gọi API backend
    try {
      setLoading(true);
      const response = await fetch("http://localhost:7000/api/run-ga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("API ERROR:", response.status, text);
        setError(
          `API trả về lỗi ${response.status}. Chi tiết: ${
            text || "Không có nội dung"
          }`
        );
        return;
      }

      const data = await response.json();
      console.log("API RESULT:", data);
      setResult(data);
    } catch (err) {
      console.error("NETWORK ERROR:", err);
      setError(`Không kết nối được tới backend: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ========= CHUẨN BỊ DỮ LIỆU HIỂN THỊ =========
  // BE luôn trả edges dạng 0-based; nếu người dùng chọn 1-based thì cộng thêm 1 khi hiển thị
  const mstEdgesDisplay =
    result?.edges?.map((e) =>
      indexing === "zero"
        ? e
        : { u: e.u + 1, v: e.v + 1, weight: e.weight }
    ) || [];

  return (
    <div className="page">
      <div className="shell">
        {/* HEADER */}
        <header className="header">
          <div>
            <h1>GA-MST Demo</h1>
            <p>
              Ứng dụng thuật toán di truyền để tìm{" "}
              <span className="highlight">cây khung nhỏ nhất</span>.
            </p>
          </div>
          <div className="badge">GA • MST</div>
        </header>

        {/* LAYOUT 2 CỘT */}
        <div className="grid">
          {/* CỘT TRÁI: cấu hình + dữ liệu cạnh */}
          <section className="panel">
            <h2 className="panel-title">Cấu hình GA</h2>

            <div className="config-grid">
              <div className="field">
                <label>Population size</label>
                <input
                  type="number"
                  value={populationSize}
                  onChange={(e) => setPopulationSize(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Max generations</label>
                <input
                  type="number"
                  value={maxGenerations}
                  onChange={(e) => setMaxGenerations(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Crossover rate</label>
                <input
                  value={crossoverRate}
                  onChange={(e) => setCrossoverRate(e.target.value)}
                  placeholder="0.8"
                />
              </div>
              <div className="field">
                <label>Mutation rate</label>
                <input
                  value={mutationRate}
                  onChange={(e) => setMutationRate(e.target.value)}
                  placeholder="0.1"
                />
              </div>
              <div className="field">
                <label>Số đỉnh (vertexCount)</label>
                <input
                  type="number"
                  value={vertexCount}
                  onChange={(e) => setVertexCount(e.target.value)}
                />
              </div>
            </div>

            {/* Chọn kiểu đánh số đỉnh */}
            <div className="field" style={{ marginTop: "8px" }}>
              <label>Đánh số đỉnh từ</label>
              <div style={{ display: "flex", gap: "12px", fontSize: "13px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="radio"
                    value="zero"
                    checked={indexing === "zero"}
                    onChange={(e) => setIndexing(e.target.value)}
                  />
                  0 (0, 1, 2, …, vertexCount - 1)
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="radio"
                    value="one"
                    checked={indexing === "one"}
                    onChange={(e) => setIndexing(e.target.value)}
                  />
                  1 (1, 2, …, vertexCount)
                </label>
              </div>
            </div>

            <h2 className="panel-title panel-title--margin">Dữ liệu cạnh</h2>
            <p className="hint">
              Mỗi dòng là một cạnh: <code>u v weight</code>. Ví dụ:{" "}
              <code>1 3 5</code>.
            </p>

            <textarea
              className="edges-input"
              value={edgesInput}
              onChange={(e) => setEdgesInput(e.target.value)}
            />

            {error && <div className="alert error">{error}</div>}

            <button
              className="primary-btn"
              onClick={handleRunClick}
              disabled={loading}
            >
              {loading ? "Đang chạy thuật toán..." : "Chạy thuật toán"}
            </button>
          </section>

          {/* CỘT PHẢI: kết quả */}
          <section className="panel panel-right">
            <h2 className="panel-title">Kết quả</h2>

            {!result && !loading && (
              <p className="placeholder">
                Nhấn <strong>“Chạy thuật toán”</strong> để xem kết quả cây
                khung nhỏ nhất.
              </p>
            )}

            {result && (
              <>
                {/* THỐNG KÊ CHUNG */}
                <div className="stats-row">
                  <div className="stat-card">
                    <span className="stat-label">Tổng trọng số MST</span>
                    <span className="stat-value">
                      {result.totalWeight ?? "---"}
                    </span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Số cạnh MST</span>
                    <span className="stat-value">
                      {result.edgeCount ?? mstEdgesDisplay.length ?? "---"}
                    </span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Số thế hệ chạy</span>
                    <span className="stat-value">
                      {result.generations ?? "---"}
                    </span>
                  </div>
                </div>

                {/* BẢNG CẠNH */}
                <div className="table-wrapper">
                  <div className="table-header">
                    <h3>Các cạnh thuộc cây khung nhỏ nhất</h3>
                    <span className="table-badge">
                      {mstEdgesDisplay.length} cạnh
                    </span>
                  </div>
                  <table className="mst-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>u</th>
                        <th>v</th>
                        <th>Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mstEdgesDisplay.map((e, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td>{e.u}</td>
                          <td>{e.v}</td>
                          <td>{e.weight}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default App;
