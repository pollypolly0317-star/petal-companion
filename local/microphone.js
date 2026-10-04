class MicrophoneProcessor extends AudioWorkletProcessor {
  constructor() { super(); this.buffer = []; this.count = 0; }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (input) {
      this.buffer.push(new Float32Array(input));
      this.count += input.length;
      if (this.count >= 2048) {
        const samples = new Float32Array(this.count);
        let offset = 0;
        for (const chunk of this.buffer) { samples.set(chunk, offset); offset += chunk.length; }
        this.port.postMessage(samples, [samples.buffer]);
        this.buffer = []; this.count = 0;
      }
    }
    return true;
  }
}
registerProcessor("microphone", MicrophoneProcessor);
