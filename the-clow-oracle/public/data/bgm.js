/**
 * THE CLOW — รายการเพลงบรรเลงประกอบ (BGM)
 * วางไฟล์ .mp3 ลงในโฟลเดอร์ public/assets/bgm/ (หรือเปลี่ยนเป็นลิงก์ Cloudflare R2 ในอนาคต)
 * สามารถเพิ่มเพลงใหม่ต่อท้าย Array นี้ได้เลย ระบบจะเล่นวนต่อเนื่องอัตโนมัติ
 */

export const BGM_TRACKS = [
  {
    id: 0,
    title: 'Akogare (ความปรารถนา)',
    url: './assets/bgm/akogare.mp3'
  },
  {
    id: 1,
    title: 'Setsunai Kimochi (ความรู้สึกในใจ)',
    url: './assets/bgm/setsunai-kimochi.mp3'
  },
  {
    id: 2,
    title: 'Roller Blade',
    url: './assets/bgm/roller-blade.mp3'
  }
];
