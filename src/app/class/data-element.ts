import { Attributes } from './core/synchronize-object/attributes';
import { SyncObject, SyncVar } from './core/synchronize-object/decorator';
import { ObjectNode } from './core/synchronize-object/object-node';
import { StringUtil } from './core/system/util/string-util';

@SyncObject('data')
export class DataElement extends ObjectNode {
  @SyncVar() name: string;
  @SyncVar() type: string;
  @SyncVar() currentValue: number | string;

  get isSimpleNumber(): boolean { return this.type != null && this.type === 'simpleNumber'; }
  get isNumberResource(): boolean { return this.type != null && this.type === 'numberResource'; }
  get isCheckProperty(): boolean { return this.type != null && this.type === 'checkProperty'; }
  get isNote(): boolean { return this.type != null && this.type === 'note'; }
  get isAbilityScore(): boolean { return this.type != null && this.type === 'abilityScore'; }
  get isUrl(): boolean { return this.type != null && this.type === 'url'; }

  public static create(name: string, value: number | string = '', attributes: Attributes = {}, identifier: string = ''): DataElement {
    let dataElement: DataElement;
    if (identifier && 0 < identifier.length) {
      dataElement = new DataElement(identifier);
    } else {
      dataElement = new DataElement();
    }
    dataElement.attributes = attributes;
    dataElement.name = name;
    dataElement.value = value;
    dataElement.initialize();

    return dataElement;
  }

  get loggingValue(): string {
    let ret: string;
    if (this.isSimpleNumber) {
      ret = `${this.value}`;
    } else if (this.isNumberResource) {
      ret = `${this.currentValue}/${this.value && this.value != 0 ? this.value : '???'}`;
    } else if (this.isCheckProperty) {
      ret = `${this.value ? ' → ✔ON' : ' → OFF'}`;
    } else if (this.isAbilityScore) {
      const modifire = this.calcAbilityScore();
      ret = `${this.value}`;
      if (this.currentValue) ret += `(${modifire >= 0 ? '+' : ''}${modifire})`;
    } else {
      ret = this.value ? this.value.toString() : '';
    }
    return ret;
  }

  getElementsByName(name: string): DataElement[] {
    let children: DataElement[] = [];
    for (let child of this.children) {
      if (child instanceof DataElement) {
        if (child.getAttribute('name') === name) children.push(child);
        Array.prototype.push.apply(children, child.getElementsByName(name));
      }
    }
    return children;
  }

  getElementsByType(type: string): DataElement[] {
    let children: DataElement[] = [];
    for (let child of this.children) {
      if (child instanceof DataElement) {
        if (child.getAttribute('type') === type) children.push(child);
        Array.prototype.push.apply(children, child.getElementsByType(type));
      }
    }
    return children;
  }

  getFirstElementByName(name: string): DataElement {
    for (let child of this.children) {
      if (child instanceof DataElement) {
        if (child.getAttribute('name') === name) return child;
        let match = child.getFirstElementByName(name);
        if (match) return match;
      }
    }
    return null;
  }

  getFirstElementByNameUnsensitive(name: string, replacePattern: string|RegExp = null, replacement=''): DataElement {
    for (let child of this.children) {
      if (child instanceof DataElement) {
        let normalizeName = StringUtil.toHalfWidth(name.replace(/[―ー—‐]/g, '-')).toLowerCase();
        if (replacePattern != null) normalizeName = normalizeName.replace(replacePattern, replacement);
        if (StringUtil.toHalfWidth(child.getAttribute('name').replace(/[―ー—‐]/g, '-')).toLowerCase() === normalizeName) return child;
        let match = child.getFirstElementByNameUnsensitive(name, replacePattern, replacement);
        if (match) return match;
      }
    }
    return null;
  }

  calcAbilityScore(): number {
    if (!this.isAbilityScore || !this.value) return 0;
    let match;
    if (match = this.currentValue.toString().match(/^div(\d+)$/)) {
      return Math.floor(+this.value / +match[1]);
    // 現状3.0以降のみ
    } else if (match = this.currentValue.toString().match(/^DnD/)) {
      return Math.floor((+this.value - 10) / 2);
    } else {
      return +this.value;
    }
  }

  checkValue(): string {
    if (!this.isCheckProperty) return '0';
    let pair = (this.currentValue + '').trim().split(/[|｜]/g, 2);
    if (pair[1] == null) {
      pair[1] = '0'
      if (pair[0] == null || (pair[0].trim() === '' && !/[|｜]/.test(this.currentValue + ''))) pair[0] = '1';
    } 
    return pair[ this.value ? 0 : 1 ].trim();
  }
}
