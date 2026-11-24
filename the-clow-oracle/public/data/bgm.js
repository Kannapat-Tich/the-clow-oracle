/**
 * THE CLOW — รายการเพลงบรรเลงประกอบ (BGM)
 * วางไฟล์ .mp3 ลงในโฟลเดอร์ public/assets/bgm/ (หรือเปลี่ยนเป็นลิงก์ Cloudflare R2 ในอนาคต)
 * สามารถเพิ่มเพลงใหม่ต่อท้าย Array นี้ได้เลย ระบบจะเล่นวนต่อเนื่องอัตโนมัติ
 */

export const BGM_TRACKS = [
  {
    id: 0,
    title: 'Akogare (ความปรารถนา)',
    titleEn: 'Akogare',
    url: './assets/bgm/akogare.mp3'
  },
  {
    id: 1,
    title: 'Setsunai Kimochi (ความรู้สึกในใจ)',
    titleEn: 'Setsunai Kimochi',
    url: './assets/bgm/setsunai-kimochi.mp3'
  },
  {
    id: 2,
    title: 'Roller Blade',
    titleEn: 'Roller Blade',
    url: './assets/bgm/roller-blade.mp3'
  },
  {
    id: 3,
    title: 'Shiawase no Sakura Namiki (ถนนซากุระแห่งความสุข)',
    titleEn: 'Shiawase no Sakura Namiki',
    youtubeId: 'UmtQzuP2wkI'
  },
  {
    id: 4,
    title: 'Yume (ความฝัน)',
    titleEn: 'Yume',
    youtubeId: 't46wJRYJJ_M'
  },
  {
    id: 5,
    title: 'Sawayakana Asa (ยามเช้าอันสดใส)',
    titleEn: 'Sawayakana Asa',
    youtubeId: 'PUKGrE8Og0g'
  }
];
