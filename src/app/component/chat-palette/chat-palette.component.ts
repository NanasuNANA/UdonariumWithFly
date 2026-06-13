import { Component, ElementRef, Input, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ChatPalette } from '@udonarium/chat-palette';
import { ChatTab } from '@udonarium/chat-tab';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem, Network } from '@udonarium/core/system';
import { StringUtil } from '@udonarium/core/system/util/string-util';
import { DiceBot } from '@udonarium/dice-bot';
import { GameCharacter } from '@udonarium/game-character';
import { PeerCursor } from '@udonarium/peer-cursor';
import { ChatInputComponent } from 'component/chat-input/chat-input.component';
import { TextViewComponent } from 'component/text-view/text-view.component';
import { ChatMessageService } from 'service/chat-message.service';
import { PanelOption, PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';

@Component({
    selector: 'chat-palette',
    templateUrl: './chat-palette.component.html',
    styleUrls: ['./chat-palette.component.css'],
    standalone: false
})
export class ChatPaletteComponent implements OnInit, OnDestroy {
  @ViewChild('chatInput', { static: true }) chatInputComponent: ChatInputComponent;
  @ViewChild('chatPlette') chatPletteElementRef: ElementRef<HTMLSelectElement>;
  @Input() character: GameCharacter = null;

  get palette(): ChatPalette { return this.character.chatPalette; }
  
  paletteCache: string[] = [];
  paletteRenewInterval: boolean = true;
  paletteRenewIntervalId = setInterval(() => {
    this.paletteRenewInterval = true;
  }, 200);
  get filteredPaletteStrings(): string[] {
    this.ngZone.run(() => {
      if (this.paletteRenewInterval) {
        this.paletteRenewInterval = false;
        this.paletteCache = this.character.chatPalette.getPalette().filter(text => this.filter(text));
      }
    });
    return this.paletteCache;
  }

  get color(): string {
    return this.chatInputComponent.color;
  }

  private _gameType: string = '';
  get gameType(): string { return !this._gameType ? 'DiceBot' : this._gameType; };
  set gameType(gameType: string) {
    this._gameType = gameType;
    if (this.character.chatPalette) this.character.chatPalette.dicebot = gameType;
  };

  get sendFrom(): string { return this.character.identifier; }
  set sendFrom(sendFrom: string) {
    this.onSelectedCharacter(sendFrom);
  }

  chatTabidentifier: string = '';
  text: string = '';
  sendTo: string = '';

  isEdit: boolean = false;
  editPalette: string = '';

  filterText: string = '';

  private doubleClickTimer: NodeJS.Timer = null;

  private selectedPaletteIndex = -1;

  get diceBotInfos() { return DiceBot.diceBotInfos }

  get chatTab(): ChatTab { return ObjectStore.instance.get<ChatTab>(this.chatTabidentifier); }
  get myPeer(): PeerCursor { return PeerCursor.myCursor; }
  get otherPeers(): PeerCursor[] { return [PeerCursor.myCursor, ...Network.peers.filter(peer => peer.isOpen).map(peer => PeerCursor.findByPeerId(peer.peerId))].filter(peerCursor => peerCursor); /* ObjectStore.instance.getObjects(PeerCursor); */ }

  constructor(
    public chatMessageService: ChatMessageService,
    private panelService: PanelService,
    private pointerDeviceService: PointerDeviceService,
    private ngZone: NgZone
  ) { }

  ngOnInit() {
    Promise.resolve().then(() => this.updatePanelTitle());
    this.chatTabidentifier = this.chatMessageService.chatTabs ? this.chatMessageService.chatTabs[0].identifier : '';
    this.gameType = this.character.chatPalette ? this.character.chatPalette.dicebot : '';
    EventSystem.register(this)
      .on('DELETE_GAME_OBJECT', event => {
        if (this.character && this.character.identifier === event.data.identifier) {
          this.panelService.close();
        }
        if (this.chatTabidentifier === event.data.identifier) {
          this.chatTabidentifier = this.chatMessageService.chatTabs ? this.chatMessageService.chatTabs[0].identifier : '';
        }
      });
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
    clearInterval(this.paletteRenewIntervalId);
    if (this.isEdit) this.toggleEditMode();
  }

  updatePanelTitle() {
    this.panelService.title = this.character.name + ' 的聊天面板';
  }

  onSelectedCharacter(identifier: string) {
    if (this.isEdit) this.toggleEditMode();
    let object = ObjectStore.instance.get(identifier);
    if (object instanceof GameCharacter) {
      this.character = object;
      let gameType = this.character.chatPalette ? this.character.chatPalette.dicebot : '';
      if (0 < gameType.length) this.gameType = gameType;
    }
    this.updatePanelTitle();
  }

  clickPalette(line: string) {
    if (!this.chatPletteElementRef.nativeElement) return;
    const evaluatedLine = this.palette.evaluate(line, this.character.rootDataElement);
    if (this.doubleClickTimer && this.selectedPaletteIndex === this.chatPletteElementRef.nativeElement.selectedIndex) {
      clearTimeout(this.doubleClickTimer);
      this.doubleClickTimer = null;
      this.chatInputComponent.sendChat(null);
    } else {
      this.selectedPaletteIndex = this.chatPletteElementRef.nativeElement.selectedIndex;
      this.text = evaluatedLine;
      let textArea: HTMLTextAreaElement = this.chatInputComponent.textAreaElementRef.nativeElement;
      textArea.value = this.text;
      this.doubleClickTimer = setTimeout(() => { this.doubleClickTimer = null }, 400);
    }
  }

  moveToInput(e: Event) {
    if (!this.chatPletteElementRef.nativeElement) return;
    const selectedPaletteIndex = this.chatPletteElementRef.nativeElement.selectedIndex;
    if (selectedPaletteIndex <= 0) {
      this.text = this._tempText;
      this.chatInputComponent.textAreaElementRef.nativeElement.value = this._tempText;
      this.chatInputComponent.textAreaElementRef.nativeElement.focus();
      e.preventDefault();
    }
  }

  arrowPalette() {
    if (!this.chatPletteElementRef.nativeElement) return;
    this.selectedPaletteIndex = this.chatPletteElementRef.nativeElement.selectedIndex;
    if (this.selectedPaletteIndex >= 0 && this.chatPletteElementRef.nativeElement.options[this.selectedPaletteIndex]) {
      this.ngZone.run(() => {
        this.text = this.palette.evaluate(this.chatPletteElementRef.nativeElement.options[this.selectedPaletteIndex].value, this.character.rootDataElement);
        let textArea: HTMLTextAreaElement = this.chatInputComponent.textAreaElementRef.nativeElement;
        textArea.value = this.text;
      });
    }
  }

  enterPalette(line: string, e: Event=null) {
    if (!this.chatPletteElementRef.nativeElement) return;
    this.text = this.palette.evaluate(line, this.character.rootDataElement);
    //this.chatInputComponent.sendChat(null);
    this.chatInputComponent.focusInput();
    //this.chatPletteElementRef.nativeElement.selectedIndex = -1;
    //this.filterText = '';
    if (e) e.preventDefault();
  }

  private _tempText: string;
  moveToPalette(tempText: string) {
    this._tempText = tempText;
    if (!this.chatPletteElementRef.nativeElement) return;
    if (this.chatPletteElementRef.nativeElement.options.length <= 0) return;
    if (this.chatPletteElementRef.nativeElement.selectedIndex <= 0) this.chatPletteElementRef.nativeElement.options[0].selected = true;
    this.chatPletteElementRef.nativeElement.focus();
  }

  sendChat(value: { text: string, gameType: string, sendFrom: string, sendTo: string,
    color?: string, isInverse?:boolean, isHollow?: boolean, isBlackPaint?: boolean, aura?: number, isUseFaceIcon?: boolean, characterIdentifier?: string, standIdentifier?: string, standName?: string, isUseStandImage?: boolean }) {
    if (this.chatTab) {
      let text = this.palette.evaluate(value.text, this.character.rootDataElement);
      this.chatMessageService.sendMessage(
        this.chatTab, 
        text, 
        value.gameType, 
        value.sendFrom, 
        value.sendTo,
        value.color, 
        value.isInverse,
        value.isHollow,
        value.isBlackPaint,
        value.aura,
        value.isUseFaceIcon,
        value.characterIdentifier,
        value.standIdentifier,
        value.standName,
        value.isUseStandImage
      );
      this.filterText = '';
    }
  }

  resetPletteSelect() {
    if (!this.chatPletteElementRef.nativeElement) return;
    this.chatPletteElementRef.nativeElement.selectedIndex = -1;
  }

  toggleEditMode() {
    this.isEdit = this.isEdit ? false : true;
    if (this.isEdit) {
      this.editPalette = this.palette.value + '';
    } else {
      this.palette.setPalette(this.editPalette);
    }
  }

  filter(value: string): boolean {
    if (this.filterText == null || this.filterText.trim() == '') return true;
    const nomarizeFilterText = StringUtil.toHalfWidth(this.filterText.replace(/[―ー—‐]/g, '-').replace(/[\u3041-\u3096]/g, m => String.fromCharCode(m.charCodeAt(0) + 0x60))).replace(/[\r\n\s]+/, ' ').toUpperCase().trim();
    const nomarizeValue = StringUtil.toHalfWidth(value.replace(/[―ー—‐]/g, '-').replace(/[\u3041-\u3096]/g, m => String.fromCharCode(m.charCodeAt(0) + 0x60))).replace(/[\r\n\s]+/, ' ').toUpperCase().trim();
    if (nomarizeValue.indexOf(nomarizeFilterText) >= 0) return true;
    const nomarizeEvaluateValue = StringUtil.toHalfWidth(!/[{｛]/.test(value) ? value : this.palette.evaluate(value, this.character.rootDataElement).replace(/[―ー—‐]/g, '-').replace(/[\u3041-\u3096]/g, m => String.fromCharCode(m.charCodeAt(0) + 0x60))).replace(/[\r\n\s]+/, ' ').toUpperCase().trim();
    return nomarizeEvaluateValue.indexOf(nomarizeFilterText) >= 0;
  }

  helpChatPallet() {
    let coordinate = this.pointerDeviceService.pointers[0];
    let option: PanelOption = { left: coordinate.x, top: coordinate.y, width: 560, height: 620 };
    let textView = this.panelService.open(TextViewComponent, option);
    textView.title = '聊天語法與聊天面板的使用方法';
    textView.shadowing = '💭';
    textView.text = [
`　屬性操作指令和骰子機器人指令不區分全形/半形，骰子機器人指令和屬性名稱也不區分英文大小寫。同時使用時，以空格分隔，依序填入：屬性操作指令、骰子機器人指令、聊天訊息，各項均可省略。

　可將聊天內容預先存入聊天面板。每行填寫一條內容，單擊該行可呼叫至聊天欄，雙擊即可送出。

・屬性操作指令
　以角色身份傳送聊天時，在開頭依序填入「:」、屬性名、操作（增加 + 、減少 -、代入 =）、操作內容，即可從聊天操作角色屬性。操作內容填入骰子機器人指令，可用擲骰結果進行操作（操作資源、數值、能力值時，最後需回傳一個數字）。
　使用「>」作為操作符，可不擲骰而直接將骰子機器人指令結果代入屬性（目前 name、size、height、altitude 無法操作）。多個操作可用「:」分隔，屬性操作指令不會顯示在聊天中。

屬性操作指令範例）
　:HP+2d6:MP-4　 HP 回復 2d6 點，MP 消耗 4 點。
　:浸食率+1D10　 登場！

資源操作會套用最大值限制，操作後不會超過最大值；若已超過最大值，則不會繼續增加。

　勾選框：操作為「+」時，不論操作內容為何一律勾選；「-」時取消勾選。代入（= 或 >）空字串、0、off、☐（空勾選框）時取消，其他值則勾選。代入（=）擲骰成功/失敗結果時，成功則勾選，失敗則取消。

・骰子機器人指令
　從聊天傳送骰子機器人指令，即可擲骰或參照骰子表。實際指令請參照各遊戲系統的骰子機器人說明。也可透過骰子表功能擴充骰子機器人指令。

・屬性參照
　以「{」和「}」括住屬性名，從聊天面板選取時及送出聊天時，會自動代入該屬性值。在屬性名前加「$」，則參照套用屬性操作指令後的值。
　以「$數字」參照時，可取得屬性操作實際的變動量（僅限資源、數值、能力值，已考量擲骰結果及最大值截斷）。數字從 1 開始，1 代表第一個操作結果，2 代表第二個……。

屬性參照範例）
　:HP-2d6　2d6+{筋力}+2　 HP{$1}，筋力+2 判定（現在 HP {$HP}）

・附加值
　在聊天面板的行中以「//名稱=值」格式填寫，可設定如同屬性般可從聊天訊息中參照的值（無法用指令操作）。

附加值範例）
　//今の天気=雨

只要聊天面板中有上述範例的行，該角色送出的指令或聊天訊息中的 {今の天気} 就會被替換為 雨。

・換行、空白
　在聊天訊息中填入「\\n」即可在該處換行（n 為小寫，\\n 不會顯示）。聊天面板每行只能填一條內容，無法直接換行，可利用此功能換行。
　填入「\\s」（半形 s）為半形空白，「\\ｓ」（全形 ｓ）為全形空白（此為區分全半形的例外）。指令中無法填入空白，有需要時請使用此功能。例外：骰子機器人指令「CHOICE」以空格分隔填寫時可使用空白，但此時無法填寫聊天訊息（空格分隔的最後部分也視為 CHOICE 指令的一部分）。

・注音（ルビ）
　在聊天內容中要加注音的部分，開頭加「|」（管道符），結尾以「《」和「》」括住注音內容。

注音範例）
　受けるが良い！｜約束された勝利の剣《エクスカリバー》！

・💭
　以角色身份傳送聊天時，以「「」和「」」括住的內容會以💭顯示。`];
  }
}
