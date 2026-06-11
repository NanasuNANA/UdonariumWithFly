import { ChatPalette } from './chat-palette';
import { SyncObject, SyncVar } from './core/synchronize-object/decorator';
import { DataElement } from './data-element';
import { TabletopObject } from './tabletop-object';
import { UUID } from '@udonarium/core/system/util/uuid';

import { StandList } from './stand-list';
import { Network } from './core/system';
import { PeerCursor } from './peer-cursor';
import { ObjectStore } from './core/synchronize-object/object-store';

@SyncObject('character')
export class GameCharacter extends TabletopObject {
  constructor(identifier: string = UUID.generateUuid()) {
    super(identifier);
    this.isAltitudeIndicate = true;
  }

  @SyncVar() rotate: number = 0;
  @SyncVar() roll: number = 0;
  @SyncVar() isDropShadow: boolean = true;
  @SyncVar() isShowChatBubble: boolean = true;
  @SyncVar() owner: string = '';
  @SyncVar() isAllowsChat: boolean = true;
  
  text = '';
  dialog = null;
  isEmote = false;
  isLoaded = false;

  //汚い、別の方法ないか
  chatBubbleAltitude = 0;

  get name(): string { return this.getCommonValue('name', ''); }
  set name(name) { this.setCommonValue('name', name); }
  get size(): number { return this.getCommonValue('size', 1); }
  get height(): number {
    let element = this.getElement('height', this.commonDataElement);
    //if (!element && this.commonDataElement) {
    //  this.commonDataElement.insertBefore(DataElement.create('height', 0, { 'currentValue': '' }, 'height_' + this.identifier), this.getElement('altitude', this.commonDataElement));
    //}
    let num = element ? +element.value : 0;
    if (element && element.currentValue) num = (Number.isNaN(num) ? 0 : num) * this.size;
    return Number.isNaN(num) ? 0 : num;
  }

  get chatPalette(): ChatPalette {
    for (let child of this.children) {
      if (child instanceof ChatPalette) return child;
    }
    return null;
  }

  get ownerName(): string {
    let object = PeerCursor.findByUserId(this.owner);
    return object ? object.name : null;
  }

  get ownerColor(): string {
    let object = PeerCursor.findByUserId(this.owner);
    return object ? object.color : '#444444';
  }
  
  get standList(): StandList {
    for (let child of this.children) {
      if (child instanceof StandList) return child;
    }
    let standList = new StandList('StandList_' + this.identifier);
    standList.initialize();
    this.appendChild(standList);
    return standList;
  }

  static create(name: string, size: number, imageIdentifier: string): GameCharacter {
    let gameCharacter: GameCharacter = new GameCharacter();
    gameCharacter.createDataElements();
    gameCharacter.initialize();
    gameCharacter.createTestGameDataElement(name, size, imageIdentifier);

    return gameCharacter;
  }

  get isHideIn(): boolean { return !!this.owner; }
  get isVisible(): boolean { return !this.owner || Network.peer.userId === this.owner; }

  static get isStealthMode(): boolean {
    for (const character of ObjectStore.instance.getObjects(GameCharacter)) {
      if (character.isHideIn && character.isVisible && character.location.name === 'table') return true;
    }
    return false;
  }

  complement(): void {
    let element = this.getElement('altitude', this.commonDataElement);
    if (!element && this.commonDataElement) {
      this.commonDataElement.appendChild(DataElement.create('altitude', 0, {}, 'altitude_' + this.identifier));
    }
    element = this.getElement('height', this.commonDataElement);
    if (!element && this.commonDataElement) {
      this.commonDataElement.insertBefore(DataElement.create('height', 0, { 'currentValue': '' }, 'height_' + this.identifier), this.getElement('altitude', this.commonDataElement));
    }
  }

