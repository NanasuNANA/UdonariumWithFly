import {
  AfterViewChecked,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import { ChatMessageService } from 'service/chat-message.service';
import { ChatMessage, ChatMessageContext } from '@udonarium/chat-message';
import { ChatTab } from '@udonarium/chat-tab';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem } from '@udonarium/core/system';
import { ResettableTimeout } from '@udonarium/core/system/util/resettable-timeout';
import { setZeroTimeout } from '@udonarium/core/system/util/zero-timeout';

import { PanelService } from 'service/panel.service';

type ScrollPosition = { top: number, bottom: number, clientHeight: number, scrollHeight: number, };

const ua = window.navigator.userAgent.toLowerCase();
const isiOS = ua.indexOf('iphone') > -1 || ua.indexOf('ipad') > -1 || ua.indexOf('macintosh') > -1 && 'ontouchend' in document;

@Component({
    selector: 'chat-tab',
    templateUrl: './chat-tab.component.html',
    styleUrls: ['./chat-tab.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class ChatTabComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges, AfterViewChecked {
  @Input() compact: boolean = false;
  
  sampleMessages: ChatMessage[] = [
    this.makeSampleMessage('System', null, '教學：開始之前', null, 'Udonarium with Fly 是一款不需要伺服器的TRPG線上工具，參加者之間互相連線，同步棋子、圖片等資料。'),
    this.makeSampleMessage('System', null, '桌面與棋子的基本操作', null, `＜桌面操作＞
桌面左鍵拖曳：視角移動
桌面右鍵拖曳：視角旋轉
桌面右鍵點擊：顯示右鍵選單

＜物件操作＞
物件拖曳：移動或旋轉物件
物件右鍵點擊：顯示個別右鍵選單
物件左鍵雙擊：執行物件特有動作`),
    this.makeSampleMessage('System', null, '範圍選取', null, `<用語>
範圍選取模式：選取選擇區域內可見的物件
磁石模式：連同同類物件一起移動

<物件選取>
桌面滑鼠左鍵長按+拖曳：長按開啟範圍選取模式，拖曳指定範圍
物件左鍵雙擊長按+拖曳：長按開啟磁石模式，拖曳移動物件
Shift+滑鼠左鍵+拖曳：立即開啟範圍選取模式，拖曳指定範圍
Ctrl+滑鼠左鍵：切換點擊物件的選取狀態
Ctrl+滑鼠左鍵+拖曳：將滑鼠游標接觸到的物件設為選取

<選取物件操作>
移動選取物件：所有選取狀態的物件同步移動
旋轉選取物件：同類選取狀態的物件同步旋轉

<取消選取>
點擊任意位置：取消所有選取狀態`),
    this.makeSampleMessage('System', null, '圖片與音樂', null, '將檔案拖曳至瀏覽器畫面即可匯入 Udonarium with Fly。'),
    this.makeSampleMessage('System', null, '資料儲存', null, '所有資料僅存在於各參加者的瀏覽器中，當所有人離開房間後資料將會消失。如需保留房間狀態至下次，請務必執行「儲存」以產生存檔（zip）。可將zip拖曳至瀏覽器畫面來讀取存檔。'),
    this.makeSampleMessage('System', '???', '玩家', '私人訊息', '私人訊息（秘密對話）不會記錄在存檔中。'),
    this.makeSampleMessage('System', '???', '玩家', '私人訊息', '此外，當你的ID更新後，即使在同一個房間內，過去的私人訊息也將不再可見，請注意。'),
    this.makeSampleMessage('System', null, '運作環境', null, '推薦使用桌面版 Google Chrome。目前從手機操作時體驗較差。'),
    this.makeSampleMessage('System', null, '運作不穩定時', null, `也許可以通過變更環境設定來改善。請嘗試以下方法：
・開啟硬體加速
・關閉所有瀏覽器擴充功能（附加元件/插件）
・改用其他瀏覽器，如 Chrome ⇔ Firefox`),
    this.makeSampleMessage('System', null, '教學：結語', null, '教學到此結束。輸入第一則聊天訊息後，此教學將會隱藏。'),
  ];

  private topTimestamp = 0;
  private botomTimestamp = 0;

  private needUpdate = true;

  @ViewChild('logContainer', { static: true }) logContainerRef: ElementRef<HTMLDivElement>;
  @ViewChild('messageContainer', { static: true }) messageContainerRef: ElementRef<HTMLDivElement>;

  private topElm: HTMLElement = null;
  private bottomElm: HTMLElement = null;
  private topElmBox: DOMRect = null;
  private bottomElmBox: DOMRect = null;

  private topIndex = 0;
  private bottomIndex = 0;

  //private minMessageHeight: number = 26;
  private get minMessageHeight(): number {
    if (this.compact) return 26; 
    let chatMessage = this.chatTab.chatMessages[this.chatTab.chatMessages.length - 1]
    return (chatMessage && chatMessage.isOperationLog) ? 26 : 61;
  }

  private preScrollTop = 0;
  private scrollSpeed = 0;

  private _chatMessages: ChatMessage[] = [];
  get chatMessages(): ChatMessage[] {
    if (!this.chatTab) return [];
    if (this.needUpdate) {
      this.needUpdate = false;
      let chatMessages = this.chatTab ? this.chatTab.chatMessages : [];
      this.adjustIndex();

      this._chatMessages = chatMessages.slice(this.topIndex, this.bottomIndex + 1);
      this.topTimestamp = 0 < this._chatMessages.length ? this._chatMessages[0].timestamp : 0;
      this.botomTimestamp = 0 < this._chatMessages.length ? this._chatMessages[this._chatMessages.length - 1].timestamp : 0;
    }
    return this._chatMessages;
  }

  get minScrollHeight(): number {
    return this.chatTab.chatMessages.reduce((height, chatMessage) => { height += chatMessage.isDisplayable ? (this.compact || chatMessage.isOperationLog ? 26 : 61) : 0; return height }, 0);
    //let length = this.chatTab ? this.chatTab.chatMessages.length : this.sampleMessages.length;
    //return (length < 10000 ? length : 10000) * this.minMessageHeight;
  }

  get topSpace(): number { return this.minScrollHeight - this.bottomSpace; }

  get bottomSpace(): number {
    return 0 < this.chatMessages.length
      ? (this.chatTab.chatMessages.length - this.bottomIndex - 1) * this.minMessageHeight
      : 0;
  }

  get isEmpty(): boolean { return this.chatTab.chatMessages.every(chatMessage => !chatMessage.isDisplayable); }

  private scrollEventShortTimer: ResettableTimeout = null;
  private scrollEventLongTimer: ResettableTimeout = null;
  private addMessageEventTimer: NodeJS.Timeout = null;

  private callbackOnScroll: any = () => this.onScroll();
  private callbackOnScrollToBottom: any = () => this.resetMessages();

  @Input() chatTab: ChatTab;
  @Output() onAddMessage: EventEmitter<null> = new EventEmitter();

  constructor(
    private chatMessageService: ChatMessageService,
    private ngZone: NgZone,
    private changeDetector: ChangeDetectorRef,
    private panelService: PanelService
  ) { }

  ngOnInit() {
    EventSystem.register(this)
      .on('MESSAGE_ADDED', event => {
        let message = ObjectStore.instance.get<ChatMessage>(event.data.messageIdentifier);
        if (!message || !this.chatTab.contains(message)) return;

        if (this.topTimestamp <= message.timestamp) {
          this.changeDetector.markForCheck();
          this.needUpdate = true;
          this.onMessageInit();
        }
      })
      .on(`UPDATE_GAME_OBJECT/aliasName/${ChatMessage.aliasName}`, event => {
        let message = ObjectStore.instance.get<ChatMessage>(event.data.identifier);
        if (message
          && this.topTimestamp <= message.timestamp && message.timestamp <= this.botomTimestamp
          && this.chatTab.contains(message)) {
          this.changeDetector.markForCheck();
        }
      });
  }

  ngAfterViewInit() {
    this.ngZone.runOutsideAngular(() => {
      this.scrollEventShortTimer = new ResettableTimeout(() => this.lazyScrollUpdate(), 33);
      this.scrollEventLongTimer = new ResettableTimeout(() => this.lazyScrollUpdate(false), 66);
      this.onScroll();
      this.panelService.scrollablePanel.addEventListener('scroll', this.callbackOnScroll, false);
      this.panelService.scrollablePanel.addEventListener('scrolltobottom', this.callbackOnScrollToBottom, false);
    });
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
    this.panelService.scrollablePanel.removeEventListener('scroll', this.callbackOnScroll, false);
    this.panelService.scrollablePanel.removeEventListener('scrolltobottom', this.callbackOnScrollToBottom, false);
    this.scrollEventShortTimer.clear();
    this.scrollEventLongTimer.clear();
    if (this.addMessageEventTimer) clearTimeout(this.addMessageEventTimer);
    this.addMessageEventTimer = null;
  }

  ngOnChanges() {
    Promise.resolve().then(() => this.resetMessages());
  }

  ngAfterViewChecked() {
    if (!this.topElm || !this.bottomElm) return;
    this.ngZone.runOutsideAngular(() => {
      Promise.resolve().then(() => this.adjustScrollPosition());
    });
  }

  onMessageInit() {
    if (this.addMessageEventTimer != null) return;
    this.ngZone.runOutsideAngular(() => {
      this.addMessageEventTimer = setTimeout(() => {
        this.addMessageEventTimer = null;
        this.ngZone.run(() => this.onAddMessage.emit());
      }, 0);
    });
  }

  resetMessages() {
    let lastIndex = this.chatTab.chatMessages.length - 1;
    this.topIndex = lastIndex - Math.floor(this.panelService.scrollablePanel.clientHeight / this.minMessageHeight);
    this.bottomIndex = lastIndex;
    this.needUpdate = true;
    this.preScrollTop = -1;
    this.scrollSpeed = 0;
    this.topElm = this.bottomElm = null;
    this.adjustIndex();
    this.changeDetector.markForCheck();
  }

  trackByChatMessage(index: number, message: ChatMessage) {
    return message.identifier;
  }

  checkAnimated(message: ChatMessage): boolean {
    //console.log(this.chatMessageService.getTime())
    return !(message.timestamp + 1000 >= this.chatMessageService.getTime());
  }

  private adjustIndex() {
    let chatMessages = this.chatTab ? this.chatTab.chatMessages : [];
    let lastIndex = 0 < chatMessages.length ? chatMessages.length - 1 : 0;

    if (this.topIndex < 0) {
      this.topIndex = 0;
    }
    if (lastIndex < this.bottomIndex) {
      this.bottomIndex = lastIndex;
    }

    if (this.topIndex < 0) this.topIndex = 0;
    if (this.bottomIndex < 0) this.bottomIndex = 0;
    if (lastIndex < this.topIndex) this.topIndex = lastIndex;
    if (lastIndex < this.bottomIndex) this.bottomIndex = lastIndex;
  }

  private getScrollPosition(): ScrollPosition {
    let top = this.panelService.scrollablePanel.scrollTop;
    let clientHeight = this.panelService.scrollablePanel.clientHeight;
    let scrollHeight = this.panelService.scrollablePanel.scrollHeight;
    if (top < 0) top = 0;
    if (scrollHeight - clientHeight < top)
      top = scrollHeight - clientHeight;
    let bottom = top + clientHeight;
    return { top, bottom, clientHeight, scrollHeight };
  }

  private adjustScrollPosition() {
    if (!this.topElm || !this.bottomElm) return;

    let hasTopElm = this.logContainerRef.nativeElement.contains(this.topElm);
    let hasBotomElm = this.logContainerRef.nativeElement.contains(this.bottomElm);

    let { hasTopBlank, hasBotomBlank } = this.checkBlank(hasTopElm, hasBotomElm);

    this.topElm = this.bottomElm = null;

    if (hasTopBlank || hasBotomBlank || (!hasTopElm && !hasBotomElm)) {
      setZeroTimeout(() => this.lazyScrollUpdate());
    }
  }

  private checkBlank(hasTopElm: boolean, hasBotomElm: boolean) {
    let hasTopBlank = !hasTopElm;
    let hasBotomBlank = !hasBotomElm;

    if (!hasTopElm && !hasBotomElm) return { hasTopBlank, hasBotomBlank };

    let elm: HTMLElement = null;
    let prevBox: DOMRect = null;
    let currentBox: DOMRect = null;
    let diff: number = 0;
    if (hasBotomElm) {
      elm = this.bottomElm;
      prevBox = this.bottomElmBox;
    } else if (hasTopElm) {
      elm = this.topElm;
      prevBox = this.topElmBox;
    }
    currentBox = elm.getBoundingClientRect();
    diff = prevBox.top - currentBox.top - this.scrollSpeed;
    if ((!hasTopBlank || !hasBotomBlank) && 0.5 ** 2 < diff ** 2) {
      this.panelService.scrollablePanel.scrollTop -= diff;
    }

    let logBox: DOMRect = this.logContainerRef.nativeElement.getBoundingClientRect();
    let messageBox: DOMRect = this.messageContainerRef.nativeElement.getBoundingClientRect();

    let messageBoxTop = messageBox.top - logBox.top;
    let messageBoxBottom = messageBoxTop + messageBox.height;

    let scrollPosition = this.getScrollPosition();

    hasTopBlank = scrollPosition.top < messageBoxTop;
    hasBotomBlank = messageBoxBottom < scrollPosition.bottom && scrollPosition.bottom < scrollPosition.scrollHeight;

    return { hasTopBlank, hasBotomBlank };
  }

  private markForReadIfNeeded() {
    if (!this.chatTab.hasUnread) return;

    let scrollPosition = this.getScrollPosition();
    if (scrollPosition.scrollHeight <= scrollPosition.bottom + 100) {
      setZeroTimeout(() => {
        this.chatTab.markForRead();
        this.changeDetector.markForCheck();
        this.ngZone.run(() => { });
      });
    }
  }

  onScroll() {
    this.scrollEventShortTimer.reset();
    if (!this.scrollEventLongTimer.isActive) {
      this.scrollEventLongTimer.reset();
    }
  }

  private lazyScrollUpdate(isNormalUpdate: boolean = true) {
    this.scrollEventShortTimer.stop();
    this.scrollEventLongTimer.stop();

    let chatMessageElements = this.messageContainerRef.nativeElement.querySelectorAll<HTMLElement>('chat-message');

    let messageBoxTop = this.messageContainerRef.nativeElement.offsetTop;
    let messageBoxBottom = messageBoxTop + this.messageContainerRef.nativeElement.clientHeight;

    let preTopIndex = this.topIndex;
    let preBottomIndex = this.bottomIndex;

    let scrollPosition = this.getScrollPosition();
    this.scrollSpeed = scrollPosition.top - this.preScrollTop;
    this.preScrollTop = scrollPosition.top;

    let hasTopBlank = scrollPosition.top < messageBoxTop;
    let hasBotomBlank = messageBoxBottom < scrollPosition.bottom && scrollPosition.bottom < scrollPosition.scrollHeight;

    if (!isNormalUpdate) {
      this.scrollEventShortTimer.reset();
    }

    if (!isNormalUpdate && !hasTopBlank && !hasBotomBlank) {
      return;
    }

    let scrollWideTop = scrollPosition.top - (!isNormalUpdate && hasTopBlank ? 100 : 1200);
    let scrollWideBottom = scrollPosition.bottom + (!isNormalUpdate && hasBotomBlank ? 100 : 1200);

    this.markForReadIfNeeded();
    this.calcItemIndexRange(messageBoxTop, messageBoxBottom, scrollWideTop, scrollWideBottom, scrollPosition, chatMessageElements);

    let isChangedIndex = this.topIndex != preTopIndex || this.bottomIndex != preBottomIndex;
    if (!isChangedIndex) return;

    this.needUpdate = true;

    this.topElm = chatMessageElements[0];
    this.bottomElm = chatMessageElements[chatMessageElements.length - 1];
    this.topElmBox = this.topElm.getBoundingClientRect();
    this.bottomElmBox = this.bottomElm.getBoundingClientRect();

    setZeroTimeout(() => {
      let scrollPosition = this.getScrollPosition();
      this.scrollSpeed = scrollPosition.top - this.preScrollTop;
      this.preScrollTop = scrollPosition.top;
      this.changeDetector.markForCheck();
      this.ngZone.run(() => { });
    });
  }

  private calcElementMaxHeight(chatMessageElements: NodeListOf<HTMLElement>): number {
    let maxHeight = this.minMessageHeight;
    for (let i = chatMessageElements.length - 1; 0 <= i; i--) {
      let height = chatMessageElements[i].clientHeight;
      if (maxHeight < height) maxHeight = height;
    }
    return maxHeight;
  }

  private calcItemIndexRange(messageBoxTop: number, messageBoxBottom: number, scrollWideTop: number, scrollWideBottom: number, scrollPosition: ScrollPosition, chatMessageElements: NodeListOf<HTMLElement>) {
    if (scrollWideTop >= messageBoxBottom || messageBoxTop >= scrollWideBottom) {
      let lastIndex = this.chatTab.chatMessages.length - 1;
      let scrollBottomHeight = scrollPosition.scrollHeight - scrollPosition.top - scrollPosition.clientHeight;

      this.bottomIndex = lastIndex - Math.floor(scrollBottomHeight / this.minMessageHeight);
      this.topIndex = this.bottomIndex - Math.floor(scrollPosition.clientHeight / this.minMessageHeight);

      this.bottomIndex += 1;
      this.topIndex -= 1;
    } else {
      let maxHeight = this.calcElementMaxHeight(chatMessageElements);
      if (scrollWideTop < messageBoxTop) {
        this.topIndex -= Math.floor((messageBoxTop - scrollWideTop) / maxHeight) + 1;
      } else if (scrollWideTop > messageBoxTop) {
        if (!isiOS) this.topIndex += Math.floor((scrollWideTop - messageBoxTop) / maxHeight);
      }

      if (messageBoxBottom > scrollWideBottom) {
        if (!isiOS) this.bottomIndex -= Math.floor((messageBoxBottom - scrollWideBottom) / maxHeight);
      } else if (messageBoxBottom < scrollWideBottom) {
        this.bottomIndex += Math.floor((scrollWideBottom - messageBoxBottom) / maxHeight) + 1;
      }
    }
    this.adjustIndex();
  }

  private makeSampleMessage(from: string, to: string, name: string, toName: string, text: string, tag='mine'): ChatMessage {
    let message = new ChatMessage();
    message.from = from;
    message.to = to;
    message.name = name;
    message.toName = toName;
    message.color = '#444444';
    message.toColor = toName ? '#444444' : null;
    message.tag = tag;
    message.value = text;
    return message;
  }
}
