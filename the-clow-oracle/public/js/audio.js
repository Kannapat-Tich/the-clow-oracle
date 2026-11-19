/**
 * THE CLOW — ระบบเสียงเอฟเฟกต์ไพ่ (Web Audio API) และเพลงบรรเลงประกอบ (BGM)
 * ปรับปรุงจาก Apps Script เดิม:
 * 1. โหลดเพลงตรงจากไฟล์ Static / CDN ไม่ต้องแปลง Base64 ให้เปลืองแรมและติดโควต้า
 * 2. แก้ไขบั๊ก attribute `loop` บน <audio> เพื่อให้จบเพลงแล้วเล่นเพลงถัดไปอัตโนมัติได้จริง
 */

import { BGM_TRACKS } from '../data/bgm.js';

let audioCtx = null;
const isSoundOn = true;

let isBgmPlaying = false;
let currentBgmTrackIdx = 0;
let bgmFadeTimer = null;

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

function fadeInAudioVolume(player, targetVolume = 0.42) {
  if (!player) return;
  if (bgmFadeTimer) clearInterval(bgmFadeTimer);
  player.volume = 0.08;
  bgmFadeTimer = setInterval(() => {
    if (!player || player.paused) {
      clearInterval(bgmFadeTimer);
      return;
    }
    if (player.volume + 0.08 >= targetVolume) {
      player.volume = targetVolume;
      clearInterval(bgmFadeTimer);
    } else {
      player.volume = Number((player.volume + 0.08).toFixed(2));
    }
  }, 50);
}

export function updateBgmUI(statusOverride = null) {
  const statusEl = document.getElementById('bgm-status-text');
  const iconEl = document.getElementById('bgm-icon');
  const btnEl = document.getElementById('btn-bgm-toggle');
  const titleEl = document.getElementById('bgm-track-title');

  const track = BGM_TRACKS[currentBgmTrackIdx] || BGM_TRACKS[0];
  if (titleEl) {
    titleEl.textContent = statusOverride || (track ? track.title : 'ไม่มีเพลง');
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

export function startBgmPlayback() {
  const track = BGM_TRACKS[currentBgmTrackIdx] || BGM_TRACKS[0];
  const player = getBgmPlayer();
  if (!player || !track || !track.url) {
    updateBgmUI();
    return;
  }

  isBgmPlaying = true;
  updateBgmUI();

  const effectiveSrc = bgmBlobUrlCache[track.id] || track.url;
  if (player.getAttribute('data-current-src') !== effectiveSrc) {
    player.pause();
    player.src = effectiveSrc;
    player.setAttribute('data-current-src', effectiveSrc);
    player.load();
  }

  player.onerror = () => {
    isBgmPlaying = false;
    updateBgmUI('รอเพิ่มไฟล์เพลง MP3');
  };

  const playPromise = player.play();
  if (playPromise && typeof playPromise.then === 'function') {
    playPromise
      .then(() => {
        fadeInAudioVolume(player);
        if (isBgmPlaying) updateBgmUI();
      })
      .catch(() => {
        isBgmPlaying = false;
        updateBgmUI();
      });
  }
}

export function stopBgmPlayback() {
  isBgmPlaying = false;
  if (bgmFadeTimer) clearInterval(bgmFadeTimer);
  const player = getBgmPlayer();
  if (player) player.pause();
  updateBgmUI();
}

export function toggleBgm() {
  if (isBgmPlaying) stopBgmPlayback();
  else startBgmPlayback();
}

export function prevBgmTrack() {
  if (BGM_TRACKS.length === 0) return;
  currentBgmTrackIdx = (currentBgmTrackIdx - 1 + BGM_TRACKS.length) % BGM_TRACKS.length;
  if (isBgmPlaying) startBgmPlayback();
  else updateBgmUI();
}

export function nextBgmTrack() {
  if (BGM_TRACKS.length === 0) return;
  currentBgmTrackIdx = (currentBgmTrackIdx + 1) % BGM_TRACKS.length;
  if (isBgmPlaying) startBgmPlayback();
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

export function playRapidRiffleSound(cardCount = 14) {
  if (!isSoundOn) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    for (let i = 0; i < cardCount; i++) {
      const startTime = ctx.currentTime + i * 0.032;
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
