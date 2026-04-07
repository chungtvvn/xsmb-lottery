# 🎯 XSMB Analytics - Thống kê Xổ Số Miền Bắc

Hệ thống thống kê và dự đoán kết quả xổ số miền Bắc (XSMB) với phân tích xác suất nâng cao.

## ✨ Tính năng

### 📊 Tab Thống kê
- Hiển thị kết quả gần nhất đầy đủ các giải
- Phân tích tần suất 100 số (00-99) theo nhiều khoảng thời gian (30/90/180/365 ngày / tất cả)
- **Bảng nhiệt (Heatmap)**: Trực quan hóa tần suất 100 số
- **Cặp số**: Top 50 cặp số xuất hiện cùng nhau nhiều nhất
- **Lịch sử gần**: 30 kết quả gần nhất dạng bảng
- **Nâng cao**: 
  - Chuỗi vắng mặt hiện tại
  - Xác suất xuất hiện kỳ tiếp (mô hình xác suất điều chỉnh)
  - Phân tích theo ngày trong tuần
  - Thống kê theo nhóm (thập phân)

### 🔮 Tab Dự đoán & Lịch sử (Yêu cầu đăng nhập)
- **Đăng nhập**: `tkxslt` / `tkxslt`
- Dự đoán Top 18 số cho kỳ kế tiếp với 3 mức độ tự tin
- Bảng điểm đầy đủ với lý do dự đoán
- Lưu dự đoán hàng ngày vào file JSON
- Lịch sử dự đoán với so sánh kết quả thực (trúng/trượt)
- Thống kê độ chính xác tổng hợp

## 🔧 Thuật toán dự đoán

Kết hợp nhiều yếu tố:
1. **Tần suất 30 ngày gần nhất** (trọng số 30%)
2. **Tần suất 90 ngày gần nhất** (trọng số 20%)
3. **Chuỗi vắng mặt** (so với trung bình lịch sử - trọng số cao khi >80% avg)
4. **Hôm qua có xuất hiện** (+10 điểm)
5. **Tần suất giải đặc biệt** (×0.5/lần/năm)
6. **Mẫu ngày trong tuần** (+5 nếu tỷ lệ xuất hiện >40% cùng thứ)

## 🚀 Chạy locally

```bash
npm install
npm run dev
```

Mở http://localhost:3000

## ☁️ Deploy lên Vercel

1. Push code lên GitHub
2. Import repo vào [vercel.com](https://vercel.com)
3. Deploy tự động

> **Lưu ý**: Trên Vercel, file `predictions.json` sẽ bị reset mỗi lần deploy (do serverless stateless). Để lưu trữ lâu dài trên Vercel, cần dùng Vercel KV hoặc database external.

## 🔄 Cập nhật tự động

GitHub Actions chạy lúc **18:45 giờ Việt Nam** mỗi ngày để:
- Fetch dữ liệu mới nhất từ [khiemdoan/vietnam-lottery-xsmb-analysis](https://github.com/khiemdoan/vietnam-lottery-xsmb-analysis)
- Cache vào `data/xsmb-2-digits-cache.json`
- Trigger redeploy Vercel (nếu cấu hình `VERCEL_DEPLOY_HOOK` secret)

## 📁 Cấu trúc dự án

```
src/
├── app/
│   ├── api/
│   │   ├── lottery-data/route.ts  # Proxy dữ liệu từ GitHub
│   │   └── predictions/route.ts   # CRUD dự đoán (auth required)
│   ├── globals.css                # Design system
│   └── page.tsx                   # Trang chính
├── components/
│   ├── StatisticsTab.tsx          # Tab thống kê
│   └── PredictionTab.tsx          # Tab dự đoán & lịch sử
├── lib/
│   ├── lottery-analyzer.ts        # Engine phân tích & dự đoán
│   └── storage.ts                 # File I/O cho predictions
└── types/
    └── lottery.ts                 # TypeScript types

data/
└── predictions.json               # Lưu lịch sử dự đoán

.github/workflows/
└── update-lottery.yml             # Tự động cập nhật dữ liệu
```

## 🔐 Bảo mật

- Endpoint `/api/predictions` yêu cầu xác thực HTTP Basic Auth
- Credentials mã hóa Base64 trong header `x-auth-token`
- Mặc định: `tkxslt:tkxslt` (nên đổi khi production)
