// src/services/gaService.js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:7000";

async function handleJsonResponse(res) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed: ${res.status} - ${text}`);
  }
  return res.json();
}

// Gọi POST /api/run-ga
// Backend có thể trả:
//  - MSTResult thuần
//  - hoặc { runId, result: MSTResult }
export async function runGa(payload) {
  const res = await fetch(`${API_BASE_URL}/api/run-ga`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleJsonResponse(res);
}

// Lịch sử các lần chạy: GET /api/run-ga/history
export async function getHistory() {
  const res = await fetch(`${API_BASE_URL}/api/run-ga/history`);
  return handleJsonResponse(res);
}

// (tuỳ cần) chi tiết 1 lần chạy theo id
export async function getHistoryById(id) {
  const res = await fetch(`${API_BASE_URL}/api/run-ga/history/${id}`);
  return handleJsonResponse(res);
}
