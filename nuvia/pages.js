/* Nuvia — shared behaviour for inner pages */
(function(){
  var d=document; d.documentElement.classList.remove('no-js');
  function $(s,r){return (r||d).querySelector(s)} function $$(s,r){return Array.prototype.slice.call((r||d).querySelectorAll(s))}
  var store={get:function(k){try{return JSON.parse(sessionStorage.getItem(k))}catch(e){return null}},set:function(k,v){try{sessionStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
  window.NuviaStore=store;

  /* header glass on scroll */
  var hdr=$('.hdr');
  function onScroll(){ if(hdr) hdr.classList.toggle('is-scrolled',window.scrollY>40) }
  window.addEventListener('scroll',onScroll,{passive:true}); onScroll();

  /* mobile menu */
  var burger=$('.burger'),menu=$('.mmenu');
  if(burger&&menu){
    burger.addEventListener('click',function(){var o=menu.classList.toggle('open');burger.setAttribute('aria-expanded',o);burger.innerHTML=o?ICON.x:ICON.menu});
    d.addEventListener('keydown',function(e){if(e.key==='Escape'&&menu.classList.contains('open')){menu.classList.remove('open');burger.setAttribute('aria-expanded','false');burger.innerHTML=ICON.menu;burger.focus()}});
    $$('a',menu).forEach(function(a){a.addEventListener('click',function(){menu.classList.remove('open')})});
  }

  /* reveal on scroll — only for elements below the first screen */
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!reduce&&'IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('rv-in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px',threshold:.08});
    var groups={};
    $$('[data-rv]').forEach(function(el){
      if(el.getBoundingClientRect().top<innerHeight*.92) return;
      var p=el.parentElement,k=groups.__k=(groups.__k||0); var i=(p._rvi=(p._rvi||0)+1)-1;
      el.style.setProperty('--rd',Math.min(i,5)*80+'ms'); el.classList.add('rv'); io.observe(el);
    });
  }

  /* simple callback forms */
  $$('form[data-callback]').forEach(function(f){
    f.addEventListener('submit',function(e){e.preventDefault(); if(!validate(f)) return;
      f.hidden=true; var ok=f.parentElement.querySelector('.ok'); if(ok){ok.classList.add('show'); var b=ok.querySelector('button'); if(b) b.focus()} });
    var again=f.parentElement.querySelector('[data-again]');
    if(again) again.addEventListener('click',function(){f.reset();f.hidden=false;f.parentElement.querySelector('.ok').classList.remove('show')});
  });
  function validate(f){
    var good=true,first=null;
    $$('[required]',f).forEach(function(inp){
      var fl=inp.closest('.field'),v=inp.type==='checkbox'?inp.checked:inp.value.trim(),bad=!v;
      if(!bad&&inp.type==='tel') bad=inp.value.replace(/\D/g,'').length<10;
      if(!bad&&inp.minLength>0) bad=inp.value.trim().length<inp.minLength;
      if(fl) fl.classList.toggle('invalid',bad);
      var er=d.getElementById(inp.getAttribute('aria-describedby')||'');
      inp.setAttribute('aria-invalid',bad?'true':'false');
      if(er) er.textContent=bad?(inp.dataset.err||'Заповніть це поле'):'';
      if(bad){good=false;if(!first)first=inp}
    });
    if(first) first.focus();
    return good;
  }
  window.NuviaValidate=validate;
  d.addEventListener('input',function(e){var fl=e.target.closest&&e.target.closest('.field.invalid'); if(fl){fl.classList.remove('invalid');var er=d.getElementById(e.target.getAttribute('aria-describedby')||'');if(er)er.textContent=''}});

  /* doctor filter */
  var chips=$$('[data-filter]');
  chips.forEach(function(c){c.addEventListener('click',function(){
    chips.forEach(function(x){x.setAttribute('aria-pressed',x===c)});
    var g=c.dataset.filter,n=0;
    $$('[data-group]').forEach(function(card){var show=g==='all'||card.dataset.group===g;card.hidden=!show;if(show)n++});
    var out=$('#doc-count'); if(out) out.textContent=n+' '+(n===1?'лікар':n<5?'лікарі':'лікарів');
  })});

  /* price filter */
  var pch=$$('[data-pfilter]');
  pch.forEach(function(c){c.addEventListener('click',function(){pch.forEach(function(x){x.setAttribute('aria-pressed',x===c)});var g=c.dataset.pfilter;$$('[data-pgroup]').forEach(function(s){s.hidden=!(g==='all'||s.dataset.pgroup===g)})})});

  /* gallery arrows */
  $$('[data-scroll]').forEach(function(b){b.addEventListener('click',function(){
    var t=d.getElementById(b.dataset.target); if(!t) return; var f=t.firstElementChild;
    t.scrollBy({left:(+b.dataset.scroll)*((f?f.getBoundingClientRect().width:300)+16),behavior:reduce?'auto':'smooth'});
  })});

  /* article table of contents */
  var toc=$$('.a-side nav a');
  if(toc.length&&'IntersectionObserver' in window){
    var map={}; toc.forEach(function(a){map[a.getAttribute('href').slice(1)]=a});
    var tio=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){toc.forEach(function(a){a.classList.remove('on')});var a=map[e.target.id];if(a)a.classList.add('on')}})},{rootMargin:'-30% 0px -60% 0px'});
    Object.keys(map).forEach(function(id){var s=d.getElementById(id);if(s)tio.observe(s)});
  }

  var ICON={menu:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 8h16M4 16h16"/></svg>',x:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'};
})();

