'use strict';
/* ============================================================
   FISH! — Sound: engine rumble + turbo boost (WebAudio)
   Made by Dave-VR
   ============================================================ */

const Sound = {
  a: null, engOsc: null, engGain: null, engF: null, pinkAt: 0, pinkStep: 0,
  noise: null, noiseGain: null, boostOsc: null, boostGain: null,

  init(){
    if(this.a || typeof window === 'undefined') return;
    try{
      this.a = new (window.AudioContext||window.webkitAudioContext)();
      const a = this.a;
      this.engOsc = a.createOscillator(); this.engOsc.type = 'sawtooth'; this.engOsc.frequency.value = 52;
      this.engF = a.createBiquadFilter(); this.engF.type = 'lowpass'; this.engF.frequency.value = 350;
      this.engGain = a.createGain(); this.engGain.gain.value = 0;
      this.engOsc.connect(this.engF); this.engF.connect(this.engGain); this.engGain.connect(a.destination);
      this.engOsc.start();

      const len = Math.floor(a.sampleRate * 1.2), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
      for(let i = 0; i < len; i++) d[i] = Math.random()*2 - 1;
      this.noise = a.createBufferSource(); this.noise.buffer = buf; this.noise.loop = true; this.noise.start();
      const nf = a.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 750; nf.Q.value = 0.6;
      this.noiseGain = a.createGain(); this.noiseGain.gain.value = 0;
      this.noise.connect(nf); nf.connect(this.noiseGain); this.noiseGain.connect(a.destination);

      this.boostOsc = a.createOscillator(); this.boostOsc.type = 'triangle'; this.boostOsc.frequency.value = 220;
      this.boostGain = a.createGain(); this.boostGain.gain.value = 0;
      this.boostOsc.connect(this.boostGain); this.boostGain.connect(a.destination);
      this.boostOsc.start();
    }catch(e){}
  },

  setEngine(ratio, boost, active){
    if(!G.save || !G.save.sound || !this.a){
      if(this.engGain) this.engGain.gain.value = 0;
      if(this.noiseGain) this.noiseGain.gain.value = 0;
      if(this.boostGain) this.boostGain.gain.value = 0;
      return;
    }
    if(this.a.state === 'suspended') this.a.resume();
    const t = this.a.currentTime;
    const r = Math.max(0, Math.min(1, ratio || 0));
    const run = !!active;
    this.engGain.gain.setTargetAtTime(run ? 0.05 + r*0.09 : 0, t, 0.12);
    this.engOsc.frequency.setTargetAtTime(48 + r*95, t, 0.15);
    this.engF.frequency.setTargetAtTime(300 + r*520, t, 0.15);
    this.noiseGain.gain.setTargetAtTime(run ? 0.015 + r*0.05 : 0, t, 0.1);
    this.boostGain.gain.setTargetAtTime(boost > 0 ? 0.06 : 0, t, 0.05);
    this.boostOsc.frequency.setTargetAtTime(boost > 0 ? 520 : 220, t, 0.08);
  },

  /* Original sparkle cue for the Pinkfong Cruiser's star trail. */
  pinkTrail(){
    if(!G.save || !G.save.sound || !this.a) return;
    const t=this.a.currentTime;
    if(t<this.pinkAt) return;
    this.pinkAt=t+0.34;
    const notes=[784,988,1175,988];
    const o=this.a.createOscillator(), g=this.a.createGain();
    o.type='triangle'; o.frequency.value=notes[this.pinkStep++%notes.length];
    g.gain.setValueAtTime(.035,t); g.gain.exponentialRampToValueAtTime(.001,t+.22);
    o.connect(g); g.connect(this.a.destination); o.start(t); o.stop(t+.23);
  }
};
