# Vietjet Booking Lookup — Research & Giải pháp

> Ghi lại toàn bộ quá trình nghiên cứu giải pháp tự động đọc thông tin vé từ website Vietjet và xuất ra text định dạng chuẩn để dán vào Zalo/Telegram cho CSKH.

> **Cập nhật 2026-09-08 — đã triển khai và test thành công với booking thật (2G9YTB).** 3 điểm quan trọng khác với giả định ban đầu ở mục 2-4 bên dưới:
> 1. **Endpoint thật là `PATCH /booking/api/v1/reservations`**, không phải `/checkin` như đoán ban đầu qua DevTools.
> 2. **Bắt buộc dùng Chrome thật (`channel: 'chrome'` trong Playwright), không dùng Chromium bundled mặc định** — Chromium bundled bị chặn ở tầng network (`net::ERR_FAILED` ngay khi gọi `/reservations`, không tới được response listener), gần như chắc chắn do bot-detection theo fingerprint trước `vietjet-api.vietjetair.com`. Dùng Chrome thật thì `headless: true` chạy bình thường — vấn đề nằm ở browser binary, không phải headless/headed.
> 3. **Selector form thật** (xác nhận qua DevTools thật, ổn định hơn nhiều so với đoán bằng placeholder): `input[name="reservationLocator"]`, `input[name="passengerFamilyName"]`, `input[name="passengerMiddleGivenName"]`, nút submit `button[type="submit"]:has-text("Tìm kiếm")`. Trang có 2 lớp popup (khuyến mãi + cookie banner) cần dismiss trước khi điền form.
>
> Code đã triển khai tại `src/lib/{lookup,format,airports}.ts` + Next.js UI ở `src/app/`. Đã thêm style thứ 3 `en-long` (bản tiếng Anh của style 2 dài dòng) theo yêu cầu. Xem README/code thay vì đoạn code mẫu ở mục 4 (đã lỗi thời).

## 1. Bài toán

**Input:** Mã đặt chỗ, Họ, Tên đệm & tên (giống form tại `vietjetair.com/vi/my/search-booking`)

**Output mong muốn** (2 style tham khảo từ thực tế nhân viên đang gõ tay):

```
Code: 2G9YTB
Hành khách: TRAN CONG TRUONG BUI VIET VUONG DUONG QUANG HIEP

Route: Hanoi - Jakarta
Depart date: 22/09/2026
Flight time: 08:40 - 13:00
Flight number: VJ929
Airline: Vietjet Air
---
Route: Jakarta - Hanoi
Depart date: 25/09/2026
Flight time: 14:00 - 18:15
Flight number: VJ928
Airline: Vietjet Air
```

```
Code: 92R5KC
Hành khách:
NGUYEN MANH CHUNG
GIANG QUYNH ANH
Chuyến bay VJ962: từ Hà Nội đến Seoul ngày 13/11/2026 lúc 22:50,
Chuyến bay VJ961: từ Seoul đến Hà Nội ngày 17/11/2026 lúc 11:05,
Hãng Vietjetair,
```

Kết luận: 2 style khác nhau — nhiều khả năng do thói quen gõ tay khác nhau của từng nhân viên, không phải 1 chuẩn cố định. Nên thiết kế hàm format nhận tham số `style`.

## 2. Các hướng đã cân nhắc

### 2.1. Gọi thẳng API ẩn (❌ không khả thi trực tiếp)

Qua DevTools Network tab, phát hiện:

- **Endpoint thật:** `PATCH https://vietjet-api.vietjetair.com/booking/api/v1/checkin` — status 200, trả JSON đầy đủ (không phải domain `vietjet-api.intelisys.ca` xuất hiện trong các `href` — đó chỉ là backend GDS/Travelport nội bộ, không gọi trực tiếp được).
- **Response: plain JSON, KHÔNG mã hoá** — đọc được toàn bộ `reservation` object.
- **Request payload: BỊ MÃ HOÁ client-side.** Body gửi lên chỉ có 1 field:
  ```json
  { "encrypted": "NINO0CD4pCqlV8a/rSt6MrlOM/bCqPEtXQ/SHJwtnalb7Shza2r..." }
  ```
  Đây là chuỗi base64, rất có thể AES-CBC/GCM với key/IV nhúng trong JS bundle của Vietjet.

**Hệ quả:** Không thể tự build JSON `{bookingCode, lastName, firstName}` rồi POST thẳng. Muốn làm được phải reverse-engineer thuật toán mã hoá trong JS bundle — làm được nhưng:
- Tốn công tìm hàm mã hoá + key/IV trong minified JS
- **Dễ vỡ**: Vietjet đổi key/thuật toán bất kỳ lúc nào, không có cảnh báo trước
- Rủi ro cao hơn lợi ích so với hướng dưới

### 2.2. Browser automation + Network interception (✅ khuyến nghị)

Thay vì:
- ❌ Tự mã hoá payload (phức tạp, dễ vỡ)
- ❌ Scrape DOM/HTML (dễ vỡ khi Vietjet đổi UI, cần selector cụ thể)

→ Dùng **Playwright** để tự động điền form như người dùng thật (để trình duyệt tự lo phần mã hoá), nhưng **không đọc DOM kết quả** — thay vào đó **intercept network response** của chính request `checkin` đó, lấy JSON gốc.