/* ===== booking ===== */
(function(){
  var root=document.getElementById('booking-app'); if(!root) return;
  var C=window.NUVIA_CATALOG, DOCS=window.NUVIA_DOCTORS;
  var q=new URLSearchParams(location.search||'');
  var st={mode:q.get('mode')==='callback'?'callback':'online',specialty:C[q.get('service')]?q.get('service'):'therapy',doctor:'any',date:null,time:null,call:'asap'};
  var qd=q.get('doctor'); if(qd&&DOCS[qd]&&DOCS[qd].service===st.specialty) st.doctor=qd;
  var $=function(s){return root.querySelector(s)}, $$=function(s){return Array.prototype.slice.call(root.querySelectorAll(s))};
  var spec=$('#bk-spec'),doc=$('#bk-doc'),days=$('#bk-days'),slots=$('#bk-slots'),form=$('#bk-form');
  var DN=['Нд','Пн','Вт','Ср','Чт','Пт','Сб'],MN=['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
  var TIMES=['08:30','09:00','10:00','10:30','11:30','12:00','13:30','14:00','15:00','16:30','17:00','18:30','19:00'];
  var CALL={asap:'Якнайшвидше',morning:'До 12:00',day:'12:00–16:00',evening:'Після 16:00'};

  Object.keys(C).forEach(function(k){var o=document.createElement('option');o.value=k;o.textContent=C[k].label;spec.appendChild(o)});
  function fillDocs(){
    doc.innerHTML='<option value="any">Будь-який лікар напряму</option>';
    C[st.specialty].doctors.forEach(function(slug){var o=document.createElement('option');o.value=slug;o.textContent=DOCS[slug].name;doc.appendChild(o)});
    if(st.doctor!=='any'&&C[st.specialty].doctors.indexOf(st.doctor)<0) st.doctor='any';
    doc.value=st.doctor;
  }
  function dayList(){var out=[],t=new Date();t.setHours(0,0,0,0);for(var i=0;i<7;i++){var x=new Date(t);x.setDate(t.getDate()+i);out.push(x)}return out}
  function key(x){return x.getFullYear()+'-'+(x.getMonth()+1)+'-'+x.getDate()}
  function fmtDate(x){var t=new Date();t.setHours(0,0,0,0);var diff=Math.round((x-t)/864e5);return (diff===0?'Сьогодні, ':diff===1?'Завтра, ':DN[x.getDay()]+', ')+x.getDate()+' '+MN[x.getMonth()]}
  function renderDays(){
    var list=dayList(); if(!st.date){var n=new Date();st.date=key(n.getHours()>=16?list[1]:list[0])}
    days.innerHTML=list.map(function(x,i){var k=key(x);return '<button type="button" class="day" data-date="'+k+'" aria-pressed="'+(st.date===k)+'" aria-label="'+fmtDate(x)+'"><small>'+(i===0?'Сьог.':DN[x.getDay()])+'</small><strong>'+x.getDate()+'</strong></button>'}).join('');
  }
  function renderSlots(){
    var parts=st.date.split('-'),dt=new Date(+parts[0],+parts[1]-1,+parts[2]),now=new Date(),seed=dt.getDate()+st.specialty.length+(st.doctor.length||0);
    var free=0;
    slots.innerHTML=TIMES.map(function(t,i){
      var h=+t.slice(0,2),m=+t.slice(3),past=dt.toDateString()===now.toDateString()&&(h*60+m)<=(now.getHours()*60+now.getMinutes()+30);
      var busy=past||(seed+i)%4===0; if(!busy) free++; if(busy&&st.time===t) st.time=null;
      return '<button type="button" class="slot" data-time="'+t+'" '+(busy?'disabled aria-label="'+t+', зайнято"':'')+' aria-pressed="'+(st.time===t)+'">'+t+'</button>';
    }).join('');
    $('#bk-noslots').hidden=free>0;
  }
  function sum(){
    var c=C[st.specialty],dslug=st.doctor==='any'?null:st.doctor,dd=dslug?DOCS[dslug]:null;
    $('#s-doc').innerHTML=dd?'<img src="'+dd.img+'" alt=""><div><b>'+dd.name+'</b><small>'+dd.role+'</small></div>':'<span class="av">N</span><div><b>Будь-який лікар</b><small>'+c.label+'</small></div>';
    $('#s-service').textContent=c.service;
    $('#s-when-l').textContent=st.mode==='online'?'Дата й час':'Дзвінок';
    var p=st.date.split('-');
    $('#s-when').textContent=st.mode==='online'?(fmtDate(new Date(+p[0],+p[1]-1,+p[2]))+(st.time?', '+st.time:' · оберіть час')):CALL[st.call];
    $('#s-dur').textContent=c.dur+' хв';
    $('#s-price').textContent=c.price+' грн';
    $('#bk-submit').firstChild.nodeValue=st.mode==='online'?'Записатися на прийом ':'Замовити дзвінок ';
  }
  function mode(){
    $$('[data-mode]').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.mode===st.mode)});
    $$('[data-only]').forEach(function(el){el.hidden=el.dataset.only!==st.mode});
    $('#bk-n-contact').textContent=st.mode==='online'?'3':'2';
  }
  function all(){fillDocs();renderDays();renderSlots();mode();sum()}
  spec.value=st.specialty;
  spec.addEventListener('change',function(){st.specialty=spec.value;st.time=null;fillDocs();renderSlots();sum()});
  doc.addEventListener('change',function(){st.doctor=doc.value;st.time=null;renderSlots();sum()});
  root.addEventListener('click',function(e){
    var b=e.target.closest('button'); if(!b) return;
    if(b.dataset.mode){st.mode=b.dataset.mode;mode();sum()}
    else if(b.dataset.date){st.date=b.dataset.date;renderDays();renderSlots();sum();$('#bk-err-time').textContent=''}
    else if(b.dataset.time&&!b.disabled){st.time=b.dataset.time;$$('.slot').forEach(function(x){x.setAttribute('aria-pressed',x===b)});sum();$('#bk-err-time').textContent=''}
    else if(b.dataset.call){st.call=b.dataset.call;$$('[data-call]').forEach(function(x){x.setAttribute('aria-pressed',x===b)});sum()}
  });
  form.addEventListener('submit',function(e){
    e.preventDefault();
    if(st.mode==='online'&&!st.time){$('#bk-err-time').textContent='Оберіть вільний час для візиту';$('#bk-slots').scrollIntoView({block:'center'});return}
    if(!window.NuviaValidate(form)) return;
    var c=C[st.specialty],dd=st.doctor==='any'?null:DOCS[st.doctor],p=st.date.split('-');
    window.NuviaStore.set('nuvia-booking',{mode:st.mode,name:form.name.value.trim(),service:c.service,doctor:dd?dd.name:'Будь-який лікар ('+c.label.toLowerCase()+')',img:dd?dd.img:null,
      when:st.mode==='online'?fmtDate(new Date(+p[0],+p[1]-1,+p[2]))+', '+st.time:CALL[st.call],price:c.price+' грн',phone:form.phone.value.trim()});
    location.href='thank-you.html';
  });
  all();
})();

