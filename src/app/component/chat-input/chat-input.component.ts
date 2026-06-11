import { Component, ElementRef, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { ChatMessage } from '@udonarium/chat-message';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem, Network } from '@udonarium/core/system';
import { PeerContext } from '@udonarium/core/system/network/peer-context';
import { ResettableTimeout } from '@udonarium/core/system/util/resettable-timeout';
import { DiceBot } from '@udonarium/dice-bot';
import { GameCharacter } from '@udonarium/game-character';
import { PeerCursor } from '@udonarium/peer-cursor';
import { TextViewComponent } from 'component/text-view/text-view.component';
import { BatchService } from 'service/batch.service';
import { ChatMessageService } from 'service/chat-message.service';
import { PanelOption, PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';

import { ContextMenuSeparator, ContextMenuService, ContextMenuAction } from 'service/context-menu.service';
import { GameCharacterSheetComponent } from 'component/game-character-sheet/game-character-sheet.component';
import { ChatPaletteComponent } from 'component/chat-palette/chat-palette.component';

import { StringUtil } from '@udonarium/core/system/util/string-util';
import { PresetSound, SoundEffect } from '@udonarium/sound-effect';
import { StandSettingComponent } from 'component/stand-setting/stand-setting.component';

import { PeerMenuComponent } from 'component/peer-menu/peer-menu.component';
import { ChatTab } from '@udonarium/chat-tab';
import { CutInList } from '@udonarium/cut-in-list';
import { DiceRollTableList } from '@udonarium/dice-roll-table-list';
import { DataElement } from '@udonarium/data-element';

interface StandGroup {
  name: string,
  stands: string[]
}

@Component({
  selector: 'chat-input',
  templateUrl: './chat-input.component.html',
  styleUrls: ['./chat-input.component.css']
})
export class ChatInputComponent implements OnInit, OnDestroy {
  @ViewChild('textArea', { static: true }) textAreaElementRef: ElementRef<HTMLTextAreaElement>;

  @Input() onlyCharacters: boolean = false;
  @Input() chatTabidentifier: string = '';
  get isUseStandImageOnChatTab(): boolean {
    const chatTab = <ChatTab>ObjectStore.instance.get(this.chatTabidentifier);
    return chatTab && chatTab.isUseStandImage;
  }

  @Input('gameType') _gameType: string = '';
  @Output() gameTypeChange = new EventEmitter<string>();
  get gameType(): string { return this._gameType };
  set gameType(gameType: string) { this._gameType = gameType; this.gameTypeChange.emit(gameType); }

  @Input('sendFrom') _sendFrom: string = this.myPeer ? this.myPeer.identifier : '';
  @Output() sendFromChange = new EventEmitter<string>();
  get sendFrom(): string { return this._sendFrom };
  set sendFrom(sendFrom: string) { this._sendFrom = sendFrom; this.sendFromChange.emit(sendFrom); }

  @Input('sendTo') _sendTo: string = '';
  @Output() sendToChange = new EventEmitter<string>();
  get sendTo(): string { return this._sendTo };
  set sendTo(sendTo: string) { this._sendTo = sendTo; this.sendToChange.emit(sendTo); }

  @Input('text') _text: string = '';
  @Output() textChange = new EventEmitter<string>();
  get text(): string { return this._text };
  set text(text: string) {
    this._text = text;
    this.textChange.emit(text);
    if (text != null && this.isFilterTextUpdate) this.filterText = text;
  }

  isFilterTextUpdate = false;
  @Input('filterText') _filterText: string = '';
  @Output() filterTextChange = new EventEmitter<string>();
  get filterText(): string { return this._filterText };
  set filterText(filterText: string) { this._filterText = filterText; this.filterTextChange.emit(filterText); }

  @Output() moveToPalette = new EventEmitter<string>();

  @Output() chat = new EventEmitter<{ 
    text: string, gameType: string, sendFrom: string, sendTo: string,
    color?: string, 
    isInverse?:boolean, 
    isHollow?: boolean, 
    isBlackPaint?: boolean, 
    aura?: number, 
    isUseFaceIcon?: boolean, 
    characterIdentifier?: string, 
    standIdentifier?: string, 
    standName?: string,
    isUseStandImage?: boolean }>();

  get isDirect(): boolean { return this.sendTo != null && this.sendTo.length ? true : false }
  gameHelp: string|string[] = '';

  isUseFaceIcon: boolean = true;
  isUseStandImage: boolean = true;
  isUseChatBalloon: boolean = true;
  
  static history: string[] = new Array();
  private currentHistoryIndex: number = -1;
  private static MAX_HISTORY_NUM = 1000;
  private tmpText;

  get character(): GameCharacter {
    let object = ObjectStore.instance.get(this.sendFrom);
    if (object instanceof GameCharacter) {
      return object;
    }
    return null;
  }

  get hasStand(): boolean {
    if (!this.character || !this.character.standList) return false;
    return this.character.standList.standElements.length > 0;
  }

  get standNameList(): string[] {
    if (!this.hasStand) return [];
    let ret: string[] = [];
    for (let standElement of this.character.standList.standElements) {
      let nameElement = standElement.getFirstElementByName('name');
      if (nameElement && nameElement.value != null && nameElement.value.toString().trim() != '' && ret.indexOf(nameElement.value.toString()) < 0) {
        ret.push(nameElement.value.toString());
      }
    }
    return this.character.standList.isSortNameList ? ret.sort() : ret;
  }
  standName: string = '';

  get standListNoGroup(): [] {
    return [];
  }

  // 未使用
  get standListWithGroup(): StandGroup[] {
    if (!this.hasStand) return [];
    let ret = {};
    const nameElements = this.character.standList.standElements.map((standElement) => standElement.getFirstElementByName('name')).filter(e => e);
    nameElements.sort((a, b) => a.currentValue === b.currentValue ? 0 : a.currentValue > b.currentValue ? -1 : 1);
    for (const nameElement of nameElements) {
      if (nameElement && nameElement.value) {
        const groupName = (nameElement.currentValue && nameElement.currentValue.toString().length > 0) ? nameElement.currentValue.toString() : '';
        if (groupName) {
          if (!ret[groupName]) ret[groupName] = [];
          if (ret[groupName].indexOf(nameElement.value.toString()) < 0) ret[groupName].push(nameElement.value.toString());
        }
      }
    }
    return Object.keys(ret).sort().map((group) => { return { name: group, stands: ret[group].sort() } }).filter(e => e.stands.length > 0);
  }

  get imageFile(): ImageFile {
    let object = ObjectStore.instance.get(this.sendFrom);
    let image: ImageFile = null;
    if (object instanceof GameCharacter) {
      image = object.imageFile;
    } else if (object instanceof PeerCursor) {
      image = object.image;
    }
    return image ? image : ImageFile.Empty;
  }

  get paletteColor(): string {
    if (this.character 
      && this.character.chatPalette 
      && this.character.chatPalette.paletteColor) {
      return this.character.chatPalette.paletteColor;
    }
    return PeerCursor.CHAT_TRANSPARENT_COLOR; 
  }

  set paletteColor(color: string) {
    this.character.chatPalette.color = color ? color : PeerCursor.CHAT_TRANSPARENT_COLOR;
  }

  get myColor(): string {
    if (PeerCursor.myCursor
      && PeerCursor.myCursor.color
      && PeerCursor.myCursor.color != PeerCursor.CHAT_TRANSPARENT_COLOR) {
      return PeerCursor.myCursor.color;
    }
    return PeerCursor.CHAT_DEFAULT_COLOR;
  }

  get color(): string {
    if (this.paletteColor && this.paletteColor != PeerCursor.CHAT_TRANSPARENT_COLOR) {
      return this.paletteColor;
    } 
    return this.myColor;
  }

  get sendToColor(): string {
    let object = ObjectStore.instance.get(this.sendTo);
    if (object instanceof PeerCursor) {
      return object.color;
    }
    return PeerCursor.CHAT_DEFAULT_COLOR;
  }

  private shouldUpdateCharacterList: boolean = true;
  private _gameCharacters: GameCharacter[] = [];
  get gameCharacters(): GameCharacter[] {
    if (this.shouldUpdateCharacterList) {
      this.shouldUpdateCharacterList = false;
      this._gameCharacters = ObjectStore.instance
        .getObjects<GameCharacter>(GameCharacter)
        .filter(character => (this.allowsChat(character) || (this.character && this.character.identifier === character.identifier)));
    }
    return this._gameCharacters;
  }

  private writingEventInterval: NodeJS.Timeout = null;
  private previousWritingLength: number = 0;

  //writingPeers: Map<string, NodeJS.Timer> = new Map();
  writingPeers: Map<string, ResettableTimeout> = new Map();
  writingPeerNameAndColors: { name: string, color: string, imageUrl: string }[] = [];
  //writingPeerNames: string[] = [];

  get diceBotInfos() { return DiceBot.diceBotInfos }
  get myPeer(): PeerCursor { return PeerCursor.myCursor; }
  get otherPeers(): PeerCursor[] { return [PeerCursor.myCursor, ...Network.peers.filter(peer => peer.isOpen).map(peer => PeerCursor.findByPeerId(peer.peerId))].filter(peerCursor => peerCursor); /** ObjectStore.instance.getObjects(PeerCursor); **/ }

  get diceBotInfosIndexed() { return DiceBot.diceBotInfosIndexed }

  get isAllowsChat(): boolean {
    return !this.character || this.allowsChat(this.character);
  }

  constructor(
    private ngZone: NgZone,
    public chatMessageService: ChatMessageService,
    private batchService: BatchService,
    private panelService: PanelService,
    private pointerDeviceService: PointerDeviceService,
    private contextMenuService: ContextMenuService
  ) { }

  ngOnInit(): void {
    EventSystem.register(this)
      .on('MESSAGE_ADDED', event => {
        if (event.data.tabIdentifier !== this.chatTabidentifier) return;
        let message = ObjectStore.instance.get<ChatMessage>(event.data.messageIdentifier);
        let peerCursor = ObjectStore.instance.getObjects<PeerCursor>(PeerCursor).find(obj => obj.userId === message.from);
        let sendFrom = peerCursor ? peerCursor.peerId : '?';
        if (this.writingPeers.has(sendFrom)) {
          this.writingPeers.get(sendFrom).stop();
          this.writingPeers.delete(sendFrom);
          this.updateWritingPeerNameAndColors();
        }
      })
      .on(`UPDATE_GAME_OBJECT/aliasName/${GameCharacter.aliasName}`, event => {
        this.shouldUpdateCharacterList = true;
        /*
        if (event.data.identifier !== this.sendFrom) return;
        let gameCharacter = ObjectStore.instance.get<GameCharacter>(event.data.identifier);
        if (gameCharacter && !this.allowsChat(gameCharacter)) {
          if (0 < this.gameCharacters.length && this.onlyCharacters) {
            this.sendFrom = this.gameCharacters[0].identifier;
          } else {
            this.sendFrom = this.myPeer.identifier;
          }
        }
        */
      }).on('DELETE_GAME_OBJECT', event => {
        // this.onlyCharacters が真の場合はパネルが閉じる前提
        if (!this.onlyCharacters && this.sendFrom === event.data.identifier) {
          this.sendFrom = this.myPeer.identifier;
          this.onChangeSendFromList();
        }
      })
      .on('DISCONNECT_PEER', event => {
        let object = ObjectStore.instance.get(this.sendTo);
        if (object instanceof PeerCursor && object.peerId === event.data.peerId) {
          this.sendTo = '';
        }
      })
      .on<string>('WRITING_A_MESSAGE', event => {
        if (event.isSendFromSelf || event.data !== this.chatTabidentifier) return;
        if (!this.writingPeers.has(event.sendFrom)) {
          this.writingPeers.set(event.sendFrom, new ResettableTimeout(() => {
            this.writingPeers.delete(event.sendFrom);
            //this.updateWritingPeerNames();
            this.updateWritingPeerNameAndColors();
            this.ngZone.run(() => { });
          }, 2000));
        }
        this.writingPeers.get(event.sendFrom).reset();
        //this.updateWritingPeerNames();
        this.updateWritingPeerNameAndColors();
        //this.batchService.add(() => this.ngZone.run(() => { }), this);
        this.batchService.requireChangeDetection();
      });
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
    this.batchService.remove(this);
  }

  private updateWritingPeerNameAndColors() {
    this.writingPeerNameAndColors = Array.from(this.writingPeers.keys()).map(peerId => {
      let peer = PeerCursor.findByPeerId(peerId);
      return {
        name: (peer ? peer.name : ''),
        color: (peer ? peer.color : PeerCursor.CHAT_TRANSPARENT_COLOR),
        imageUrl: (peer ? peer.image.url : ''),
      };
    });
  }
  
  //private updateWritingPeerNames() {
  //  this.writingPeerNames = Array.from(this.writingPeers.keys()).map(peerId => {
  //    let peer = PeerCursor.findByPeerId(peerId);
  //    return peer ? peer.name : '';
  //  });
  //}

  onInput() {
    if (this.writingEventInterval === null && this.previousWritingLength <= this.text.length) {
      let sendTo: string = null;
      if (this.isDirect) {
        let object = ObjectStore.instance.get(this.sendTo);
        if (object instanceof PeerCursor) {
          let peer = PeerContext.parse(object.peerId);
          if (peer) sendTo = peer.peerId;
        }
      }
      EventSystem.call('WRITING_A_MESSAGE', this.chatTabidentifier, sendTo);
      this.writingEventInterval = setTimeout(() => {
        this.writingEventInterval = null;
      }, 200);
    }
    this.previousWritingLength = this.text.length;
    this.calcFitHeight();
  }

  moveHistory(event: Partial<KeyboardEvent>, direction: number) {
    if (event) event.preventDefault();
    if (this.currentHistoryIndex < 0) this.tmpText = this.text;

    if (direction < 0 && this.currentHistoryIndex < 0) {
      this.currentHistoryIndex = -1;
    } else if (direction > 0 && this.currentHistoryIndex >= ChatInputComponent.history.length - 1) {
      this.currentHistoryIndex = ChatInputComponent.history.length - 1;
      return;
    } else {
      this.currentHistoryIndex = this.currentHistoryIndex + direction;
    }

    let histText: string;
    if (this.currentHistoryIndex < 0) {
      this.currentHistoryIndex = -1;
      histText = (this.tmpText && this.tmpText.length) ? this.tmpText : '';
    } else {
      histText = ChatInputComponent.history[this.currentHistoryIndex];
    }

    this.text = histText;
    this.previousWritingLength = this.text.length;
    let textArea: HTMLTextAreaElement = this.textAreaElementRef.nativeElement;
    textArea.value = histText;
    this.calcFitHeight();
  }

  moveTo(e: Event) {
    if (!this.textAreaElementRef) return;
    if (this.textAreaElementRef.nativeElement.selectionStart != this.textAreaElementRef.nativeElement.selectionEnd) return;
    if (this.textAreaElementRef.nativeElement.selectionStart === this.textAreaElementRef.nativeElement.value.length) {
      this.moveToPalette.emit(this.text);
      e.preventDefault();
    }
  }

  focusInput() {
    if (!this.textAreaElementRef) return;
    this.textAreaElementRef.nativeElement.focus();
  } 

  onChangeSendFromList() {
    this.standName = '';
    this.shouldUpdateCharacterList = true;
  }

  sendChat(event: Partial<KeyboardEvent>) {
    if (event) event.preventDefault();
    //if (!this.text.length) return;
    if (event && event.keyCode !== 13) return;
    if (!this.isAllowsChat) return;
    if (!this.sendFrom.length) this.sendFrom = this.myPeer.identifier;
    
    let text = this.text;
    let targetCharacter = this.character;
    const gameType = this.gameType;
    const sendFrom = this.sendFrom;
    const sendTo = this.sendTo;
    const color = this.color;
    const isUseFaceIcon = this.isUseFaceIcon;
    const standName = this.standName;
    const isUseStandImage = this.isUseStandImage;
    const isUseStandImageOnChatTab = this.isUseStandImageOnChatTab;

    if (this.text != '') {
      ChatInputComponent.history = ChatInputComponent.history.filter(string => string !== this.text);
      ChatInputComponent.history.unshift(this.text);
      if (ChatInputComponent.history.length >= ChatInputComponent.MAX_HISTORY_NUM) {
        ChatInputComponent.history.pop();
      }
      this.currentHistoryIndex = -1;
      this.tmpText = null;
    }

    this.text = '';
    this.previousWritingLength = this.text.length;
    const textArea: HTMLTextAreaElement = this.textAreaElementRef.nativeElement;
    if (textArea) textArea.value = '';
    this.calcFitHeight();
    EventSystem.trigger('MESSAGE_EDITING_START', null);

    (async () => {  
      let matchMostLongText = '';
      let standIdentifier = null;
      const delayRefs: string[] = [];
      // ステータス操作
      if (text != '' && /^[\\￥]+[:：]/.test(text)) {
        // コマンド全体のエスケープ
        text = text.replace(/[\\￥]([:：])/, '$1');
      } else if (text != '' && StringUtil.toHalfWidth(text).startsWith(':')) {
        if (!targetCharacter) {
          this.chatMessageService.sendOperationLog('命令錯誤：目標不是角色');
        } else {
          const commandsInfo = StringUtil.parseCommands(targetCharacter.chatPalette.evaluate(text.substring(1), targetCharacter.rootDataElement));
          text = commandsInfo.endString;
          if (commandsInfo.commands.length) {
            //await (async () => {
              const loggingTexts: string[] = [`${targetCharacter.name == '' ? '(無名角色)' : targetCharacter.name} 的命令：${commandsInfo.commandString}`];
              let isDiceRoll = false;
              for (let i = 0; i < commandsInfo.commands.length; i++) {
                let rollResult = null;
                // ステータス操作のみ
                  try {
                  const command = commandsInfo.commands[i];
                  if (command.isIncomplete) throw '→ 命令錯誤：命令不完整：' + command.targetName;

                  const targetName = targetCharacter.chatPalette.evaluate(command.targetName, targetCharacter.rootDataElement, delayRefs);
                  const operator = StringUtil.toHalfWidth(command.operator);
                  const operateValue = targetCharacter.chatPalette.evaluate(command.value, targetCharacter.rootDataElement, delayRefs);
                  let oldValue: string;
                  let target: DataElement;
                  let delayRef: string;
                  let isOperateNumber = false;
                  let isOperateMaxValue = false;

                  if (target = targetCharacter.detailDataElement.getFirstElementByNameUnsensitive(targetName)) {
                    if (target.isNumberResource || target.isSimpleNumber || target.isAbilityScore) isOperateNumber = true;
                  } else if (
                    target = targetCharacter.detailDataElement.getFirstElementByNameUnsensitive(targetName, /^最大/)
                    || targetCharacter.detailDataElement.getFirstElementByNameUnsensitive(targetName, /^Max[\:\_\-\s]*/i)
                    || targetCharacter.detailDataElement.getFirstElementByNameUnsensitive(targetName, /^初期|^初始/)
                    || targetCharacter.detailDataElement.getFirstElementByNameUnsensitive(targetName, /初期値$|初始值$/)
                    || targetCharacter.detailDataElement.getFirstElementByNameUnsensitive(targetName, /最大値$|最大值$/)
                    || targetCharacter.detailDataElement.getFirstElementByNameUnsensitive(targetName, /^基本/)
                    || targetCharacter.detailDataElement.getFirstElementByNameUnsensitive(targetName, /^原/)
                    || targetCharacter.detailDataElement.getFirstElementByNameUnsensitive(targetName, /\^$/)
                    || targetCharacter.detailDataElement.getFirstElementByNameUnsensitive(targetName, /基本値$|基本值$/)
                    || targetCharacter.detailDataElement.getFirstElementByNameUnsensitive(targetName, /原点$|原點$/)
                  ) {
                    if (target.isNumberResource || target.isAbilityScore) {
                      isOperateNumber = true;
                      isOperateMaxValue = true;
                    } else {
                      target = null;
                    }
                  }
                  
                  if (!target) throw `→ コマンドエラー：${(StringUtil.cr(targetName).trim() == '') ? '(無名變數)' : StringUtil.cr(targetName).trim()} 找不到`;

                  oldValue = target.loggingValue;
                  let value = null;
                  if (command.isEscapeRoll || operator === '>') {
                    value = operateValue;
                  } else {
                    const testHalfWidthText = StringUtil.toHalfWidth(operateValue.replace(/[―ー—‐]/g, '-')).trim();
                    //const rollText = StringUtil.toHalfWidth(operateValue.replace(/[ⅮÐ]/g, 'D').replace(/×/g, '*').replace(/÷/g, '/').replace(/[―ー—‐]/g, '-')).trim();
                    if (StringUtil.cr(testHalfWidthText) == '') {
                      value = '';
                    } else {
                      if (/^[\+\-]?\d+$/.test(testHalfWidthText)) {
                        value = parseInt(testHalfWidthText);
                      } else if (/^[\d\+\-\*\/\(\)]+$/.test(testHalfWidthText.replace(/[ⅮÐ]/g, 'D').replace(/×/g, '*').replace(/÷/g, '/'))) {
                        rollResult = await DiceBot.rollCommandAsync(`C(${testHalfWidthText.replace(/[ⅮÐ]/g, 'D').replace(/×/g, '*').replace(/÷/g, '/')})`, gameType ? gameType : 'DiceBot');
                      } else if (/^[cＣｃ][hＨｈ][oＯｏ][iＩｉ][cＣｃ][eＥｅ]/i.test(operateValue) || /^[a-zA-Z0-9!-/:-@¥[-`{-~\}]+$/.test(testHalfWidthText.replace(/[ⅮÐ]/g, 'D').replace(/×/g, '*').replace(/÷/g, '/'))
                        || DiceRollTableList.instance.diceRollTables.some(diceRollTable => diceRollTable.command != null && (new RegExp('^' + StringUtil.toHalfWidth(diceRollTable.command.replace(/[―ー—‐]/g, '-')).toUpperCase().trim() + '([=+\\-]\\d*)?$')).test(testHalfWidthText.toUpperCase()))) {
                        rollResult = await DiceBot.rollCommandAsync(operateValue, gameType ? gameType : 'DiceBot');
                      } else {
                        value = operateValue;
                      }
                      if (rollResult) {
                        //console.log(rollResult.result)
                        let match = null;
                        if (isOperateNumber && rollResult.result.length > 0 && (match = rollResult.result.match(/\s＞\s(?:成功数|計算結果)?(\-?\d+)$/))) {
                          value = match[1];
                        } else if (target.isCheckProperty && (rollResult.isSuccess || rollResult.isFailure)) {
                          value = rollResult.isSuccess ? '1' : '0';
                        } else if (rollResult.result.length > 0) {
                          value = rollResult.isDiceRollTable ? rollResult.result.split(/\s＞\s/).slice(1).join('') : rollResult.result.split(/\s＞\s/).slice(-1)[0];
                        }
                      } else if (!isOperateNumber) {
                        value = operateValue;
                      }
                    }
                  }
                  //console.log(value)
                  if (value == null 
                    || (rollResult && rollResult.isDiceRollTable && rollResult.isFailure) 
                    || (isOperateNumber && value !== '' && isNaN(value))) {
                    throw `→ ${target.name == '' ? '(無名變數)' : target.name} 操作 → 命令錯誤：` + command.operator + command.value;
                  } else if (target.isUrl && !StringUtil.validUrl(StringUtil.cr(value))) {
                    throw `→ ${target.name == '' ? '(無名變數)' : target.name} 操作 → URL無效：` + command.value;
                  }
                  //console.log(value)
                  if (operator === '>') {
                    if (isOperateNumber) {
                      if (value != '') {
                        if (target.isNumberResource && !isOperateMaxValue) {
                          const dValue: number = parseInt(target.currentValue + '');
                          target.currentValue = parseInt(value);
                          delayRef = (parseInt(value) - dValue).toString();
                        } else {
                          const dValue = target.value == null ? 0 : parseInt(target.value + '');
                          target.value = parseInt(value);
                          delayRef = (parseInt(value) - dValue).toString();
                        }
                      } else {
                        delayRef = '0';
                      }
                    } else if (target.isCheckProperty) {
                      target.value = (value == '' || parseInt(value) == 0 || StringUtil.toHalfWidth(value).toLowerCase() === 'off' || StringUtil.toHalfWidth(value).toLowerCase() === '☐') ? '' : target.name;
                    } else if (target.isNote || target.isUrl) {
                      target.value = StringUtil.cr(value);
                    } else {
                      target.value = StringUtil.cr(value).replace(/(:?\r\n|\r|\n)/g, ' ');
                    }
                  } else if (target.isNumberResource && !isOperateMaxValue) {
                    if (value != null && value.toString() != '') {
                      //console.log(value)
                      const dValue: number = parseInt(target.currentValue + '');
                      const result: number = parseInt((target.currentValue && operator !== '=') ? target.currentValue.toString() : '0') + (parseInt(value) * (operator === '-' ? -1 : 1));
                      if (result <= parseInt(target.currentValue + '')) {
                        target.currentValue = result;
                      } else if (result > parseInt(target.value + '') && parseInt(target.currentValue + '') < parseInt(target.value + '') && parseInt(target.value + '') != 0) {
                        target.currentValue = target.value;
                      } else if (result <= parseInt(target.value + '') || parseInt(target.value + '') == 0) {
                        target.currentValue = result;
                      }
                      delayRef = (parseInt(target.currentValue + '') - dValue).toString();
                    } else {
                      delayRef = '0';
                    }
                  } else if (isOperateNumber) {
                    const dValue: number = target.currentValue == null ? 0 : parseInt(target.value.toString());
                    if (value != null && value.toString() != '') target.value = parseInt(target.value && operator !== '=' ? target.value + '' : '0') + (parseInt(value) * (operator === '-' ? -1 : 1));
                    delayRef = (parseInt(target.value + '') - dValue).toString();
                  } else if (target.isCheckProperty) {
                    //if (operator == '=') {
                    switch (operator) {
                    case '=':
                      target.value = (value === '' || parseInt(value) === 0 || StringUtil.toHalfWidth(value).toLowerCase() === 'off' || StringUtil.toHalfWidth(value).toLowerCase() === '☐') ? '' : target.name;
                      break;
                    case '+':
                      target.value = target.name;
                      break;
                    case '-':
                      target.value = '';
                      break;
                    }
                  } else if (operator === '=') {
                    if (target.isNote || target.isUrl) {
                      target.value = (isNaN(value) || value === '' || target.isUrl) ? StringUtil.cr(value) : parseInt(value);
                    } else {
                      target.value = (isNaN(value) || value === '') ? StringUtil.cr(value).replace(/(:?\r\n|\r|\n)/g, ' ') : parseInt(value);
                    }
                  } else {
                    throw `→ ${target.name === '' ? '(無名變數)' : target.name} 操作 → 命令錯誤：` + command.operator + command.value;
                  }
                  const newValue = target.loggingValue;
                  let loggingText = `→ ${target.name === '' ? '(無名變數)' : target.name} 操作`;
                  if (isOperateNumber) {
                    loggingText += ` ${oldValue} → ${oldValue === newValue ? '未變更' : newValue}`;
                  } else if (target.isCheckProperty) {
                    loggingText += `${oldValue === newValue ? ' 未變更' : newValue}`
                  } else {
                    loggingText += ` "${oldValue}" → ${oldValue === newValue ? '未變更' : '"' + newValue + '"'}`;
                  }
                  if (rollResult) {
                    if (rollResult.isDiceRollTable) {
                      loggingText += ` (${rollResult.tableName}：${rollResult.isEmptyDice ? '' : '🎲'}${rollResult.result.split(/\s＞\s/)[0]})`;
                    } else {
                      loggingText += ` (${ rollResult.result.split(/\s＞\s/g).map((str, j) => (j == 0 ? (rollResult.isEmptyDice ? '計算結果' : '🎲' + gameType + '：' + str.replace(/^c?\(/i, '').replace(/\)$/, '')) : str)).join(' → ') })`;
                    }
                    if (!rollResult.isEmptyDice) isDiceRoll = true;
                  }
                  //console.log(delayRef)
                  loggingTexts.push(loggingText);
                  delayRefs.push(delayRef != null ? delayRef : '');
                  //console.log(delayRefs)
                } catch (error) {
                  // 横着、例外設計すべき
                  if (error instanceof Error) throw error;
                  loggingTexts.push(error);
                  delayRefs.push('');
                  continue;
                }
              }
              if (loggingTexts.length) this.chatMessageService.sendOperationLog(loggingTexts.join("\n"));
              if (isDiceRoll) {
                if (Math.random() < 0.5) {
                  SoundEffect.play(PresetSound.diceRoll1);
                } else {
                  SoundEffect.play(PresetSound.diceRoll2);
                }
              }
            //})();
          }
        }
      }
      if (targetCharacter) {
        text = targetCharacter.chatPalette.evaluate(text, targetCharacter.rootDataElement, delayRefs);
        // スタンド
        // 空文字でもスタンド反応するのは便利かと思ったがメッセージ送信後にもう一度エンター押すだけで誤爆するので指定時のみ
        if (StringUtil.cr(text).trim() || standName) {
          // 立ち絵
          if (targetCharacter.standList) {
            let imageIdentifier = null;
            if (isUseFaceIcon && targetCharacter.faceIcon) {
              imageIdentifier = targetCharacter.faceIcon.identifier;
            } else {
              imageIdentifier = targetCharacter.imageFile ? targetCharacter.imageFile.identifier : null;
            }
            const standInfo = targetCharacter.standList.matchStandInfo(text, imageIdentifier, standName);
            if (isUseStandImage && isUseStandImageOnChatTab) {
              if (standInfo.farewell) {
                this.farewellStand(targetCharacter);
              } else if (standInfo.standElementIdentifier) {
                standIdentifier = standInfo.standElementIdentifier;
                const sendObj = {
                  characterIdentifier: targetCharacter.identifier, 
                  standIdentifier: standInfo.standElementIdentifier, 
                  color: targetCharacter.chatPalette ? targetCharacter.chatPalette.color : PeerCursor.CHAT_DEFAULT_COLOR,
                  secret: sendTo ? true : false
                };
                if (sendObj.secret) {
                  const targetPeer = ObjectStore.instance.get<PeerCursor>(sendTo);
                  if (targetPeer) {
                    if (targetPeer.peerId != PeerCursor.myCursor.peerId) EventSystem.call('POPUP_STAND_IMAGE', sendObj, targetPeer.peerId);
                    EventSystem.call('POPUP_STAND_IMAGE', sendObj, PeerCursor.myCursor.peerId);
                  }
                } else {
                  EventSystem.call('POPUP_STAND_IMAGE', sendObj);
                }
              }
            }
            matchMostLongText = standInfo.matchMostLongText;
          }
        }
      }
      // 插圖
      const cutInInfo = CutInList.instance.matchCutInInfo(text);
      if (isUseStandImageOnChatTab && cutInInfo) {
        for (const identifier of cutInInfo.identifiers) {
          const sendObj = {
            identifier: identifier, 
            secret: sendTo ? true : false,
            sender: PeerCursor.myCursor.peerId
          };
          if (sendObj.secret) {
            const targetPeer = ObjectStore.instance.get<PeerCursor>(sendTo);
            if (targetPeer) {
              if (targetPeer.peerId != PeerCursor.myCursor.peerId) EventSystem.call('PLAY_CUT_IN', sendObj, targetPeer.peerId);
              EventSystem.call('PLAY_CUT_IN', sendObj, PeerCursor.myCursor.peerId);
            }
          } else {
            EventSystem.call('PLAY_CUT_IN', sendObj);
          }
        }
        if (cutInInfo.names && cutInInfo.names.length && !sendTo) {
          const counter = new Map();
          for (const name of cutInInfo.names) {
            let count = counter.get(name) || 0;
            count += 1;
            counter.set(name == '' ? '(無名插圖)' : name, count);
          }
          const text = `${[...counter.keys()].map(key => counter.get(key) > 1 ? `${key}×${counter.get(key)}` : key).join('、')}`;
          this.chatMessageService.sendOperationLog(text + ' 已觸發');
        }
      }
      // 切り取り
      if (matchMostLongText.length < cutInInfo.matchMostLongText.length) matchMostLongText = cutInInfo.matchMostLongText;
      text = text.slice(0, text.length - matchMostLongText.length);
      // 💭
      if (this.isUseChatBalloon && isUseStandImageOnChatTab && targetCharacter && StringUtil.cr(text).trim()) {
        // CHOICEコマンドの引数は💭としない
        const regArray = /^(([sＳｓ][rＲｒ][eＥｅ][pＰｐ][eＥｅ][aＡａ][tＴｔ]|[rＲｒ][eＥｅ][pＰｐ][eＥｅ][aＡａ][tＴｔ]|[sＳｓ][rＲｒ][eＥｅ][pＰｐ]|[rＲｒ][eＥｅ][pＰｐ]|[sＳｓ][xＸｘ]|[xＸｘ])?([\d０-９]+)?[ 　]+)?([\s\S]*)?/igm.exec(text);
        let dialogText = (regArray[4] != null) ? regArray[4].trim() : text.trim();
        let choiceMatch;
        if (/^([sＳｓ]?[cＣｃ][hＨｈ][oＯｏ][iＩｉ][cＣｃ][eＥｅ][\d０-９]*)[ 　]+([^ 　]*)/ig.test(dialogText)) {
          dialogText = '';
        } else if ((choiceMatch = /^([sＳｓ]?[cＣｃ][hＨｈ][oＯｏ][iＩｉ][cＣｃ][eＥｅ][\d０-９]*[\[［][^\]］]+[\]］])/ig.exec(dialogText)) 
                || (choiceMatch = /^([sＳｓ]?[cＣｃ][hＨｈ][oＯｏ][iＩｉ][cＣｃ][eＥｅ][\d０-９]*[\(（][^\)）]+[\)）])/ig.exec(dialogText))) {
          dialogText = dialogText.slice(choiceMatch[1].length)
        }
        //console.log(dialogText)
        //💭はEvant機能使うようにする
        const dialogRegExp = /「+([\s\S]+?)」/gm;
        // const dialogRegExp = /(?:^|[^\￥])「([\s\S]+?[^\￥])」/gm; 
        //ToDO ちゃんとパースする
        let match;
        let dialog = [];
        if ((match = dialogRegExp.exec(dialogText)) !== null) {
          dialog.push(match[1]);
        }
        if (dialog.length === 0) {
          const emoteTest = dialogText.split(/[\s　]/).slice(-1)[0];
          if (StringUtil.isEmote(emoteTest)) {
            dialog.push(emoteTest);
          }
        }
        if (dialog.length > 0) {
          //連続💭とりあえずやめる（複数顯示できないかな）
          //const dialogs = [...dialog, null];
          //const gameCharacter = this.character;
          //const color = this.color;
          
          const dialogObj = {
            characterIdentifier: targetCharacter.identifier, 
            text: dialog.join("\n\n"),
            faceIconIdentifier: (isUseFaceIcon && targetCharacter.faceIcon) ? targetCharacter.faceIcon.identifier : null,
            color: color,
            secret: sendTo ? true : false
          };
          if (dialogObj.secret) {
            const targetPeer = ObjectStore.instance.get<PeerCursor>(sendTo);
            if (targetPeer) {
              if (targetPeer.peerId != PeerCursor.myCursor.peerId) EventSystem.call('POPUP_CHAT_BALLOON', dialogObj, targetPeer.peerId);
              EventSystem.call('POPUP_CHAT_BALLOON', dialogObj, PeerCursor.myCursor.peerId);
            }
          } else {
            EventSystem.call('POPUP_CHAT_BALLOON', dialogObj);
          }
        } else if (StringUtil.cr(text).trim() && targetCharacter.text) {
          EventSystem.call('FAREWELL_CHAT_BALLOON', { characterIdentifier: targetCharacter.identifier });
        }
      }

      if (PeerCursor.isGMHold && !sendTo && !PeerCursor.myCursor.isGMMode && /成為\s*GM|GM\s*Mode/i.test(StringUtil.toHalfWidth(text))) {
        PeerCursor.myCursor.isGMMode = true;
        this.chatMessageService.sendOperationLog('已進入GM模式');
        EventSystem.trigger('CHANGE_GM_MODE', null);
      }

      if (StringUtil.cr(text).trim()) {
        this.chat.emit({
          text: text,
          gameType: gameType,
          sendFrom: sendFrom,
          sendTo: sendTo,
          color: color, 
          isInverse: targetCharacter ? targetCharacter.isInverse : false,
          isHollow: targetCharacter? targetCharacter.isHollow : false,
          isBlackPaint: targetCharacter ? targetCharacter.isBlackPaint : false,
          aura: targetCharacter ? targetCharacter.aura : -1,
          isUseFaceIcon: isUseFaceIcon,
          characterIdentifier: targetCharacter ? targetCharacter.identifier : null,
          standIdentifier: standIdentifier,
          standName: standName,
          isUseStandImage: (isUseStandImage && isUseStandImageOnChatTab)
        });
      }
    })();
  }

  calcFitHeight() {
    let textArea: HTMLTextAreaElement = this.textAreaElementRef.nativeElement;
    textArea.style.height = '';
    if (textArea.scrollHeight >= textArea.offsetHeight) {
      textArea.style.height = textArea.scrollHeight + 'px';
    }
  }

  loadDiceBot(gameType: string) {
    console.log('onChangeGameType ready');
    DiceBot.getHelpMessage(gameType).then(help => {
      console.log('onChangeGameType done\n' + help);
    });
  }

  showDicebotHelp() {
    DiceBot.getHelpMessage(this.gameType).then(help => {
      this.gameHelp = help;

      let gameName: string = '骰子機器人';
      for (let diceBotInfo of DiceBot.diceBotInfos) {
        if (diceBotInfo.id === this.gameType) {
          gameName = '骰子機器人〈' + diceBotInfo.game + '〉'
        }
      }
      gameName += '使用法';

      let coordinate = this.pointerDeviceService.pointers[0];
      let option: PanelOption = { left: coordinate.x, top: coordinate.y, width: 600, height: 500 };
      let textView = this.panelService.open(TextViewComponent, option);
      textView.title = gameName;
      textView.text = this.gameHelp;
    });
  }

  onContextMenu(e: Event) {
    e.stopPropagation();
    e.preventDefault();

    if (!this.pointerDeviceService.isAllowedToOpenContextMenu || !this.isAllowsChat) return;

    let position = this.pointerDeviceService.pointers[0];
    if (!this.character) {
      this.contextMenuService.open(
        position, 
        [
          { name: '連線資訊...', action: () => {
            this.panelService.open(PeerMenuComponent, { width: 520, height: 600, top: position.y - 100, left: position.x - 100 });
          } }
        ],
        PeerCursor.myCursor.name, 
        null,
        PeerCursor.myCursor.color,
        true
      );
      return;
    }
    
    let contextMenuActions: ContextMenuAction[] = [
      { name: '輸入「」', 
        action: () => {
          let textArea: HTMLTextAreaElement = this.textAreaElementRef.nativeElement;
          let text = this.text.trim();
          if (text.slice(0, 1) != '「') text = '「' + text;
          if (text.slice(-1) != '」') text = text + '」';
          this.text = text;
          textArea.value = this.text;
          textArea.selectionStart = this.text.length - 1;
          textArea.selectionEnd = this.text.length - 1;
          textArea.focus();
        }
      }
    ];
    if (this.character) {
      if (!this.isUseFaceIcon || !this.character.faceIcon) {
        if (this.character.imageFiles.length > 1) {
          contextMenuActions.push(ContextMenuSeparator);
          contextMenuActions.push({
            name: '画像切換',
            action: null,
            subActions: this.character.imageFiles.map((image, i) => {
              return { 
                name: `${this.character.currntImageIndex == i ? '◉' : '○'}`, 
                action: () => { 
                  this.character.currntImageIndex = i;
                  if (!this.character.isHideIn && this.character.location.name === 'table') SoundEffect.play(PresetSound.surprise);
                  EventSystem.trigger('UPDATE_INVENTORY', null);
                }, 
                default: this.character.currntImageIndex == i,
                icon: image,
                checkBox: 'radio'
              };
            })
          });
        }
        contextMenuActions.push(ContextMenuSeparator);
        contextMenuActions.push(
          { name: '圖片效果', action: null, subActions: [
            (this.character.isInverse
              ? {
                name: '☑ 反転', action: () => {
                  this.character.isInverse = false;
                  EventSystem.trigger('UPDATE_INVENTORY', null);
                },
                checkBox: 'check'
              } : {
                name: '☐ 反転', action: () => {
                  this.character.isInverse = true;
                  EventSystem.trigger('UPDATE_INVENTORY', null);
                },
                checkBox: 'check'
              }),
            (this.character.isHollow
              ? {
                name: '☑ 模糊', action: () => {
                  this.character.isHollow = false;
                  EventSystem.trigger('UPDATE_INVENTORY', null);
                },
                checkBox: 'check'
              } : {
                name: '☐ 模糊', action: () => {
                  this.character.isHollow = true;
                  EventSystem.trigger('UPDATE_INVENTORY', null);
                },
                checkBox: 'check'
              }),
            (this.character.isBlackPaint
              ? {
                name: '☑ 黑色塗抹', action: () => {
                  this.character.isBlackPaint = false;
                  EventSystem.trigger('UPDATE_INVENTORY', null);
                },
                checkBox: 'check'
              } : {
                name: '☐ 黑色塗抹', action: () => {
                  this.character.isBlackPaint = true;
                  EventSystem.trigger('UPDATE_INVENTORY', null);
                },
                checkBox: 'check'
              }),
              { name: '光環', action: null, subActions: [{ name: `${this.character.aura == -1 ? '◉' : '○'} 無`, action: () => { this.character.aura = -1; EventSystem.trigger('UPDATE_INVENTORY', null) }, checkBox: 'radio' }, ContextMenuSeparator].concat(['黑', '藍', '綠', '青', '紅', '紫', '黃', '白'].map((color, i) => {  
                return { name: `${this.character.aura == i ? '◉' : '○'} ${color}`, action: () => { this.character.aura = i; EventSystem.trigger('UPDATE_INVENTORY', null) }, colorSample: true, checkBox: 'radio' };
              })) },
            ContextMenuSeparator,
            {
              name: '重置', action: () => {
                this.character.isInverse = false;
                this.character.isHollow = false;
                this.character.isBlackPaint = false;
                this.character.aura = -1;
                EventSystem.trigger('UPDATE_INVENTORY', null);
              },
              disabled: !this.character.isInverse && !this.character.isHollow && !this.character.isBlackPaint && this.character.aura == -1
            }
          ]
        });
      } else {
        //if (this.character.faceIcons.length > 1) {
          contextMenuActions.push(ContextMenuSeparator);
          contextMenuActions.push({
            name: '切換臉部圖示',
            action: null,
            subActions: this.character.faceIcons.map((faceIconImage, i) => {
              return { 
                name: `${this.character.currntIconIndex == i ? '◉' : '○'}`, 
                action: () => { 
                  if (this.character.currntIconIndex != i) {
                    this.character.currntIconIndex = i;
                  }
                }, 
                default: this.character.currntIconIndex == i,
                icon: faceIconImage,
                checkBox: 'radio'
              };
            }),
            disabled: this.character.faceIcons.length <= 1
          });
        //}
      }
      contextMenuActions.push(ContextMenuSeparator);
      contextMenuActions.push({ name: '顯示詳細...', action: () => { this.showDetail(this.character); } });
      if (!this.onlyCharacters) {
        contextMenuActions.push({ name: '顯示聊天面板...', action: () => { this.showChatPalette(this.character) } });
      }
      contextMenuActions.push({ name: '立繪設定...', action: () => { this.showStandSetting(this.character) } });
    }
    this.contextMenuService.open(position, contextMenuActions, this.character.name);
  }

  farewellStand(targetCharacter: GameCharacter=null) {
    if (!targetCharacter) targetCharacter = this.character;
    if (this.character) {
      const sendObj = {
        characterIdentifier: this.character.identifier
      };
      if (this.sendTo) {
        const targetPeer = ObjectStore.instance.get<PeerCursor>(this.sendTo);
        if (targetPeer) {
          if (targetPeer.peerId != PeerCursor.myCursor.peerId) EventSystem.call('FAREWELL_STAND_IMAGE', sendObj, targetPeer.peerId);
          EventSystem.call('FAREWELL_STAND_IMAGE', sendObj, PeerCursor.myCursor.peerId);
        }
      } else {
        EventSystem.call('FAREWELL_STAND_IMAGE', sendObj);
      }
    }
  }

  private showDetail(gameObject: GameCharacter) {
    let coordinate = this.pointerDeviceService.pointers[0];
    let title = '角色卡';
    if (gameObject.name.length) title += ' - ' + gameObject.name;
    let option: PanelOption = { title: title, left: coordinate.x - 400, top: coordinate.y - 300, width: 800, height: 600 };
    let component = this.panelService.open<GameCharacterSheetComponent>(GameCharacterSheetComponent, option);
    component.tabletopObject = gameObject;
  }

  private showChatPalette(gameObject: GameCharacter) {
    let coordinate = this.pointerDeviceService.pointers[0];
    let option: PanelOption = { left: coordinate.x - 250, top: coordinate.y - 175, width: 620, height: 350 };
    let component = this.panelService.open<ChatPaletteComponent>(ChatPaletteComponent, option);
    component.character = gameObject;
  }

  private showStandSetting(gameObject: GameCharacter) {
    let coordinate = this.pointerDeviceService.pointers[0];
    let option: PanelOption = { left: coordinate.x - 400, top: coordinate.y - 175, width: 730, height: 572 };
    let component = this.panelService.open<StandSettingComponent>(StandSettingComponent, option);
    component.character = gameObject;
  }

  private allowsChat(gameCharacter: GameCharacter): boolean {
    if (!gameCharacter.isAllowsChat) return false;
    switch (gameCharacter.location.name) {
      case 'table':
      case this.myPeer.peerId:
        return true;
      case 'graveyard':
        return false;
      default:
        for (const peer of Network.peers) {
          if (peer.isOpen && gameCharacter.location.name === peer.peerId) {
            return false;
          }
        }
        return true;
    }
  }
}
