import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';

import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem, Network } from '@udonarium/core/system';
import { PeerContext } from '@udonarium/core/system/network/peer-context';
import { PeerSessionGrade } from '@udonarium/core/system/network/peer-session-state';
import { PeerCursor } from '@udonarium/peer-cursor';

import { FileSelecterComponent } from 'component/file-selecter/file-selecter.component';
import { LobbyComponent } from 'component/lobby/lobby.component';
import { AppConfig, AppConfigService } from 'service/app-config.service';
import { ModalService } from 'service/modal.service';
import { PanelService } from 'service/panel.service';
import { animate, style, transition, trigger } from '@angular/animations';
import { ChatMessageService } from 'service/chat-message.service';
import { ConfirmationComponent, ConfirmationType } from 'component/confirmation/confirmation.component';
import { GameCharacter } from '@udonarium/game-character';
import { ImageFile, ImageState } from '@udonarium/core/file-storage/image-file';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';

import * as localForage from 'localforage';

@Component({
  selector: 'peer-menu',
  templateUrl: './peer-menu.component.html',
  styleUrls: ['./peer-menu.component.css'],
  animations: [
    trigger('fadeInOut', [
      transition('false => true', [
        animate('50ms ease-in-out', style({ opacity: 1.0 })),
        animate('900ms ease-in-out', style({ opacity: 0 }))
      ])
    ])
  ]
})
export class PeerMenuComponent implements OnInit, OnDestroy {
  targetUserId: string = '';
  networkService = Network
  gameRoomService = ObjectStore.instance;

  isCopied = false;
  isRoomNameCopied = false;
  isPasswordCopied = false;
  isPasswordOpen = false;
  isRoomInfoCopied = false

  help: string = '';

  private _timeOutId: NodeJS.Timeout;
  private _timeOutId2: NodeJS.Timeout;
  private _timeOutId3: NodeJS.Timeout;
  private _timeOutId4: NodeJS.Timeout;

  private interval: NodeJS.Timeout;
  get myPeer(): PeerCursor { return PeerCursor.myCursor; }

  get myPeerName(): string {
    if (!PeerCursor.myCursor) return null;
    return PeerCursor.myCursor.name;
  }
  set myPeerName(name: string) {
    if (PeerCursor.myCursor) {
      PeerCursor.myCursor.name = name;
      if (PeerCursor.myCursor.name === PeerCursor.CHAT_DEFAULT_NAME) {
        localForage.removeItem(PeerCursor.CHAT_MY_NAME_LOCAL_STORAGE_KEY).catch(e => console.log(e));
      } else {
        localForage.setItem(PeerCursor.CHAT_MY_NAME_LOCAL_STORAGE_KEY, PeerCursor.myCursor.name).catch(e => console.log(e));
      }
    }
  }