/* ===== thank-you ===== */
(function(){
  var box=document.getElementById('ty-summary'); if(!box) return;
  var b=window.NuviaStore.get('nuvia-booking');
  if(!b){return}
  var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
  document.getElementById('ty-title').innerHTML=(b.name?esc(b.name)+', д':'Д')+'якуємо! <span class="hl">'+(b.mode==='online'?'Заявку на прийом':'Заявку на дзвінок')+' отримано</span>';
  box.innerHTML=[[b.mode==='online'?'Послуга':'Тема',b.service],['Лікар',b.doctor],[b.mode==='online'?'Дата й час':'Коли зателефонувати',b.when],['Телефон',b.phone],['Вартість',b.price]].map(function(r){return '<div><span>'+r[0]+'</span><strong>'+esc(r[1])+'</strong></div>'}).join('');
  box.hidden=false;
})();

/* ===== account (demo) ===== */
(function(){
  var app=document.getElementById('account-app'); if(!app) return;
  var $=function(s){return app.querySelector(s)}, $$=function(s){return Array.prototype.slice.call(app.querySelectorAll(s))};
  var phone='';
  function show(id){$$('[data-view]').forEach(function(v){v.hidden=v.dataset.view!==id}); var h=app.querySelector('[data-view="'+id+'"] h2'); if(h){h.setAttribute('tabindex','-1');h.focus({preventScroll:true})}}
  $$('[data-tab]').forEach(function(b){b.addEventListener('click',function(){$$('[data-tab]').forEach(function(x){x.setAttribute('aria-pressed',x===b)});show(b.dataset.tab)})});
  $$('form[data-acc]').forEach(function(f){f.addEventListener('submit',function(e){e.preventDefault();if(!window.NuviaValidate(f))return;phone=f.phone.value.trim();$('#code-phone').textContent=phone;$('.acc-tabs').hidden=true;show('code');var c=$('.code input');if(c)c.focus()})});
  var codes=$$('.code input');
  codes.forEach(function(inp,i){
    inp.addEventListener('input',function(){inp.value=inp.value.replace(/\D/g,'').slice(0,1);if(inp.value&&codes[i+1])codes[i+1].focus();check()});
    inp.addEventListener('keydown',function(e){if(e.key==='Backspace'&&!inp.value&&codes[i-1])codes[i-1].focus()});
    inp.addEventListener('paste',function(e){var t=(e.clipboardData.getData('text')||'').replace(/\D/g,'').slice(0,4);if(t){e.preventDefault();codes.forEach(function(c,j){c.value=t[j]||''});check()}});
  });
  function check(){var v=codes.map(function(c){return c.value}).join('');$('#code-err').textContent='';if(v.length===4){if(v==='1234'){show('cab')}else{$('#code-err').textContent='Невірний код. У демо-версії код — 1234'}}}
  $('#code-back').addEventListener('click',function(){$('.acc-tabs').hidden=false;codes.forEach(function(c){c.value=''});show('login');$$('[data-tab]').forEach(function(x){x.setAttribute('aria-pressed',x.dataset.tab==='login')})});
  $('#cab-out').addEventListener('click',function(){$('.acc-tabs').hidden=false;codes.forEach(function(c){c.value=''});show('login')});
  var b=window.NuviaStore.get('nuvia-booking'); if(b&&b.mode==='online'){$('#cab-next').innerHTML='<span class="pill-ok">Очікує підтвердження</span><b>'+b.service.replace(/</g,'&lt;')+'</b><span class="small">'+b.doctor.replace(/</g,'&lt;')+' · '+b.when.replace(/</g,'&lt;')+'</span>'}
})();
