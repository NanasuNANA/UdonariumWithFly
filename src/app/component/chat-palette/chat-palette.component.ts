import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ChatPalette } from '@udonarium/chat-palette';
import { ChatTab } from '@udonarium/chat-tab';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem } from '@udonarium/core/system';
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

  filterText = '';

  private doubleClickTimer: NodeJS.Timer = null;

  private selectedPaletteIndex = -1;

  get diceBotInfos() { return DiceBot.diceBotInfos }

  get chatTab(): ChatTab { return ObjectStore.instance.get<ChatTab>(this.chatTabidentifier); }
  get myPeer(): PeerCursor { return PeerCursor.myCursor; }
  get otherPeers(): PeerCursor[] { return ObjectStore.instance.getObjects(PeerCursor); }

  constructor(
    public chatMessageService: ChatMessageService,
    private panelService: PanelService,
    private pointerDeviceService: PointerDeviceService
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
    if (this.isEdit) this.toggleEditMode();
  }

  updatePanelTitle() {
    this.panelService.title = this.character.name + ' のチャットパレット';
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

  selectPalette(line: string) {
    this.text = line;
    /* 作りかけ、とりあえず封印
    setTimeout(() => {
      this.filterText = line;
    }, 300);
    */
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
  //ToDO あいまい検索
  filter(value: string): boolean {
    if (this.filterText == null || this.filterText.trim() == '') return true;
    return value.search(this.filterText) >= 0;
  }

  helpChatPallet() {
    let coordinate = this.pointerDeviceService.pointers[0];
    let option: PanelOption = { left: coordinate.x, top: coordinate.y, width: 560, height: 620 };
    let textView = this.panelService.open(TextViewComponent, option);
    textView.title = 'チャット記法とチャットパレットの使い方';
    textView.text = 
`　パラメータ操作コマンド、ダイスボットコマンドは全角と半角を区別しません、また、ダイスボットコマンドやパラメータの名前はアルファベットの大文字と小文字を区別しません。下記を併用する場合、スペースで区切ってパラメータ操作コマンド、ダイスボットコマンド、チャットメッセージの順に記述します、それぞれ省略が可能です。

　チャット内容をチャットパレットに準備することができます。各行に一つの内容を記述し、行をシングルクリックでチャット欄に呼び出し、ダブルクリックで送信します。

・パラメータ操作コマンド
　キャラクターからのチャット送信時、先頭に : 、パラメータ名、オペレーター（増加 + 、減少 -、代入 =）、操作内容の順に記述して、チャットからキャラクターのパラメータ操作を行うことができます。操作内容にダイスボットコマンドを記載することによりダイスロール結果で操作を行うことができます（リソースや数値、能力値を操作する場合、最後に一つの数字を返す必要があります）。
　また、オペレーターとして > を使用すれば、ダイスボットコマンドを（ダイスロールを行わず）直接パラメータに代入できます（現状 name、size、height、altitude は操作できません）。さらに : で区切って複数の操作を記述できます、パラメータ操作コマンドはチャットに表示されません。

パラメータ操作コマンドの例）
　:HP+2d6:MP-4　 HPを2d6回復し、MPを4点消費します。
　:浸食率+1D10　 登場！

リソースの操作は最大値が適用されます、コマンドによる操作では最大値を超えず、すでに最大値を超えていればそれ以上増加しません。

　チェックボックスの値は空文字、0、off、☐（空のチェックボックス）を代入した場合オフ、それ以外はオンになります、また成功/失敗を返すダイスボットコマンドを代入し、成功の場合はオン、失敗の場合はオフとなります。

・ダイスボットコマンド
　チャットからダイスボットコマンドを送信することにより、ダイスロールや表の参照が可能です。実際のコマンドはゲームシステムごとのダイスボットのヘルプを参照してください。またダイスボット表機能によりダイスボットコマンドを拡張することができます。

・パラメータ参照
　{ と } で囲んでパラメータ名を記載すると、チャットパレットから選択した際とチャットを送信した際に、パラメータの内容に置き換えられます。またパラメータ名の先頭に $ を付記することにより、前述のパラメータ操作コマンドを適用後の値を参照します。
　さらに $数値 を参照することにより、パラメータ操作による実際の変化量（リソース、数値、能力値のみ、ダイスロール結果や最大値による切り捨てを考慮）を参照します。数値は1から開始で1でパラメータ操作コマンドの最初の操作結果、2で2番目の結果…となります。

パラメータ参照の例）
　:HP-2d6　2d6+{筋力}+2　 HP{$1}、筋力に+2して判定（現在HP {$HP}）

・追加の値
　チャットパレットの行に //名前=値 の形で記述することにより、パラメータ同様にチャットメッセージから参照できる値を設定できます（コマンドで操作はできません）。

追加の値の例）
　//今の天気=雨

チャットパレットのいずれかの行に上記の例のように記述されていれば、そのキャラクターから送信するコマンドやチャットメッセージ中の {今の天気} が 雨 に置き換わります。

・改行、空白
　チャットメッセージ中に \\n と記述した場合そこで改行されます（nは小文字、\\nは表示されません）、チャットパレットは1行に一つの送信内容を記述し、改行を直接記述できませんので、これを利用して改行します。
　\\s （sが半角）と記述した場合半角スペース、\\ｓ （ｓが全角）と記述した場合全角スペースとなります（全角半角を区別する例外です）、コマンド中にスペースは記述できませんので、必要ならこちらを利用します。例外として、ダイスボットコマンド CHOICE のスペース区切りでの記述では、スペースを記述できますが、その場合チャットメッセージを記述できません（スペース区切りの最後もCHOICEコマンドの一部とみなされます）。

・ルビ（フリガナ）
　チャット内容のフリガナを振りたい部分の開始に | （パイプ）、終了に 《 と 》 で囲んでフリガナの内容を記述します。

ルビの例）
　受けるが良い！｜約束された勝利の剣《エクスカリバー》！

・💭
　キャラクターからのチャット送信時、 「 と 」 で囲んだ内容を💭で表示します。`;
  }
}