**Ưu điểm:**
- Không cần biết/duy trì thuật toán mã hoá
- JSON response ổn định hơn nhiều so với cấu trúc HTML/DOM (Vietjet đổi giao diện không ảnh hưởng)
- Vẫn nhẹ hơn cách "scrape toàn bộ DOM" vì chỉ nghe network, không cần querySelector phức tạp

**Nhược điểm / lưu ý triển khai:**
- Cần Chromium headless → không chạy được trên Vercel serverless (giới hạn thời gian/memory). Nên chạy trên VPS/Google Cloud sẵn có của HNS, hoặc GitHub Actions on-demand (workflow_dispatch), giống mô hình đã dùng cho `hns-ticket-sync`.
- Cần theo dõi nếu Vietjet đổi selector các input field trong form (ít rủi ro hơn đổi thuật toán mã hoá, nhưng vẫn cần bảo trì).

## 3. Cấu trúc dữ liệu JSON response (đã xác nhận qua thực tế)

Từ response của `PATCH /booking/api/v1/checkin`, field cần dùng nằm trong `reservation`:

| Dữ liệu cần | Đường dẫn JSON |
|---|---|
| Mã đặt chỗ | `reservation.locator` |
| Họ tên hành khách | `reservation.passengers[].reservationProfile.lastName` + `.firstName` (đã viết hoa sẵn) |
| Danh sách chặng bay | `reservation.journeys[]` |
| Sân bay đi (tên, mã) | `journeys[i].departure.airport.name`, `.code` |
| Sân bay đến (tên, mã) | `journeys[i].arrival.airport.name`, `.code` |
| Giờ/ngày khởi hành | `journeys[i].departure.localScheduledTime` |
| Giờ/ngày đến | `journeys[i].arrival.localScheduledTime` |
| Số hiệu chuyến bay | `journeys[i].segments[0].flight.airlineCode.code` + `.flightNumber` → ghép `VJ` + `929` = `VJ929` |

Tên thành phố (`airport.name`) đã có sẵn trong JSON (vd "Ha Noi", "Jakarta") — không cần tự build bảng map mã sân bay → tên thành phố, chỉ cần map nhỏ để chuẩn hoá tiếng Việt nếu muốn ("Ha Noi" → "Hà Nội").

## 4. Code mẫu (Playwright + network interception)

```typescript
import { chromium } from 'playwright';

async function getBookingJson(code: string, lastName: string, firstName: string) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const resultPromise = new Promise<any>((resolve) => {
    page.on('response', async (res) => {
      if (res.url().includes('/booking/api/v1/checkin') && res.request().method() === 'PATCH') {
        const json = await res.json();
        if (json.status) resolve(json);
      }
    });
  });

  await page.goto('https://vietjetair.com/vi/my/search-booking');
  await page.fill('input[placeholder*="Mã đặt chỗ"]', code);
  await page.fill('input[placeholder*="Họ"]', lastName);
  await page.fill('input[placeholder*="Tên đệm"]', firstName);
  await page.click('button:has-text("Tìm kiếm")');

  const data = await resultPromise;
  await browser.close();
  return data; // data.reservation chứa toàn bộ locator, passengers, journeys...
}
```

> Lưu ý: selector input (`placeholder*="Mã đặt chỗ"` v.v.) cần tự kiểm tra lại trên trang thật — chưa xác nhận 100% chính xác, chỉ là gợi ý dựa trên label hiển thị trên UI.

## 5. Hàm format output (dự kiến bước tiếp theo)

Cần viết hàm nhận `data.reservation` (từ bước 4) + tham số `style: 'en' | 'vi-short'` để xuất ra 1 trong 2 định dạng mẫu ở mục 1. Logic chính:

1. Lấy `locator` → dòng `Code:`
2. Gom tất cả `passengers[].reservationProfile` → `lastName + firstName` → dòng `Hành khách:`
3. Loop qua `journeys[]`, với mỗi chặng lấy route/date/time/flight number, join bằng `---` (style 1) hoặc từng dòng `Chuyến bay VJxxx: từ ... đến ... ngày ... lúc ...,` (style 2)

*(Chưa viết — sẽ làm ở bước kế tiếp khi cần.)*

## 6. Kiến trúc triển khai đề xuất

- **Không dùng Vercel serverless** cho phần Playwright (cần Chromium, thời gian chạy dài hơn giới hạn free tier).
- Chạy trên **VPS/Google Cloud sẵn có của HNS**, hoặc **GitHub Actions on-demand** (`workflow_dispatch`) — giống mô hình `hns-ticket-sync`.
- Có thể build 1 form nội bộ nhỏ (Next.js): nhập mã đặt chỗ + họ + tên → gọi API nội bộ (chạy Playwright ở backend) → trả về text đã format sẵn kèm nút copy, để CSKH dán thẳng vào Zalo/Telegram.
- Tách 2 lớp riêng: **lớp lấy dữ liệu thô** (Playwright + intercept) và **lớp format** — để khi Vietjet đổi UI/API chỉ cần sửa lớp lấy dữ liệu, không đụng logic format.

## 7. Rủi ro cần theo dõi

- Vietjet có thể thêm captcha hoặc rate-limit nếu submit nhiều lần liên tục trong thời gian ngắn.
- Selector form input hoặc endpoint API có thể đổi bất kỳ lúc nào — nên có cơ chế cảnh báo/log lỗi khi response không khớp cấu trúc mong đợi.
- Không nên cố gắng tự implement lại thuật toán mã hoá của payload — rủi ro cao, lợi ích thấp so với hướng network interception.
