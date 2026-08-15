import{useState,useEffect,useRef,useCallback}from"react";

const KEY="foco_v18";
const DKEY="foco_dk"; // clave de dispositivo, separada de los datos

// ─── Cifrado local ligero ─────────────────────────────────────────────────────
// No es cifrado militar — es ofuscacion real con clave por dispositivo, para que
// los datos no queden como JSON plano legible si alguien exporta el storage.
// Contra malware con acceso root al dispositivo esto NO protege (la clave vive
// en el mismo storage); si necesitas eso, hace falta cifrado del lado del SO.
function getDeviceKey(){
  try{
    const existing=localStorage.getItem(DKEY);
    if(existing)return existing.split(",").map(Number);
    const arr=new Uint8Array(16);
    (window.crypto||window.msCrypto).getRandomValues(arr);
    const key=Array.from(arr);
    localStorage.setItem(DKEY,key.join(","));
    return key;
  }catch{return[42,17,88,3,201,77,150,9,63,240,11,199,54,182,6,97];}
}
function xorBytes(bytes,key){return bytes.map((b,i)=>b^key[i%key.length]);}
function bytesToB64(bytes){let bin="";bytes.forEach(b=>bin+=String.fromCharCode(b));return btoa(bin);}
function b64ToBytes(b64){const bin=atob(b64);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return bytes;}

function persist(d){
  try{
    const key=getDeviceKey();
    const bytes=new TextEncoder().encode(JSON.stringify(d));
    const b64=bytesToB64(xorBytes(bytes,key));
    localStorage.setItem(KEY,b64);
  }catch{}
}
function load(){
  try{
    const raw=localStorage.getItem(KEY);
    if(!raw)return def();
    const key=getDeviceKey();
    try{
      const bytes=b64ToBytes(raw);
      const json=new TextDecoder().decode(xorBytes(bytes,key));
      return JSON.parse(json)||def();
    }catch{
      // Migracion: datos guardados en texto plano por una version anterior sin cifrado
      const legacy=JSON.parse(raw);
      persist(legacy);
      return legacy;
    }
  }catch{return def();}
}
function wipeAllData(){
  try{localStorage.removeItem(KEY);localStorage.removeItem(DKEY);}catch{}
}
function def(){return{score:0,checkins:0,history:[],topics:[],lastResult:null,lastInsightDate:null,lastDayNormal:true,lastFeedback:null,activeDays:0,lastActiveDate:null,fechaHoy:null,onboarded:false,ayerFueDiferente:false,recurringTasks:{},weekScore:0,weekStart:null,weekHistory:[],bestScore:0,logros:{},zonaCount:0,lastZonaDate:null,contrato:null,contratoHistory:[],theme:"light"};}

// ─── DESIGN SYSTEM — Light + Dark ────────────────────────────────────────────
const LIGHTT={
  BG:"#DADADA",CARD:"#FFFFFF",CARD2:"#E8E8E8",DARK:"#141414",MID:"#1A1A1A",DIM:"#5A5A5A",
  LINE:"#B0B0B0",LIMA:"#8FB300",POS:"#16A34A",NEG:"#DC2626",AMB:"#D97706",
  SHA:"0 2px 20px rgba(0,0,0,0.13)",SHA2:"0 8px 32px rgba(0,0,0,0.22)",ON_DARK:"#FFFFFF",
};
const DARKT={
  BG:"#0A0A0A",CARD:"#161616",CARD2:"#1F1F1F",DARK:"#F5F5F5",MID:"#D8D8D8",DIM:"#7A7A7A",
  LINE:"#2A2A2A",LIMA:"#C8FF00",POS:"#34C759",NEG:"#FF453A",AMB:"#FF9F0A",
  SHA:"0 2px 20px rgba(0,0,0,0.45)",SHA2:"0 8px 36px rgba(0,0,0,0.6)",ON_DARK:"#0A0A0A",
};
let T=LIGHTT; // paleta activa — se reasigna en cada render de Foco() segun data.theme
const SANS  = "'Bricolage Grotesque','Inter',sans-serif";
const MONO  = "'Space Mono','Courier New',monospace";
const R     = 16;  // border radius base
const SMIN=-30,SMAX=100;

function applyScore(cur,e,data){const t=new Date().toDateString();const b=(data.fechaHoy!==t&&cur<-10)?-10:cur;return Math.max(SMIN,Math.min(SMAX,b+(e==="ALINEADO"?10:-10)));}
function sCol(s){return s>0?T.POS:s<0?T.NEG:T.MID;}
function sLbl(s){if(s>=30)return"Óptimo";if(s>=10)return"Alineado";if(s>=0)return"Neutral";if(s>=-15)return"Inestable";return"Crítico";}
function getWS(){const n=new Date(),d=n.getDay(),m=new Date(n);m.setDate(n.getDate()+(d===0?-6:1-d));m.setHours(0,0,0,0);return m.toDateString();}
function calcWeek(wh){if(!wh||wh.length<3)return null;return{pct:Math.round(wh.filter(h=>h.estado==="ALINEADO").length/wh.length*100),total:wh.length,alineados:wh.filter(h=>h.estado==="ALINEADO").length};}

