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
  styleUrls: ['./chat-palette.component.css']
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
`　パラメータ操作コマンド、ダイスボットコマンドは全角と半角を区別しません、また、ダイスボットコマンドやパラメータの名稱はアルファベットの大文字と小文字を区別しません。下記を併用する場合、スペースで区切ってパラメータ操作コマンド、ダイスボットコマンド、チャットメッセージの順に記述します、それぞれ省略が可能です。

　チャット内容をチャットパレットに準備することができます。各行に一つの内容を記述し、行をシングルクリックでチャット欄に呼び出し、ダブルクリックで送信します。

・パラメータ操作コマンド
　角色からのチャット送信時、先頭に : 、パラメータ名、操作（増加 + 、減少 -、代入 =）、操作内容の順に記述して、チャットから角色のパラメータ操作を行うことができます。操作内容にダイスボットコマンドを記載することによりダイス擲骰結果で操作を行うことができます（資源や數值、能力值を操作する場合、最後に一つの数字を返す必要があります）。
　また、操作として > を使用すれば、ダイスボットコマンドを（ダイス擲骰を行わず）直接パラメータに代入できます（現状 name、size、height、altitude は操作できません）。さらに : で区切って複数の操作を記述できます、パラメータ操作コマンドはチャットに顯示されません。

パラメータ操作コマンドの例）
　:HP+2d6:MP-4　 HPを2d6回復し、MPを4点消費します。
　:浸食率+1D10　 登場！

資源の操作は最大値が適用されます、コマンドによる操作では最大値を超えず、すでに最大値を超えていればそれ以上増加しません。

　勾選框は操作が + の場合は操作内容に関わらずオン、- の場合はオフになります。また空文字、0、off、☐（空の勾選框）を代入（ = または > ）した場合オフ、それ以外の代入はオンになります、さらに成功/失敗を返すダイス擲骰結果を代入（ = ）した場合、成功はオン、失敗はオフとなります。

・ダイスボットコマンド
　チャットからダイスボットコマンドを送信することにより、ダイス擲骰や表の参照が可能です。実際のコマンドはゲームシステムごとのダイスボットのヘルプを参照してください。またダイスボット表機能によりダイスボットコマンドを拡張することができます。

・パラメータ参照
　{ と } で囲んでパラメータ名を記載すると、チャットパレットから選択した際とチャットを送信した際に、パラメータの内容に置き換えられます。またパラメータ名の先頭に $ を付記することにより、前述のパラメータ操作コマンドを適用後の値を参照します。
　さらに $數值 を参照することにより、パラメータ操作による実際の変化量（資源、數值、能力值のみ、ダイス擲骰結果や最大値による切り捨てを考慮）を参照します。數值は1から開始で1でパラメータ操作コマンドの最初の操作結果、2で2番目の結果…となります。

パラメータ参照の例）
　:HP-2d6　2d6+{筋力}+2　 HP{$1}、筋力に+2して判定（現在HP {$HP}）

・追加の値
　チャットパレットの行に //名稱=値 の形で記述することにより、パラメータ同様にチャットメッセージから参照できる値を設定できます（コマンドで操作はできません）。

追加の値の例）
　//今の天気=雨

チャットパレットのいずれかの行に上記の例のように記述されていれば、その角色から送信するコマンドやチャットメッセージ中の {今の天気} が 雨 に置き換わります。

・改行、空白
　チャットメッセージ中に \\n と記述した場合そこで改行されます（nは小文字、\\nは顯示されません）、チャットパレットは1行に一つの送信内容を記述し、改行を直接記述できませんので、これを利用して改行します。
　\\s （sが半角）と記述した場合半角スペース、\\ｓ （ｓが全角）と記述した場合全角スペースとなります（全角半角を区別する例外です）、コマンド中にスペースは記述できませんので、必要ならこちらを利用します。例外として、ダイスボットコマンド CHOICE のスペース区切りでの記述では、スペースを記述できますが、その場合チャットメッセージを記述できません（スペース区切りの最後もCHOICEコマンドの一部とみなされます）。

・ルビ（フリガナ）
　チャット内容のフリガナを振りたい部分の開始に | （パイプ）、終了に 《 と 》 で囲んでフリガナの内容を記述します。

ルビの例）
　受けるが良い！｜約束された勝利の剣《エクスカリバー》！

・💭
　角色からのチャット送信時、 「 と 」 で囲んだ内容を💭で顯示します。`];
  }
}
