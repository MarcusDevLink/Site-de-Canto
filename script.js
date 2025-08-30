let audioCtx, analyser, source, dataArray;
let isRunning = false;
let animationId;
let recordedNotes = [];
let isRecording = false;

const noteEl = document.getElementById("note");
const freqEl = document.getElementById("freq");
const canvas = document.getElementById("visualizer");
const ctx = canvas.getContext("2d");

// Mapeia notas musicais
const noteStrings = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function freqToNote(freq) {
  const noteNum = 12 * (Math.log2(freq / 440)) + 69;
  return Math.round(noteNum);
}

function noteFromNum(num) {
  const octave = Math.floor(num / 12) - 1;
  const note = noteStrings[num % 12];
  return `${note}${octave}`;
}

// Captura do microfone
async function initAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  source = audioCtx.createMediaStreamSource(stream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  dataArray = new Float32Array(analyser.fftSize);
  source.connect(analyser);
  draw();
}

// Detecção de pitch via autocorrelação
function autoCorrelate(buf, sampleRate) {
  let SIZE = buf.length;
  let rms = 0;

  for (let i=0;i<SIZE;i++) {
    let val = buf[i];
    rms += val*val;
  }
  rms = Math.sqrt(rms/SIZE);
  if (rms<0.01) return -1;

  let r1=0, r2=SIZE-1, thres=0.2;
  for (let i=0;i<SIZE/2;i++) if (Math.abs(buf[i])<thres) {r1=i; break;}
  for (let i=1;i<SIZE/2;i++) if (Math.abs(buf[SIZE-i])<thres) {r2=SIZE-i; break;}
  buf = buf.slice(r1,r2);
  SIZE = buf.length;

  let c = new Array(SIZE).fill(0);
  for (let i=0;i<SIZE;i++) for (let j=0;j<SIZE-i;j++) c[i] = c[i]+buf[j]*buf[j+i];

  let d=0; while(c[d]>c[d+1]) d++;
  let maxval=-1, maxpos=-1;
  for (let i=d;i<SIZE;i++) {
    if(c[i]>maxval){maxval=c[i];maxpos=i;}
  }
  let T0 = maxpos;

  return sampleRate/T0;
}

// Loop de análise
function draw() {
  analyser.getFloatTimeDomainData(dataArray);
  const pitch = autoCorrelate(dataArray, audioCtx.sampleRate);

  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.beginPath();
  ctx.strokeStyle = "#6c5ce7";
  ctx.lineWidth = 2;
  for(let i=0;i<dataArray.length;i++){
    let x = (i/canvas.width)*canvas.width;
    let y = (0.5 + dataArray[i]/2)*canvas.height;
    if(i===0) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  }
  ctx.stroke();

  if(pitch !== -1) {
    const noteNum = freqToNote(pitch);
    const noteName = noteFromNum(noteNum);
    noteEl.textContent = noteName;
    freqEl.textContent = pitch.toFixed(2)+" Hz";

    if(isRecording){
      recordedNotes.push({note: noteNum, time: Date.now()});
    }
  } else {
    noteEl.textContent = "--";
    freqEl.textContent = "0 Hz";
  }

  animationId = requestAnimationFrame(draw);
}

// Botões
document.getElementById("startBtn").addEventListener("click", () => {
  if(!isRunning){
    initAudio();
    isRunning = true;
    document.getElementById("startBtn").textContent = "⏹️ Parar";
  } else {
    cancelAnimationFrame(animationId);
    audioCtx.close();
    isRunning = false;
    document.getElementById("startBtn").textContent = "🎤 Iniciar";
  }
});

document.getElementById("recordBtn").addEventListener("click", () => {
  isRecording = !isRecording;
  if(isRecording){
    recordedNotes = [];
    document.getElementById("recordBtn").textContent = "⏹️ Parar Gravação";
  } else {
    document.getElementById("recordBtn").textContent = "⏺️ Gravar";
    document.getElementById("downloadBtn").disabled = recordedNotes.length === 0;
  }
});

document.getElementById("downloadBtn").addEventListener("click", () => {
  if(recordedNotes.length === 0) return;
  const track = new MidiWriter.Track();
  track.addEvent(new MidiWriter.ProgramChangeEvent({instrument: 1}));
  recordedNotes.forEach(n=>{
    track.addEvent(new MidiWriter.NoteEvent({pitch:[noteFromNum(n.note)], duration:'4'}));
  });
  const write = new MidiWriter.Writer(track);
  const blob = new Blob([write.buildFile()], {type:"audio/midi"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "record.mid";
  a.click();
});
