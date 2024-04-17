export default class KNXDataBuffer {
  private _data: any;
  private _info: any;

  constructor(_data: any, _info: any) {
    this._data = _data;
    this._info = _info;
  }

  get length(): number {
    return this._data == null ? 0 : this._data.length;
  }

  get value(): any {
    return this._data;
  }

  get info(): any {
    return this._info;
  }

  sixBits(): boolean {
    if (this.info == null) {
      return true;
    }
    // return !(this.info.type.type === '1');
    return this.info.type.type;
  }
}