/**
 * THE CLOW — ระบบเสียงเอฟเฟกต์ไพ่ (Web Audio API) และเพลงบรรเลงประกอบ (BGM)
 * ปรับปรุงจาก Apps Script เดิม:
 * 1. โหลดเพลงตรงจากไฟล์ Static / CDN ไม่ต้องแปลง Base64 ให้เปลืองแรมและติดโควต้า
 * 2. แก้ไขบั๊ก attribute `loop` บน <audio> เพื่อให้จบเพลงแล้วเล่นเพลงถัดไปอัตโนมัติได้จริง
 */

import { BGM_TRACKS } from '../data/bgm.js';

let audioCtx = null;
const isSoundOn = true;

let isBgmPlaying = true;
let currentBgmTrackIdx = 0;
let bgmFadeTimer = null;
let pendingAutoplayUnlock = false;
let unlockListenersAttached = false;
let ytPlayer = null;
let ytReady = false;
let ytApiLoading = false;
let pendingYtVideoId = null;

// iOS Safari อนุญาตให้ปลดล็อกเสียงบน touchend / click / keydown (ไม่ใช้ pointerdown/touchstart)
const UNLOCK_EVENTS = ['touchend', 'click', 'keydown'];
let isUnlockingNow = false;

function detachAutoplayUnlockListeners() {
  if (!unlockListenersAttached) return;
  unlockListenersAttached = false;
  UNLOCK_EVENTS.forEach((evt) => {
    window.removeEventListener(evt, handleFirstUserGestureUnlock, true);
  });
}

function handleFirstUserGestureUnlock(event) {
  if (!isBgmPlaying || !pendingAutoplayUnlock) {
    detachAutoplayUnlockListeners();
    return;
  }

  // หากผู้ใช้กดปุ่มปิดเพลงเป็นคลิกแรก ไม่ต้องบังคับปลดล็อกเปิดเพลงทับ
  if (event && event.target && typeof event.target.closest === 'function') {
    if (event.target.closest('#btn-bgm-toggle')) {
      return;
    }
  }

  if (isUnlockingNow) return;
  isUnlockingNow = true;
  getAudioCtx();
  startBgmPlayback({ isAutoAttempt: false });
  setTimeout(() => {
    isUnlockingNow = false;
  }, 150);
}

function armAutoplayUnlockListeners() {
  pendingAutoplayUnlock = true;
  if (unlockListenersAttached) return;
  unlockListenersAttached = true;
  UNLOCK_EVENTS.forEach((evt) => {
    window.addEventListener(evt, handleFirstUserGestureUnlock, { capture: true, passive: true });
  });
}

function getAudioCtx() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function getBgmPlayer() {
  const player = document.getElementById('bgm-audio-element');
  if (player && !player.dataset.boundEnded) {
    player.dataset.boundEnded = '1';
    player.addEventListener('ended', () => {
      if (isBgmPlaying && BGM_TRACKS.length > 0) {
        currentBgmTrackIdx = (currentBgmTrackIdx + 1) % BGM_TRACKS.length;
        startBgmPlayback();
      }
    });
  }
  return player;
}

function fadeInAudioVolume(player, targetVolume = 0.1) {
  if (!player) return;
  if (bgmFadeTimer) clearInterval(bgmFadeTimer);
  player.volume = 0.02;
  bgmFadeTimer = setInterval(() => {
    if (!player || player.paused) {
      clearInterval(bgmFadeTimer);
      return;
    }
    if (player.volume + 0.02 >= targetVolume) {
      player.volume = targetVolume;
      clearInterval(bgmFadeTimer);
    } else {
      player.volume = Number((player.volume + 0.02).toFixed(2));
    }
  }, 50);
}

