import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ChatTab } from '@udonarium/chat-tab';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { Network, EventSystem } from '@udonarium/core/system';
import { UUID } from '@udonarium/core/system/util/uuid';
import { ChatMessageService } from 'service/chat-message.service';
import { ModalService } from 'service/modal.service';
import { PanelService } from 'service/panel.service';
import { SaveDataService } from 'service/save-data.service';

@Component({
  selector: 'app-chat-log-output',
  templateUrl: './chat-log-output.component.html',
  styleUrls: ['./chat-log-output.component.css']
})
export class ChatLogOutputComponent implements OnInit, AfterViewInit {
  @ViewChild('select', { static: false }) select: ElementRef<HTMLSelectElement>;
  
  private static isAllTabs = false;
  private static logFormat: number = 1;
  private static dateFormat: string = 'HH:mm';
  private static isWriteOerationLog: boolean = true;

  selectedTabs: ChatTab[] = [];
  panelId;

  isSaveing: boolean = false;
  progresPercent: number = 0;

  get isAllTabs(): boolean { return ChatLogOutputComponent.isAllTabs; }
  set isAllTabs(isAllTabs: boolean) { ChatLogOutputComponent.isAllTabs = isAllTabs; }

  get logFormat(): number { return ChatLogOutputComponent.logFormat; }
  set logFormat(logFormat: number) { ChatLogOutputComponent.logFormat = logFormat; }

  get dateFormat(): string { return ChatLogOutputComponent.dateFormat; }
  set dateFormat(dateFormat: string) { ChatLogOutputComponent.dateFormat = dateFormat; }

  get isWriteOerationLog(): boolean { return ChatLogOutputComponent.isWriteOerationLog; }
  set isWriteOerationLog(isWriteOerationLog: boolean) { ChatLogOutputComponent.isWriteOerationLog = isWriteOerationLog; }
  
  //get tabName(): string { return this.selectedTab.name; }
  //set tabName(tabName: string) { this.selectedTab.name = tabName; }

  get chatTabs(): ChatTab[] { return this.chatMessageService.chatTabs; }
  get isEmpty(): boolean { return this.chatMessageService.chatTabs.length < 1 }

  get isDisable(): boolean { return this.isEmpty || this.isSaveing || (!this.isAllTabs && this.selectedTabs.length === 0) }

  get roomName():string {
    let roomName = Network.peer && 0 < Network.peer.roomName.length
      ? Network.peer.roomName
      : '房間資料';
    return roomName;
  }

  constructor(
    private modalService: ModalService,
    private panelService: PanelService,
    private chatMessageService: ChatMessageService,
    private saveDataService: SaveDataService
  ) { }

  ngOnInit() {
    Promise.resolve().then(() => { this.modalService.title = this.panelService.title = '匯出聊天日誌'; this.panelService.isAbleFullScreenButton = false });
    EventSystem.register(this)
      .on('DELETE_GAME_OBJECT', 1000, event => {
        if (this.selectedTabs.length == 0 || !event.data.identifier) return;
        let object = ObjectStore.instance.get(event.data.identifier);
        if (!object) {
          this.selectedTabs = this.selectedTabs.filter(tab => tab && tab.identifier != event.data.identifier);
        }
        this.selectTabsApplay();
      });
    this.panelId = UUID.generateUuid();
  }

  ngAfterViewInit() {
    this.selectTabsApplay();
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
  }

  onChangeSelectTabs() {
    if (!this.select) return;
    this.selectedTabs = Array.from(this.select.nativeElement.options)
      .filter(option => option.selected)
      .map(elm => ObjectStore.instance.get<ChatTab>(elm.value))
      .filter(tab => tab);
  }

  selectTabsApplay() {
    if (!this.select || this.isAllTabs) return;
    const selectedTabsIdentifier = this.selectedTabs.map(tab => tab.identifier);
    Array.from(this.select.nativeElement.options).forEach(elm => {
      elm.selected = selectedTabsIdentifier.includes(elm.value);
    });
  }

  saveLog() {
    if (this.isDisable) return;
    const fileName = this.roomName + '_聊天日誌_' + (this.isAllTabs ? '全部分頁' : this.selectedTabs[0].name + (this.selectedTabs.length > 1 ? '、其他' : ''));
    const tabs = this.isAllTabs ? null : this.selectedTabs;
    this.saveDataService.saveChatLog(this.logFormat, fileName, tabs, this.dateFormat, this.isWriteOerationLog);
  }

  async saveLogWithImages() {
    if (this.isDisable) return;
    const fileName = this.roomName + '_聊天日誌含圖片_' + (this.isAllTabs ? '全部分頁' : this.selectedTabs[0].name + (this.selectedTabs.length > 1 ? '、其他' : ''));
    const tabs = this.isAllTabs ? null : this.selectedTabs;

    this.isSaveing = true;
    this.progresPercent = 0;

    await this.saveDataService.saveChatLogAsync(this.logFormat, fileName, tabs, this.dateFormat, this.isWriteOerationLog, percent => {
      this.progresPercent = percent;
    });

    setTimeout(() => {
      this.isSaveing = false;
      this.progresPercent = 0;
    }, 500);
  }
}