// ─── RESUMEN SEMANAL — dia por dia, con el estado emocional dominante de cada uno
const DAY_ADJ={EV:"evasivo",EN:"agotado",CO:"confundido",RE:"resistente",ANS:"ansioso",PERF:"perfeccionista",SOB:"sobrecargado",ABUR:"aburrido",ESTR:"estresado",MOT:"desmotivado",DIS:"motivado"};
const DIAS_ORDEN=["Lun","Mar","Mie","Jue","Vie","Sab","Dom"];
function buildResumenSemanal(data){
  const wh=data.weekHistory||[];
  if(wh.length<3)return null;
  const porDia={};
  wh.forEach(h=>{if(!porDia[h.day])porDia[h.day]=[];porDia[h.day].push(h);});
  const dias=DIAS_ORDEN.map(d=>{
    const entries=porDia[d];
    if(!entries||!entries.length)return{dia:d,sinDatos:true};
    const tipos={};
    entries.forEach(e=>{const t=e.tipo||"EV";tipos[t]=(tipos[t]||0)+1;});
    const tipoTop=Object.entries(tipos).sort((a,b)=>b[1]-a[1])[0][0];
    const pctAl=Math.round(entries.filter(e=>e.estado==="ALINEADO").length/entries.length*100);
    const ultimo=entries[entries.length-1];
    return{dia:d,sinDatos:false,tipo:tipoTop,adj:DAY_ADJ[tipoTop]||"evasivo",pctAl,total:entries.length,insight:ultimo.insight,tarea:ultimo.tarea};
  });
  // Adjetivo dominante de la semana completa
  const tiposTotal={};
  wh.forEach(h=>{const t=h.tipo||"EV";tiposTotal[t]=(tiposTotal[t]||0)+1;});
  const tipoSemana=Object.entries(tiposTotal).sort((a,b)=>b[1]-a[1])[0][0];
  const pctAlSemana=Math.round(wh.filter(h=>h.estado==="ALINEADO").length/wh.length*100);
  const diasConDatos=dias.filter(d=>!d.sinDatos).length;
  return{dias,adjSemana:DAY_ADJ[tipoSemana]||"evasivo",tipoSemana,pctAlSemana,diasConDatos,totalChecks:wh.length};
}
function detectPatron(h){if(h.length<5)return null;const c=h.slice(0,5).map(x=>x.tipo).filter(Boolean).reduce((a,t)=>({...a,[t]:(a[t]||0)+1}),{});const top=Object.entries(c).sort((a,b)=>b[1]-a[1])[0];return top&&top[1]>=2?top[0]:null;}
function resetDaily(d){const t=new Date().toDateString(),ws=getWS();let n=d.fechaHoy!==t?{...d,usosHoy:0,fechaHoy:t,ayerFueDiferente:false,zonaCount:0}:{...d};if(n.weekStart!==ws)n={...n,weekScore:0,weekStart:ws,weekHistory:[]};return n;}
function markActive(d){const t=new Date().toDateString();if(d.lastActiveDate===t)return d;const y=new Date(Date.now()-86400000).toDateString();return{...d,lastActiveDate:t,activeDays:d.lastActiveDate===y?(d.activeDays||0)+1:1};}
function dKey(d=new Date()){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function todaySt(h){const t=dKey(),c=h.filter(x=>x.dk===t);if(!c.length)return null;return{pct:Math.round(c.filter(x=>x.estado==="ALINEADO").length/c.length*100),total:c.length};}
function vsY(h){const t=dKey(),y=dKey(new Date(Date.now()-86400000));const tA=h.filter(x=>x.dk===t),yA=h.filter(x=>x.dk===y);if(!tA.length||!yA.length)return null;return Math.round(tA.filter(x=>x.estado==="ALINEADO").length/tA.length*100-yA.filter(x=>x.estado==="ALINEADO").length/yA.length*100);}
function getLoop(data){if(data.ayerFueDiferente||!data.lastInsightDate)return null;const l=new Date(data.lastInsightDate).toDateString(),y=new Date(Date.now()-86400000).toDateString();if(l!==y)return null;return data.lastResult==="DESALINEADO"?"Ayer evitaste lo importante.":"Ayer estabas alineado.";}
function getAlmost(data,e){if((data.checkins||0)<5||(data.score||0)<=0)return null;if(e==="DESALINEADO"&&data.lastResult==="ALINEADO")return"Estabas mejorando. No caigas ahora.";return null;}
function getRecurring(rt){const e=Object.entries(rt||{}).filter(([,v])=>v>=3);return e.length?e.sort((a,b)=>b[1]-a[1])[0][0]:null;}

// ─── PREDICCION — Zona de Riesgo ──────────────────────────────────────────────
// Analiza el historial por dia de semana + franja horaria para detectar momentos
// donde sistematicamente fallas, y avisa ANTES de que vuelva a pasar (no despues).
function getTurno(hour){if(hour<12)return"Mañana";if(hour<18)return"Tarde";return"Noche";}
function predictRisk(data){
  const hist=data.history||[];
  if(hist.length<8)return null; // hace falta historial minimo para predecir con confianza
  const now=new Date();
  const diaActual=["Dom","Lun","Mar","Mie","Jue","Vie","Sab"][now.getDay()];
  const turnoActual=getTurno(now.getHours());
  const matching=hist.filter(h=>h.day===diaActual&&getTurno(parseInt((h.time||"0:00").split(":")[0])||0)===turnoActual);
  if(matching.length<3)return null; // necesitamos al menos 3 muestras en ese dia+franja
  const desalineados=matching.filter(h=>h.estado==="DESALINEADO").length;
  const pct=Math.round(desalineados/matching.length*100);
  if(pct<55)return null; // solo avisamos si el riesgo es real, no ante cualquier dato
  const tiposFail=matching.filter(h=>h.estado==="DESALINEADO").map(h=>h.tipo).filter(Boolean);
  const tipoCount={};
  tiposFail.forEach(t=>tipoCount[t]=(tipoCount[t]||0)+1);
  const tipoTop=Object.entries(tipoCount).sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
  return{dia:diaActual,turno:turnoActual,pct,muestras:matching.length,tipoTop};
}
function haptic(t="l"){try{if(navigator.vibrate){if(t==="s")navigator.vibrate([10,30,10]);else if(t==="e")navigator.vibrate([40,20,40]);else navigator.vibrate(10);}}catch{}}
function exportCSV(h){const rows=["Fecha,Estado,Tipo,Score,Insight",...h.map(x=>[x.date,x.estado,x.tipo||"",x.score,'"'+((x.insight||"").replace(/"/g,"'"))+'"'].join(","))].join("\n");const u=URL.createObjectURL(new Blob([rows],{type:"text/csv;charset=utf-8;"}));const a=document.createElement("a");a.href=u;a.download="foco.csv";document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);}
function norm(t){return t.toLowerCase().trim().replace(/[^\w\s]/g,"").replace(/\s+/g," ");}
const STOP=new Set(["trabajo","hacer","hice","algo","nada","para","quiero","tengo","voy","estar","estoy","bien","mal"]);

// ─── MOTOR DE DIAGNOSTICO — analisis multi-señal tipo psicologo profesional ──
// En vez de un solo keyword ganador, se puntua CADA respuesta (Q1..Q6) contra
// 8 categorias con bancos de frases ponderadas, y gana la de mayor puntaje.
// Esto evita que el motor "caiga siempre en lo mismo" por defecto.

function normTxt(t){return (t||"").toLowerCase();}

// Detecta si `phrase` aparece en `text` sin estar negada justo antes ("no cansado" no cuenta)
function hasPhrase(text,phrase){
  const idx=text.indexOf(phrase);
  if(idx===-1)return false;
  if(phrase.startsWith("no "))return true; // la negacion ya es parte de la frase
  const before=text.slice(0,idx).trim().split(/\s+/).slice(-2).join(" ");
  if(/\bno\b/.test(before))return false;
  return true;
}
function scoreBank(text,bank){let s=0;for(const[phrase,w]of bank){if(hasPhrase(text,phrase))s+=w;}return s;}

// Bancos de frases ponderadas (peso 1-3 segun especificidad)
const BANK_EV=[["instagram",2],["tiktok",2],["youtube",2],["netflix",2],["redes sociales",2],["whatsapp",1],["scroll",2],["celular",1],["telefono",1],["me distraje",2],["me puse a mirar",2],["vi videos",2],["perdi el tiempo",2],["se me fue el tiempo",2],["otra cosa",1],["cualquier cosa menos",3],["lo que sea menos",3],["mirando memes",2],["series",1],["youtube",2]];
const BANK_EN=[["cansado",2],["cansada",2],["agotado",2],["agotada",2],["sin energia",2],["sin fuerzas",2],["exhausto",2],["exhausta",2],["no dormi",2],["dormi mal",2],["fatiga",2],["reventado",1],["reventada",1],["muerto",1],["muerta",1],["no tengo ganas",2],["sin ganas",2],["desgano",2],["no me da",1],["quemado",2],["quemada",2],["baja energia",2]];
const BANK_CO=[["no se por donde",3],["no se como",2],["no tengo claro",2],["perdido",2],["perdida",2],["confundido",2],["confundida",2],["no entiendo",2],["no se que hacer primero",3],["me pierdo",2],["no tengo un plan",2],["desorganizado",1],["desorganizada",1],["no tengo idea",2],["sin rumbo",2]];
const BANK_RE=[["no quiero",3],["pereza",2],["paja",2],["odio",2],["me cae mal",1],["no me gusta",1],["me resisto",2],["rechazo",2],["bronca",1],["fastidio",1],["harto",2],["harta",2],["me niego",3],["no tengo intencion",2]];
const BANK_ANS=[["ansiedad",3],["ansioso",3],["ansiosa",3],["nervioso",2],["nerviosa",2],["me paraliza",3],["me paralizo",3],["miedo a",3],["miedo de",3],["panico",3],["me bloqueo",3],["bloqueada",2],["bloqueado",2],["que tal si sale mal",2],["y si no puedo",2],["y si fallo",2],["me da terror",3],["angustia",2]];
const BANK_PERF=[["no me sale como quiero",2],["no esta perfecto",2],["tiene que quedar bien",2],["no quiero hacerlo mal",2],["prefiero no empezar",2],["si no lo hago bien",2],["no estoy conforme",2],["muy exigente",1],["perfeccionista",3],["no es suficiente",1],["no me convence",1],["tiene que salir perfecto",3]];
const BANK_SOB=[["tengo demasiado",2],["no doy abasto",3],["demasiadas cosas",2],["no se por cual",2],["todo junto",2],["muchas tareas",2],["desbordado",3],["desbordada",3],["no llego",2],["colapsado",2],["colapsada",2],["saturado",2],["saturada",2],["tengo mil cosas",2],["se me acumulo",2]];
const BANK_ABUR=[["aburrido",3],["aburrida",3],["aburre",2],["me aburre",3],["no me interesa",2],["no me llama",2],["es tedioso",2],["es tedioso",2],["es repetitivo",2],["monotono",2],["monotona",2],["no tiene gracia",2],["me da lo mismo",2],["indiferente",2],["ninguna emocion",1],["nada interesante",2]];
const BANK_ESTR=[["estresado",3],["estresada",3],["presion",2],["mucha presion",3],["no llego con los tiempos",3],["contrarreloj",2],["me supera",2],["demasiada exigencia",2],["me exige mucho",2],["tension",2],["nervios",1],["urgencia",1],["plazo",1],["fecha limite",2],["deadline",2],["no me alcanza el tiempo",3]];
const BANK_MOT=[["sin motivacion",3],["no tengo motivacion",3],["no le veo sentido",3],["para que",2],["no vale la pena",2],["no me importa",2],["desmotivado",3],["desmotivada",3],["no encuentro sentido",3],["no se para que sirve",2],["indiferencia",1],["apatia",2],["vacio",1],["sin proposito",2]];
const BANKS={EV:BANK_EV,EN:BANK_EN,CO:BANK_CO,RE:BANK_RE,ANS:BANK_ANS,PERF:BANK_PERF,SOB:BANK_SOB,ABUR:BANK_ABUR,ESTR:BANK_ESTR,MOT:BANK_MOT};

// Marcadores de contradiccion — si aparecen, Q1/Q2 parecidas NO son alineacion real
const CONTRA=["pero","a medias","no del todo","un poco","casi nada","todavia no","recien empezando","por la mitad","me falta mucho"];

// Stem crudo (primeros 4 caracteres) para que "mandar"/"mande", "elegir"/"elegi", etc.
// cuenten como la misma palabra — sin esto, cualquier respuesta natural en español
// (intencion en infinitivo -> resultado en pasado) se marcaba como DESALINEADO por error.
function stem4(w){return w.length>4?w.slice(0,4):w;}
function esAlineado(q1,q2){
  const na=norm(q1),nb=norm(q2);
  if(!na||!nb)return false;
  if(CONTRA.some(c=>nb.includes(c)))return false;
  if(na===nb)return true;
  const wa=new Set(na.split(" ").filter(w=>w.length>3&&!STOP.has(w)).map(stem4));
  const wbArr=nb.split(" ").filter(w=>w.length>3&&!STOP.has(w)).map(stem4);
  if(!wa.size||!wbArr.length)return false;
  const overlap=wbArr.filter(w=>wa.has(w)).length;
  const ratio=overlap/Math.max(wa.size,wbArr.length);
  return ratio>=0.5||na.includes(nb)||nb.includes(na);
}

// Analiza TODAS las respuestas (no solo una) y puntua cada categoria — como
// un psicologo integraria multiples respuestas en vez de fijarse en una sola frase
function detectTipoPro(answers){
  const text=normTxt(answers.filter(Boolean).join(" . "));
  const scores={};
  for(const[cat,bank]of Object.entries(BANKS))scores[cat]=scoreBank(text,bank);
  const entries=Object.entries(scores).filter(([,v])=>v>0);
  if(!entries.length)return"EV";
  const max=Math.max(...entries.map(([,v])=>v));
  const top=entries.filter(([,v])=>v===max).map(([k])=>k);
  return top[Math.floor(Math.random()*top.length)];
}

const TC_MAP={EV:"NEG",EN:"AMB",CO:"AMB",RE:"NEG",ANS:"NEG",PERF:"AMB",SOB:"NEG",ABUR:"AMB",ESTR:"NEG",MOT:"AMB",DIS:"POS"};
function getTC(){const o={};for(const[k,v]of Object.entries(TC_MAP))o[k]=T[v];return o;}
const TDESC={
  EV:"Eleges lo facil en vez de lo importante.",
  EN:"No es pereza. Es desgaste real.",
  CO:"No tenes claro el primer paso.",
  RE:"Sabes que hacer. No queres.",
  ANS:"El miedo a fallar te paraliza antes de arrancar.",
  PERF:"Preferis no empezar a hacerlo imperfecto.",
  SOB:"Tenes tanto encima que no sabes por donde entrar.",
  ABUR:"La tarea no te genera ningun interes real.",
  ESTR:"La presion externa te esta superando.",
  MOT:"No encontras un motivo real para hacerlo.",
  DIS:"Estas haciendo lo que dijiste.",
};

const INS={
  AL:{DIS:["Lo que dijiste coincide con lo que haces.","Hoy no te estas mintiendo.","Estas exactamente donde dijiste que ibas a estar.","La brecha entre lo que dijiste y lo que haces es cero.","No necesitas motivacion cuando tenes disciplina.","Alineado. El trabajo hace el trabajo.","Haces lo que dijiste. Eso ya te diferencia.","Sin excusas. Estas en lo que tenes que estar.","Pocos llegan a este punto sin trampas. Vos si."]},
  DE:{
    EV:["Sabes que hacer. Lo estas evitando activamente.","Eleges lo facil cuando importa lo dificil.","Cada minuto aca es uno que no avanzas.","La brecha entre lo que dijiste y lo que haces es maxima.","Evitar es una decision. Tambien lo es arrancar.","El scroll no resuelve nada. La tarea sigue ahi.","Estas ocupado en cosas que no importan para esquivar lo que si importa."],
    EN:["No es pereza. Es desgaste. Pero igual tenes que arrancar.","Podes estar cansado y avanzar igual.","5 minutos. Despues decides.","El cansancio no desaparece esperando.","Si realmente estas agotado, descansa de verdad. Si no, arranca.","El cuerpo pide pausa, no abandono."],
    CO:["No empezas porque no tenes claro el primer paso.","La claridad viene de hacer, no de pensar.","Un paso pequeno mal hecho vale mas que ningun paso perfecto.","No necesitas el mapa completo. Solo el siguiente paso.","La confusion se resuelve escribiendo, no pensando mas."],
    RE:["Sabes que hacer. No queres hacerlo.","No es que no podes. Es que no queres.","La resistencia no desaparece esperando.","La tarea que mas resists es la que mas importa.","No queres hacerlo. Vas a tener que hacerlo igual."],
    ANS:["El miedo a que salga mal te esta paralizando antes de arrancar.","Ansiedad y evitacion se alimentan entre si. Cortala con una accion chica.","No es que no puedas. Es que anticipas el fracaso antes de intentar.","El panico baja cuando empezas, no cuando lo pensas mas."],
    PERF:["Preferis no arrancar a arrancar imperfecto.","Nada te va a salir perfecto en el primer intento. Arranca igual.","El perfeccionismo es procrastinacion con excusa elegante.","Esperar el momento perfecto es una forma de nunca empezar."],
    SOB:["Tenes tanto encima que ninguna tarea avanza.","La sobrecarga paraliza mas que la pereza.","No necesitas terminar todo hoy. Necesitas elegir una sola cosa.","Cuando todo es prioridad, nada lo es."],
    ABUR:["La tarea no te interesa y por eso la postergas.","El aburrimiento tambien es una forma de evitar.","No hace falta que te apasione. Hace falta que la termines.","Lo aburrido no se vuelve interesante esperando. Se termina y listo."],
    ESTR:["La presion te esta ganando antes de arrancar.","El estres no se resuelve evitando la tarea. Se acumula mas.","Demasiada presion externa y ninguna accion. Hay que cortar el ciclo.","No es que no puedas. Es que la presion te esta bloqueando."],
    MOT:["No le encontras sentido y por eso no arrancas.","La motivacion no aparece antes de empezar. Aparece despues.","No necesitas ganas. Necesitas el primer minuto.","Esperar sentir motivacion es la trampa mas comun para no hacer nada."],
  },
};
const ACC={
  DIS:["Segui. No rompas el ritmo.","Termina lo que empezaste."],
  EV:["Cerra eso. Abri lo que importa.","5 minutos en la tarea ahora."],
  EN:["5 minutos y evaluas.","Empieza por la parte mas facil."],
  CO:["Escribe el primer paso, solo uno.","Define que significa terminar esto."],
  RE:["Hacelo aunque no quieras.","Arranca ahora. 30 segundos."],
  ANS:["Hace la version mas chica posible de la tarea.","Poné un timer de 5 minutos. Sin pensar, solo empezar."],
  PERF:["Hace una version fea primero. Despues mejoras.","Date permiso de hacerlo mal la primera vez."],
  SOB:["Elegi una sola cosa. Las demas esperan.","Escribi todo lo que tenes encima y tacha lo que no es hoy."],
  ABUR:["Poné musica y hacela igual, 10 minutos.","Convertilo en un desafio de tiempo: 5 minutos, a ver que avanzas."],
  ESTR:["Respira 3 veces y arranca por lo mas urgente.","Bajá la presion: solo el primer paso, no la tarea entera."],
  MOT:["No esperes ganas. Arranca 2 minutos y evalua.","Recorda por que empezaste esto en primer lugar."],
};
const EMO={
  DIS:["claridad y foco","presencia"],
  EV:["evasion","miedo disfrazado"],
  EN:["desgaste real","fatiga"],
  CO:["paralisis","confusion"],
  RE:["resistencia","rechazo"],
  ANS:["miedo al fracaso","anticipacion ansiosa"],
  PERF:["perfeccionismo","miedo a fallar en publico"],
  SOB:["sobrecarga","saturacion"],
  ABUR:["desinteres","falta de estimulo"],
  ESTR:["presion externa","tension acumulada"],
  MOT:["falta de proposito","vacio motivacional"],
};

function pick(arr,prev=[]){
  const f=arr.filter(x=>!prev.includes(x));
  if(f.length)return f[Math.floor(Math.random()*f.length)];
  const f2=arr.filter(x=>x!==prev[0]);
  const pool=f2.length?f2:arr;
  return pool[Math.floor(Math.random()*pool.length)];
}
function localDx(answers,data){
  const q1=answers[0]||"",q2=answers[1]||"";
  const prev=(data.history||[]).slice(0,8).map(h=>h.insight);
  if(esAlineado(q1,q2))return{estado:"ALINEADO",tipo:"DIS",insight:pick(INS.AL.DIS,prev),accion:pick(ACC.DIS),emocion:pick(EMO.DIS)};
  const estado="DESALINEADO",tipo=detectTipoPro(answers);
  return{estado,tipo,insight:pick(INS.DE[tipo]||INS.DE.EV,prev),accion:pick(ACC[tipo]||ACC.EV),emocion:pick(EMO[tipo]||EMO.EV)};
}
async function callAI(answers,data){await new Promise(r=>setTimeout(r,900+Math.random()*300));return localDx(answers,data);}

const Q1=["Que dijiste que ibas a hacer?","Que estas evitando ahora mismo?","Que sabes que deberias estar haciendo?","Que estas posponiendo hoy?"];
const Q2=["Que estas haciendo en vez de eso?","En que se te fue el tiempo?","Que elegiste hacer en lugar de eso?","Que estas haciendo realmente ahora?"];
const QEXT=["Como te sentis con esa tarea?","Que pasa si no la terminas hoy?","Hay algo distrayendote?","Cuando fue tu ultimo avance real?"];
const QDAY="Ayer fue un dia normal?";
const TQ=7,DAYIDX=6;
function pQ(arr,last){const f=arr.filter(x=>x!==last);return f[Math.floor(Math.random()*f.length)]||arr[0];}
function buildQs(lq=[]){return[pQ(Q1,lq[0]),pQ(Q2,lq[1]),QEXT[0],QEXT[1],QEXT[2],QEXT[3],QDAY];}

function getContrato(data){const c=data.contrato;if(!c||c.dk!==dKey())return null;return c;}

// Logros
const LOGROS_DEF={
  primera_vez:{titulo:"Primera vez",desc:"Completaste tu primer check-in",ico:"check",check:(d)=>d.checkins>=1},
  primera_alineado:{titulo:"Primer alineado",desc:"Primer diagnostico ALINEADO",ico:"star",check:(d)=>d.history.some(h=>h.estado==="ALINEADO")},
  tres_dias:{titulo:"Racha x3",desc:"3 dias activos seguidos",ico:"flame",check:(d)=>(d.activeDays||0)>=3},
  siete_dias:{titulo:"Semana completa",desc:"7 dias activos seguidos",ico:"trophy",check:(d)=>(d.activeDays||0)>=7},
  diez_checks:{titulo:"Modo rapido",desc:"10 check-ins desbloqueados",ico:"bolt",check:(d)=>d.checkins>=10},
  score_positivo:{titulo:"Score positivo",desc:"Score positivo por primera vez",ico:"up",check:(d)=>d.score>0},
  score_50:{titulo:"Score 50+",desc:"Score de 50 o mas",ico:"target",check:(d)=>d.score>=50},
  dia_perfecto:{titulo:"Dia perfecto",desc:"Todos los checks del dia ALINEADOS",ico:"zap",check:(d,ts)=>ts&&ts.pct===100&&ts.total>=2},
  zona:{titulo:"En zona",desc:"3 ALINEADOS seguidos hoy",ico:"layers",check:(d)=>(d.zonaCount||0)>=3},
  treinta_checks:{titulo:"Constancia",desc:"30 check-ins totales",ico:"clock",check:(d)=>d.checkins>=30},
  cincuenta_checks:{titulo:"???",ico:"star",oculto:true,check:(d)=>d.checkins>=50,titulo_real:"Veterano",desc_real:"50 check-ins."},
  contrato_x3:{titulo:"???",ico:"bolt",oculto:true,check:(d)=>(d.contratoHistory||[]).length>=3,titulo_real:"Palabra cumplida",desc_real:"3 contratos cumplidos."},
  cinco_seguidos:{titulo:"???",ico:"layers",oculto:true,check:(d)=>{const h=d.history||[];if(h.length<5)return false;return h.slice(0,5).every(x=>x.estado==="ALINEADO");},titulo_real:"Racha perfecta",desc_real:"5 ALINEADOS consecutivos."},
  adn_desbloqueado:{titulo:"???",ico:"target",oculto:true,check:(d)=>d.checkins>=15,titulo_real:"Autoconciencia",desc_real:"15 check-ins. Ya tenes suficiente historial para ver tu patron real."},
};

function checkLogros(data,ts){
  const nuevos=[];const logros={...(data.logros||{})};
  Object.entries(LOGROS_DEF).forEach(([k,v])=>{if(!logros[k]&&v.check(data,ts)){logros[k]=Date.now();nuevos.push({...v,id:k});}});
  return{logros,nuevos};
}

const ICO={
  check:"M2 8l4 4 8-8",star:"M8 2l1.6 3.3L13 6l-2.5 2.5.6 3.5L8 10.4 5 12l.6-3.5L3 6l3.4-.7z",
  flame:"M8 2s2.5 3.5 1 6c1.5-1 2-2.5 1.5-5C12 5 13 8 11 11s-3 2-4 1c1.5 0 2.5-1.5 1.5-3-.5 1.5-2 1-2-0.5 0 2.5-1.5 3-.5 5a3.5 3.5 0 007 0C13 8 8 2 8 2z",
  trophy:"M4 2h8v5a4 4 0 01-8 0V2zM2 3h2M12 3h2M6 11v2M10 11v2M5 13h6",
  bolt:"M9 1L4 9h4l-1 6 7-8h-4z",up:"M2 11h12M8 11V3M4 7l4-4 4 4",
  target:"M14 8A6 6 0 112 8a6 6 0 0112 0zM11 8a3 3 0 11-6 0 3 3 0 016 0zm-1.5 0a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z",
  layers:"M8 1L1 5l7 4 7-4-7-4zM1 9l7 4 7-4M1 12l7 4 7-4",
  clock:"M8 1a7 7 0 100 14A7 7 0 008 1zM8 4v4l3 2",
  zap:"M13 2L8 9h4l-5 6 8-9H11z",back:"M10 2L4 8l6 6",close:"M2 2l12 12M14 2L2 14",home:"M1 7l7-6 7 6M2 7v7h4v-4h4v4h4V7",hist:"M2 4h12M2 8h8M2 12h10",award:"M8 1l1.6 3.3L13 6l-2.5 2.5.6 3.5L8 10.4 5 12l.6-3.5L3 6l3.4-.7zM6 14v-3M10 14v-3",
  trash:"M3 4h10M6 4V2.5a1 1 0 011-1h2a1 1 0 011 1V4M4.5 4l.6 9a1 1 0 001 .9h3.8a1 1 0 001-.9l.6-9",
  alert:"M8 1.5L1 14h14L8 1.5zM8 6v4M8 11.5h.01",
};

function SvgIco({d,color=T.DARK,size=16,stroke=1.5}){
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>;
}

// ─── BOTTOM NAV ───────────────────────────────────────────────────────────────
function BottomNav({active,onNav}){
  const items=[
    {id:"home",ico:ICO.home,label:"Inicio"},
    {id:"history",ico:ICO.hist,label:"Historial"},
    {id:"logros",ico:ICO.award,label:"Logros"},
  ];
  return(
    <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:T.CARD,borderTop:"1px solid "+T.LINE,display:"flex",zIndex:90,paddingBottom:"env(safe-area-inset-bottom,0)"}}>
      {items.map(({id,ico,label})=>(
        <button key={id} onClick={()=>onNav(id)} style={{flex:1,padding:"12px 0 10px",background:"transparent",border:"none",display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer",transition:"all 0.15s"}}>
          <SvgIco d={ico} color={active===id?T.DARK:T.DIM} size={20} stroke={active===id?2:1.5}/>
          <span style={{fontFamily:SANS,fontSize:10,fontWeight:active===id?800:600,color:active===id?T.DARK:T.DIM,letterSpacing:0.2}}>{label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── TOP BAR ─────────────────────────────────────────────────────────────────
function TopBar({title,onBack,right,slim=false}){
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:slim?"14px 20px":"52px 20px 14px",background:T.BG,position:"sticky",top:0,zIndex:10}}>
      {onBack?(
        <button onClick={onBack} style={{width:36,height:36,borderRadius:12,background:T.CARD,boxShadow:T.SHA,border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
          <SvgIco d={ICO.back} color={T.DARK} size={16}/>
        </button>
      ):<div style={{width:36}}/>}
      <span style={{fontFamily:SANS,fontSize:16,fontWeight:800,color:T.DARK,letterSpacing:-0.4}}>{title}</span>
      {right||<div style={{width:36}}/>}
    </div>
  );
}

// ─── SCORE BAR ────────────────────────────────────────────────────────────────
// ─── COUNTDOWN — cuenta regresiva hasta medianoche para "racha en riesgo" ─────
function useTimeLeft(){
  const calc=()=>{
    const now=new Date();
    const end=new Date(now);
    end.setHours(24,0,0,0);
    const ms=end-now;
    const h=Math.floor(ms/3600000);
    const m=Math.floor((ms%3600000)/60000);
    return{h,m};
  };
  const[t,setT]=useState(calc);
  useEffect(()=>{const iv=setInterval(()=>setT(calc()),30000);return()=>clearInterval(iv);},[]);
  return t;
}
function RachaCountdown({dias}){
  const{h,m}=useTimeLeft();
  const urgente=h<3;
  return(
    <div style={{background:T.NEG+(urgente?"1A":"12"),borderRadius:R,padding:"14px 16px",display:"flex",alignItems:"center",gap:10,border:"1px solid "+T.NEG+(urgente?"40":"20")}}>
      <SvgIco d={ICO.clock} color={T.NEG} size={16}/>
      <div style={{flex:1}}>
        <p style={{margin:"0 0 2px",fontSize:13,color:T.DARK,fontWeight:700}}>No hiciste ningun check-in hoy</p>
        <p style={{margin:0,fontSize:12,color:T.NEG,fontWeight:600}}>{dias>=1?"Racha de "+dias+" dias en riesgo — ":""}quedan {h}h {m}min antes de perderla</p>
      </div>
    </div>
  );
}

function ScoreBar({score}){
  const[mt,setMt]=useState(false);
  useEffect(()=>{const t=setTimeout(()=>setMt(true),80);return()=>clearTimeout(t);},[]);
  const pct=Math.max(0.5,Math.min(99.5,((score-SMIN)/(SMAX-SMIN))*100));
  const sp=Math.max(0.5,Math.min(99.5,((0-SMIN)/(SMAX-SMIN))*100));
  const dp=mt?pct:sp;
  return(
    <div style={{paddingTop:4}}>
      <div style={{height:4,borderRadius:2,background:T.LINE,position:"relative",overflow:"visible"}}>
        <div style={{position:"absolute",inset:0,borderRadius:2,background:"linear-gradient(to right,"+T.NEG+","+T.AMB+","+T.POS+")"}}/>
        <div style={{position:"absolute",top:"50%",left:dp+"%",transform:"translate(-50%,-50%)",width:14,height:14,borderRadius:"50%",background:T.CARD,border:"2.5px solid "+sCol(score),boxShadow:"0 2px 8px rgba(0,0,0,0.15)",transition:"left 0.8s cubic-bezier(0.4,0,0.2,1)"}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
        <span style={{fontFamily:MONO,fontSize:9,color:T.DIM}}>{SMIN}</span>
        <span style={{fontFamily:MONO,fontSize:9,color:T.DIM}}>0</span>
        <span style={{fontFamily:MONO,fontSize:9,color:T.DIM}}>+{SMAX}</span>
      </div>
    </div>
  );
}

// ─── MINI CHART ───────────────────────────────────────────────────────────────
function MiniChart({history}){
  const pts=history.slice(0,14).reverse().map(h=>h.score);
  if(pts.length<3)return null;
  const W=280,H=44,mn=-30,mx=100;
  const x=i=>Math.round((i/(pts.length-1))*W);
  const y=v=>Math.round(H-((v-mn)/(mx-mn))*H);
  const last=pts[pts.length-1];
  const lc=sCol(last);
  const area="M "+pts.map((v,i)=>x(i)+","+y(v)).join(" L ")+" L "+x(pts.length-1)+","+H+" L 0,"+H+" Z";
  const line="M "+pts.map((v,i)=>x(i)+","+y(v)).join(" L ");
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
        <span style={{fontFamily:MONO,fontSize:9,color:T.DIM}}>Ultimos {pts.length} checks</span>
        <span style={{fontFamily:MONO,fontSize:9,color:lc,fontWeight:700}}>{last>0?"+":""}{last}</span>
      </div>
      <svg width="100%" viewBox={"0 0 "+W+" "+H} style={{display:"block",overflow:"visible"}}>
        <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={lc} stopOpacity="0.15"/><stop offset="100%" stopColor={lc} stopOpacity="0"/></linearGradient></defs>
        <line x1="0" y1={y(0)} x2={W} y2={y(0)} stroke={T.LINE} strokeWidth="1"/>
        <path d={area} fill="url(#cg)"/>
        <path d={line} fill="none" stroke={lc} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx={x(pts.length-1)} cy={y(last)} r="4" fill={T.CARD} stroke={lc} strokeWidth="2"/>
      </svg>
    </div>
  );
}

// ─── TOAST LOGRO ─────────────────────────────────────────────────────────────
function LogroToast({logro,onDone}){
  const[v,setV]=useState(false);
  useEffect(()=>{setV(true);const t=setTimeout(()=>{setV(false);setTimeout(onDone,400)},3500);return()=>clearTimeout(t);},[]);
  return(
    <div style={{position:"fixed",top:60,left:"50%",zIndex:300,maxWidth:340,width:"calc(100% - 32px)",background:T.CARD,borderRadius:16,padding:"14px 16px",boxShadow:T.SHA2,opacity:v?1:0,transform:v?"translateX(-50%) translateY(0)":"translateX(-50%) translateY(-12px)",transition:"all 0.35s cubic-bezier(0.16,1,0.3,1)"}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:38,height:38,borderRadius:11,background:T.CARD2,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <SvgIco d={ICO[logro.ico]||ICO.check} color={T.DARK} size={18} stroke={2}/>
        </div>
        <div>
          <p style={{margin:"0 0 1px",fontFamily:MONO,fontSize:8,color:T.DARK,letterSpacing:"0.12em",fontWeight:700}}>LOGRO DESBLOQUEADO</p>
          <p style={{margin:"0 0 2px",fontFamily:SANS,fontSize:14,fontWeight:800,color:T.DARK}}>{logro.titulo_real||logro.titulo}</p>
          <p style={{margin:0,fontSize:12,color:T.MID}}>{logro.desc_real||logro.desc}</p>
        </div>
      </div>
    </div>
  );
}

// ─── CONFETTI ────────────────────────────────────────────────────────────────
function Confetti(){
  const colors=[T.LIMA,T.POS,"#FCD34D","#FFFFFF",T.AMB];
  const pieces=Array.from({length:20},(_,i)=>({id:i,color:colors[i%colors.length],left:5+Math.random()*90,delay:Math.random()*0.6,dur:0.8+Math.random()*0.7,size:3+Math.random()*5,rot:Math.random()*360}));
  return(
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:200,overflow:"hidden"}}>
      {pieces.map(p=><div key={p.id} style={{position:"absolute",left:p.left+"%",top:"-8px",width:p.size,height:p.size,background:p.color,borderRadius:p.size>5?"50%":"1px",animation:"confetti "+p.dur+"s "+p.delay+"s ease-in forwards"}}/>)}
    </div>
  );
}

// ─── SPLASH ───────────────────────────────────────────────────────────────────
function Splash({onDone}){
  const[v,setV]=useState(0);
  useEffect(()=>{const t1=setTimeout(()=>setV(1),80);const t2=setTimeout(()=>setV(2),1600);const t3=setTimeout(()=>onDone(),2200);return()=>{clearTimeout(t1);clearTimeout(t2);clearTimeout(t3);};},[]);
  return(
    <div style={{position:"fixed",inset:0,background:T.BG,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:1000,opacity:v===2?0:1,transition:"opacity 0.5s ease"}}>
      <div style={{opacity:v>=1?1:0,transform:v>=1?"translateY(0)":"translateY(16px)",transition:"all 0.6s cubic-bezier(0.16,1,0.3,1)",textAlign:"center"}}>
        <div style={{width:80,height:80,borderRadius:24,background:"#141414",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",boxShadow:T.SHA2}}>
          <span style={{fontFamily:SANS,fontSize:36,fontWeight:800,color:"#FFFFFF",letterSpacing:-2}}>F</span>
        </div>
        <p style={{margin:"0 0 6px",fontFamily:SANS,fontSize:28,fontWeight:800,color:T.DARK,letterSpacing:-1}}>FOCO</p>
        <p style={{margin:0,fontFamily:MONO,fontSize:10,color:T.DIM,letterSpacing:"0.14em"}}>DIAGNOSTICO PERSONAL</p>
      </div>
    </div>
  );
}

// ─── LOADER ───────────────────────────────────────────────────────────────────
function DxLoader({onDone}){
  const msgs=["Analizando respuestas","Detectando patrones","Preparando diagnostico"];
  const[i,setI]=useState(0);
  useEffect(()=>{const t1=setTimeout(()=>setI(1),900);const t2=setTimeout(()=>setI(2),1800);const t3=setTimeout(()=>onDone(),2600);return()=>{clearTimeout(t1);clearTimeout(t2);clearTimeout(t3);};},[]);
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,background:T.BG}}>
      <div style={{width:48,height:48,borderRadius:14,background:T.CARD,boxShadow:T.SHA,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <svg width="24" height="24" viewBox="0 0 24 24" style={{animation:"spin 1.2s linear infinite"}}>
          <circle cx="12" cy="12" r="10" fill="none" stroke={T.LINE} strokeWidth="2.5"/>
          <path d="M12 2a10 10 0 0 1 10 10" fill="none" stroke={T.DARK} strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </div>
      <p style={{margin:0,fontFamily:MONO,fontSize:11,color:T.DIM,letterSpacing:"0.08em"}}>{msgs[i]}...</p>
    </div>
  );
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
function Onboarding({onDone}){
  const[s,setS]=useState(0);
  const slides=[
    {title:"Cuantas veces hoy dijiste que ibas a hacer algo y no lo hiciste?",sub:"No hace falta responder. Ya sabes la respuesta.",btn:"Continuar"},
    {title:"No fallas por falta de disciplina. Fallas porque eleges lo facil cuando importa lo dificil.",sub:"Todos lo hacemos. La diferencia es quien lo reconoce.",btn:"Continuar"},
    {title:"Esto te va a mostrar la verdad. Aunque no te guste.",sub:"7 preguntas · 1 minuto · sin rodeos",btn:"Empezar"},
  ];
  const sl=slides[s];
  return(
    <div style={{minHeight:"100dvh",display:"flex",flexDirection:"column",background:T.BG,fontFamily:SANS}}>
      <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"space-between",padding:"64px 28px 52px"}}>
        <div>
          <div style={{display:"flex",gap:6,marginBottom:48}}>
            {slides.map((_,i)=><div key={i} style={{height:3,flex:1,background:i<=s?T.DARK:T.LINE,borderRadius:2,transition:"background 0.3s"}}/>)}
          </div>
          <p style={{margin:"0 0 4px",fontFamily:MONO,fontSize:9,color:T.DIM,letterSpacing:"0.16em"}}>0{s+1} / 03</p>
          <h1 style={{margin:"0 0 16px",fontSize:26,fontWeight:800,letterSpacing:-0.8,lineHeight:1.25,color:T.DARK}}>{sl.title}</h1>
          <p style={{margin:0,fontSize:14,color:T.MID,lineHeight:1.8}}>{sl.sub}</p>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <button style={{width:"100%",padding:"16px",background:T.DARK,color:T.ON_DARK,border:"none",borderRadius:R,fontFamily:SANS,fontSize:15,fontWeight:800,cursor:"pointer",boxShadow:T.SHA2}} onClick={()=>s<2?setS(x=>x+1):onDone()}>{sl.btn}</button>
          <button style={{width:"100%",padding:"12px",background:"transparent",color:T.DIM,border:"none",fontFamily:MONO,fontSize:11,letterSpacing:"0.08em",cursor:"pointer"}} onClick={onDone}>Saltar</button>
        </div>
      </div>
    </div>
  );
}

// ─── POMODORO ─────────────────────────────────────────────────────────────────
function Pomodoro({onClose,color}){
  const T=25*60;const[s,setS]=useState(T);const[on,setOn]=useState(true);const r=useRef();
  useEffect(()=>{if(on&&s>0){r.current=setInterval(()=>setS(x=>x-1),1000);}else clearInterval(r.current);return()=>clearInterval(r.current);},[on,s]);
  const mm=String(Math.floor(s/60)).padStart(2,"0"),ss2=String(s%60).padStart(2,"0");
  const col=color||T.DARK;
  return(
    <div style={{background:T.CARD,borderRadius:R,padding:"18px",boxShadow:T.SHA}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <span style={{fontFamily:MONO,fontSize:9,color:T.DARK,letterSpacing:"0.12em",fontWeight:700}}>POMODORO</span>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer"}}><SvgIco d={ICO.close} color={T.DIM} size={14}/></button>
      </div>
      {s===0?<p style={{fontFamily:SANS,color:col,fontSize:15,fontWeight:700,textAlign:"center",margin:"10px 0"}}>25 minutos completados.</p>:<>
        <p style={{margin:"0 0 14px",fontFamily:MONO,fontSize:42,fontWeight:700,color:T.DARK,textAlign:"center",letterSpacing:-1,fontVariantNumeric:"tabular-nums",lineHeight:1}}>{mm}:{ss2}</p>
        <div style={{height:4,background:T.LINE,borderRadius:2,marginBottom:16,overflow:"hidden"}}><div style={{height:4,width:((T-s)/T*100)+"%",background:col,transition:"width 1s linear",borderRadius:2}}/></div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setOn(x=>!x)} style={{flex:1,padding:"12px",background:T.DARK,color:T.ON_DARK,border:"none",borderRadius:R-4,fontFamily:SANS,fontSize:13,fontWeight:700,cursor:"pointer"}}>{on?"Pausar":"Continuar"}</button>
          <button onClick={()=>{setS(T);setOn(false);}} style={{padding:"12px 16px",background:T.CARD2,color:T.MID,border:"none",borderRadius:R-4,fontFamily:MONO,fontSize:11,cursor:"pointer"}}>RESET</button>
        </div>
      </>}
    </div>
  );
}

// ─── FEEDBACK ─────────────────────────────────────────────────────────────────
function Feedback({onFb}){
  const[done,setDone]=useState(false);
  if(done)return <p style={{margin:0,fontFamily:MONO,fontSize:10,color:T.DIM,textAlign:"center"}}>Registrado.</p>;
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px",background:T.CARD,borderRadius:R,boxShadow:T.SHA}}>
      <span style={{fontSize:13,color:T.DARK,fontWeight:600}}>El diagnostico fue acertado?</span>
      <div style={{display:"flex",gap:8}}>
        {[{l:"SI",v:"up"},{l:"NO",v:"close"}].map(({l,v})=>(
          <button key={l} onClick={()=>{onFb(l);setDone(true);}} style={{background:T.CARD2,border:"none",borderRadius:8,padding:"7px 14px",display:"flex",alignItems:"center",gap:5,cursor:"pointer"}}>
            <SvgIco d={ICO[v]} color={T.MID} size={12}/><span style={{fontFamily:MONO,fontSize:10,color:T.MID,letterSpacing:"0.06em"}}>{l}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── SHARE ────────────────────────────────────────────────────────────────────
function ShareSheet({result,score,onClose}){
  const[cap,setCap]=useState(false);const[copied,setCopied]=useState(false);
  const ref=useRef();
  const txt=result.estado==="ALINEADO"?"Hoy hice lo que dije que iba a hacer. foco.app":"Sabia lo que tenia que hacer... y no lo hice. foco.app";
  const copy=()=>{navigator.clipboard?.writeText(txt);setCopied(true);setTimeout(()=>setCopied(false),2000);};
  const shareImg=async()=>{
    setCap(true);
    try{
      if(!window.html2canvas){await new Promise((res,rej)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";s.onload=res;s.onerror=rej;document.head.appendChild(s);});}
      const cv=await window.html2canvas(ref.current,{backgroundColor:T.BG,scale:2,useCORS:true,logging:false});
      const blob=await new Promise(r=>cv.toBlob(r,"image/png",0.95));
      const file=new File([blob],"foco.png",{type:"image/png"});
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]}))await navigator.share({files:[file],text:txt});
      else{const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download="foco.png";document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);}
    }catch{copy();}finally{setCap(false);}
  };
  const rc=result.estado==="ALINEADO"?T.POS:T.NEG;
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"flex-end",backdropFilter:"blur(4px)"}} onClick={onClose}>
      <div style={{width:"100%",maxWidth:430,margin:"0 auto",background:T.BG,borderRadius:"20px 20px 0 0",padding:"20px 20px 52px"}} onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,background:T.LINE,borderRadius:2,margin:"0 auto 20px"}}/>
        <div ref={ref} style={{background:T.CARD,borderRadius:R,padding:"20px",marginBottom:14,boxShadow:T.SHA}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
            <span style={{fontFamily:SANS,fontSize:15,fontWeight:800,color:T.DARK}}>FOCO</span>
            <span style={{fontFamily:MONO,fontSize:10,color:T.DIM}}>{new Date().toLocaleDateString("es-AR")}</span>
          </div>
          <p style={{margin:"0 0 3px",fontFamily:MONO,fontSize:8,color:T.DIM,letterSpacing:"0.1em"}}>DIAGNOSTICO</p>
          <p style={{margin:"0 0 10px",fontFamily:SANS,fontSize:28,fontWeight:800,color:rc,letterSpacing:-1,lineHeight:1}}>{result.estado}</p>
          <p style={{margin:"0 0 16px",fontFamily:SANS,fontSize:13,color:T.DARK,lineHeight:1.6}}>{result.insight}</p>
          <div style={{borderTop:"1px solid "+T.LINE,paddingTop:14,display:"flex",justifyContent:"space-between"}}>
            <div><p style={{margin:0,fontFamily:MONO,fontSize:8,color:T.DIM}}>SCORE</p><p style={{margin:"3px 0 0",fontFamily:SANS,fontSize:20,fontWeight:700,color:sCol(score)}}>{score}</p></div>
            <p style={{margin:0,fontFamily:MONO,fontSize:9,color:T.DIM,alignSelf:"flex-end"}}>foco.app</p>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          {[{l:"WhatsApp",f:()=>window.open("https://wa.me/?text="+encodeURIComponent(txt),"_blank")},{l:"Twitter",f:()=>window.open("https://twitter.com/intent/tweet?text="+encodeURIComponent(txt),"_blank")},{l:"Imagen",f:shareImg},{l:copied?"Copiado":"Copiar",f:copy}].map(({l,f})=>(
            <button key={l} onClick={f} style={{padding:"12px",background:T.CARD,border:"none",borderRadius:12,color:T.MID,fontFamily:MONO,fontSize:10,letterSpacing:"0.06em",cursor:"pointer",boxShadow:T.SHA}}>{l}</button>
          ))}
        </div>
        <button onClick={shareImg} disabled={cap} style={{width:"100%",padding:"15px",background:T.DARK,color:T.ON_DARK,border:"none",borderRadius:R,fontFamily:SANS,fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:T.SHA2,opacity:cap?0.7:1}}>{cap?"Generando...":"Compartir con imagen"}</button>
      </div>
    </div>
  );
}

// ─── CONTRATO MODAL ───────────────────────────────────────────────────────────
function ContratoModal({data,onSave,onClose}){
  const[tarea,setTarea]=useState("");
  const inp2=useRef();
  useEffect(()=>{setTimeout(()=>inp2.current?.focus(),100);},[]);
  const c=getContrato(data);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"flex-end",backdropFilter:"blur(4px)"}} onClick={onClose}>
      <div style={{width:"100%",maxWidth:430,margin:"0 auto",background:T.BG,borderRadius:"20px 20px 0 0",padding:"24px 20px 52px"}} onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,background:T.LINE,borderRadius:2,margin:"0 auto 20px"}}/>
        <p style={{margin:"0 0 4px",fontFamily:MONO,fontSize:9,color:T.DIM,letterSpacing:"0.14em"}}>CONTRATO DIARIO</p>
        <p style={{margin:"0 0 6px",fontFamily:SANS,fontSize:20,fontWeight:800,color:T.DARK}}>Tu UNA tarea de hoy</p>
        <p style={{margin:"0 0 20px",fontSize:13,color:T.MID,lineHeight:1.6}}>Una sola. La mas importante. Si no la haces, el dia fue un fracaso.</p>
        {c?(
          <div style={{background:T.CARD,borderRadius:R,padding:"16px",marginBottom:16,boxShadow:T.SHA}}>
            <p style={{margin:"0 0 4px",fontFamily:MONO,fontSize:9,color:T.POS,letterSpacing:"0.1em"}}>CONTRATO ACTIVO</p>
            <p style={{margin:0,fontFamily:SANS,fontSize:16,fontWeight:700,color:T.DARK}}>{c.tarea}</p>
          </div>
        ):(
          <>
            <input ref={inp2} value={tarea} onChange={e=>setTarea(e.target.value)} onKeyDown={e=>e.key==="Enter"&&tarea.trim()&&onSave(tarea.trim())}
              style={{width:"100%",background:T.CARD,border:"2px solid "+(tarea.trim()?T.DARK:T.LINE),borderRadius:R,padding:"14px 16px",fontSize:15,color:T.DARK,fontFamily:SANS,outline:"none",marginBottom:12,transition:"border-color 0.15s",boxSizing:"border-box",boxShadow:T.SHA}}
              placeholder="ej: terminar el informe de ventas"/>
            <button onClick={()=>tarea.trim()&&onSave(tarea.trim())} disabled={!tarea.trim()} style={{width:"100%",padding:"15px",background:tarea.trim()?T.DARK:"transparent",color:tarea.trim()?T.ON_DARK:T.DIM,border:"2px solid "+(tarea.trim()?T.DARK:T.LINE),borderRadius:R,fontFamily:SANS,fontSize:15,fontWeight:800,cursor:tarea.trim()?"pointer":"default",transition:"all 0.15s",boxShadow:tarea.trim()?T.SHA2:"none"}}>Firmar contrato</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── RESUMEN SEMANAL — modal con el dia por dia de la semana ─────────────────
function ResumenSemanal({data,onClose}){
  const r=buildResumenSemanal(data);
  if(!r)return null;
  const hoy=DIAS_ORDEN[new Date().getDay()===0?6:new Date().getDay()-1];
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"flex-end",backdropFilter:"blur(4px)"}} onClick={onClose}>
      <div style={{width:"100%",maxWidth:430,margin:"0 auto",background:T.BG,borderRadius:"20px 20px 0 0",padding:"20px 20px 52px",maxHeight:"88dvh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,background:T.LINE,borderRadius:2,margin:"0 auto 20px"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div>
            <p style={{margin:"0 0 4px",fontFamily:MONO,fontSize:9,color:T.DIM,letterSpacing:"0.14em"}}>RESUMEN SEMANAL</p>
            <p style={{margin:0,fontFamily:SANS,fontSize:20,fontWeight:800,color:T.DARK}}>Tu semana en detalle</p>
          </div>
          <button onClick={onClose} style={{background:T.CARD,border:"none",borderRadius:10,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",boxShadow:T.SHA}}>
            <SvgIco d={ICO.close} color={T.MID} size={14}/>
          </button>
        </div>

        {/* Card resumen general */}
        <div style={{background:"#141414",borderRadius:R,padding:"18px",marginBottom:14,boxShadow:T.SHA2}}>
          <p style={{margin:"0 0 6px",fontFamily:MONO,fontSize:9,color:"rgba(255,255,255,0.6)",letterSpacing:"0.1em"}}>EN GENERAL FUISTE</p>
          <p style={{margin:"0 0 10px",fontFamily:SANS,fontSize:26,fontWeight:800,color:"#C8FF00",letterSpacing:-1,textTransform:"capitalize"}}>{r.adjSemana}</p>
          <p style={{margin:0,fontSize:13,color:"rgba(255,255,255,0.75)",lineHeight:1.6}}>{r.pctAlSemana}% alineado esta semana, con {r.totalChecks} check-ins en {r.diasConDatos} dias distintos.</p>
        </div>

        {/* Dia por dia */}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {r.dias.map(d=>(
            <div key={d.dia} style={{background:d.dia===hoy?T.CARD:(d.sinDatos?"transparent":T.CARD),borderRadius:R,padding:"14px 16px",boxShadow:d.sinDatos?"none":T.SHA,border:d.dia===hoy?"1.5px solid "+T.DARK:d.sinDatos?"1px dashed "+T.LINE:"none",opacity:d.sinDatos?0.5:1,display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:44,textAlign:"center",flexShrink:0}}>
                <p style={{margin:0,fontFamily:MONO,fontSize:10,color:T.DIM,letterSpacing:"0.06em",fontWeight:d.dia===hoy?800:400}}>{d.dia.toUpperCase()}</p>
              </div>
              <div style={{width:1,alignSelf:"stretch",background:T.LINE}}/>
              {d.sinDatos?(
                <p style={{margin:0,fontSize:12,color:T.DIM,flex:1}}>Sin check-ins</p>
              ):(
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <span style={{fontFamily:SANS,fontSize:14,fontWeight:700,color:getTC()[d.tipo]||T.DARK,textTransform:"capitalize"}}>{d.adj}</span>
                    <span style={{fontFamily:MONO,fontSize:9,color:T.DIM}}>{d.pctAl}% alineado</span>
                  </div>
                  <p style={{margin:0,fontSize:12,color:T.MID,lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.insight}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MODO TESTIGO — reporte semanal para mandarle a OTRA persona ─────────────
// A diferencia del Resumen Semanal (introspectivo, para vos), esto es un
// informe objetivo en tercera persona, pensado para que alguien mas te pida
// cuentas. El accountability externo es mas efectivo que cualquier mecanica
// de gamificacion interna.
function getWeekRange(){
  const ws=getWS();const we=new Date(ws);we.setDate(we.getDate()+6);
  const fmt=d=>new Date(d).toLocaleDateString("es-AR",{day:"numeric",month:"short"});
  return fmt(ws)+" al "+fmt(we);
}
function buildTestigo(data){
  const wh=data.weekHistory||[];
  if(wh.length<3)return null;
  const total=wh.length;
  const alineados=wh.filter(h=>h.estado==="ALINEADO").length;
  const pct=Math.round(alineados/total*100);
  const porDia={};
  wh.forEach(h=>{if(!porDia[h.day])porDia[h.day]={al:0,tot:0};if(h.estado==="ALINEADO")porDia[h.day].al++;porDia[h.day].tot++;});
  const diasArr=Object.entries(porDia).filter(([,v])=>v.tot>=1).map(([d,v])=>({d,pct:Math.round(v.al/v.tot*100)}));
  const mejorDia=diasArr.length?diasArr.sort((a,b)=>b.pct-a.pct)[0].d:null;
  const peorDia=diasArr.length>1?diasArr.sort((a,b)=>a.pct-b.pct)[0].d:null;
  const patron=detectPatron(wh)||"Sin datos suficientes";
  let veredicto;
  if(pct>=70)veredicto="Semana solida. Hizo lo que dijo que iba a hacer la mayoria del tiempo.";
  else if(pct>=50)veredicto="Semana mixta. Hubo intencion pero tambien evasion.";
  else if(pct>=30)veredicto="Semana dificil. El patron de evasion fue dominante.";
  else veredicto="Semana sin foco. Las promesas no se tradujeron en accion.";
  return{total,alineados,pct,patron,mejorDia,peorDia,veredicto,racha:data.activeDays||0,score:data.score||0,weekScore:data.weekScore||0};
}
function textoTestigo(t,range){
  return[
    "REPORTE TESTIGO — FOCO",
    "Semana del "+range,
    "",
    "Alineacion:   "+t.pct+"% ("+t.alineados+"/"+t.total+" checks)",
    "Score semana: "+(t.weekScore>0?"+":"")+t.weekScore,
    "Patron:       "+t.patron,
    t.mejorDia?"Mejor dia:    "+t.mejorDia:"",
    t.racha>0?"Racha activa: "+t.racha+" dias":"",
    "",
    "VEREDICTO",
    t.veredicto,
    "",
    "generado por foco.app",
  ].filter(l=>l!==undefined).join("\n");
}
function ModoTestigo({data,onClose}){
  const t=buildTestigo(data);
  const range=getWeekRange();
  const ref=useRef();
  const[copied,setCopied]=useState(false);
  const[cap,setCap]=useState(false);

  if(!t)return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"flex-end",backdropFilter:"blur(4px)"}} onClick={onClose}>
      <div style={{width:"100%",maxWidth:430,margin:"0 auto",background:T.BG,borderRadius:"20px 20px 0 0",padding:"28px 20px 52px"}} onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,background:T.LINE,borderRadius:2,margin:"0 auto 24px"}}/>
        <p style={{margin:"0 0 6px",fontFamily:MONO,fontSize:9,color:T.DIM,letterSpacing:"0.14em"}}>MODO TESTIGO</p>
        <p style={{margin:"0 0 8px",fontFamily:SANS,fontSize:20,fontWeight:800,color:T.DARK}}>Necesitas mas datos</p>
        <p style={{margin:"0 0 24px",fontSize:13,color:T.MID,lineHeight:1.6}}>El reporte se genera con 3 o mas check-ins en la semana actual.</p>
        <button onClick={onClose} style={{width:"100%",padding:"14px",background:T.CARD,border:"none",borderRadius:R,fontFamily:MONO,fontSize:11,color:T.MID,letterSpacing:"0.1em",cursor:"pointer",boxShadow:T.SHA}}>CERRAR</button>
      </div>
    </div>
  );

  const txt=textoTestigo(t,range);
  const copy=()=>{navigator.clipboard?.writeText(txt);setCopied(true);setTimeout(()=>setCopied(false),2500);};
  const shareImg=async()=>{
    setCap(true);
    try{
      if(!window.html2canvas){await new Promise((res,rej)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";s.onload=res;s.onerror=rej;document.head.appendChild(s);});}
      const cv=await window.html2canvas(ref.current,{backgroundColor:T.BG,scale:2,useCORS:true,logging:false});
      const blob=await new Promise(r=>cv.toBlob(r,"image/png",0.95));
      const file=new File([blob],"testigo.png",{type:"image/png"});
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]}))await navigator.share({files:[file],text:txt});
      else{const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download="testigo.png";document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);}
    }catch{copy();}finally{setCap(false);}
  };
  const wa=()=>window.open("https://wa.me/?text="+encodeURIComponent(txt),"_blank");
  const barColor=t.pct>=70?T.POS:t.pct>=50?T.AMB:T.NEG;

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"flex-end",backdropFilter:"blur(4px)"}} onClick={onClose}>
      <div style={{width:"100%",maxWidth:430,margin:"0 auto",background:T.BG,borderRadius:"20px 20px 0 0",padding:"20px 20px 52px",maxHeight:"92dvh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,background:T.LINE,borderRadius:2,margin:"0 auto 20px"}}/>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div>
            <p style={{margin:"0 0 2px",fontFamily:MONO,fontSize:9,color:T.DIM,letterSpacing:"0.14em"}}>MODO TESTIGO</p>
            <p style={{margin:0,fontFamily:SANS,fontSize:18,fontWeight:800,color:T.DARK}}>Reporte semanal</p>
          </div>
          <button onClick={onClose} style={{background:T.CARD,border:"none",borderRadius:10,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",boxShadow:T.SHA}}>
            <SvgIco d={ICO.close} color={T.MID} size={14}/>
          </button>
        </div>

        {/* Card para compartir / capturar */}
        <div ref={ref} style={{background:T.CARD,borderRadius:R,padding:"20px",marginBottom:16,boxShadow:T.SHA}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div>
              <p style={{margin:"0 0 2px",fontFamily:SANS,fontSize:15,fontWeight:800,color:T.DARK}}>FOCO</p>
              <p style={{margin:0,fontFamily:MONO,fontSize:9,color:T.DIM,letterSpacing:"0.06em"}}>Semana del {range}</p>
            </div>
            <div style={{textAlign:"right"}}>
              <p style={{margin:"0 0 1px",fontFamily:SANS,fontSize:22,fontWeight:800,color:barColor,lineHeight:1}}>{t.pct}%</p>
              <p style={{margin:0,fontFamily:MONO,fontSize:8,color:T.DIM,letterSpacing:"0.08em"}}>ALINEADO</p>
            </div>
          </div>

          <div style={{height:6,background:T.LINE,borderRadius:3,marginBottom:20,overflow:"hidden"}}>
            <div style={{height:6,width:t.pct+"%",background:barColor,borderRadius:3,transition:"width 0.8s ease"}}/>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:0,border:"1px solid "+T.LINE,borderRadius:10,overflow:"hidden",marginBottom:16}}>
            {[
              {v:t.alineados+"/"+t.total,l:"CHECKS"},
              {v:(t.weekScore>0?"+":"")+t.weekScore,l:"SCORE",c:t.weekScore>0?T.POS:t.weekScore<0?T.NEG:T.DARK},
              {v:t.racha+"d",l:"RACHA"},
            ].map(({v,l,c},i)=>(
              <div key={l} style={{padding:"12px 10px",borderRight:i<2?"1px solid "+T.LINE:"none",textAlign:"center"}}>
                <p style={{margin:"0 0 2px",fontFamily:SANS,fontSize:18,fontWeight:800,color:c||T.DARK,lineHeight:1}}>{v}</p>
                <p style={{margin:0,fontFamily:MONO,fontSize:8,color:T.DIM,letterSpacing:"0.1em"}}>{l}</p>
              </div>
            ))}
          </div>

          <div style={{display:"flex",gap:0,border:"1px solid "+T.LINE,borderRadius:10,overflow:"hidden",marginBottom:16}}>
            <div style={{flex:1,padding:"12px",borderRight:"1px solid "+T.LINE}}>
              <p style={{margin:"0 0 3px",fontFamily:MONO,fontSize:8,color:T.DIM,letterSpacing:"0.1em"}}>PATRON</p>
              <p style={{margin:0,fontFamily:SANS,fontSize:13,fontWeight:700,color:getTC()[t.patron]||T.DARK}}>{t.patron}</p>
            </div>
            {t.mejorDia&&<div style={{flex:1,padding:"12px",borderRight:t.peorDia&&t.peorDia!==t.mejorDia?"1px solid "+T.LINE:"none"}}>
              <p style={{margin:"0 0 3px",fontFamily:MONO,fontSize:8,color:T.DIM,letterSpacing:"0.1em"}}>MEJOR DIA</p>
              <p style={{margin:0,fontFamily:SANS,fontSize:13,fontWeight:700,color:T.POS}}>{t.mejorDia}</p>
            </div>}
            {t.peorDia&&t.peorDia!==t.mejorDia&&<div style={{flex:1,padding:"12px"}}>
              <p style={{margin:"0 0 3px",fontFamily:MONO,fontSize:8,color:T.DIM,letterSpacing:"0.1em"}}>PEOR DIA</p>
              <p style={{margin:0,fontFamily:SANS,fontSize:13,fontWeight:700,color:T.NEG}}>{t.peorDia}</p>
            </div>}
          </div>

          <div style={{background:barColor+"12",border:"1px solid "+barColor+"30",borderRadius:10,padding:"14px"}}>
            <p style={{margin:"0 0 6px",fontFamily:MONO,fontSize:8,color:barColor,letterSpacing:"0.14em"}}>VEREDICTO</p>
            <p style={{margin:0,fontFamily:SANS,fontSize:14,fontWeight:700,color:T.DARK,lineHeight:1.5}}>{t.veredicto}</p>
          </div>

          <div style={{marginTop:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <p style={{margin:0,fontFamily:MONO,fontSize:8,color:T.DIM,letterSpacing:"0.08em"}}>foco.app — modo testigo</p>
            <p style={{margin:0,fontFamily:MONO,fontSize:8,color:T.DIM}}>{new Date().toLocaleDateString("es-AR")}</p>
          </div>
        </div>

        <p style={{margin:"0 0 10px",fontFamily:MONO,fontSize:9,color:T.DIM,letterSpacing:"0.1em",textAlign:"center"}}>ENVIAR A TU TESTIGO</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <button onClick={wa} style={{padding:"13px",background:T.CARD,border:"none",borderRadius:10,color:T.MID,fontFamily:MONO,fontSize:10,letterSpacing:"0.06em",cursor:"pointer",boxShadow:T.SHA}}>WHATSAPP</button>
          <button onClick={copy} style={{padding:"13px",background:T.CARD,border:copied?"1px solid "+T.POS:"none",borderRadius:10,color:copied?T.POS:T.MID,fontFamily:MONO,fontSize:10,letterSpacing:"0.06em",cursor:"pointer",boxShadow:T.SHA}}>{copied?"COPIADO":"COPIAR TEXTO"}</button>
        </div>
        <button onClick={shareImg} disabled={cap} style={{width:"100%",padding:"15px",background:T.DARK,color:T.ON_DARK,border:"none",borderRadius:R,fontFamily:SANS,fontSize:14,fontWeight:800,cursor:"pointer",boxShadow:T.SHA2,opacity:cap?0.7:1}}>{cap?"Generando...":"Enviar imagen"}</button>
        <p style={{margin:"12px 0 0",fontFamily:MONO,fontSize:9,color:T.DIM,textAlign:"center",letterSpacing:"0.06em"}}>Tu testigo ve tus numeros reales. Sin filtros.</p>
      </div>
    </div>
  );
}

// ─── HISTORIAL SCREEN ─────────────────────────────────────────────────────────
function HistScreen({data}){
  const[showAll,setShowAll]=useState(false);const[f,setF]=useState("all");
  const week=calcWeek(data.weekHistory||[]);const ts=todaySt(data.history);
  const hf=f==="all"?data.history:data.history.filter(h=>h.estado===(f==="ok"?"ALINEADO":"DESALINEADO"));
  return(
    <div style={{minHeight:"100dvh",background:T.BG,paddingBottom:80}}>
      <TopBar title="Historial" right={<span style={{fontFamily:MONO,fontSize:10,color:T.DIM}}>{data.history.length}</span>}/>
      <div style={{padding:"0 16px"}}>
        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
          {[{v:data.activeDays||0,l:"Racha",c:T.DARK},{v:ts?ts.pct+"%":"—",l:"Hoy",c:ts?(ts.pct>=50?T.POS:T.NEG):T.DIM},{v:data.checkins||0,l:"Total",c:T.DARK}].map(({v,l,c})=>(
            <div key={l} style={{background:T.CARD,borderRadius:R,padding:"14px 12px",textAlign:"center",boxShadow:T.SHA}}>
              <p style={{margin:"0 0 3px",fontFamily:SANS,fontSize:22,fontWeight:800,color:c,lineHeight:1}}>{v}</p>
              <p style={{margin:0,fontFamily:MONO,fontSize:9,color:T.DARK,letterSpacing:"0.08em",fontWeight:700}}>{l.toUpperCase()}</p>
            </div>
          ))}
        </div>
        {week&&<div style={{background:T.CARD,borderRadius:R,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,boxShadow:T.SHA}}>
          <span style={{fontFamily:MONO,fontSize:10,color:T.DIM,letterSpacing:"0.08em"}}>SEMANA</span>
          <span style={{fontFamily:SANS,fontSize:16,fontWeight:800,color:week.pct>=50?T.POS:T.NEG}}>{week.pct}% alineado — {week.alineados}/{week.total}</span>
        </div>}
        {data.history.length>0&&<button style={{width:"100%",padding:"12px",background:T.CARD,border:"none",borderRadius:R,fontFamily:MONO,fontSize:10,color:T.DIM,letterSpacing:"0.08em",cursor:"pointer",marginBottom:12,boxShadow:T.SHA}} onClick={()=>exportCSV(data.history)}>Exportar CSV</button>}
        {/* Filtros */}
        <div style={{display:"flex",background:T.CARD,borderRadius:R,padding:4,gap:4,marginBottom:12,boxShadow:T.SHA}}>
          {[{v:"all",l:"Todo"},{v:"ok",l:"Alineado"},{v:"no",l:"Desalineado"}].map(({v,l})=>(
            <button key={v} onClick={()=>setF(v)} style={{flex:1,padding:"8px",background:f===v?T.DARK:"transparent",color:f===v?T.ON_DARK:T.MID,border:"none",borderRadius:R-4,fontFamily:SANS,fontSize:12,fontWeight:f===v?700:400,cursor:"pointer",transition:"all 0.2s"}}>{l}</button>
          ))}
        </div>
        {hf.length===0&&<p style={{color:T.DIM,fontSize:13,textAlign:"center",marginTop:20}}>Sin resultados.</p>}
        {hf.slice(0,showAll?200:20).map((h,i)=>(
          <div key={i} style={{background:T.CARD,borderRadius:R,padding:"14px 16px",marginBottom:8,boxShadow:T.SHA,borderLeft:"4px solid "+(h.estado==="ALINEADO"?T.POS:T.NEG)}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:12,fontWeight:800,color:h.estado==="ALINEADO"?T.POS:T.NEG}}>{h.estado}</span>
                {h.tipo&&<span style={{fontFamily:MONO,fontSize:9,color:getTC()[h.tipo]||T.DIM,background:T.CARD2,padding:"2px 6px",borderRadius:4}}>· {h.tipo}</span>}
              </div>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <span style={{fontFamily:SANS,fontSize:14,fontWeight:800,color:sCol(h.score)}}>{h.score}</span>
                <span style={{fontFamily:MONO,fontSize:9,color:T.DIM}}>{h.date}</span>
              </div>
            </div>
            <p style={{margin:"0 0 4px",fontSize:13,color:T.DARK,lineHeight:1.5}}>{h.insight}</p>
            {h.accion&&<p style={{margin:0,fontSize:12,color:T.DARK,fontWeight:600}}>→ {h.accion}</p>}
          </div>
        ))}
        {hf.length>20&&<button style={{width:"100%",padding:"14px",background:T.CARD,border:"none",borderRadius:R,fontFamily:SANS,fontSize:13,color:T.MID,cursor:"pointer",boxShadow:T.SHA}} onClick={()=>setShowAll(x=>!x)}>{showAll?"Ver menos":"Ver mas (+"+(hf.length-20)+")"}</button>}
      </div>
    </div>
  );
}

// ─── LOGROS SCREEN REAL ───────────────────────────────────────────────────────
function LogrosFullScreen({data,onDeleteAll}){
  const total=Object.keys(LOGROS_DEF).length;
  const unlocked=Object.keys(data.logros||{}).length;
  const[confirmDel,setConfirmDel]=useState(false);
  return(
    <div style={{minHeight:"100dvh",background:T.BG,paddingBottom:80}}>
      <TopBar title="Logros" right={<span style={{fontFamily:MONO,fontSize:10,color:T.DIM}}>{unlocked}/{total}</span>}/>
      <div style={{padding:"0 16px"}}>
        <div style={{background:T.CARD,borderRadius:R,padding:"16px",marginBottom:12,boxShadow:T.SHA}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{fontFamily:MONO,fontSize:9,color:T.DIM,letterSpacing:"0.08em"}}>PROGRESO</span>
            <span style={{fontFamily:MONO,fontSize:9,color:T.DARK,fontWeight:700}}>{Math.round(unlocked/total*100)}%</span>
          </div>
          <div style={{height:6,background:T.LINE,borderRadius:3,overflow:"hidden"}}>
            <div style={{height:6,width:Math.round(unlocked/total*100)+"%",background:T.DARK,borderRadius:3,transition:"width 0.6s ease"}}/>
          </div>
        </div>
        {Object.entries(LOGROS_DEF).map(([k,v])=>{
          const ul=(data.logros||{})[k];
          const isOculto=v.oculto&&!ul;
          return(
            <div key={k} style={{background:ul?T.CARD:T.CARD2,borderRadius:R,padding:"14px 16px",marginBottom:8,boxShadow:ul?T.SHA:"none",opacity:isOculto?0.5:1,display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:42,height:42,borderRadius:12,background:ul?T.DARK:T.LINE,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <SvgIco d={ICO[v.ico]||ICO.check} color={ul?T.ON_DARK:T.DIM} size={20}/>
              </div>
              <div style={{flex:1}}>
                <p style={{margin:"0 0 2px",fontFamily:SANS,fontSize:14,fontWeight:700,color:ul?T.DARK:T.DIM}}>{isOculto?"???":(v.titulo_real||v.titulo)}</p>
                <p style={{margin:0,fontSize:12,color:T.MID}}>{isOculto?"Logro oculto":(v.desc_real||v.desc)}</p>
              </div>
              {ul&&<span style={{fontFamily:MONO,fontSize:8,color:T.DIM,flexShrink:0}}>{new Date(ul).toLocaleDateString("es-AR",{day:"numeric",month:"short"})}</span>}
            </div>
          );
        })}

        {/* Zona de peligro — privacidad y borrado de datos */}
        <div style={{marginTop:24,paddingTop:16,borderTop:"1px solid "+T.LINE}}>
          <p style={{margin:"0 0 4px",fontFamily:MONO,fontSize:9,color:T.DIM,letterSpacing:"0.1em"}}>PRIVACIDAD</p>
          <p style={{margin:"0 0 14px",fontSize:12,color:T.MID,lineHeight:1.6}}>Todos tus datos se guardan solo en este dispositivo, cifrados localmente. Nunca se envian a ningun servidor.</p>
          {!confirmDel?(
            <button onClick={()=>setConfirmDel(true)} style={{width:"100%",padding:"13px",background:T.CARD,color:T.NEG,border:"1px solid "+T.NEG+"40",borderRadius:R,fontFamily:SANS,fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:T.SHA}}>
              <SvgIco d={ICO.trash} color={T.NEG} size={14}/>Borrar todos mis datos
            </button>
          ):(
            <div style={{background:T.NEG+"12",border:"1px solid "+T.NEG+"30",borderRadius:R,padding:"14px"}}>
              <p style={{margin:"0 0 12px",fontSize:12,color:T.DARK,fontWeight:600,lineHeight:1.5}}>Esto borra tu historial, score, logros y contratos para siempre. No se puede deshacer. Estas seguro?</p>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setConfirmDel(false)} style={{flex:1,padding:"11px",background:T.CARD,color:T.MID,border:"none",borderRadius:10,fontFamily:SANS,fontSize:12,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
                <button onClick={onDeleteAll} style={{flex:1,padding:"11px",background:T.NEG,color:"#FFFFFF",border:"none",borderRadius:10,fontFamily:SANS,fontSize:12,fontWeight:700,cursor:"pointer"}}>Si, borrar todo</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function Foco(){
  const[data,setData]=useState(()=>resetDaily(load()));
  const[splash,setSplash]=useState(true);
  const[tab,setTab]=useState("home");
  const[screen,setScreen]=useState("home"); // home | chat | result
  const[questions,setQuestions]=useState(()=>buildQs());
  const[step,setStep]=useState(0);
  const[ans,setAns]=useState(Array(TQ).fill(""));
  const[dayC,setDayC]=useState("true");
  const[inp,setInp]=useState("");
  const[loading,setLoading]=useState(false);
  const[stLoad,setStLoad]=useState(false);
  const[diagAnim,setDiagAnim]=useState(false);
  const[pending,setPending]=useState(null);
  const[result,setResult]=useState(null);
  const[almost,setAlmost]=useState(null);
  const[pomo,setPomo]=useState(false);
  const[share,setShare]=useState(false);
  const[quick,setQuick]=useState(false);
  const[pendingLogros,setPendingLogros]=useState([]);
  const[showConfetti,setShowConfetti]=useState(false);
  const[showContrato,setShowContrato]=useState(false);
  const[showResumen,setShowResumen]=useState(false);
  const[showTestigo,setShowTestigo]=useState(false);
  const inpRef=useRef();

  useEffect(()=>{
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Space+Mono:wght@400;700&display=swap";
    document.head.appendChild(link);
    return()=>{try{document.head.removeChild(link);}catch{}};
  },[]);

  useEffect(()=>{if(!stLoad&&!loading&&screen==="chat")inpRef.current?.focus();},[screen,step,stLoad,loading]);
  const save=useCallback(d=>{setData(d);persist(d);},[]);
  const finishOnboard=()=>{save({...data,onboarded:true});startCheck(false);};
  const startCheck=(q=false)=>{setQuestions(buildQs(data.lastQuestions||[]));setStep(0);setAns(Array(TQ).fill(""));setInp("");setDayC("true");setResult(null);setPomo(false);setAlmost(null);setQuick(q);setScreen("chat");};
  const reset=()=>{setScreen("home");setResult(null);setPomo(false);setShare(false);setDiagAnim(false);setPending(null);setShowConfetti(false);};
  const onDiagDone=()=>{setDiagAnim(false);if(pending){setResult(pending);setPending(null);setScreen("result");}};
  const saveContrato=(tarea)=>{save({...data,contrato:{dk:dKey(),tarea}});setShowContrato(false);};
  const deleteAllData=()=>{wipeAllData();setData(def());setScreen("home");setTab("home");};

  const runDx=async(answers,dayNormal)=>{
    setLoading(true);
    try{
      const dx=await callAI(answers,data);
      haptic(dx.estado==="ALINEADO"?"s":"e");
      const now=new Date(),today=now.toDateString(),ws=getWS();
      const ns=applyScore(data.score||0,dx.estado,data);
      const nws=Math.max(-30,Math.min(100,(data.weekScore||0)+(dx.estado==="ALINEADO"?10:-10)));
      const newBest=Math.max(data.bestScore||0,ns);
      const sameDay=data.lastZonaDate===dKey();
      const zonaCount=dx.estado==="ALINEADO"?(sameDay?(data.zonaCount||0)+1:1):0;
      setAlmost(getAlmost(data,dx.estado));
      const entry={estado:dx.estado,tipo:dx.tipo,insight:dx.insight,accion:dx.accion,score:ns,tarea:answers[0]||"",date:now.toLocaleDateString("es-AR",{day:"numeric",month:"short"}),dk:dKey(now),time:now.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"}),day:["Dom","Lun","Mar","Mie","Jue","Vie","Sab"][now.getDay()]};
      const nh=[entry,...data.history].slice(0,100);
      const nwh=[entry,...(data.weekHistory||[])].slice(0,50);
      const sw=new Set(["estoy","haciendo","quiero","tengo"]);
      const nt=[...new Set([...(data.topics||[]),...(answers[0]||"").toLowerCase().split(" ").filter(w=>w.length>4&&!sw.has(w)).slice(0,3)])].slice(0,10);
      const rk=norm(answers[0]||"").slice(0,40);
      const nrt={...(data.recurringTasks||{}),[rk]:((data.recurringTasks||{})[rk]||0)+1};
      const newData=markActive({...data,score:ns,history:nh,weekScore:nws,weekHistory:nwh,weekStart:ws,checkins:(data.checkins||0)+1,usosHoy:(data.usosHoy||0)+1,fechaHoy:today,lastResult:dx.estado,lastInsightText:dx.insight,lastInsightDate:now.toISOString(),lastDayNormal:dayNormal,lastFeedback:null,topics:nt,lastQuestions:questions,ayerFueDiferente:false,recurringTasks:nrt,bestScore:newBest,zonaCount,lastZonaDate:dx.estado==="ALINEADO"?dKey():data.lastZonaDate});
      const ts2=todaySt(nh);
      const{logros:nlogros,nuevos}=checkLogros(newData,ts2);
      // Hitos de score — recompensa sorpresa cuando cruzas 25/50/75/100 puntos
      const MILESTONES=[25,50,75,100];
      const cruzados=MILESTONES.filter(m=>(data.score||0)<m&&ns>=m);
      const hitos=cruzados.map(m=>({ico:"target",titulo_real:"Hito: "+m+" puntos",desc_real:"Cruzaste el umbral de "+m+". Seguí asi."}));
      const c=getContrato(data);
      const ctHistory=c?[{dk:c.dk,tarea:c.tarea,roto:dx.estado==="DESALINEADO"},...(data.contratoHistory||[])].slice(0,30):(data.contratoHistory||[]);
      save({...newData,logros:nlogros,contratoHistory:ctHistory});
      const todasLasNotifs=[...nuevos,...hitos];
      if(todasLasNotifs.length>0)setPendingLogros(todasLasNotifs);
      if(dx.estado==="ALINEADO")setShowConfetti(true);
      setPending(dx);setDiagAnim(true);
    }finally{setLoading(false);}
  };

  const submitStep=async()=>{
    if(!quick&&step===DAYIDX){await runDx([...ans],dayC==="true");return;}
    if(!inp.trim()||loading||stLoad)return;
    haptic("l");
    const na=[...ans];na[step]=inp.trim();setAns(na);setInp("");
    if(quick&&step===1){await runDx(na,data.lastDayNormal!==false);return;}
    if(!quick&&step===DAYIDX-1){setStLoad(true);await new Promise(r=>setTimeout(r,220));setStLoad(false);setStep(DAYIDX);return;}
    setStLoad(true);await new Promise(r=>setTimeout(r,220));setStLoad(false);setStep(s=>s+1);
  };

  const onNav=(id)=>{if(screen!=="chat"){setTab(id);if(screen==="result")setScreen("home");}};

  if(splash)return <Splash onDone={()=>setSplash(false)}/>;
  if(!data.onboarded)return <Onboarding onDone={finishOnboard}/>;

  const sc=data.score||0,scLbl2=sLbl(sc);
  const wsc=data.weekScore||0;
  const patron=detectPatron(data.history);
  const ts=todaySt(data.history);
  const vs=vsY(data.history);
  const loop=getLoop(data);
  const rec=getRecurring(data.recurringTasks||{});
  const rc=result?(result.estado==="ALINEADO"?T.POS:T.NEG):T.DARK;
  const week=calcWeek(data.weekHistory||[]);
  const cl=data.history.length<5?5-data.history.length:0;
  const isEnZona=(data.zonaCount||0)>=3&&data.lastZonaDate===dKey();
  const risk=predictRisk(data);
  const haHechoHoy=ts&&ts.total>0;
  const contrato=getContrato(data);
  T=data.theme==="dark"?DARKT:LIGHTT; // reasigna la paleta activa para este render

  const showNav=screen!=="chat";

  return(
    <div style={{fontFamily:SANS,background:T.BG,color:T.DARK,minHeight:"100dvh",maxWidth:430,margin:"0 auto",position:"relative"}}>
      <style>{"*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}body{-webkit-font-smoothing:antialiased;}input{outline:none;}input::placeholder{color:#555;}::-webkit-scrollbar{display:none;}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes confetti{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}@keyframes pulse{0%,100%{opacity:0.3}50%{opacity:1}}"}</style>

      {pendingLogros.length>0&&<LogroToast logro={pendingLogros[0]} onDone={()=>setPendingLogros(p=>p.slice(1))}/>}
      {showConfetti&&<Confetti/>}
      {diagAnim&&<div style={{position:"fixed",inset:0,background:T.BG,zIndex:50,display:"flex",flexDirection:"column",maxWidth:430,margin:"0 auto"}}><DxLoader onDone={onDiagDone}/></div>}
      {showContrato&&<ContratoModal data={data} onSave={saveContrato} onClose={()=>setShowContrato(false)}/>}
      {showResumen&&<ResumenSemanal data={data} onClose={()=>setShowResumen(false)}/>}
      {showTestigo&&<ModoTestigo data={data} onClose={()=>setShowTestigo(false)}/>}

      {/* ── HOME TAB ── */}
      {tab==="home"&&screen==="home"&&(
        <div style={{paddingBottom:80}}>
          {/* Header */}
          <div style={{padding:"52px 20px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <p style={{margin:0,fontFamily:MONO,fontSize:9,color:T.DIM,letterSpacing:"0.1em"}}>{new Date().toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"}).toUpperCase()}</p>
              <p style={{margin:"2px 0 0",fontFamily:SANS,fontSize:22,fontWeight:800,color:T.DARK,letterSpacing:-0.8}}>Buenos dias</p>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button onClick={()=>save({...data,theme:data.theme==="dark"?"light":"dark"})} style={{width:42,height:42,borderRadius:14,background:T.CARD,border:"none",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:T.SHA,cursor:"pointer"}}>
                {data.theme==="dark"
                  ?<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke={T.DARK} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="3.5"/><path d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.7 3.3l-1 1M4.3 11.7l-1 1M12.7 12.7l-1-1M4.3 4.3l-1-1"/></svg>
                  :<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke={T.DARK} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 8.7A6 6 0 017 1.8a6 6 0 106.5 6.9z"/></svg>
                }
              </button>
              <div style={{width:42,height:42,borderRadius:14,background:T.DARK,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:T.SHA2}}>
                <span style={{fontFamily:SANS,fontSize:18,fontWeight:800,color:data.theme==="dark"?T.BG:"#FFF",letterSpacing:-1}}>F</span>
              </div>
            </div>
          </div>

          <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>
            {/* Score card — superficie negra fija, siempre alto contraste en ambos temas */}
            <div style={{background:"#141414",borderRadius:20,padding:"22px",boxShadow:T.SHA2}}>
              <p style={{margin:"0 0 6px",fontFamily:MONO,fontSize:9,color:"rgba(255,255,255,0.85)",letterSpacing:"0.12em"}}>SCORE ACTUAL</p>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:18}}>
                <div style={{display:"flex",alignItems:"baseline",gap:10}}>
                  <span style={{fontFamily:SANS,fontSize:60,fontWeight:800,color:sc>0?"#C8FF00":sc<0?"#FF6B6B":"rgba(255,255,255,0.85)",letterSpacing:-4,lineHeight:1,fontVariantNumeric:"tabular-nums"}}>{sc}</span>
                  <span style={{fontFamily:MONO,fontSize:11,color:"rgba(255,255,255,0.95)",letterSpacing:"0.08em"}}>{scLbl2}</span>
                </div>
                <div style={{textAlign:"right",display:"flex",gap:16}}>
                  {(data.activeDays||0)>0&&<div>
                    <p style={{margin:0,fontFamily:SANS,fontSize:22,fontWeight:800,color:"rgba(255,255,255,0.9)",lineHeight:1}}>{data.activeDays}</p>
                    <p style={{margin:"2px 0 0",fontFamily:MONO,fontSize:8,color:"rgba(255,255,255,0.95)",letterSpacing:"0.1em"}}>RACHA</p>
                  </div>}
                  {(data.weekHistory||[]).length>0&&<div>
                    <p style={{margin:0,fontFamily:SANS,fontSize:22,fontWeight:800,color:wsc>0?"#C8FF00":wsc<0?"#FF6B6B":"rgba(255,255,255,0.95)",lineHeight:1}}>{wsc>0?"+":""}{wsc}</p>
                    <p style={{margin:"2px 0 0",fontFamily:MONO,fontSize:8,color:"rgba(255,255,255,0.95)",letterSpacing:"0.1em"}}>SEMANA</p>
                  </div>}
                </div>
              </div>
              {/* Score bar en la card negra */}
              <div>
                <div style={{height:3,borderRadius:2,background:"rgba(255,255,255,0.12)",position:"relative"}}>
                  <div style={{position:"absolute",inset:0,borderRadius:2,background:"linear-gradient(to right,#FF6B6B,#FF9F0A,#C8FF00)"}}/>
                  <div style={{position:"absolute",top:"50%",left:Math.max(0.5,Math.min(99.5,((sc-SMIN)/(SMAX-SMIN))*100))+"%",transform:"translate(-50%,-50%)",width:12,height:12,borderRadius:"50%",background:"#141414",border:"2.5px solid "+(sc>0?"#C8FF00":sc<0?"#FF6B6B":"rgba(255,255,255,0.95)"),transition:"left 0.8s cubic-bezier(0.4,0,0.2,1)"}}/></div>
                {data.bestScore>0&&sc<data.bestScore&&<p style={{margin:"8px 0 0",fontFamily:MONO,fontSize:8,color:"rgba(255,255,255,0.95)",letterSpacing:"0.08em"}}>RECORD: {data.bestScore}</p>}
              </div>
            </div>

            {/* Stats 2x2 */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div style={{background:T.CARD,borderRadius:R,padding:"16px",boxShadow:T.SHA}}>
                <p style={{margin:"0 0 4px",fontFamily:MONO,fontSize:9,color:T.DARK,letterSpacing:"0.1em",fontWeight:700}}>HOY</p>
                {ts?(<>
                  <p style={{margin:"0 0 2px",fontFamily:SANS,fontSize:28,fontWeight:800,color:ts.pct>=50?T.POS:T.NEG,letterSpacing:-1,lineHeight:1}}>{ts.pct}<span style={{fontSize:14,fontWeight:500}}>%</span></p>
                  <p style={{margin:0,fontSize:11,color:T.DIM}}>{ts.total} checks{vs!==null?" · "+(vs>=0?"+":"")+vs+"% ayer":""}</p>
                  {ts.pct===100&&ts.total>=2&&<p style={{margin:"4px 0 0",fontFamily:MONO,fontSize:8,color:T.POS,letterSpacing:"0.08em"}}>DIA PERFECTO</p>}
                </>):(<p style={{margin:"6px 0 0",fontSize:13,color:T.DIM}}>Sin checks</p>)}
              </div>
              <div style={{background:T.CARD,borderRadius:R,padding:"16px",boxShadow:T.SHA}}>
                <p style={{margin:"0 0 4px",fontFamily:MONO,fontSize:9,color:T.DARK,letterSpacing:"0.1em",fontWeight:700}}>PATRON</p>
                {patron?(<>
                  <p style={{margin:"0 0 2px",fontFamily:SANS,fontSize:18,fontWeight:800,color:getTC()[patron]||T.DARK,lineHeight:1}}>{patron}</p>
                  <p style={{margin:0,fontSize:11,color:T.DIM}}>{data.checkins} check-ins</p>
                </>):(<p style={{margin:"6px 0 0",fontSize:12,color:T.DIM}}>Faltan {cl}</p>)}
              </div>
            </div>

            {/* Resumen semanal — disponible desde 3 check-ins en la semana, mas visible el finde */}
            {week&&(()=>{const esFinde=[0,6].includes(new Date().getDay());return(
              <button onClick={()=>setShowResumen(true)} style={{background:esFinde?"#141414":T.CARD,border:"none",borderRadius:R,padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",boxShadow:esFinde?T.SHA2:T.SHA}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <SvgIco d={ICO.hist} color={esFinde?"#C8FF00":T.DARK} size={16}/>
                  <div style={{textAlign:"left"}}>
                    <p style={{margin:0,fontFamily:SANS,fontSize:13,fontWeight:700,color:esFinde?"#FFFFFF":T.DARK}}>Resumen semanal</p>
                    <p style={{margin:0,fontSize:11,color:esFinde?"rgba(255,255,255,0.6)":T.DIM}}>Como estuviste dia por dia</p>
                  </div>
                </div>
                {esFinde&&<span style={{fontFamily:MONO,fontSize:8,color:"#C8FF00",letterSpacing:"0.08em",background:"rgba(200,255,0,0.15)",padding:"3px 8px",borderRadius:20}}>LISTO</span>}
              </button>
            );})()}

            {/* Modo Testigo — reporte para mandarle a otra persona, mismo umbral que Resumen Semanal */}
            {week&&(
              <button onClick={()=>setShowTestigo(true)} style={{background:T.CARD,border:"none",borderRadius:R,padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",boxShadow:T.SHA}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <SvgIco d={ICO.star} color={T.DARK} size={16}/>
                  <div style={{textAlign:"left"}}>
                    <p style={{margin:0,fontFamily:SANS,fontSize:13,fontWeight:700,color:T.DARK}}>Modo Testigo</p>
                    <p style={{margin:0,fontSize:11,color:T.DIM}}>Mandale el reporte a alguien</p>
                  </div>
                </div>
              </button>
            )}

            {/* Contrato — recien aparece despues de 3 check-ins, no compite con el loop principal el dia 1 */}
            {data.checkins>=3&&(contrato?(
              <div style={{background:T.CARD,borderRadius:R,padding:"16px",boxShadow:T.SHA,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}} onClick={()=>setShowContrato(true)}>
                <div style={{flex:1}}>
                  <p style={{margin:"0 0 4px",fontFamily:MONO,fontSize:9,color:T.POS,letterSpacing:"0.1em"}}>CONTRATO DE HOY</p>
                  <p style={{margin:0,fontFamily:SANS,fontSize:14,fontWeight:700,color:T.DARK}}>{contrato.tarea}</p>
                </div>
                <div style={{width:32,height:32,borderRadius:10,background:T.POS+"15",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginLeft:12}}>
                  <SvgIco d={ICO.check} color={T.POS} size={16} stroke={2}/>
                </div>
              </div>
            ):(
              <button onClick={()=>setShowContrato(true)} style={{background:T.CARD,border:"2px dashed "+T.LINE,borderRadius:R,padding:"14px 16px",width:"100%",display:"flex",alignItems:"center",gap:12,cursor:"pointer",textAlign:"left",boxShadow:"none"}}>
                <SvgIco d={ICO.bolt} color={T.DIM} size={18}/>
                <div>
                  <p style={{margin:"0 0 2px",fontFamily:MONO,fontSize:9,color:T.DIM,letterSpacing:"0.1em"}}>CONTRATO DIARIO</p>
                  <p style={{margin:0,fontSize:13,color:T.DIM}}>Define tu UNA tarea de hoy</p>
                </div>
              </button>
            ))}

            {/* Zona de Riesgo — prediccion basada en tu propio historial */}
            {risk&&<div style={{background:T.AMB+"14",borderRadius:R,padding:"14px 16px",border:"1px solid "+T.AMB+"35",display:"flex",gap:12,alignItems:"flex-start"}}>
              <SvgIco d={ICO.alert} color={T.AMB} size={18} stroke={2}/>
              <div>
                <p style={{margin:"0 0 3px",fontFamily:MONO,fontSize:9,color:T.AMB,letterSpacing:"0.1em",fontWeight:700}}>ZONA DE RIESGO</p>
                <p style={{margin:0,fontSize:13,color:T.DARK,fontWeight:600,lineHeight:1.5}}>Los {risk.dia} de {risk.turno.toLowerCase()} fallas el {risk.pct}% de las veces ({risk.muestras} datos).{risk.tipoTop?" Suele ser por "+risk.tipoTop+".":""}</p>
              </div>
            </div>}

            {/* En Zona */}
            {isEnZona&&<div style={{background:T.LIMA,borderRadius:R,padding:"14px 16px",display:"flex",alignItems:"center",gap:10}}>
              <SvgIco d={ICO.zap} color={T.DARK} size={18}/>
              <div>
                <p style={{margin:"0 0 1px",fontFamily:SANS,fontSize:14,fontWeight:800,color:T.DARK}}>En zona</p>
                <p style={{margin:0,fontSize:11,color:"rgba(0,0,0,0.6)"}}>{data.zonaCount} alineados seguidos hoy</p>
              </div>
            </div>}

            {/* Alerta racha — countdown en vivo hasta medianoche */}
            {!haHechoHoy&&data.checkins>0&&<RachaCountdown dias={data.activeDays||0}/>}

            {/* Continuidad */}
            {loop&&<div style={{background:T.CARD,borderRadius:R,padding:"14px 16px",boxShadow:T.SHA,borderLeft:"4px solid "+T.NEG}}>
              <p style={{margin:"0 0 6px",fontSize:13,color:T.DARK,fontWeight:600,lineHeight:1.5}}>{loop}</p>
              <button onClick={()=>save({...data,ayerFueDiferente:true})} style={{background:"none",border:"none",color:T.DIM,fontSize:12,cursor:"pointer",padding:0,textDecoration:"underline",fontFamily:SANS}}>Ayer fue diferente</button>
            </div>}

            {/* Chart */}
            {data.history.length>=3&&<div style={{background:T.CARD,borderRadius:R,padding:"16px",boxShadow:T.SHA}}><MiniChart history={data.history}/></div>}

            {/* Recurrente */}
            {rec&&<div style={{background:T.CARD,borderRadius:R,padding:"14px 16px",boxShadow:T.SHA}}>
              <p style={{margin:"0 0 4px",fontFamily:MONO,fontSize:9,color:T.AMB,letterSpacing:"0.1em"}}>TAREA RECURRENTE</p>
              <p style={{margin:0,fontSize:13,color:T.DARK,lineHeight:1.5}}>Mencionas <span style={{color:T.DARK,fontWeight:700}}>"{rec.slice(0,28)}"</span> seguido.</p>
            </div>}

            {/* Ultimo diagnostico */}
            {data.history.length>0&&<div style={{background:T.CARD,borderRadius:R,padding:"16px",boxShadow:T.SHA}}>
              <p style={{margin:"0 0 8px",fontFamily:MONO,fontSize:9,color:T.DARK,letterSpacing:"0.1em",fontWeight:700}}>ULTIMO DIAGNOSTICO</p>
              <p style={{margin:"0 0 6px",fontSize:14,color:T.DARK,lineHeight:1.6,fontStyle:"italic",fontWeight:500}}>"{data.history[0].insight}"</p>
              <p style={{margin:0,fontSize:12,color:getTC()[data.history[0].tipo]||T.DIM,fontWeight:600}}>→ {data.history[0].accion}</p>
            </div>}

            {/* CTA */}
            <div style={{display:"flex",gap:10,paddingBottom:4}}>
              {(data.checkins||0)>=10?(
                <>
                  <button style={{flex:3,padding:"16px 0",background:T.DARK,color:T.ON_DARK,border:"none",borderRadius:R,fontFamily:SANS,fontSize:15,fontWeight:800,cursor:"pointer",boxShadow:T.SHA2}} onClick={()=>startCheck(false)}>Check-in</button>
                  <button title="Modo rapido" style={{flex:1,padding:"16px 0",background:T.CARD,color:T.MID,border:"none",borderRadius:R,fontFamily:MONO,fontSize:11,cursor:"pointer",boxShadow:T.SHA}} onClick={()=>startCheck(true)}>RAP</button>
                </>
              ):(
                <button style={{flex:1,padding:"16px",background:T.DARK,color:T.ON_DARK,border:"none",borderRadius:R,fontFamily:SANS,fontSize:16,fontWeight:800,cursor:"pointer",boxShadow:T.SHA2}} onClick={()=>startCheck(false)}>Hacer check-in</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORIAL TAB ── */}
      {tab==="history"&&screen==="home"&&<HistScreen data={data}/>}

      {/* ── LOGROS TAB ── */}
      {tab==="logros"&&screen==="home"&&<LogrosFullScreen data={data} onDeleteAll={deleteAllData}/>}

      {/* ── CHAT ── */}
      {screen==="chat"&&(
        <div style={{display:"flex",flexDirection:"column",minHeight:"100dvh",background:T.BG}}>
          <div style={{padding:"52px 20px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <button onClick={reset} style={{width:36,height:36,borderRadius:12,background:T.CARD,boxShadow:T.SHA,border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
              <SvgIco d={ICO.back} color={T.DARK} size={16}/>
            </button>
            {quick?(
              <div style={{background:T.AMB+"20",borderRadius:20,padding:"5px 12px",display:"flex",alignItems:"center",gap:6}}>
                <SvgIco d={ICO.bolt} color={T.AMB} size={12}/>
                <span style={{fontFamily:MONO,fontSize:10,color:T.AMB,letterSpacing:"0.08em"}}>RAPIDO</span>
              </div>
            ):(
              <div style={{display:"flex",gap:5}}>
                {Array.from({length:TQ}).map((_,i)=><div key={i} style={{height:3,width:i<step?14:i===step?20:6,background:i<step?T.DARK:i===step?T.DARK:T.LINE,borderRadius:2,opacity:i<step?1:i===step?1:0.3,transition:"all 0.3s ease"}}/>)}
              </div>
            )}
            <span style={{fontFamily:MONO,fontSize:10,color:T.DARK,fontWeight:700}}>{step+1}/{quick?2:TQ}</span>
          </div>

          <div style={{flex:1,padding:"8px 20px 16px",display:"flex",flexDirection:"column",gap:20,overflowY:"auto"}}>
            {ans.slice(0,step).map((a,i)=>a&&i<DAYIDX&&(
              <div key={i} style={{background:T.CARD,borderRadius:R,padding:"14px 16px",boxShadow:T.SHA}}>
                <p style={{margin:"0 0 4px",fontFamily:MONO,fontSize:9,color:T.DIM,letterSpacing:"0.1em"}}>{i===0?"TAREA":i===1?"REALIDAD":"CONTEXTO"}</p>
                <p style={{margin:0,fontSize:14,color:T.DARK,lineHeight:1.5}}>{a}</p>
              </div>
            ))}
            {step===DAYIDX&&!loading&&!stLoad&&(
              <div>
                <p style={{margin:"0 0 4px",fontFamily:MONO,fontSize:9,color:T.DIM,letterSpacing:"0.1em"}}>CONTEXTO FINAL</p>
                <p style={{margin:"0 0 16px",fontFamily:SANS,fontSize:22,fontWeight:700,color:T.DARK,letterSpacing:-0.6,lineHeight:1.2}}>Ayer fue un dia normal?</p>
                <div style={{display:"flex",gap:10}}>
                  {[{l:"Si",v:"true"},{l:"No, fue distinto",v:"false"}].map(({l,v})=>(
                    <button key={v} onClick={()=>setDayC(v)} style={{flex:1,padding:"14px",background:dayC===v?T.DARK:T.CARD,color:dayC===v?T.ON_DARK:T.MID,border:"none",borderRadius:R,fontFamily:SANS,fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:dayC===v?T.SHA2:T.SHA,transition:"all 0.2s"}}>{l}</button>
                  ))}
                </div>
              </div>
            )}
            {step===0&&!loading&&!stLoad&&contrato&&(
              <div style={{background:T.POS+"12",borderRadius:R,padding:"12px 16px",border:"1px solid "+T.POS+"20"}}>
                <p style={{margin:"0 0 3px",fontFamily:MONO,fontSize:9,color:T.POS,letterSpacing:"0.1em"}}>TU CONTRATO DE HOY</p>
                <p style={{margin:0,fontFamily:SANS,fontSize:13,fontWeight:700,color:T.DARK}}>{contrato.tarea}</p>
              </div>
            )}
            {!loading&&!stLoad&&step<DAYIDX&&(
              <div>
                <p style={{margin:"0 0 8px",fontFamily:MONO,fontSize:9,color:T.DIM,letterSpacing:"0.1em"}}>{step===0?"TAREA":step===1?"REALIDAD":"CONTEXTO"} · {step+1}/{quick?2:TQ}</p>
                <p style={{margin:0,fontFamily:SANS,fontSize:24,fontWeight:800,color:T.DARK,letterSpacing:-0.8,lineHeight:1.2}}>{questions[step]}</p>
              </div>
            )}
            {(loading||stLoad)&&(
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:T.DIM,animation:"pulse 1s ease-in-out infinite"}}/>
                <span style={{fontSize:13,color:T.DIM,fontFamily:MONO}}>{loading?"Analizando...":""}</span>
              </div>
            )}
          </div>

          {!loading&&!stLoad&&step<DAYIDX&&(
            <div style={{padding:"12px 20px 48px",display:"flex",gap:10}}>
              <input ref={inpRef} value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitStep()}
                style={{flex:1,background:T.CARD,border:"2px solid "+(inp.trim()?T.DARK:T.LINE),borderRadius:R,padding:"14px 16px",fontSize:15,color:T.DARK,fontFamily:SANS,outline:"none",transition:"border-color 0.15s",boxShadow:T.SHA}}
                placeholder="Responde sin filtro..."/>
              <button onClick={submitStep} disabled={!inp.trim()} style={{background:inp.trim()?T.DARK:"transparent",color:inp.trim()?T.ON_DARK:T.DIM,border:"2px solid "+(inp.trim()?T.DARK:T.LINE),borderRadius:R,padding:"14px 18px",cursor:inp.trim()?"pointer":"default",transition:"all 0.15s",boxShadow:inp.trim()?T.SHA2:"none"}}>
                <SvgIco d={ICO.bolt} color={inp.trim()?T.ON_DARK:T.DIM} size={18}/>
              </button>
            </div>
          )}
          {!loading&&!stLoad&&step===DAYIDX&&(
            <div style={{padding:"12px 20px 48px"}}>
              <button onClick={submitStep} style={{width:"100%",padding:"16px",background:T.DARK,color:T.ON_DARK,border:"none",borderRadius:R,fontFamily:SANS,fontSize:15,fontWeight:800,cursor:"pointer",boxShadow:T.SHA2}}>Analizar</button>
            </div>
          )}
        </div>
      )}

      {/* ── RESULT ── */}
      {screen==="result"&&result&&(
        <div style={{minHeight:"100dvh",paddingBottom:80,background:T.BG}}>
          <div style={{padding:"52px 20px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <button onClick={reset} style={{width:36,height:36,borderRadius:12,background:T.CARD,boxShadow:T.SHA,border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
              <SvgIco d={ICO.back} color={T.DARK} size={16}/>
            </button>
            <span style={{fontFamily:SANS,fontSize:16,fontWeight:800,color:T.DARK}}>Diagnostico</span>
            <button onClick={()=>onNav("history")} style={{background:"transparent",border:"none",color:T.DIM,cursor:"pointer",fontFamily:MONO,fontSize:10,letterSpacing:"0.06em",padding:"8px 0"}}>HISTORIAL</button>
          </div>

          <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>
            {almost&&<div style={{background:T.AMB+"15",borderRadius:R,padding:"12px 16px",border:"1px solid "+T.AMB+"25"}}>
              <p style={{margin:0,fontSize:13,color:T.AMB,fontWeight:600}}>{almost}</p>
            </div>}

            {/* Estado card */}
            <div style={{background:result.estado==="ALINEADO"?T.POS:T.NEG,borderRadius:20,padding:"22px",boxShadow:T.SHA2}}>
              <p style={{margin:"0 0 4px",fontFamily:MONO,fontSize:9,color:"rgba(255,255,255,0.85)",letterSpacing:"0.12em"}}>ESTADO</p>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontFamily:SANS,fontSize:38,fontWeight:800,color:"#FFFFFF",letterSpacing:-2,lineHeight:1}}>{result.estado}</span>
                <div style={{width:44,height:44,borderRadius:14,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <SvgIco d={result.estado==="ALINEADO"?ICO.check:ICO.up} color="#FFF" size={22} stroke={2.5}/>
                </div>
              </div>
              {result.estado==="ALINEADO"&&(data.zonaCount||0)>=2&&<p style={{margin:"10px 0 0",fontFamily:MONO,fontSize:9,color:"rgba(255,255,255,0.95)",letterSpacing:"0.08em"}}>{data.zonaCount} ALINEADOS SEGUIDOS HOY</p>}
            </div>

            {/* Insight */}
            {result.insight&&<div style={{background:T.CARD,borderRadius:R,padding:"18px",boxShadow:T.SHA}}>
              <p style={{margin:"0 0 8px",fontFamily:MONO,fontSize:9,color:T.DARK,letterSpacing:"0.1em",fontWeight:700}}>INSIGHT</p>
              <p style={{margin:"0 0 8px",fontFamily:SANS,fontSize:16,fontWeight:700,color:T.DARK,lineHeight:1.5}}>{result.insight}</p>
              {result.emocion&&<p style={{margin:0,fontSize:12,color:T.DARK,fontWeight:600}}>Raiz: <span style={{color:T.MID,fontWeight:600}}>{result.emocion}</span></p>}
            </div>}

            {/* Share */}
            <button onClick={()=>setShare(true)} style={{width:"100%",padding:"14px",background:T.CARD,color:T.DARK,border:"none",borderRadius:R,fontFamily:SANS,fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:T.SHA}}>Compartir resultado</button>

            {/* Tipo + Accion */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {result.tipo&&<div style={{background:T.CARD,borderRadius:R,padding:"16px",boxShadow:T.SHA}}>
                <p style={{margin:"0 0 8px",fontFamily:MONO,fontSize:9,color:T.DARK,letterSpacing:"0.1em",fontWeight:700}}>TIPO</p>
                <p style={{margin:"0 0 4px",fontFamily:SANS,fontSize:16,fontWeight:800,color:getTC()[result.tipo]||T.DARK}}>{result.tipo}</p>
                <p style={{margin:0,fontSize:11,color:T.DIM,lineHeight:1.5}}>{TDESC[result.tipo]||""}</p>
              </div>}
              {result.accion&&<div style={{background:T.CARD,borderRadius:R,padding:"16px",boxShadow:T.SHA}}>
                <p style={{margin:"0 0 8px",fontFamily:MONO,fontSize:9,color:T.DARK,letterSpacing:"0.1em",fontWeight:700}}>ACCION</p>
                <p style={{margin:"0 0 6px",fontFamily:SANS,fontSize:14,fontWeight:700,color:T.DARK,lineHeight:1.3}}>{result.accion}</p>
                <p style={{margin:0,fontFamily:MONO,fontSize:10,color:T.DARK,fontWeight:800,letterSpacing:"0.06em"}}>AHORA</p>
              </div>}
            </div>

            {/* Score */}
            <div style={{background:T.CARD,borderRadius:R,padding:"18px",boxShadow:T.SHA}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <span style={{fontFamily:MONO,fontSize:10,color:T.DIM,letterSpacing:"0.1em"}}>SCORE</span>
                <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                  <span style={{fontFamily:SANS,fontSize:36,fontWeight:800,color:sCol(sc),letterSpacing:-2,fontVariantNumeric:"tabular-nums"}}>{sc}</span>
                  <span style={{fontFamily:MONO,fontSize:10,color:sCol(sc),letterSpacing:"0.06em"}}>{scLbl2}</span>
                </div>
              </div>
              <ScoreBar score={sc}/>
            </div>

            {/* Stats */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
              {[{v:data.activeDays||0,l:"RACHA"},{v:ts?ts.pct+"%":"—",l:"HOY"},{v:vs!==null?(vs>=0?"+":"")+vs+"%":"—",l:"AYER"},{v:data.checkins||0,l:"TOTAL"}].map(({v,l})=>(
                <div key={l} style={{background:T.CARD,borderRadius:12,padding:"12px 6px",textAlign:"center",boxShadow:T.SHA}}>
                  <p style={{margin:"0 0 2px",fontFamily:SANS,fontSize:17,fontWeight:800,color:T.DARK,lineHeight:1}}>{v}</p>
                  <p style={{margin:0,fontFamily:MONO,fontSize:8,color:T.DIM,letterSpacing:"0.08em"}}>{l}</p>
                </div>
              ))}
            </div>

            <Feedback onFb={fb=>save({...data,lastFeedback:fb})}/>

            {pomo?<Pomodoro onClose={()=>setPomo(false)} color={rc}/>:
              <button onClick={()=>setPomo(true)} style={{width:"100%",padding:"14px",background:T.CARD,color:T.MID,border:"none",borderRadius:R,fontFamily:MONO,fontSize:11,letterSpacing:"0.1em",cursor:"pointer",boxShadow:T.SHA,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <SvgIco d={ICO.clock} color={T.MID} size={14}/>POMODORO 25 MIN
              </button>
            }
            <button onClick={()=>startCheck(false)} style={{width:"100%",padding:"14px",background:T.DARK,color:T.ON_DARK,border:"none",borderRadius:R,fontFamily:SANS,fontSize:14,fontWeight:800,cursor:"pointer",boxShadow:T.SHA2}}>Nuevo check-in</button>
          </div>
        </div>
      )}

      {share&&result&&<ShareSheet result={result} score={sc} onClose={()=>setShare(false)}/>}
      {showNav&&<BottomNav active={tab} onNav={onNav}/>}
    </div>
  );
}
