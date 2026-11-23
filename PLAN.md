# PLAN.md — DriftGuard AI: Rovo Autonomous Spec & Release Drift Auditor

## 1. Thông Tin Dự Án & Mục Tiêu Hackathon
* **Cuộc thi:** Atlassian Codegeist 2026 ($120,000+ Prize Pool).
* **Mặt trận mục tiêu:**
  * **Hạng mục chính:** Apps for Software Teams (Giải Nhất: $15,000 USD).
  * **Giải phụ mục tiêu (Bonus Prizes):**
    * *Best Rovo Agents ($1,500 USD):* Ứng dụng AI agent Rovo có prompt sắc bén, hành động tự chủ sâu và ngữ cảnh thông minh.
    * *Best Teamwork Graph Integration ($1,500 USD):* Khai thác mối quan hệ đa chiều giữa Confluence Docs, Jira Issues và Bitbucket Pull Requests.
* **Tên ứng dụng:** **DriftGuard AI** (`atlassian-driftguard-forge`).

---

## 2. Vấn Đề Cốt Lõi (Problem Statement)
Trong các đội ngũ phát triển phần mềm hiện đại:
1. **Spec-to-Ticket Drift (Độ lệch Yêu cầu):** Khi Confluence PRD hoặc System Architecture Specs được cập nhật trong sprint (ví dụ: bổ sung bảo mật 2FA, đổi cấu trúc payload API, tăng thời hạn token), Jira Tickets của lập trình viên thường không được đồng bộ kịp thời.
2. **Missing Acceptance Criteria:** Lập trình viên hoàn thành ticket dựa trên tiêu chí cũ, dẫn đến code merge thiếu kiểm thử, hồi quy lỗi nghiêm trọng khi release.
3. **Mù mờ rủi ro Release (Blind Release Risk):** Release Manager không có cách nào đối chiếu tự động xem bản build chuẩn bị lên Production có thực sự phản ánh đúng 100% các cam kết trong tài liệu đặc tả hay không.

---

## 3. Giải Pháp & Kiến Trúc Kỹ Thuật (Architecture)

### 3.1. Các Thành Phần Cốt Lõi:
1. **Atlassian Forge Manifest (`manifest.yml`):**
   * Module `rovo:agent`: `drift-guard-agent` (Persona: Senior Release Auditor & Systems Architect).
   * Module `action` (Rovo Action Capabilities):
     * `audit-drift-action`: Quét so sánh ngữ nghĩa giữa Confluence Page và Jira Issue/Epic, trích xuất danh sách sai lệch (Drifts).
     * `reconcile-ticket-action`: Tự động cập nhật trường Acceptance Criteria của Jira Ticket hoặc tạo Sub-task khắc phục độ lệch.
     * `generate-release-score-action`: Tính toán Release Readiness Score (0-100), phân loại rủi ro (Low / Medium / High / Critical).
   * Module `jira:issuePanel` & `confluence:contentAction`: Nhúng giao diện kiểm toán trực tiếp vào Jira Issue và Confluence Page.
   * Module `customUI`: Giao diện React hiển thị Drift Matrix, Diff View, và Interactive Action Triggers.

2. **Drift Detection Engine (`src/engine/`):**
   * Module so khớp tiêu chí kỹ thuật (Requirement Matching).
   * Đánh giá độ lệch theo 4 chiều:
     * *Scope Drift:* Yêu cầu mới trong spec chưa có ticket tương ứng.
     * *Acceptance Criteria Mismatch:* Tiêu chuẩn nghiệm thu của ticket không khớp tài liệu.
     * *Security/Compliance Oversight:* Yêu cầu bảo mật trong tài liệu bị bỏ quên.
     * *State Stagnation:* Ticket đã đóng (Done) nhưng spec vẫn đang sửa đổi.

3. **Chế Độ Local Interactive Sandbox Demo:**
   * Cho phép giám khảo / người dùng mở trực tiếp trên trình duyệt cục bộ (hoặc web standalone) mà không cần cài đặt Atlassian CLI hoặc tài khoản Atlassian Cloud.
   * Tích hợp sẵn 3 bộ dataset giả lập thực tế:
     * *Scenario 1 (Fintech API Gateway):* Confluence Spec v2.4 (thêm HMAC SHA-256 + Rate Limiting 100 req/s) vs Jira FIN-104 (vẫn dùng API Key v1 cũ). -> Critical Drift.
     * *Scenario 2 (E-Commerce Checkout):* Confluence Spec v3.0 (yêu cầu PCI-DSS 4.0 sandbox verification) vs Jira CHECK-209. -> High Risk Drift.
     * *Scenario 3 (OAuth2 SSO Migration):* Spec v1.2 vs Jira AUTH-55 -> Clean / In-Sync (Score 96/100).

---

## 4. Kế Hoạch Triển Khai TDD & Tiêu Chuẩn Nghiệm Thu

1. **Khởi tạo dự án:**
   * `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`.
   * Cài đặt thư viện: `react`, `react-dom`, `@forge/api`, `@forge/bridge` (mockable), `vitest`.
2. **Xây dựng `manifest.yml` chuẩn Forge:**
   * Khai báo chuẩn schema `modules`, `rovo:agent`, `action`, `customUI`, `permissions`, `app`.
3. **Hiện thực hóa Logic & Test Engine (TDD):**
   * Viết test `driftEngine.test.ts` -> Hiện thực `driftEngine.ts`.
   * Viết test `rovoActions.test.ts` -> Hiện thực `rovoActions.ts`.
   * Viết test `manifestValidator.test.ts` -> Hiện thực kiểm tra schema `manifest.yml`.
4. **Xây dựng Giao Diện Custom UI & Local Sandbox:**
   * Thiết kế giao diện chuyên nghiệp, tương phản cao, phông chữ monospace/sans-serif sắc nét, không dùng gradient tím-xanh AI rập khuôn.
   * Tích hợp các nút bấm hành động thực tế: "Run Deep Audit", "Trigger Rovo Auto-Reconcile", "Export Audit Report Markdown".
5. **Đóng gói & Kiểm tra:**
   * Chạy `npm test` -> 100% PASS.
   * Chạy `npm run build` -> 100% PASS (Zero TypeScript error, Zero bundle warnings).
