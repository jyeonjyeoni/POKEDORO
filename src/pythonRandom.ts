const STATE_SIZE = 624;
const PERIOD = 397;
const MATRIX_A = 0x9908b0df;
const UPPER_MASK = 0x80000000;
const LOWER_MASK = 0x7fffffff;

/** CPython 3.14 random.Random's MT19937 core for non-negative integer seeds. */
export class PythonRandom {
  private readonly state = new Uint32Array(STATE_SIZE);
  private index = STATE_SIZE;

  constructor(seedWordsLittleEndian: readonly number[]) {
    this.initByArray(seedWordsLittleEndian.length ? seedWordsLittleEndian : [0]);
  }

  private initGenRand(seed: number) {
    this.state[0] = seed >>> 0;
    for (let i = 1; i < STATE_SIZE; i++) {
      const previous = this.state[i - 1];
      this.state[i] = (Math.imul(previous ^ (previous >>> 30), 1812433253) + i) >>> 0;
    }
    this.index = STATE_SIZE;
  }

  private initByArray(key: readonly number[]) {
    this.initGenRand(19650218);
    let i = 1;
    let j = 0;
    let count = Math.max(STATE_SIZE, key.length);
    while (count-- > 0) {
      const previous = this.state[i - 1];
      const mixed = Math.imul(previous ^ (previous >>> 30), 1664525);
      this.state[i] = ((this.state[i] ^ mixed) + (key[j] >>> 0) + j) >>> 0;
      i++;
      j++;
      if (i >= STATE_SIZE) {
        this.state[0] = this.state[STATE_SIZE - 1];
        i = 1;
      }
      if (j >= key.length) j = 0;
    }
    count = STATE_SIZE - 1;
    while (count-- > 0) {
      const previous = this.state[i - 1];
      const mixed = Math.imul(previous ^ (previous >>> 30), 1566083941);
      this.state[i] = ((this.state[i] ^ mixed) - i) >>> 0;
      i++;
      if (i >= STATE_SIZE) {
        this.state[0] = this.state[STATE_SIZE - 1];
        i = 1;
      }
    }
    this.state[0] = 0x80000000;
  }

  private nextUint32(): number {
    if (this.index >= STATE_SIZE) {
      let i = 0;
      for (; i < STATE_SIZE - PERIOD; i++) {
        const value = (this.state[i] & UPPER_MASK) | (this.state[i + 1] & LOWER_MASK);
        this.state[i] = (this.state[i + PERIOD] ^ (value >>> 1) ^ ((value & 1) ? MATRIX_A : 0)) >>> 0;
      }
      for (; i < STATE_SIZE - 1; i++) {
        const value = (this.state[i] & UPPER_MASK) | (this.state[i + 1] & LOWER_MASK);
        this.state[i] = (this.state[i + PERIOD - STATE_SIZE] ^ (value >>> 1) ^ ((value & 1) ? MATRIX_A : 0)) >>> 0;
      }
      const value = (this.state[STATE_SIZE - 1] & UPPER_MASK) | (this.state[0] & LOWER_MASK);
      this.state[STATE_SIZE - 1] = (this.state[PERIOD - 1] ^ (value >>> 1) ^ ((value & 1) ? MATRIX_A : 0)) >>> 0;
      this.index = 0;
    }

    let value = this.state[this.index++];
    value ^= value >>> 11;
    value ^= (value << 7) & 0x9d2c5680;
    value ^= (value << 15) & 0xefc60000;
    value ^= value >>> 18;
    return value >>> 0;
  }

  getRandBits(bits: number): number {
    if (!Number.isInteger(bits) || bits < 1 || bits > 32) throw new RangeError('bits must be between 1 and 32');
    return this.nextUint32() >>> (32 - bits);
  }

  randRange(stop: number): number {
    if (!Number.isSafeInteger(stop) || stop <= 0) throw new RangeError('stop must be a positive safe integer');
    const bits = Math.floor(Math.log2(stop)) + 1;
    let value: number;
    do value = this.getRandBits(bits); while (value >= stop);
    return value;
  }
}
