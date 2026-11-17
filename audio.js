// Audio synthesis using Web Audio API (No external sound files required)
class SoundFX {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playCorrect() {
        if (!this.enabled) return;
        this.init();
        const now = this.ctx.currentTime;
        
        // Happy arpeggio
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.08);
            
            gain.gain.setValueAtTime(0, now + idx * 0.08);
            gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.08 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.3);
            
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.start(now + idx * 0.08);
            osc.stop(now + idx * 0.08 + 0.35);
        });
    }

    playWrong() {
        if (!this.enabled) return;
        this.init();
        const now = this.ctx.currentTime;
        
        // Harsh buzzer / elimination sound
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        
        osc1.frequency.setValueAtTime(140, now);
        osc1.frequency.linearRampToValueAtTime(80, now + 0.45);
        
        osc2.frequency.setValueAtTime(146, now);
        osc2.frequency.linearRampToValueAtTime(83, now + 0.45);
        
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.5);
        osc2.stop(now + 0.5);
    }

    playTick() {
        if (!this.enabled) return;
        this.init();
        const now = this.ctx.currentTime;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(now);
        osc.stop(now + 0.06);
    }

    playEliminated() {
        if (!this.enabled) return;
        this.init();
        const now = this.ctx.currentTime;
        
        // Dramatic doom boom
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.8);
        
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(now);
        osc.stop(now + 0.9);
    }

    playFanfare() {
        if (!this.enabled) return;
        this.init();
        const now = this.ctx.currentTime;
        const notes = [
            { f: 523.25, d: 0.15 },
            { f: 659.25, d: 0.15 },
            { f: 783.99, d: 0.15 },
            { f: 1046.50, d: 0.4 }
        ];
        
        let t = now;
        notes.forEach(n => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(n.f, t);
            gain.gain.setValueAtTime(0.25, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + n.d);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + n.d);
            t += n.d * 0.9;
        });
    }
}

window.soundFX = new SoundFX();
