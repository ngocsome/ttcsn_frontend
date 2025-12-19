import { useState } from "react";
import "./App.css";
import { runGa, getHistory } from "./services/gaService";
import MstGraph from "./MstGraph";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from "recharts";

function App() {
  // ====== CẤU HÌNH GA ======
  const [populationSize, setPopulationSize] = useState("50");
  const [maxGenerations, setMaxGenerations] = useState("200");
  const [crossoverRate, setCrossoverRate] = useState("0.8");
  const [mutationRate, setMutationRate] = useState("0.1");
  const [vertexCount, setVertexCount] = useState("5");

  // Đánh số đỉnh: 0-based hay 1-based (chỉ ảnh hưởng hiển thị & input)
  const [indexing, setIndexing] = useState("zero"); // "zero" | "one"

  // Dữ liệu cạnh nhập từ textarea
  const [edgesInput, setEdgesInput] = useState(
    `0 1 2
0 2 3
1 2 1
1 3 4
2 4 5
3 4 2`
  );

  // Kết quả & trạng thái
  const [result, setResult] = useState(null);
  const [lastRunId, setLastRunId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Lịch sử chạy (bảng bên dưới)
  const [historyVisible, setHistoryVisible] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  // Dữ liệu cho biểu đồ thời gian (theo từng lần chạy)
  const [timeSeries, setTimeSeries] = useState([]);

  // ====== TIỆN ÍCH PARSE SỐ ======
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

  // ====== PARSE DỮ LIỆU CẠNH TỪ TEXTAREA ======
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
        if (uRaw < 0 || vRaw < 0 || uRaw >= vCount || vRaw >= vCount) {
          return {
            edges: null,
            error: `Dòng ${
              i + 1
            }: u, v phải nằm trong khoảng [0, ${vCount - 1}].`,
          };
        }
        edgesForBackend.push({ u: uRaw, v: vRaw, weight: w });
      } else {
        if (uRaw < 1 || vRaw < 1 || uRaw > vCount || vRaw > vCount) {
          return {
            edges: null,
            error: `Dòng ${
              i + 1
            }: u, v phải nằm trong khoảng [1, ${vCount}].`,
          };
        }
        edgesForBackend.push({ u: uRaw - 1, v: vRaw - 1, weight: w });
      }
    }

    return { edges: edgesForBackend, error: null };
  };

  // ====== LỊCH SỬ CHẠY (BẢNG) ======
  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      setHistoryError("");
      const data = await getHistory();
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setHistoryError(err.message || "Đã xảy ra lỗi khi tải lịch sử");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleToggleHistory = async () => {
    const willShow = !historyVisible;
    setHistoryVisible(willShow);
    if (willShow) {
      await fetchHistory();
    }
  };

  // ====== GỌI API CHẠY GA ======
  const handleRunClick = async () => {
    setError("");
    setResult(null);

    let vCountNum;
    let popSize, maxGen, cross, mut;

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

    const { edges, error: edgesErr } = parseEdgesForBackend(
      edgesInput,
      vCountNum,
      indexing
    );
    if (edgesErr) {
      setError(edgesErr);
      return;
    }

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

    try {
      setLoading(true);
      const data = await runGa(payload);

      // Backend có thể trả MSTResult thuần hoặc { runId, result }
      const mstResult = data.result || data;
      setResult(mstResult);
      setLastRunId(data.runId ?? null);

      // Cập nhật cho biểu đồ thời gian thực hiện
      setTimeSeries((prev) => [
        ...prev,
        {
          runIndex: prev.length + 1,
          executionTimeMs: mstResult.executionTimeMs ?? 0,
          vertexCount: vCountNum,
          edgeCount: edges.length,
        },
      ]);

      console.log("API RESULT:", data);

      // Nếu đang mở lịch sử thì reload
      if (historyVisible) {
        await fetchHistory();
      }
    } catch (err) {
      console.error("API ERROR:", err);
      setError(
        `Không gọi được API /api/run-ga: ${err.message || "Unknown error"}`
      );
    } finally {
      setLoading(false);
    }
  };

  // ====== DỮ LIỆU HIỂN THỊ KẾT QUẢ ======
  const mstEdgesRaw = result?.edges || [];

  // Hiển thị theo chế độ đánh số
  const mstEdgesDisplay = mstEdgesRaw.map((e) =>
    indexing === "zero"
      ? e
      : { u: e.u + 1, v: e.v + 1, weight: e.weight }
  );

  // Dữ liệu cho biểu đồ hội tụ (dùng bestFitnessHistory & avgFitnessHistory từ backend)
  const convergenceData =
    result?.bestFitnessHistory && Array.isArray(result.bestFitnessHistory)
      ? result.bestFitnessHistory.map((best, index) => ({
          generation: index + 1,
          best,
          avg: result.avgFitnessHistory?.[index] ?? null,
        }))
      : [];

  const hasAvgSeries =
    result?.avgFitnessHistory &&
    Array.isArray(result.avgFitnessHistory) &&
    result.avgFitnessHistory.length > 0;

  // ====== RENDER ======
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
          {/* ==== CỘT TRÁI: CẤU HÌNH + BIỂU ĐỒ ==== */}
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

            {/* ĐÁNH SỐ ĐỈNH */}
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
                  0 (0, 1, …, vertexCount - 1)
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

            {/* ==== 2 BIỂU ĐỒ (xếp dọc + to hơn) ==== */}
            {result && (
              <div className="charts-grid">
                {/* Biểu đồ hội tụ */}
                <div className="chart-card">
                  <div className="table-header">
                    <h3>Biểu đồ hội tụ</h3>
                    <span className="table-badge">
                      {convergenceData.length} thế hệ
                    </span>
                  </div>

                  {convergenceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={340}>
                      <LineChart
                        data={convergenceData}
                        margin={{ top: 10, right: 16, left: 4, bottom: 6 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="generation" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="best"
                          name="Best cost"
                          dot={false}
                        />
                        {hasAvgSeries && (
                          <Line
                            type="monotone"
                            dataKey="avg"
                            name="Avg cost"
                            dot={false}
                            strokeDasharray="4 4"
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="chart-placeholder">
                      Backend chưa trả về dữ liệu history để vẽ biểu đồ hội tụ.
                    </p>
                  )}
                </div>

                {/* Biểu đồ thời gian thực hiện */}
                <div className="chart-card">
                  <div className="table-header">
                    <h3>Biểu đồ thời gian thực hiện</h3>
                    <span className="table-badge">
                      {timeSeries.length} lần chạy
                    </span>
                  </div>

                  {timeSeries.length > 0 ? (
                    <ResponsiveContainer width="100%" height={340}>
                      <LineChart
                        data={timeSeries}
                        margin={{ top: 10, right: 16, left: 4, bottom: 6 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="runIndex" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="executionTimeMs"
                          name="Thời gian (ms)"
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="chart-placeholder">
                      Chưa có dữ liệu thời gian. Hãy chạy thuật toán ít nhất 1
                      lần.
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ==== CỘT PHẢI: KẾT QUẢ, BẢNG, SƠ ĐỒ, LỊCH SỬ ==== */}
          <section className="panel panel-right">
            <h2 className="panel-title">Kết quả</h2>

            {!result && !loading && (
              <p className="placeholder">
                Nhấn <strong>“Chạy thuật toán”</strong> để xem kết quả cây khung
                nhỏ nhất.
              </p>
            )}

            {result && (
              <>
                {/* Thống kê nhanh */}
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
                      {result.edgeCount ?? mstEdgesRaw.length ?? "---"}
                    </span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Số thế hệ chạy</span>
                    <span className="stat-value">
                      {result.generations ?? "---"}
                    </span>
                  </div>
                  {lastRunId != null && (
                    <div className="stat-card">
                      <span className="stat-label">ID lần chạy gần nhất</span>
                      <span className="stat-value">{lastRunId}</span>
                    </div>
                  )}
                  {result.executionTimeMs != null && (
                    <div className="stat-card">
                      <span className="stat-label">Thời gian thực hiện</span>
                      <span className="stat-value">
                        {result.executionTimeMs.toFixed(3)} ms
                      </span>
                    </div>
                  )}
                </div>

                {/* Bảng cạnh MST */}
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

                {/* Sơ đồ cây khung nhỏ nhất */}
                <MstGraph vertexCount={vertexCount} edges={mstEdgesRaw} />
              </>
            )}

            {/* LỊCH SỬ CHẠY THUẬT TOÁN */}
            <div className="history-section">
              <div className="history-header">
                <h2 className="panel-title panel-title--margin">
                  Lịch sử chạy thuật toán
                </h2>
                <button
                  className="secondary-btn"
                  type="button"
                  onClick={handleToggleHistory}
                >
                  {historyVisible ? "Ẩn lịch sử" : "Xem lịch sử"}
                </button>
              </div>

              {historyVisible && (
                <div className="table-wrapper">
                  {historyLoading && <p>Đang tải lịch sử...</p>}
                  {historyError && (
                    <p style={{ color: "#ff9999", fontSize: 14 }}>
                      Lỗi: {historyError}
                    </p>
                  )}
                  {!historyLoading && !historyError && history.length === 0 && (
                    <p className="placeholder">Chưa có lần chạy nào.</p>
                  )}

                  {!historyLoading && !historyError && history.length > 0 && (
                    <>
                      <div className="table-header">
                        <h3>Danh sách các lần chạy</h3>
                        <span className="table-badge">
                          {history.length} lần
                        </span>
                      </div>
                      <table className="mst-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>ID</th>
                            <th>Thời gian</th>
                            <th>Số đỉnh</th>
                            <th>Số cạnh</th>
                            <th>Tổng trọng số</th>
                            <th>Số thế hệ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((run, index) => {
                            const vCount = run.graph?.vertexCount ?? 0;
                            const eCount = run.graph?.edges?.length ?? 0;
                            const totalW = run.result?.totalWeight ?? 0;
                            const gens = run.result?.generations ?? 0;

                            return (
                              <tr key={run.id}>
                                <td>{index + 1}</td>
                                <td>{run.id}</td>
                                <td>{run.createdAt}</td>
                                <td>{vCount}</td>
                                <td>{eCount}</td>
                                <td>{totalW}</td>
                                <td>{gens}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default App;
