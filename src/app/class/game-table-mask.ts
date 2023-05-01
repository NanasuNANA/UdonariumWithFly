import { SyncObject, SyncVar } from './core/synchronize-object/decorator';
import { Network } from './core/system';
import { DataElement } from './data-element';
import { PeerCursor } from './peer-cursor';
import { TabletopObject } from './tabletop-object';

@SyncObject('table-mask')
export class GameTableMask extends TabletopObject {
  @SyncVar() isLock: boolean = false;
  @SyncVar() blendType: number = 0;
  @SyncVar() isTransparentOnGMMode: boolean = false;

  @SyncVar() owner: string = '';
  @SyncVar() scratchingGrids: string = '';
  @SyncVar() scratchedGrids: string = '';
  @SyncVar() isScratchPreviewOnGMMode = false;
  @SyncVar() isPreview = false;

  get name(): string { return this.getCommonValue('name', ''); }
  get width(): number { return this.getCommonValue('width', 1); }
  get height(): number { return this.getCommonValue('height', 1); }
  get opacity(): number {
    let element = this.getElement('opacity', this.commonDataElement);
    let num = element ? <number>element.currentValue / <number>element.value : 1;
    return Number.isNaN(num) ? 1 : num;
  }
  
  get fontsize(): number { 
    let element = this.getElement('fontsize', this.commonDataElement);
    return element ? +element.value : 18;
  }
  set fontsize(fontsize: number) { this.setCommonValue('fontsize', fontsize); }
  
  get text(): string { 
    let element = this.getElement('text', this.commonDataElement);
    return element ? element.value + '' : '';
  }
  set text(text: string) { this.setCommonValue('text', text); }

  get color(): string { 
    let element = this.getElement('color', this.commonDataElement);
    return element ? element.value + '' : '#555555';
  }
  set color(color: string) { this.setCommonValue('color', color); }

  get bgcolor(): string { 
    let element = this.getElement('color', this.commonDataElement);
    return element ? element.currentValue + '' : '#0a0a0a';
  }
  set bgcolor(bgcolor: string) { 
    let element = this.getElement('color', this.commonDataElement);
    if (element) element.currentValue = bgcolor;
  }

  get ownerName(): string {
    let object = PeerCursor.findByUserId(this.owner);
    return object ? object.name : '';
  }

  get ownerColor(): string {
    let object = PeerCursor.findByUserId(this.owner);
    return object ? object.color : '#444444';
  }

  get hasOwner(): boolean { return 0 < this.owner.length; }
  get ownerIsOnline(): boolean { return this.hasOwner && (this.isMine || Network.peers.some(peer => peer.userId === this.owner && peer.isOpen)); }
  get isMine(): boolean { return Network.peer.userId === this.owner; }

  complement(): void {
    let element = this.getElement('fontsize', this.commonDataElement);
    if (!element && this.commonDataElement) {
      this.commonDataElement.appendChild(DataElement.create('fontsize', 18, { }, 'fontsize_' + this.identifier));
    }
    element = this.getElement('text', this.commonDataElement);
    if (!element && this.commonDataElement) {
      this.commonDataElement.appendChild(DataElement.create('text', '', { type: 'note', currentValue: '' }, 'text_' + this.identifier));
    }
    element = this.getElement('color', this.commonDataElement);
    if (!element && this.commonDataElement) {
      this.commonDataElement.appendChild(DataElement.create('color', "#555555", { type: 'colors', currentValue: '#0a0a0a' }, 'color_' + this.identifier));
    }
    element = this.getElement('altitude', this.commonDataElement);
    if (!element && this.commonDataElement) {
      this.commonDataElement.appendChild(DataElement.create('altitude', 0, {}, 'altitude_' + this.identifier));
    }
  }

  static create(name: string, width: number, height: number, opacity: number, identifier?: string): GameTableMask {
    let object: GameTableMask = null;

    if (identifier) {
      object = new GameTableMask(identifier);
    } else {
      object = new GameTableMask();
    }
    object.createDataElements();

    object.commonDataElement.appendChild(DataElement.create('name', name, {}, 'name_' + object.identifier));
    object.commonDataElement.appendChild(DataElement.create('width', width, {}, 'width_' + object.identifier));
    object.commonDataElement.appendChild(DataElement.create('height', height, {}, 'height_' + object.identifier));
    object.commonDataElement.appendChild(DataElement.create('opacity', opacity, { type: 'numberResource', currentValue: opacity }, 'opacity_' + object.identifier));
    object.commonDataElement.appendChild(DataElement.create('fontsize', 18, { }, 'fontsize_' + object.identifier));
    object.commonDataElement.appendChild(DataElement.create('text', '', { type: 'note', currentValue: '' }, 'text_' + object.identifier));
    object.commonDataElement.appendChild(DataElement.create('color', "#555555", { type: 'colors' , currentValue: '#0a0a0a' }, 'ccolor_' + object.identifier));
    object.commonDataElement.appendChild(DataElement.create('altitude', 0, { }, 'altitude_' + object.identifier));
    object.initialize();

    return object;
  }
}
