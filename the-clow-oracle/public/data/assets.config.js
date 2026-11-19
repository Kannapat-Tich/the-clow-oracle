/**
 * THE CLOW — ตั้งค่าแหล่งเก็บรูปภาพไพ่และกราฟิก (Static CDN / Cloudflare R2)
 *
 * ค่าเริ่มต้นจะอ่านจากโฟลเดอร์ ./assets/ ในโปรเจกต์โดยตรง (โหลดผ่าน Cloudflare CDN ฟรี)
 * หากในอนาคตย้ายไฟล์รูปไปไว้บน Cloudflare R2 สามารถเปลี่ยน assetBaseUrl เป็นโดเมน R2 ได้ที่จุดเดียว
 * หากยังไม่ได้ใส่ไฟล์รูปบางใบ เว็บจะสลับไปแสดงภาพเวกเตอร์ (SVG) สำรองให้อัตโนมัติโดยไม่พัง
 */

export const ASSETS_CONFIG = {
  // เปลี่ยนเป็น URL ของ R2 ได้ในอนาคต เช่น 'https://assets.yourdomain.com'
  assetBaseUrl: './assets',
  cardImageExt: 'webp',
  cardBackFile: 'ui/ccs_clow_card.webp',
  magicCircleFile: 'ui/clow_magic_circle.webp',

  /**
   * รูปแบบชื่อไฟล์รูปไพ่ในโฟลเดอร์ assets/cards/
   * ค่าเริ่มต้นคือ <driveKey>.webp เช่น light.webp, windy.webp, shield.webp
   * (หากไฟล์เดิมตั้งชื่อว่า clow_light.webp สามารถเติม prefix: 'clow_' ได้ที่นี่)
   */
  cardFilePrefix: ''
};

export function getCardBackUrl() {
  return `${ASSETS_CONFIG.assetBaseUrl}/${ASSETS_CONFIG.cardBackFile}`;
}

export function getMagicCircleUrl() {
  return `${ASSETS_CONFIG.assetBaseUrl}/${ASSETS_CONFIG.magicCircleFile}`;
}

export function getCardFrontUrl(driveKey) {
  if (!driveKey) return null;
  return `${ASSETS_CONFIG.assetBaseUrl}/cards/${ASSETS_CONFIG.cardFilePrefix}${driveKey}.${ASSETS_CONFIG.cardImageExt}`;
}