  get myPeerColor(): string {
    if (!PeerCursor.myCursor) return PeerCursor.CHAT_DEFAULT_COLOR;
    return PeerCursor.myCursor.color;
  }
  set myPeerColor(color: string) {
    if (color && PeerCursor.myCursor) {
      color = color.trim().toLowerCase();
      if (!/^\#[0-9a-f]{6}$/.test(color)) return; 
      PeerCursor.myCursor.color = (color == PeerCursor.CHAT_TRANSPARENT_COLOR) ? PeerCursor.CHAT_DEFAULT_COLOR : color;
      if (PeerCursor.myCursor.color === PeerCursor.CHAT_DEFAULT_COLOR) {
        localForage.removeItem(PeerCursor.CHAT_MY_COLOR_LOCAL_STORAGE_KEY).catch(e => console.log(e));
      } else {
        localForage.setItem(PeerCursor.CHAT_MY_COLOR_LOCAL_STORAGE_KEY, PeerCursor.myCursor.color).catch(e => console.log(e));
      }
    }
  }

  get isGMMode(): boolean{ return PeerCursor.myCursor ? PeerCursor.myCursor.isGMMode : false; }
  set isGMMode(isGMMode: boolean) { if (PeerCursor.myCursor) PeerCursor.myCursor.isGMMode = isGMMode; }

  get isGMHold(): boolean { return PeerCursor.isGMHold; }
  get isDisableConnect(): boolean { return this.isGMHold || this.isGMMode; }

  get maskedPassword(): string { return '●●●●●●●●' }
  get config(): AppConfig { return AppConfigService.appConfig; }
  get canUsePrivateSession(): boolean { return this.config.backend.mode == 'skyway'; }

  constructor(
    private ngZone: NgZone,
    private modalService: ModalService,
    private panelService: PanelService,
    private chatMessageService: ChatMessageService,
    public appConfigService: AppConfigService
  ) { }

  ngOnInit() {
    Promise.resolve().then(() => { this.panelService.title = '連線資訊'; this.panelService.isAbleFullScreenButton = false });
  }

  ngAfterViewInit() {
    EventSystem.register(this)
      .on('OPEN_NETWORK', event => {
        this.ngZone.run(() => { });
      });
    this.interval = setInterval(() => { }, 1000);
  }

  ngOnDestroy() {
    clearTimeout(this._timeOutId);
    clearTimeout(this._timeOutId2);
    clearTimeout(this._timeOutId3);
    clearTimeout(this._timeOutId4);
    EventSystem.unregister(this);
    clearInterval(this.interval);
  }

  changeIcon() {
    let currentImageIdentifires: string[] = [];
    if (this.myPeer && this.myPeer.imageIdentifier) currentImageIdentifires = [this.myPeer.imageIdentifier];
    this.modalService.open<string>(FileSelecterComponent, { currentImageIdentifires: currentImageIdentifires }).then(value => {
      if (!this.myPeer || !value) return;
      this.myPeer.imageIdentifier = value;
      let file: ImageFile = ImageStorage.instance.get(value);
      if (file) {
        if (file.state === ImageState.COMPLETE) {
          localForage.setItem(PeerCursor.CHAT_MY_ICON_LOCAL_STORAGE_KEY, file.blob).catch(e => console.log(e));
        } else if (value === 'none_icon') {
          localForage.removeItem(PeerCursor.CHAT_MY_ICON_LOCAL_STORAGE_KEY).catch(e => console.log(e));
        } else {
          localForage.setItem(PeerCursor.CHAT_MY_ICON_LOCAL_STORAGE_KEY, value).catch(e => console.log(e));
        }
      }
    });
  }

  connectPeer() {
    let targetUserId = this.targetUserId;
    this.targetUserId = '';
    if (targetUserId.length < 1) return;
    this.help = '';
    let peer = PeerContext.create(targetUserId);
    if (peer.isRoom) return;
    ObjectStore.instance.clearDeleteHistory();
    Network.connect(peer);
    if (PeerCursor.isGMHold || this.isGMMode) {
      PeerCursor.isGMHold = false;
      this.isGMMode = false;
      if (this.isGMMode) {
        this.chatMessageService.sendOperationLog('解除GM模式');
        EventSystem.trigger('CHANGE_GM_MODE', null);
      }
    }
  }

  showLobby() {
    if (PeerCursor.isGMHold || this.isGMMode) {
      PeerCursor.isGMHold = false;
      this.isGMMode = false;
      if (this.isGMMode) {
        this.chatMessageService.sendOperationLog('解除GM模式');
        EventSystem.trigger('CHANGE_GM_MODE', null);
      }
    }
    this.modalService.open(LobbyComponent, { width: 700, height: 400, left: 0, top: 400 });
  }

  stringFromSessionGrade(grade: PeerSessionGrade): string {
    return PeerSessionGrade[grade] ?? PeerSessionGrade[PeerSessionGrade.UNSPECIFIED];
  }

  findUserId(peerId: string) {
    const peerCursor = PeerCursor.findByPeerId(peerId);
    return peerCursor ? peerCursor.userId : '';
  }

  findPeerName(peerId: string) {
    const peerCursor = PeerCursor.findByPeerId(peerId);
    return peerCursor ? peerCursor.name : '';
  }

  findPeerColor(peerId: string) {
    const peerCursor = PeerCursor.findByPeerId(peerId);
    return peerCursor ? peerCursor.color : '';
  }

  findPeerImageUrl(peerId: string) {
    const peerCursor = PeerCursor.findByPeerId(peerId);
    return peerCursor ? peerCursor.image.url : '';
  }

  findPeerIsGMMode(peerId: string): boolean {
    const peerCursor = PeerCursor.findByPeerId(peerId);
    return peerCursor ? peerCursor.isGMMode : false;
  }

  copyPeerId() {
    if (navigator.clipboard && this.canUsePrivateSession) {
      navigator.clipboard.writeText(this.networkService.peer.userId);
      this.isCopied = true;
      clearTimeout(this._timeOutId);
      this._timeOutId = setTimeout(() => {
        this.isCopied = false;
      }, 1000);
    }
  }

  copyRoomName() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(this.networkService.peer.roomName + '/' + this.networkService.peer.roomId);
      this.isRoomNameCopied = true;
      clearTimeout(this._timeOutId2);
      this._timeOutId2 = setTimeout(() => {
        this.isRoomNameCopied = false;
      }, 1000);
    }
  }

  copyPassword() {
    if (navigator.clipboard) {
      this.modalService.open(ConfirmationComponent, {
        title: '密碼的副本', 
        text: '確定要將密碼複製到剪貼簿嗎？',
        helpHtml: '共享密碼時，請<b>避免在SNS公開帳號等地方公開給不特定多數人</b>。',
        type: ConfirmationType.OK_CANCEL,
        materialIcon: 'content_copy',
        action: () => {
          navigator.clipboard.writeText(this.networkService.peer.password);
          this.isPasswordCopied = true;
          clearTimeout(this._timeOutId3);
          this._timeOutId3 = setTimeout(() => {
            this.isPasswordCopied = false;
          }, 1000);
        }
      });
      this.isPasswordOpen = false;
    }
  }

  copyRoomInfo() {
    if (navigator.clipboard) {
      this.modalService.open(ConfirmationComponent, {
        title: '複製房間資訊', 
        text: '確定要將房間資訊（房間名稱/房間ID、密碼）複製到剪貼簿嗎？',
        helpHtml: '共享密碼時，請<b>避免在SNS公開帳號等地方公開給不特定多數人</b>。',
        type: ConfirmationType.OK_CANCEL,
        materialIcon: 'content_copy',
        action: () => {
          navigator.clipboard.writeText('房間名稱：' + this.networkService.peer.roomName + '/' + this.networkService.peer.roomId + '  密碼：' + this.networkService.peer.password);
          this.isRoomInfoCopied = true;
          clearTimeout(this._timeOutId4);
          this._timeOutId4 = setTimeout(() => {
            this.isRoomInfoCopied = false;
          }, 1000);
        }
      });
      this.isPasswordOpen = false;
    }
  }

  isAbleClipboardCopy(): boolean {
    return navigator.clipboard ? true : false;
  }

  onPasswordOpen($event: Event) {
    if (this.isPasswordOpen) {
      this.isPasswordOpen = false;
    } else {
      $event.preventDefault();
      this.modalService.open(ConfirmationComponent, {
        title: '顯示密碼', 
        text: '確定要顯示密碼嗎？',
        helpHtml: '直播遊戲時請注意不要誤顯示密碼。<br>共享密碼時，請<b>避免在SNS公開帳號等地方公開給不特定多數人</b>。',
        type: ConfirmationType.OK_CANCEL,
        materialIcon: 'visibility',
        action: () => {
          this.isPasswordOpen = true;
          (<HTMLInputElement>$event.target).checked = true;
          //this.changeDetector.markForCheck();
        }
      });
    }
  }

  onGMMode($event: Event) {
    if (PeerCursor.isGMHold || this.isGMMode) {
      if (this.isGMMode) {
        $event.preventDefault();
        this.modalService.open(ConfirmationComponent, {
          title: '解除GM模式', 
          text: '確定要解除GM模式嗎？',
          type: ConfirmationType.OK_CANCEL,
          materialIcon: 'person_remove',
          action: () => {
            PeerCursor.isGMHold = false;
            this.isGMMode = false;
            (<HTMLInputElement>$event.target).checked = false;
            this.chatMessageService.sendOperationLog('解除GM模式');
            EventSystem.trigger('CHANGE_GM_MODE', null);
            //this.changeDetector.markForCheck();
            if (GameCharacter.isStealthMode) {
              this.modalService.open(ConfirmationComponent, {
                title: '隱身模式', 
                text: '將進入隱身模式。',
                help: '當桌面上有一個以上只有自己看見位置的角色時，你的游標位置不會傳遞給其他參加者。',
                type: ConfirmationType.OK,
                materialIcon: 'disabled_visible'
              });
            }
          }
        });
      } else {
        PeerCursor.isGMHold = false;
        this.isGMMode = false;
      }
    } else {
      $event.preventDefault();
      this.modalService.open(ConfirmationComponent, {
        title: '進入GM模式', 
        text: '確定要進入GM模式嗎？\nGM模式中（含等待中）無法從你這邊進行私人連線或連接房間。',
        helpHtml: 'GM模式下，可以看到所有<b>秘話</b>、背面的<b>牌</b>、未公開的<b>骰子符號</b>、<b>角色</b>位置及<b>游標</b>位置，你的游標位置也不會傳遞給其他參加者。\n\n<b><big>—With great power comes great responsibility.</big></b>',
        type: ConfirmationType.OK_CANCEL,
        materialIcon: 'person_add',
        action: () => {
          PeerCursor.isGMHold = true;
          this.isGMMode = false;
          (<HTMLInputElement>$event.target).checked = true;
          //this.changeDetector.markForCheck();
          this.modalService.open(ConfirmationComponent, {
            title: '進入GM模式', 
            text: '目前尚未進入GM模式。',
            helpHtml: '要進入GM模式，請從聊天發送包含 <b>成為GM</b> 或 <b>GM Mode</b> 的訊息。',
            type: ConfirmationType.OK,
            materialIcon: 'person_add'
          });
        }
      });
    }
  }

  healthIcon(helth) {
    if (helth >= 0.99) return 'sentiment_very_satisfied';
    if (helth > 0.97) return 'sentiment_dissatisfied';
    if (helth > 0.95) return 'mood_bad';
    return 'sentiment_very_dissatisfied';
  }

  healthClass(helth) {
    if (helth >= 0.99) return 'health-blue';
    if (helth > 0.97) return 'health-green';
    if (helth > 0.95) return 'health-yellow';
    return 'health-red';
  }
}
