'use strict';
const $ = id => document.getElementById(id);
let book, pageNumber = 0, mode = 'single', touchStart = null;
const pad = n => String(n).padStart(2, '0');
function announce(text) { $('status').textContent = text; }
function go(page, nextMode = mode) {
  const nextHash = page ? `#page=${Math.max(1, Math.min(book.pages.length, page))}&mode=${nextMode}` : '';
  if (location.hash === nextHash) render(); else location.hash = nextHash;
}
function pageAsset(p) { return p.asset; }
function imageNode(p, priority = false) {
  const frame = document.createElement('div'); frame.className = 'page-frame';
  const img = document.createElement('img'); img.className = 'page-image'; img.alt = p.alt;
  img.width = p.width || 1024; img.height = p.height || 1536;
  img.loading = priority ? 'eager' : 'lazy'; img.decoding = 'async';
  if (priority) img.fetchPriority = 'high';
  const state = document.createElement('div'); state.className = 'image-state';
  const message = document.createElement('span'); message.textContent = '漫畫載入中…'; state.append(message);
  const retry = document.createElement('button'); retry.textContent = '重新載入本頁'; retry.hidden = true;
  state.append(retry);
  img.onload = () => { state.hidden = true; };
  img.onerror = () => { state.hidden = false; message.textContent = '這一頁暫時無法載入，文字版仍可閱讀。'; retry.hidden = false; };
  retry.onclick = () => { message.textContent = '漫畫載入中…'; retry.hidden = true; img.src = pageAsset(p) + '?retry=' + Date.now(); };
  img.src = pageAsset(p); frame.append(img, state); return frame;
}
function article(p, priority) {
  const node = document.createElement('article'); node.className = 'page'; node.id = `page-${p.number}`;
  node.setAttribute('aria-label', `第 ${p.number} 頁：${p.title}`);
  node.append(imageNode(p, priority));
  const caption = document.createElement('div'); caption.className = 'page-caption';
  const title = document.createElement('span'); title.textContent = p.title;
  const counter = document.createElement('span'); counter.textContent = `${pad(p.number)} / ${pad(book.pages.length)}`;
  caption.append(title, counter); node.append(caption);
  const details = document.createElement('details'); details.className = 'text-version';
  const summary = document.createElement('summary'); summary.textContent = `第 ${p.number} 頁文字版`;
  const text = document.createElement('div'); text.className = 'transcript';
  const dialogue = Array.isArray(p.transcript) ? p.transcript.join('\n\n') : p.transcript;
  text.textContent = p.summary + (dialogue ? '\n\n' + dialogue : '');
  details.append(summary, text); node.append(details); return node;
}
function render() {
  const params = new URLSearchParams(location.hash.slice(1));
  const raw = Number(params.get('page'));
  pageNumber = Number.isInteger(raw) && raw > 0 ? Math.min(raw, book.pages.length) : 0;
  mode = params.get('mode') === 'strip' ? 'strip' : 'single';
  $('cover').hidden = !!pageNumber; $('reader').hidden = !pageNumber;
  $('pages').replaceChildren();
  $('single-mode').setAttribute('aria-pressed', mode === 'single'); $('strip-mode').setAttribute('aria-pressed', mode === 'strip');
  $('ending').hidden = !(pageNumber && (pageNumber === book.pages.length || mode === 'strip'));
  $('page-nav').hidden = mode === 'strip';
  document.title = pageNumber ? `${book.title}｜第 ${pageNumber} 頁` : `${book.title}｜原創熱血短篇漫畫`;
  if (pageNumber) {
    $('position').textContent = mode === 'strip' ? `全 ${book.pages.length} 頁` : `${pad(pageNumber)} / ${pad(book.pages.length)}`;
    const visible = mode === 'strip' ? book.pages : [book.pages[pageNumber - 1]];
    visible.forEach(p => $('pages').append(article(p, p.number === pageNumber)));
    $('previous').disabled = pageNumber === 1; $('next').disabled = pageNumber === book.pages.length;
    announce(mode === 'strip' ? `長條閱讀，全 ${book.pages.length} 頁` : `第 ${pageNumber} 頁：${book.pages[pageNumber - 1].title}`);
    if (mode === 'single') [pageNumber - 2, pageNumber].forEach(i => { if (book.pages[i]) { const img = new Image(); img.src = pageAsset(book.pages[i]); } });
  }
  document.querySelectorAll('.thumbnail').forEach((b, i) => { if (i + 1 === pageNumber) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (mode === 'strip' && pageNumber > 1) requestAnimationFrame(() => $(`page-${pageNumber}`).scrollIntoView({block:'start',behavior:'instant'}));
}
function openDrawer() { $('drawer').showModal(); }
async function init() {
  try {
    const response = await fetch('manifest.json'); if (!response.ok) throw new Error('Manifest unavailable');
    book = await response.json();
    if (!Array.isArray(book.pages) || book.pages.length !== 10 || book.pages.some(p => !p.asset || !p.alt)) throw new Error('Incomplete manga');
    $('brand-title').textContent = book.title; $('book-title').textContent = book.title;
    $('subtitle').textContent = book.subtitle; $('description').textContent = book.description;
    document.querySelector('meta[name=description]').content = book.description;
    $('cover-image').onerror = () => { $('cover-error').hidden = false; };
    $('cover-image').onload = () => { $('cover-error').hidden = true; };
    $('retry-cover').onclick = () => { $('cover-error').hidden = true; $('cover-image').src = (book.cover || book.pages[0].asset) + '?retry=' + Date.now(); };
    $('cover-image').src = book.cover || book.pages[0].asset;
    $('cover-image').alt = `${book.title}，第 1 頁封面預覽`;
    book.pages.forEach(p => {
      const b = document.createElement('button'); b.className = 'thumbnail'; b.setAttribute('aria-label', `閱讀第 ${p.number} 頁：${p.title}`);
      const img = document.createElement('img'); img.src = p.thumbnail || p.asset; img.alt = ''; img.loading = 'lazy'; img.width = 160; img.height = 240;
      const label = document.createElement('span'); label.textContent = `${pad(p.number)}　${p.title}`;
      b.append(img,label); b.onclick = () => { $('drawer').close(); go(p.number); }; $('thumbnails').append(b);
    });
    $('start').onclick = () => go(1); $('restart').onclick = () => go(1, 'single');
    $('next').onclick = () => go(pageNumber + 1); $('previous').onclick = () => go(pageNumber - 1);
    $('single-mode').onclick = () => go(pageNumber || 1, 'single'); $('strip-mode').onclick = () => go(pageNumber || 1, 'strip');
    $('contents').onclick = openDrawer; $('all-pages').onclick = openDrawer; $('close-drawer').onclick = () => $('drawer').close();
    $('drawer').addEventListener('click', e => { if(e.target === $('drawer')) { const r = $('drawer').getBoundingClientRect(); if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) $('drawer').close(); } });
    if (!document.fullscreenEnabled) $('fullscreen').hidden = true;
    $('fullscreen').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { announce('此瀏覽器目前無法進入全螢幕。'); } };
    document.addEventListener('fullscreenchange', () => { $('fullscreen').textContent = document.fullscreenElement ? '離開全螢幕' : '全螢幕'; });
    window.addEventListener('hashchange', render);
    document.addEventListener('keydown', e => {
      if (!pageNumber || mode !== 'single' || $('drawer').open || e.altKey || e.ctrlKey || e.metaKey || ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowLeft' && pageNumber < book.pages.length) { e.preventDefault(); go(pageNumber + 1); }
      if (e.key === 'ArrowRight' && pageNumber > 1) { e.preventDefault(); go(pageNumber - 1); }
    });
    $('pages').addEventListener('touchstart', e => { touchStart = e.touches.length === 1 && !e.target.closest('details,button') ? {x:e.touches[0].clientX,y:e.touches[0].clientY} : null; }, {passive:true});
    $('pages').addEventListener('touchmove', e => { if(e.touches.length !== 1) touchStart = null; }, {passive:true});
    $('pages').addEventListener('touchend', e => {
      if (!touchStart || mode !== 'single' || (window.visualViewport && window.visualViewport.scale > 1.05)) { touchStart = null; return; }
      const dx = e.changedTouches[0].clientX-touchStart.x, dy=e.changedTouches[0].clientY-touchStart.y; touchStart=null;
      if (Math.abs(dx) > 80 && Math.abs(dx)>Math.abs(dy)*1.6) { if(dx>0&&pageNumber<book.pages.length) go(pageNumber+1); if(dx<0&&pageNumber>1)go(pageNumber-1); }
    }, {passive:true});
    render();
  } catch(error) { $('cover').hidden=true; $('reader').hidden=true; $('global-error').hidden=false; $('contents').disabled=true; console.error(error); }
}
$('reload').onclick = () => location.reload();
init();
