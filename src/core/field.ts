/** Row-major grid of brightness values in [0, 1]. */
export class FieldFrame {
  readonly cols: number;
  readonly rows: number;
  readonly data: Float32Array;

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.data = new Float32Array(cols * rows);
  }

  get(x: number, y: number): number {
    return this.data[y * this.cols + x];
  }

  set(x: number, y: number, v: number): void {
    this.data[y * this.cols + x] = v;
  }
}