export function updateBgmUI(statusOverride = null) {
  const statusEl = document.getElementById('bgm-status-text');
  const iconEl = document.getElementById('bgm-icon');
  const btnEl = document.getElementById('btn-bgm-toggle');
  const titleBox = document.getElementById('bgm-track-title');
  const titleInner = document.getElementById('bgm-track-title-inner');

  const track = BGM_TRACKS[currentBgmTrackIdx] || BGM_TRACKS[0];
  const displayTitle = statusOverride || (track ? track.title : 'ไม่มีเพลง');
  if (titleInner && titleBox) {
    titleInner.classList.remove('bgm-marquee-active');
    titleInner.textContent = displayTitle;
    requestAnimationFrame(() => {
      const overflow = titleInner.scrollWidth - titleBox.clientWidth;
      if (overflow > 4) {
        titleInner.style.setProperty('--marquee-dist', `-${overflow + 6}px`);
        titleInner.style.setProperty('--marquee-dur', `${Math.max(5, Math.round(overflow / 18) + 3)}s`);
        titleInner.classList.add('bgm-marquee-active');
      }
    });
  } else if (titleBox) {
    titleBox.textContent = displayTitle;
  }

  if (!statusEl || !iconEl || !btnEl) return;

  if (isBgmPlaying) {
    statusEl.innerHTML = '<span class="hidden sm:inline">เพลง: </span>เปิด';
    iconEl.textContent = '♫';
    btnEl.classList.add('bg-[#F8DF94]');
    btnEl.classList.remove('bg-[#FCF4DC]');
  } else {
    statusEl.innerHTML = '<span class="hidden sm:inline">เพลง: </span>ปิด';
    iconEl.textContent = '♩';
    btnEl.classList.remove('bg-[#F8DF94]');
    btnEl.classList.add('bg-[#FCF4DC]');
  }
}

const bgmBlobUrlCache = {};
const bgmPreloading = new Set();

export function preloadAllBgmTracks() {
  if (!Array.isArray(BGM_TRACKS) || BGM_TRACKS.length === 0) return;
  BGM_TRACKS.forEach((track, idx) => {
    setTimeout(async () => {
      if (!track || !track.url || bgmBlobUrlCache[track.id] || bgmPreloading.has(track.id)) return;
      bgmPreloading.add(track.id);
      try {
        const res = await fetch(track.url);
        if (res.ok) {
          const blob = await res.blob();
          bgmBlobUrlCache[track.id] = URL.createObjectURL(blob);
        }
      } catch (_) {
      } finally {
        bgmPreloading.delete(track.id);
      }
    }, 500 + idx * 1200);
  });
}

export function initAutoBgm() {
  isBgmPlaying = false;
  updateBgmUI();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && isBgmPlaying) {
      stopBgmPlayback();
    }
  });
  window.addEventListener('pagehide', () => {
    if (isBgmPlaying) {
      stopBgmPlayback();
    }
  });
}

function pauseYouTubePlayer() {
  pendingYtVideoId = null;
  if (ytPlayer && ytReady && typeof ytPlayer.pauseVideo === 'function') {
    try {
      ytPlayer.pauseVideo();
    } catch (_) {}
  }
}

function playYouTubeTrack(videoId) {
  pendingYtVideoId = videoId;
  if (ytPlayer && ytReady && typeof ytPlayer.loadVideoById === 'function') {
    try {
      ytPlayer.setVolume(10);
      ytPlayer.loadVideoById(videoId);
      ytPlayer.playVideo();
      pendingAutoplayUnlock = false;
      detachAutoplayUnlockListeners();
    } catch (_) {}
    return;
  }

  const createPlayer = () => {
    if (ytPlayer || !window.YT || !window.YT.Player) return;
    let host = document.getElementById('bgm-yt-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'bgm-yt-host';
      host.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:-9999px;';
      document.body.appendChild(host);
    }
    ytPlayer = new window.YT.Player(host, {
      width: 1,
      height: 1,
      videoId: pendingYtVideoId || videoId,
      playerVars: { autoplay: 1, controls: 0, playsinline: 1 },
      events: {
        onReady: () => {
          ytReady = true;
          try {
            ytPlayer.setVolume(10);
            if (isBgmPlaying && pendingYtVideoId) {
              ytPlayer.loadVideoById(pendingYtVideoId);
              ytPlayer.playVideo();
            }
          } catch (_) {}
        },
        onStateChange: (evt) => {
          if (evt && evt.data === 0 && isBgmPlaying && BGM_TRACKS.length > 0) {
            currentBgmTrackIdx = (currentBgmTrackIdx + 1) % BGM_TRACKS.length;
            startBgmPlayback();
          }
        }
      }
    });
  };

  if (window.YT && window.YT.Player) {
    createPlayer();
    return;
  }

  if (!ytApiLoading) {
    ytApiLoading = true;
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevReady === 'function') prevReady();
      createPlayer();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    tag.onerror = () => {
      ytApiLoading = false;
    };
    document.head.appendChild(tag);
  }
}

