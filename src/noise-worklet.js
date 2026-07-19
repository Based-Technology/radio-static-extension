// Generates the receiver noise bed: continuous hiss + sparse crackle pops.
// Port of radio-static's noise.py (hiss: gaussian-ish noise; crackle: poisson
// impulses smeared with a ~1 ms exponential decay).

class RadioNoiseProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "hissGain", defaultValue: 0.0158, minValue: 0, maxValue: 1 }, // -36 dBFS
      { name: "crackleGain", defaultValue: 0.0224, minValue: 0, maxValue: 1 }, // -33 dBFS
      { name: "crackleRate", defaultValue: 4, minValue: 0, maxValue: 100 }, // pops/s
    ];
  }

  constructor() {
    super();
    this.crackle = 0;
    // exp decay with ~1 ms time constant
    this.decayCoef = Math.exp(-1 / (0.001 * sampleRate));
  }

  process(_inputs, outputs, parameters) {
    const out = outputs[0];
    if (out.length === 0) return true;
    const n = out[0].length;
    const hissGain = parameters.hissGain[0];
    const crackleGain = parameters.crackleGain[0];
    const pImpulse = parameters.crackleRate[0] / sampleRate;

    for (let i = 0; i < n; i++) {
      // sum of three uniforms ~ gaussian (Irwin-Hall), unit-ish variance
      const hiss =
        Math.random() + Math.random() + Math.random() - 1.5;
      if (Math.random() < pImpulse) {
        const sign = Math.random() < 0.5 ? -1 : 1;
        this.crackle = sign * (0.5 + 0.5 * Math.random());
      }
      this.crackle *= this.decayCoef;
      out[0][i] = hiss * hissGain * 2 + this.crackle * crackleGain;
    }
    for (let ch = 1; ch < out.length; ch++) out[ch].set(out[0]);
    return true;
  }
}

registerProcessor("radio-noise", RadioNoiseProcessor);
