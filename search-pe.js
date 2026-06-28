<script>
/* ===== Petronas Gallery Search — logic (thêm 25/6) | khớp Figma "Search" ===== */
(function(){
  "use strict";
  var CONFIG = { 
    endpoint: 'https://webflow-search-proxy.yasuaola.workers.dev',
    types: ['Artworks','Articles','Videos','Archive','News'],
    debounce: 180
  }; 
  var SAMPLE = [
    {title:'01 Prologue', type:'Archive', url:'/prologue', meta:'Exhibition', img:'https://cdn.prod.website-files.com/69f3481baacb3839088dc670/6a1c41977682ee1bfc064026_i1.png'},
    {title:'02 Spirit & Form', type:'Archive', url:'/spirit-form', meta:'Exhibition', img:'https://cdn.prod.website-files.com/69f3481baacb3839088dc670/6a1c419850966f1b31d7f65f_i2.png'},
    {title:'03 Nature & Nationhood', type:'Archive', url:'/nature-nationhood', meta:'Exhibition', img:'https://cdn.prod.website-files.com/69f3481baacb3839088dc670/6a1c4198e8d9bae930c32ed5_i3.png'},
    {title:'04 Iconic Installation', type:'Archive', url:'/interval-art-installation', meta:'Exhibition', img:'https://cdn.prod.website-files.com/69f3481baacb3839088dc670/6a1c4198b187ffdba13fcb79_i4.png'},
    {title:'Ahmad Zakii Anwar', type:'Artworks', url:'#', meta:'Artist'},
    {title:'Anniketyni Madian', type:'Artworks', url:'#', meta:'Artist'},
    {title:'Ahmad Fuad Osman', type:'Artworks', url:'#', meta:'Artist'},
    {title:'Abdullah Ariff', type:'Artworks', url:'#', meta:'Artist'},
    {title:'Capturing Malaysia Through The Years', type:'Articles', url:'#', meta:'Article'},
    {title:'Brand Resources', type:'Articles', url:'/media-centre-resources', meta:'Article'},
    {title:'Press Release', type:'News', url:'/media-centre-press-release', meta:'News'},
    {title:'Media Centre News', type:'News', url:'/media-centre-news', meta:'News'}
  ];

  var bar, input, filterTrigger, filterText, menu, panel, countEl, listEl, tagsEl, moreEl;
  var selected = [], dataCache = null, dataCacheTime = 0, debTimer = null;
  var lastItems = [], lastQ = '', expanded = false;
  var activeTrigger = null;
  var pageEl, pInput, pList, pTags, pCount, pBarTrigger;

  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }

  function renderMenu(types){
    if(!menu) return;
    menu.innerHTML = types.map(function(t){
      var on = selected.indexOf(t)!==-1;
      return '<label class="pgs-opt'+(on?' is-on':'')+'"><input type="checkbox" value="'+esc(t)+'"'+(on?' checked':'')+'>'+
        '<span class="pgs-box"><svg viewBox="0 0 24 24" fill="none" stroke="#1b1f23" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></span>'+esc(t)+'</label>';
    }).join('');
  }
  // Filter category tự sinh theo collection thật trong CMS (auto-update khi CMS có loại mới)
  function applyCategories(types){
    types = Array.from(new Set(((types)||[]).filter(Boolean)));
    if(!types.length) return;
    selected = selected.filter(function(s){ return types.indexOf(s)!==-1; });
    renderMenu(types); updateFilterLabel(); renderTags();
  }

  function buildOverlay(){
    menu = document.createElement('div'); menu.className='pgs-menu';
    renderMenu(CONFIG.endpoint ? [] : CONFIG.types);  

    panel = document.createElement('div'); panel.className='pgs-panel';
    panel.innerHTML = '<div class="pgs-tags"></div><div class="pgs-list"></div>'+
      '<div class="pgs-footer"><span class="pgs-count"></span>'+
      '<button type="button" class="pgs-more">Show me more results '+
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="12" x2="20" y2="12"/><polyline points="13 5 20 12 13 19"/></svg></button></div>';
    
    var container = document.querySelector('.search-bar .pgs-bar-outer');
    if(container){
      container.appendChild(menu);
      container.appendChild(panel);
    } else {
      document.body.appendChild(menu);
      document.body.appendChild(panel);
    }
    tagsEl = panel.querySelector('.pgs-tags');
    countEl = panel.querySelector('.pgs-count');
    listEl  = panel.querySelector('.pgs-list');
    moreEl = panel.querySelector('.pgs-more');
    moreEl.addEventListener('click', function(){ gotoResults(lastQ); });

    menu.addEventListener('change', function(e){
      var cb = e.target.closest && e.target.closest('input[type=checkbox]'); if(!cb) return;
      cb.closest('.pgs-opt').classList.toggle('is-on', cb.checked);
      selected = Array.prototype.map.call(menu.querySelectorAll('input:checked'), function(x){return x.value;});
      updateFilterLabel(); renderTags(); refresh();
    });
    tagsEl.addEventListener('click', onTagClick);
  }

  function updateFilterLabel(){
    if(filterTrigger) filterTrigger.classList.toggle('has-sel', selected.length>0);
    if(!filterText) return;
    filterText.textContent = selected.length ? (selected.length===1 ? selected[0] : selected.length+' filters') : 'All';
  }
  function renderTags(){
    var html = selected.map(function(t){
      return '<span class="pgs-tag">'+esc(t)+'<button type="button" data-t="'+esc(t)+'" aria-label="Remove">'+
        '<svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.6"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg></button></span>';
    }).join('');
    if(tagsEl) tagsEl.innerHTML = html;
    if(pTags) pTags.innerHTML = html;
  }
  function onTagClick(e){
    var b = e.target.closest && e.target.closest('button[data-t]'); if(!b) return;
    var t = b.getAttribute('data-t');
    selected = selected.filter(function(x){return x!==t;});
    var boxes = menu.querySelectorAll('input[type=checkbox]');
    Array.prototype.forEach.call(boxes, function(cb){ if(cb.value===t){ cb.checked=false; cb.closest('.pgs-opt').classList.remove('is-on'); }});
    updateFilterLabel(); renderTags(); run();
  }

  function loadData(){
    if(dataCache && (Date.now()-dataCacheTime < 60000)) return Promise.resolve(dataCache);   // TTL 60s → tự làm mới theo CMS
    if(!CONFIG.endpoint){ dataCache = SAMPLE.slice(); dataCacheTime = Date.now(); return Promise.resolve(dataCache); }
    return fetch(CONFIG.endpoint, {headers:{'Accept':'application/json'}})
      .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(function(j){ dataCache = (j.items || j || []); dataCacheTime = Date.now(); applyCategories((j && j.types) || dataCache.map(function(x){return x.type;})); return dataCache; })
      .catch(function(err){ console.warn('[pgs] CMS fetch lỗi, tạm dùng data mẫu (sẽ thử lại Worker):', err); return SAMPLE.slice(); });  // KHÔNG cache khi lỗi
  }

  function match(items, q){
    q = (q||'').trim().toLowerCase();
    return items.filter(function(it){
      if(selected.length && selected.indexOf(it.type)===-1) return false;
      if(!q) return true;
      return (String(it.title||'')+' '+String(it.author||'')+' '+String(it.meta||'')+' '+String(it.excerpt||'')+' '+String(it.type||'')).toLowerCase().indexOf(q)!==-1;
    });
  }
  function fmtDate(d){ if(!d) return ''; var t=new Date(d); return isNaN(t)?'':t.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}); }
  function metaHTML(it){
    var parts=[];
    if(it.author) parts.push(esc(it.author));
    var dt=fmtDate(it.date); if(dt) parts.push(esc(dt));
    if(parts.length) return parts.join('<span class="pgs-meta-sep"></span>');
    var fb = it.excerpt || it.type || ''; return fb ? esc(fb) : '';
  }
  function render(items, q){
    lastItems = items; lastQ = q;
    countEl.textContent = items.length + (items.length===1?' result':' results');
    var footer = panel.querySelector('.pgs-footer'); if(footer) footer.style.display = items.length?'flex':'none';
    if(!items.length){ listEl.innerHTML = '<div class="pgs-empty">No results'+(q?' for "'+esc(q)+'"':'')+'</div>'; return; }
    var lim = expanded ? 9999 : 4;
    if(moreEl) moreEl.style.display = (items.length>4 && !expanded) ? 'inline-flex' : 'none';
    listEl.innerHTML = items.slice(0,lim).map(function(it){
      var src = it.image || it.img;
      var img = src ? '<img class="pgs-thumb" src="'+esc(src)+'" alt="" loading="lazy"/>' : '<div class="pgs-thumb"></div>';
      return '<a class="pgs-row" href="'+esc(it.url||'#')+'">'+img+
        '<div class="pgs-row-body"><div class="pgs-row-title">'+esc(it.title)+'</div>'+
        '<div class="pgs-row-meta">'+metaHTML(it)+'</div></div></a>';
    }).join('');
  }

  function place(){
    // No-op: Cả pgs-menu và pgs-panel đều là các phần tử inline trong luồng trang
  }
  function openPanel(){ panel.classList.add('is-open'); place(); }
  function closePanel(){ panel.classList.remove('is-open'); }
  function closeMenu(){ menu.classList.remove('is-open'); if(filterTrigger) filterTrigger.setAttribute('aria-expanded','false'); if(pBarTrigger) pBarTrigger.setAttribute('aria-expanded','false'); }
  function refresh(){ if(pageEl && pageEl.classList.contains('is-open')) renderPage(pInput.value); else run(); }

  // ---- Trang Search Results (Figma "More search Results") ----
  function buildResultsPage(){
    pageEl = document.createElement('div'); pageEl.id='pgs-page';
    pageEl.innerHTML =
      '<div class="pgs-hero"><div class="pgs-hero-deco"></div><h1>Search Results</h1>'+
      '<button type="button" class="pgs-page-close" aria-label="Close">✕</button></div>'+
      '<div class="pgs-page-inner">'+
        '<form class="pgs-bar pgs-page-bar" role="search" autocomplete="off" onsubmit="return false;">'+
          '<input class="pgs-input pgs-page-input" type="search" maxlength="256" placeholder="Search artworks, artists, or exhibitions"/>'+
          '<div class="pgs-filter"><button type="button" class="pgs-filter-trigger pgs-page-filter" aria-haspopup="true" aria-expanded="false">'+
            '<span class="pgs-allbox"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></span>'+
            '<svg class="pgs-funnel" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>'+
            '<span class="pgs-filter-text">All</span>'+
            '<svg class="pgs-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></button></div>'+
          '<button type="submit" class="pgs-submit"><span class="pgs-submit-text">Search</span>'+
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg></button>'+
        '</form>'+
        '<div class="pgs-ptags"></div><div class="pgs-pcount"></div><div class="pgs-plist"></div>'+
      '</div><div class="pgs-page-footer"></div>';
    document.body.appendChild(pageEl);
    var rf = document.querySelector('.footer'); if(rf) pageEl.querySelector('.pgs-page-footer').appendChild(rf.cloneNode(true));
    pInput = pageEl.querySelector('.pgs-page-input');
    pList  = pageEl.querySelector('.pgs-plist');
    pTags  = pageEl.querySelector('.pgs-ptags');
    pCount = pageEl.querySelector('.pgs-pcount');
    pBarTrigger = pageEl.querySelector('.pgs-page-filter');

    pageEl.querySelector('.pgs-page-close').addEventListener('click', closePage);
    pInput.addEventListener('input', function(){ clearTimeout(debTimer); debTimer=setTimeout(function(){ renderPage(pInput.value); }, CONFIG.debounce); });
    pageEl.querySelector('.pgs-page-bar').addEventListener('submit', function(e){ e.preventDefault(); renderPage(pInput.value); });
    pBarTrigger.addEventListener('click', function(e){ e.preventDefault(); activeTrigger=pBarTrigger; var open=menu.classList.toggle('is-open'); pBarTrigger.setAttribute('aria-expanded',open?'true':'false'); if(open) place(); });
    pList.addEventListener('click', function(e){
      var btn = e.target.closest && e.target.closest('.pgs-prow-exp');
      if(btn){ e.preventDefault(); onPRowClick(btn.closest('.pgs-prow')); }
    });
    pTags.addEventListener('click', onTagClick);
  }
  function openPage(q){
    if(!pageEl) buildResultsPage();
    closeMenu(); closePanel();
    pageEl.classList.add('is-open'); document.body.style.overflow='hidden';
    pInput.value = q||'';
    loadData().then(function(){ updateFilterLabel(); renderTags(); renderPage(pInput.value); });
  }
  function closePage(){ if(pageEl){ pageEl.classList.remove('is-open'); document.body.style.overflow=''; } closeMenu(); }
  function gotoResults(q){
    var u = 'search-reults.html?q=' + encodeURIComponent(q||'');
    if(selected.length) u += '&type=' + encodeURIComponent(selected.join(','));
    window.location.href = u;
  }
  function prowHTML(it, idx){
    var src=it.image||it.img;
    var thumb = src ? '<img class="pgs-prow-thumb" src="'+esc(src)+'" alt="" loading="lazy"/>' : '<div class="pgs-prow-thumb"></div>';
    var dt = fmtDate(it.date);
    return '<div class="pgs-prow" data-idx="'+idx+'">'+
      '<a class="pgs-prow-link" href="'+esc(it.url||'#')+'"><div class="pgs-prow-title">'+esc(it.title)+'</div>'+thumb+
      '<div class="pgs-prow-date">'+esc(dt||it.type||'')+'</div></a>'+
      '<button type="button" class="pgs-prow-exp" aria-label="Xem nhanh"><svg class="pgs-prow-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 6 15 12 9 18"/></svg></button></div>';
  }
  function cardHTML(it){
    var src=it.image||it.img;
    var media = src ? '<div class="pgs-card-media"><img src="'+esc(src)+'" alt=""/></div>' : '<div class="pgs-card-media"></div>';
    var desc = it.excerpt ? '<p>'+esc(it.excerpt)+'</p>' : '';
    var dt = fmtDate(it.date); var dateRow = dt ? '<div class="pgs-card-date">'+esc(dt)+'</div>' : '';
    var typeRow = it.type ? '<div class="pgs-card-meta"><div>Type: '+esc(it.type)+'</div></div>' : '';
    var link = (it.url && it.url!=='#') ? '<div class="pgs-card-meta"><a href="'+esc(it.url)+'" style="color:#fff;text-decoration:underline">View detail →</a></div>' : '';
    return '<div class="pgs-card"><div>'+media+'</div><div><h2>'+esc(it.title)+'</h2>'+desc+dateRow+typeRow+link+'</div></div>';
  }
  function renderPage(q){
    if(!pList) return;
    var items = match(dataCache||[], q);
    pCount.textContent = items.length + (items.length===1?' result':' results');
    pList.innerHTML = items.length ? items.map(prowHTML).join('') : '<div class="pgs-empty">No results'+(q?' for "'+esc(q)+'"':'')+'</div>';
  }
  function onPRowClick(row){
    if(!row) return;
    var idx = +row.getAttribute('data-idx');
    var items = match(dataCache||[], pInput.value); var it = items[idx]; if(!it) return;
    var wasOpen = row.classList.contains('is-open');
    var card = pList.querySelector('.pgs-card'); if(card) card.remove();
    Array.prototype.forEach.call(pList.querySelectorAll('.pgs-prow.is-open'), function(r){ r.classList.remove('is-open'); });
    if(!wasOpen){ row.classList.add('is-open'); row.insertAdjacentHTML('afterend', cardHTML(it)); }
  }

  function run(){
    var q = input ? input.value : '';
    expanded = false;
    loadData().then(function(items){ render(match(items,q), q); openPanel(); });
  }
  function debouncedRun(){ clearTimeout(debTimer); debTimer=setTimeout(run, CONFIG.debounce); }

  ready(function(){
    bar = document.querySelector('.pgs-bar'); if(!bar) return;
    input = bar.querySelector('.pgs-input');
    filterTrigger = bar.querySelector('.pgs-filter-trigger');
    filterText = bar.querySelector('.pgs-filter-text');
    buildOverlay();
    loadData();   

    input.addEventListener('input', debouncedRun);
    input.addEventListener('focus', function(){ if(input.value.trim()||selected.length) run(); });
    bar.addEventListener('submit', function(e){ e.preventDefault(); gotoResults(input.value); });

    filterTrigger.addEventListener('click', function(e){
      e.preventDefault();
      activeTrigger = filterTrigger;
      var open = menu.classList.toggle('is-open');
      filterTrigger.setAttribute('aria-expanded', open?'true':'false');
      if(open) place();
    });

    document.addEventListener('click', function(e){
      var isInsideHeader = e.target.closest && (e.target.closest('.header') || e.target.closest('.navbar'));
      var isInsideSearchBar = e.target.closest && e.target.closest('.search-bar');
      var isInsideMenu = menu && menu.contains(e.target);
      if (isInsideHeader || isInsideSearchBar || isInsideMenu) {
        return;  
      }
      closeMenu(); closePanel();
      var barEl = document.querySelector('.search-bar');
      if (barEl && barEl.classList.contains('open-search-bar')) {
        barEl.style.height = '0px';
        barEl.classList.remove('open-search-bar');
      }
    });

    window.addEventListener('resize', function(){ if(panel.classList.contains('is-open')||menu.classList.contains('is-open')) place(); });

    var icon = document.querySelector('.search-icon');
    if(icon) icon.addEventListener('click', function(){
      setTimeout(function(){
        var open = bar.closest('.search-bar') && bar.closest('.search-bar').classList.contains('open-search-bar');
        if(open){ setTimeout(function(){ if(input) input.focus(); }, 380); }
        else { closeMenu(); closePanel(); }
      }, 30);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.close-search'), function(b){
      b.addEventListener('click', function(){ closeMenu(); closePanel(); });
    });
    document.addEventListener('keydown', function(e){ if(e.key==='Escape'){ closeMenu(); closePanel(); closePage(); } });
  });
})();
</script>