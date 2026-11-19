# THE CLOW — คัมภีร์พยากรณ์ไพ่โคลว์การ์ด (Cloudflare Pages Edition)

โปรเจกต์ย้ายจาก Google Apps Script มาอยู่บน **Cloudflare Pages + Pages Functions** (ฟรี 0 บาท/เดือน รองรับผู้ใช้งานพร้อมกันจำนวนมาก ผูก Custom Domain ได้ และมีระบบ AI ตีความตามคัมภีร์)

## โครงสร้างโฟลเดอร์

```text
the-clow-oracle/
├── public/
│   ├── index.html              # หน้าเว็บหลัก
│   ├── styles/grimoire.css     # สไตล์คัมภีร์วินเทจ
│   ├── data/
│   │   ├── cards.js            # ข้อมูลไพ่โคลว์ 52 ใบ (ใช้ร่วมกันทั้ง UI และ AI)
│   │   ├── spreads.js          # ผังการวางไพ่ (เพิ่มผังใหม่ได้ที่นี่)
│   │   ├── bgm.js              # รายการเพลงประกอบ
│   │   └── assets.config.js    # ตั้งค่าพาธรูปภาพ (รองรับย้ายไป Cloudflare R2)
│   ├── js/
│   │   ├── app.js              # ระบบพิธีกรรมเปิดไพ่และการแสดงผล
│   │   ├── audio.js            # เสียงเอฟเฟกต์และตัวเล่นเพลง BGM
│   │   └── ai-oracle.js        # ตัวเชื่อม API ตีความด้วย AI
│   └── assets/
│       ├── cards/              # วางภาพไพ่ 52 ใบ (.webp เช่น light.webp, windy.webp)
│       ├── ui/                 # วาง ccs_clow_card.webp และ clow_magic_circle.webp
│       └── bgm/                # วางไฟล์เพลง .mp3 (akogare.mp3, setsunai-kimochi.mp3, roller-blade.mp3)
└── functions/
    └── api/
        └── interpret.js        # Cloudflare Pages Function เรียก Gemini ฟรี + Fallback
```

## วิธีนำขึ้นออนไลน์ฟรี (Cloudflare Pages)

1. อัปโหลดโค้ดขึ้น **GitHub Repository**
2. ไปที่ **Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git**
3. เลือก Repository แล้วตั้งค่า:
   - **Build command:** เว้นว่างไว้ (ไม่ต้อง Build)
   - **Build output directory:** `public`
4. ตั้งค่า **Environment Variables (Secret)** เพื่อให้ AI ทำงาน:
   - `GEMINI_API_KEY` = คีย์ฟรีจาก [Google AI Studio](https://aistudio.google.com/apikey) (ไม่ต้องผูกบัตรเครดิต)
   - *(ไม่บังคับ)* `GROQ_API_KEY` = คีย์สำรองฟรีจาก [Groq Console](https://console.groq.com/) กรณีโควต้า Gemini เต็ม
5. ผูก **Custom Domain** ได้ทันทีในแท็บ **Custom domains** (ได้ HTTPS ฟรี)
