/* =========================================================
   Trex — White Edition engine (monochrome network motion)
   ========================================================= */
(function(){
  'use strict';

  var clamp=function(v,a,b){return Math.max(a,Math.min(b,v));};
  var ease=function(t){return 1-Math.pow(1-t,3);};

  /* ---------- Intro loader ---------- */
  function reveal(){
    var intro=document.getElementById('intro');
    if(intro)intro.classList.add('done');
    if(!document.body.classList.contains('loaded')){
      document.body.classList.add('loaded');
      /* headline gathers first, then the mix wave sweeps both lines */
      setTimeout(function(){if(typeof startColorWave==='function')startColorWave();},1000);
    }
  }
  window.addEventListener('load',function(){setTimeout(reveal,700);});
  setTimeout(reveal,3200);

  /* ---------- Scroll progress bar ---------- */
  var bar=document.createElement('div');
  bar.className='scroll-progress';
  document.body.appendChild(bar);

  /* ---------- Nav ---------- */
  var nav=document.getElementById('nav');
  var ham=document.getElementById('ham');
  var navLinks=document.getElementById('navLinks');
  if(ham&&navLinks){
    ham.addEventListener('click',function(){
      ham.classList.toggle('open');
      navLinks.classList.toggle('open');
    });
  }
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click',function(e){
      var t=document.querySelector(a.getAttribute('href'));
      if(t){e.preventDefault();t.scrollIntoView({behavior:'smooth'});}
      if(navLinks)navLinks.classList.remove('open');
      if(ham)ham.classList.remove('open');
    });
  });

  /* ---------- Color helpers (per-char gradient) ---------- */
  function lerpColor(a,b,t){
    var ar=parseInt(a.slice(1,3),16),ag=parseInt(a.slice(3,5),16),ab=parseInt(a.slice(5,7),16);
    var br=parseInt(b.slice(1,3),16),bg=parseInt(b.slice(3,5),16),bb=parseInt(b.slice(5,7),16);
    return'rgb('+Math.round(ar+(br-ar)*t)+','+Math.round(ag+(bg-ag)*t)+','+Math.round(ab+(bb-ab)*t)+')';
  }
  function multiLerp(colors,t){
    if(colors.length===1)return colors[0];
    var seg=(colors.length-1)*t;
    var i=Math.min(Math.floor(seg),colors.length-2);
    return lerpColor(colors[i],colors[i+1],seg-i);
  }

  /* ---------- Hero headline: colored scatter-gather, then the mix ----------
     Chars assemble already colored (line1 orange / line2 blue).
     Once settled, a wave sweeps both lines into the blended
     orange→gold→blue palette — the two colors mixing together. ---------- */
  var heroGradChars=[];
  document.querySelectorAll('[data-chars]').forEach(function(line){
    var txt=line.textContent;
    var grad=null,grad2=null;
    if(line.dataset.grad){
      try{grad=JSON.parse(line.dataset.grad);}catch(e){grad=null;}
    }
    if(line.dataset.grad2){
      try{grad2=JSON.parse(line.dataset.grad2);}catch(e){grad2=null;}
    }
    line.textContent='';
    var n=txt.length;
    [...txt].forEach(function(ch,i){
      var s=document.createElement('span');
      s.className='ch';
      s.textContent=ch;
      s.style.transitionDelay=(i*0.045)+'s';
      s.style.setProperty('--hx',((Math.random()-.5)*560).toFixed(0)+'px');
      s.style.setProperty('--hy',((Math.random()-.5)*360).toFixed(0)+'px');
      s.style.setProperty('--hr',((Math.random()-.5)*120).toFixed(0)+'deg');
      var t=n>1?i/(n-1):0;
      if(grad)s.style.color=multiLerp(grad,t);   /* default palette from the start */
      if(grad2){
        s.dataset.tc2=multiLerp(grad2,t);        /* blended palette, applied later */
        heroGradChars.push(s);
      }
      line.appendChild(s);
    });
  });
  var waveStarted=false;
  function startColorWave(){
    if(waveStarted)return;
    waveStarted=true;
    heroGradChars.forEach(function(s,i){
      setTimeout(function(){s.style.color=s.dataset.tc2;},i*90);
    });
  }

  /* ---------- Network canvases: AI (blue) × Human (orange) mixing ----------
     Blue nodes drift in from the left half, orange from the right.
     When a blue and an orange node meet, their link is drawn as a
     blue→orange gradient — AI and human blending into one picture. ---------- */
  var AI_C='74,164,220', HU_C='240,144,48';           /* on light bg */
  var AI_CD='127,195,232', HU_CD='245,182,112';       /* brighter, on dark bg */
  var NET_THEMES={
    hero: {ai:AI_C,hu:HU_C,nodeA:0.75,maxA:0.34,count:60},
    light:{ai:AI_C,hu:HU_C,nodeA:0.5,maxA:0.2,count:46},
    mid:  {ai:AI_C,hu:HU_C,nodeA:0.42,maxA:0.15,count:26},
    dark: {ai:AI_CD,hu:HU_CD,nodeA:0.75,maxA:0.32,count:52}
  };
  function initNet(canvas){
    var theme=NET_THEMES[canvas.dataset.net]||NET_THEMES.light;
    var ctx=canvas.getContext('2d');
    var w=0,h=0,DPR=Math.min(1.25,window.devicePixelRatio||1);
    var nodes=[];
    function resize(){
      var rect=canvas.getBoundingClientRect();
      w=Math.max(2,Math.round(rect.width*DPR));
      h=Math.max(2,Math.round(rect.height*DPR));
      canvas.width=w;canvas.height=h;
      if(!nodes.length){
        for(var i=0;i<theme.count;i++){
          var isAI=i%2===0;
          nodes.push({
            t:isAI?'ai':'hu',
            c:isAI?theme.ai:theme.hu,
            /* AI spawns left, Human spawns right — then they drift & mix */
            x:isAI?Math.random()*0.55:0.45+Math.random()*0.55,
            y:Math.random(),
            vx:(Math.random()-.5)*.00026,vy:(Math.random()-.5)*.00026,
            r:1.1+Math.random()*1.7
          });
        }
      }
    }
    var LINK=0.17;
    var running=false,rafId=null;
    function frame(){
      if(!running)return;
      ctx.clearRect(0,0,w,h);
      var i,j,n,m;
      for(i=0;i<nodes.length;i++){
        n=nodes[i];
        n.x+=n.vx;n.y+=n.vy;
        if(n.x<0||n.x>1)n.vx*=-1;
        if(n.y<0||n.y>1)n.vy*=-1;
      }
      var linkPx=Math.min(w,h)*2.2*LINK;
      ctx.lineWidth=1;
      for(i=0;i<nodes.length;i++){
        n=nodes[i];
        for(j=i+1;j<nodes.length;j++){
          m=nodes[j];
          var dx=(n.x-m.x)*w,dy=(n.y-m.y)*h;
          var d=Math.sqrt(dx*dx+dy*dy);
          if(d<linkPx){
            var a=theme.maxA*(1-d/linkPx);
            if(n.t===m.t){
              ctx.strokeStyle='rgba('+n.c+','+a.toFixed(3)+')';
            }else{
              /* AI × Human link: gradient blend between the two colors */
              var g=ctx.createLinearGradient(n.x*w,n.y*h,m.x*w,m.y*h);
              g.addColorStop(0,'rgba('+n.c+','+a.toFixed(3)+')');
              g.addColorStop(1,'rgba('+m.c+','+a.toFixed(3)+')');
              ctx.strokeStyle=g;
            }
            ctx.beginPath();ctx.moveTo(n.x*w,n.y*h);ctx.lineTo(m.x*w,m.y*h);ctx.stroke();
          }
        }
      }
      for(i=0;i<nodes.length;i++){
        n=nodes[i];
        ctx.fillStyle='rgba('+n.c+','+theme.nodeA+')';
        ctx.beginPath();ctx.arc(n.x*w,n.y*h,n.r,0,Math.PI*2);ctx.fill();
      }
      rafId=requestAnimationFrame(frame);
    }
    resize();
    window.addEventListener('resize',resize);
    new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting&&!running){running=true;resize();rafId=requestAnimationFrame(frame);}
        else if(!e.isIntersecting&&running){running=false;if(rafId)cancelAnimationFrame(rafId);}
      });
    },{rootMargin:'100px'}).observe(canvas);
  }
  document.querySelectorAll('.net').forEach(initNet);

  /* ---------- Mission text: phrase-wrapped chars for scrub ---------- */
  var scrubText=document.getElementById('scrubText');
  var scrubChars=[];
  if(scrubText){
    /* colored key phrases — same palette as the AI × HUMAN heading:
       AI = blue gradient / human = orange gradient / mix = orange→gold→blue */
    /* 段階昇温: the opening (problem) stays plain ink — from
       「だから、決めました。」 onward, color floods in sentence by
       sentence, ending with the most colorful line */
    var emDefs=[
      {w:'時間はAIが生む',g:['#2F87BD','#4AA4DC']},
      {w:'想いは人が込める',g:['#D07820','#F09030']},
      {w:'細部まで磨き上げる',g:['#D07820','#F09030']},
      {w:'AIと',g:['#2F87BD','#4AA4DC']},
      {w:'人のかけあわせ',g:['#F09030','#E8B430']},
      {w:'自分らしさ',g:['#D07820','#F09030','#E8B430']},
      {w:'もっと遠くへ',g:['#E8B430','#4AA4DC']}
    ];
    var phrases=scrubText.textContent.split('|');
    var raw=phrases.join('');
    scrubText.textContent='';
    var emRanges=[];
    emDefs.forEach(function(def){
      var idx=raw.indexOf(def.w);
      while(idx!==-1){
        emRanges.push({s:idx,e:idx+def.w.length,g:def.g});
        idx=raw.indexOf(def.w,idx+1);
      }
    });
    function emAt(i){
      for(var k=0;k<emRanges.length;k++){
        var r=emRanges[k];
        if(i>=r.s&&i<r.e)return r;
      }
      return null;
    }
    var gi=0;
    phrases.forEach(function(ph){
      var wrap=document.createElement('span');
      wrap.className='ph';
      [...ph].forEach(function(ch){
        var s=document.createElement('span');
        var r=emAt(gi);
        s.className='w'+(r?' em':'');
        s.textContent=ch;
        /* every char lands as a ghost, then takes its final color:
           body text → ink, key words → blue/orange gradients */
        if(r){
          var len=r.e-r.s;
          s.dataset.fc=multiLerp(r.g,len>1?(gi-r.s)/(len-1):0);
        }else{
          s.dataset.fc='#121213';
        }
        /* scatter origin: chars fly in from random directions */
        s.style.setProperty('--mx',((Math.random()-.5)*520).toFixed(0)+'px');
        s.style.setProperty('--my',((Math.random()-.5)*340).toFixed(0)+'px');
        s.style.setProperty('--mr',((Math.random()-.5)*140).toFixed(0)+'deg');
        wrap.appendChild(s);
        scrubChars.push(s);
        gi++;
      });
      scrubText.appendChild(wrap);
    });
  }
  var scrubSec=document.getElementById('mission');

  /* ---------- Showreel ---------- */
  var reelSec=document.getElementById('reel');
  var reelFrame=document.getElementById('reelFrame');

  /* ---------- Stacking cards ---------- */
  var stackItems=[].slice.call(document.querySelectorAll('.stack-item'));

  /* ---------- Unified scroll loop ---------- */
  var vh=window.innerHeight;
  window.addEventListener('resize',function(){vh=window.innerHeight;});

  function stickyProgress(sec){
    var r=sec.getBoundingClientRect();
    return clamp(-r.top/(r.height-vh),0,1);
  }

  var ticking=false;
  function update(){
      vh=window.innerHeight||vh||720;
      var doc=document.documentElement;
      var total=doc.scrollHeight-doc.clientHeight;
      bar.style.width=(total>0?(doc.scrollTop/total)*100:0)+'%';
      if(nav)nav.classList.toggle('scrolled',window.scrollY>60);

      /* mission char scrub */
      if(scrubSec&&scrubChars.length){
        var p=stickyProgress(scrubSec);
        var lit=Math.floor(p*1.25*scrubChars.length);
        for(var i=0;i<scrubChars.length;i++){
          var on=i<lit;
          if(on!==scrubChars[i]._lit){
            scrubChars[i]._lit=on;
            scrubChars[i].classList.toggle('lit',on);
          }
        }
        /* color chases the assembly: landed chars take their final color
           a few characters behind the gathering front */
        var colorLit=Math.min(scrubChars.length,Math.max(0,lit-14));
        for(var c=0;c<scrubChars.length;c++){
          var col=c<colorLit;
          if(col!==scrubChars[c]._col){
            scrubChars[c]._col=col;
            scrubChars[c].style.color=col?scrubChars[c].dataset.fc:'';
          }
        }
      }

      /* showreel zoom */
      if(reelSec&&reelFrame){
        var rp=stickyProgress(reelSec);
        var grow=ease(clamp(rp/0.55,0,1));
        var shrink=ease(clamp((rp-0.8)/0.2,0,1));
        var scale=0.82+0.18*grow-0.05*shrink;
        reelFrame.style.transform='scale('+scale.toFixed(4)+')';
      }

      /* stacking cards */
      if(window.innerWidth>768){
        for(var k=0;k<stackItems.length;k++){
          var card=stackItems[k].querySelector('.card');
          if(!card)continue;
          var next=stackItems[k+1];
          var cp=0;
          if(next){
            var nr=next.getBoundingClientRect();
            cp=clamp(1-(nr.top-100)/(vh-100),0,1);
          }
          card.style.transform='scale('+(1-cp*0.05).toFixed(4)+') translateY('+(-cp*12).toFixed(1)+'px)';
          card.style.filter='brightness('+(1-cp*0.08).toFixed(3)+')';
        }
      }
  }
  function onScroll(){
    if(document.hidden){update();return;}
    if(ticking)return;
    ticking=true;
    requestAnimationFrame(function(){ticking=false;update();});
  }
  window.addEventListener('scroll',onScroll,{passive:true});
  onScroll();

  /* ---------- Generic reveal ---------- */
  var io=new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){e.target.classList.add('vis');io.unobserve(e.target);}
    });
  },{threshold:0.12,rootMargin:'0px 0px -40px 0px'});
  document.querySelectorAll('.reveal').forEach(function(el,i){
    el.style.transitionDelay=(i%3*0.1)+'s';
    io.observe(el);
  });

})();