export function startBgmPlayback({ isAutoAttempt = false } = {}) {
  const track = BGM_TRACKS[currentBgmTrackIdx] || BGM_TRACKS[0];
  const player = getBgmPlayer();
  if (!track || (!track.url && !track.youtubeId)) {
    updateBgmUI();
    return;
  }

  isBgmPlaying = true;
  updateBgmUI();

  if (track.youtubeId) {
    if (bgmFadeTimer) clearInterval(bgmFadeTimer);
    if (player) player.pause();
    playYouTubeTrack(track.youtubeId);
    return;
  }

  pauseYouTubePlayer();
  if (!player) return;

  const desiredTrackKey = String(track.id);
  const currentTrackKey = player.getAttribute('data-current-track-id');
  const effectiveSrc = bgmBlobUrlCache[track.id] || track.url;

  if (currentTrackKey !== desiredTrackKey || !player.getAttribute('data-current-src')) {
    player.pause();
    player.src = effectiveSrc;
    player.setAttribute('data-current-src', effectiveSrc);
    player.setAttribute('data-current-track-id', desiredTrackKey);
    player.load();
  }

  player.onerror = () => {
    pendingAutoplayUnlock = false;
    detachAutoplayUnlockListeners();
    isBgmPlaying = false;
    updateBgmUI('รอเพิ่มไฟล์เพลง MP3');
  };

  const playPromise = player.play();
  if (playPromise && typeof playPromise.then === 'function') {
    playPromise
      .then(() => {
        pendingAutoplayUnlock = false;
        detachAutoplayUnlockListeners();
        fadeInAudioVolume(player);
        if (isBgmPlaying) updateBgmUI();
      })
      .catch(() => {
        // เบราว์เซอร์ (เช่น iOS Safari / Chrome) บล็อก Autoplay ก่อนมี interaction
        // คงสถานะเปิดเพลงไว้ แล้วปลดล็อกเล่นอัตโนมัติทันทีเมื่อผู้ใช้แตะหน้าจอครั้งแรก
        if (isBgmPlaying) {
          armAutoplayUnlockListeners();
          updateBgmUI();
        } else if (!isAutoAttempt) {
          updateBgmUI();
        }
      });
  }
}

export function stopBgmPlayback() {
  isBgmPlaying = false;
  pendingAutoplayUnlock = false;
  detachAutoplayUnlockListeners();
  if (bgmFadeTimer) clearInterval(bgmFadeTimer);
  const player = getBgmPlayer();
  if (player) player.pause();
  pauseYouTubePlayer();
  updateBgmUI();
}

export function toggleBgm() {
  if (isBgmPlaying) stopBgmPlayback();
  else startBgmPlayback({ isAutoAttempt: false });
}

export function prevBgmTrack() {
  if (BGM_TRACKS.length === 0) return;
  currentBgmTrackIdx = (currentBgmTrackIdx - 1 + BGM_TRACKS.length) % BGM_TRACKS.length;
  if (isBgmPlaying) startBgmPlayback({ isAutoAttempt: false });
  else updateBgmUI();
}

export function nextBgmTrack() {
  if (BGM_TRACKS.length === 0) return;
  currentBgmTrackIdx = (currentBgmTrackIdx + 1) % BGM_TRACKS.length;
  if (isBgmPlaying) startBgmPlayback({ isAutoAttempt: false });
  else updateBgmUI();
}

export function playSoftPaperRustle() {
  if (!isSoundOn) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duration = 0.24;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * Math.sin(t * Math.PI) * Math.exp(-t * 2.4);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(1150, now);
    lowpass.frequency.exponentialRampToValueAtTime(680, now + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.045);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    noise.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  } catch (_) {}
}

export function playCardFlipSound() {
  if (!isSoundOn) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duration = 0.22;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * Math.pow(Math.sin(t * Math.PI), 1.4) * Math.exp(-t * 1.8);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(950, now);
    lowpass.frequency.exponentialRampToValueAtTime(1450, now + 0.09);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.095, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    noise.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  } catch (_) {}
}

export function playRapidRiffleSound(cardCount = 14, stepSec = 0.032) {
  if (!isSoundOn) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    for (let i = 0; i < cardCount; i++) {
      const startTime = ctx.currentTime + i * stepSec;
      const bufferSize = Math.floor(ctx.sampleRate * 0.022);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let s = 0; s < bufferSize; s++) {
        data[s] = (Math.random() * 2 - 1) * Math.exp(-s / (bufferSize * 0.28));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1750 + (i % 4) * 180;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.065, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.022);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(startTime);
    }
  } catch (_) {}
}