  createTestGameDataElement(name: string, size: number, imageIdentifier: string) {
    this.createDataElements();

    let nameElement: DataElement = DataElement.create('name', name, {}, 'name_' + this.identifier);
    let sizeElement: DataElement = DataElement.create('size', size, {}, 'size_' + this.identifier);
    let heightElement: DataElement = DataElement.create('height', 0, { 'currentValue': '' }, 'height_' + this.identifier);
    let altitudeElement: DataElement = DataElement.create('altitude', 0, {}, 'altitude_' + this.identifier);

    if (this.imageDataElement.getFirstElementByName('imageIdentifier')) {
      this.imageDataElement.getFirstElementByName('imageIdentifier').value = imageIdentifier;
    }

    let resourceElement: DataElement = DataElement.create('資源', '', {}, '資源' + this.identifier);
    let hpElement: DataElement = DataElement.create('HP', 200, { 'type': 'numberResource', 'currentValue': '200' }, 'HP_' + this.identifier);
    let mpElement: DataElement = DataElement.create('MP', 100, { 'type': 'numberResource', 'currentValue': '100' }, 'MP_' + this.identifier);

    this.commonDataElement.appendChild(nameElement);
    this.commonDataElement.appendChild(sizeElement);
    this.commonDataElement.appendChild(heightElement);
    this.commonDataElement.appendChild(altitudeElement);

    this.detailDataElement.appendChild(resourceElement);
    resourceElement.appendChild(hpElement);
    resourceElement.appendChild(mpElement);

    //TEST
    let testElement: DataElement = DataElement.create('資訊', '', {}, '資訊' + this.identifier);
    this.detailDataElement.appendChild(testElement);
    testElement.appendChild(DataElement.create('說明', '在此撰寫說明', { 'type': 'note' }, '說明' + this.identifier));
    testElement.appendChild(DataElement.create('備注', '任意文字', { 'type': 'note' }, '備注' + this.identifier));
    testElement.appendChild(DataElement.create('參考URL', 'https://www.example.com', { 'type': 'url' }, '參考URL' + this.identifier));

    //TEST
    testElement = DataElement.create('能力', '', {}, '能力' + this.identifier);
    this.detailDataElement.appendChild(testElement);
    testElement.appendChild(DataElement.create('靈巧', 24, { 'type': 'abilityScore', 'currentValue': 'div6' }, '靈巧' + this.identifier));
    testElement.appendChild(DataElement.create('敏捷', 24, { 'type': 'abilityScore', 'currentValue': 'div6' }, '敏捷' + this.identifier));
    testElement.appendChild(DataElement.create('力量', 24, { 'type': 'abilityScore', 'currentValue': 'div6' }, '力量' + this.identifier));
    testElement.appendChild(DataElement.create('生命力', 24, { 'type': 'abilityScore', 'currentValue': 'div6' }, '生命力' + this.identifier));
    testElement.appendChild(DataElement.create('智力', 24, { 'type': 'abilityScore', 'currentValue': 'div6' }, '智力' + this.identifier));
    testElement.appendChild(DataElement.create('精神力', 24, { 'type': 'abilityScore', 'currentValue': 'div6' }, '精神力' + this.identifier));

    //TEST
    testElement = DataElement.create('戰鬥技能', '', {}, '戰鬥技能' + this.identifier);
    this.detailDataElement.appendChild(testElement);
    testElement.appendChild(DataElement.create('Lv1', '全力攻擊', {}, 'Lv1' + this.identifier));
    testElement.appendChild(DataElement.create('Lv3', '武器熟練/劍', {}, 'Lv3' + this.identifier));
    testElement.appendChild(DataElement.create('Lv5', '武器熟練/劍Ⅱ', {}, 'Lv5' + this.identifier));
    testElement.appendChild(DataElement.create('Lv7', '堅韌', {}, 'Lv7' + this.identifier));
    testElement.appendChild(DataElement.create('Lv9', '橫掃', {}, 'Lv9' + this.identifier));
    testElement.appendChild(DataElement.create('自動', '治療適性', {}, '自動' + this.identifier));

    let domParser: DOMParser = new DOMParser();
    let gameCharacterXMLDocument: Document = domParser.parseFromString(this.rootDataElement.toXml(), 'application/xml');

    let palette: ChatPalette = new ChatPalette('ChatPalette_' + this.identifier);
    palette.setPalette(`チャットパレット入力例：
2d6+1 ダイス擲骰
１ｄ２０＋{敏捷}＋｛格闘｝　{name}の格闘！
:ｈｐ-3d6 2d20KH1+{靈巧}+2>=15 《{Lv1}》を使用　HP｛＄1｝
:HP={最大HP}:MP-10 HP全回復！ MP{$2}、HP{HP} → {$HP}（{$1}点回復）
//敏捷=10+{敏捷A}
//敏捷A=10
//格闘＝１`);
    palette.initialize();
    this.appendChild(palette);

    let standList = new StandList('StandList_' + this.identifier);
    standList.initialize();
    this.appendChild(standList);
  }
}
